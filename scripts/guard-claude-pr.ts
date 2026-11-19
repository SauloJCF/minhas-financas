// Trava das PRs abertas pelo agente (branch `claude/…`): confere o que dá para checar
// mecanicamente das regras de docs/agents/escopo-do-agente.md. A contagem de colunas e a
// regra "é bug ou não" ficam com o prompt e com a revisão do administrador.
//
// Uso no CI: node scripts/guard-claude-pr.ts origin/main
// Roda direto pelo Node, sem build (tipos apagados), como o servidor MCP.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export type Migration = { path: string; sql: string }
export type TestFile = { path: string; sql: string }

// Caminhos que o agente nunca altera.
const FORBIDDEN_PATHS: { test: (path: string) => boolean; reason: string }[] = [
  { test: (p) => p.startsWith('.github/'), reason: '.github/ (workflows)' },
  { test: (p) => p.startsWith('supabase/functions/'), reason: 'supabase/functions/ (Edge Functions)' },
  { test: (p) => p === 'package.json' || p === 'package-lock.json', reason: 'dependências (package.json e lockfile)' },
  {
    test: (p) =>
      p.startsWith('src/auth/') ||
      p.startsWith('supabase/templates/') ||
      p === 'supabase/config.toml' ||
      /^src\/pages\/(Login|ForgotPassword|SetPassword)\.tsx$/.test(p) ||
      p === 'src/components/NewPasswordForm.tsx',
    reason: 'autenticação, convite e senha',
  },
  { test: (p) => p.startsWith('scripts/'), reason: 'scripts/ (inclui esta trava)' },
  { test: (p) => p.startsWith('docs/adr/'), reason: 'ADRs' },
  { test: (p) => p.startsWith('docs/agents/'), reason: 'regras do agente (docs/agents/)' },
]

// Comandos que o agente não escreve numa migration. `GRANT` fica de fora da lista simples:
// toda tabela precisa de `GRANT … TO authenticated` neste projeto, então só se proíbe o
// que amplia o acesso além disso (ver `grantProblem`).
const FORBIDDEN_SQL: { pattern: RegExp; label: string }[] = [
  { pattern: /\bdrop\s+(table|column|schema|view|policy|index|constraint|type)\b/i, label: 'DROP' },
  { pattern: /\btruncate\b/i, label: 'TRUNCATE' },
  { pattern: /\bdelete\s+from\b/i, label: 'DELETE' },
  { pattern: /\bdisable\s+row\s+level\s+security\b/i, label: 'DISABLE ROW LEVEL SECURITY' },
  { pattern: /\bno\s+force\s+row\s+level\s+security\b/i, label: 'NO FORCE ROW LEVEL SECURITY' },
  { pattern: /\bsecurity\s+definer\b/i, label: 'SECURITY DEFINER' },
  { pattern: /\bcreate\s+(or\s+replace\s+)?function\b/i, label: 'CREATE FUNCTION' },
  { pattern: /\bcreate\s+(or\s+replace\s+)?(constraint\s+)?trigger\b/i, label: 'CREATE TRIGGER' },
]

// Tira comentários e o conteúdo de strings, para que `-- não use DROP` ou 'drop' não reprovem.
export function stripSql(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''")
}

// Divide em comandos; `$$…$$` não é tratado: função já é proibida e o resto não os usa.
function statements(sql: string): string[] {
  return stripSql(sql)
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
}

function grantProblem(statement: string): string | null {
  if (!/^grant\b/i.test(statement)) return null
  if (/\bon\s+(function|procedure|routine|sequence|schema|all|database)\b/i.test(statement)) {
    return 'GRANT em função, sequência ou schema'
  }
  // `grant select on public.x to authenticated` é o padrão do projeto; o resto, não.
  const to = /\bto\s+(.+)$/i.exec(statement.replace(/\s+/g, ' '))?.[1] ?? ''
  const roles = to.split(',').map((r) => r.trim().toLowerCase())
  if (roles.length === 0 || roles.some((r) => r !== 'authenticated')) {
    return 'GRANT para outro papel além de authenticated'
  }
  return null
}

function migrationProblems({ path, sql }: Migration, tests: TestFile[]): string[] {
  const problems: string[] = []
  const clean = stripSql(sql)

  for (const { pattern, label } of FORBIDDEN_SQL) {
    if (pattern.test(clean)) problems.push(`${path}: ${label} não é permitido ao agente`)
  }
  for (const statement of statements(sql)) {
    const problem = grantProblem(statement)
    if (problem) problems.push(`${path}: ${problem}`)
  }

  // Toda view com security_invoker (a view respeita o RLS de quem consulta).
  const views = clean.match(/create\s+(?:or\s+replace\s+)?(?:materialized\s+)?view\s+[^;]*?\bas\b/gi) ?? []
  for (const view of views) {
    if (!/security_invoker\s*=\s*(true|on)\b/i.test(view)) {
      problems.push(`${path}: view sem security_invoker = true`)
    }
  }

  // Tabela nova: RLS ligado na mesma migration e um teste pgTAP que a mencione.
  const created = [...clean.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?/gi)].map(
    (m) => m[1].toLowerCase(),
  )
  for (const table of created) {
    const rls = new RegExp(
      `alter\\s+table\\s+(?:only\\s+)?(?:public\\.)?"?${table}"?\\s+enable\\s+row\\s+level\\s+security`,
      'i',
    )
    if (!rls.test(clean)) problems.push(`${path}: tabela ${table} sem ENABLE ROW LEVEL SECURITY`)
    const mention = new RegExp(`\\b${table}\\b`, 'i')
    if (!tests.some((t) => mention.test(t.sql))) {
      problems.push(`${path}: tabela ${table} sem teste pgTAP em supabase/tests/ nesta PR`)
    }
  }

  return problems
}

// `files`: tudo o que a PR muda. `migrations`: as migrations NOVAS (adicionadas pela PR) com o
// conteúdo. `tests`: os arquivos de supabase/tests/ que a PR adiciona ou altera, com o conteúdo.
export function checkPr(input: { files: string[]; migrations: Migration[]; tests: TestFile[] }): string[] {
  const problems: string[] = []
  for (const file of input.files) {
    const forbidden = FORBIDDEN_PATHS.find((rule) => rule.test(file))
    if (forbidden) problems.push(`${file}: o agente não altera ${forbidden.reason}`)
  }
  for (const migration of input.migrations) problems.push(...migrationProblems(migration, input.tests))
  return problems
}

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function lines(text: string): string[] {
  return text ? text.split('\n') : []
}

function main(base: string) {
  const range = `${base}...HEAD`
  const files = lines(git('diff', '--name-only', range))
  const added = lines(git('diff', '--name-only', '--diff-filter=A', range))
  const migrations = added
    .filter((f) => /^supabase\/migrations\/.+\.sql$/.test(f))
    .map((path) => ({ path, sql: readFileSync(path, 'utf8') }))
  const tests = files
    .filter((f) => /^supabase\/tests\/.+\.sql$/.test(f))
    .map((path) => ({ path, sql: readFileSync(path, 'utf8') }))

  const problems = checkPr({ files, migrations, tests })
  if (problems.length === 0) {
    console.log('Trava do agente: nada fora do escopo mecânico.')
    return
  }
  for (const problem of problems) console.log(`::error::${problem}`)
  console.error(`\nTrava do agente: ${problems.length} problema(s). Ver docs/agents/escopo-do-agente.md.`)
  process.exit(1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2] ?? 'origin/main')
}
