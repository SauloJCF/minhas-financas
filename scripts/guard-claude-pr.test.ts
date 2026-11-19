// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { checkPr, stripSql } from './guard-claude-pr.ts'

const migration = (sql: string) => ({ path: 'supabase/migrations/20261201000000_x.sql', sql })

const check = (sql: string, tests: string[] = []) =>
  checkPr({
    files: ['supabase/migrations/20261201000000_x.sql'],
    migrations: [migration(sql)],
    tests: tests.map((t, i) => ({ path: `supabase/tests/t${i}.test.sql`, sql: t })),
  })

describe('caminhos proibidos', () => {
  it.each([
    '.github/workflows/ci.yml',
    'supabase/functions/tickets/core.ts',
    'package.json',
    'package-lock.json',
    'src/auth/AuthProvider.tsx',
    'src/pages/Login.tsx',
    'src/pages/SetPassword.tsx',
    'src/components/NewPasswordForm.tsx',
    'supabase/templates/invite.html',
    'supabase/config.toml',
    'scripts/guard-claude-pr.ts',
    'docs/adr/0011-edge-function-para-tickets.md',
    'docs/agents/escopo-do-agente.md',
  ])('reprova %s', (file) => {
    const problems = checkPr({ files: [file], migrations: [], tests: [] })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain(file)
  })

  it('aceita telas, testes e GLOSSARY', () => {
    const files = ['src/pages/Dashboard.tsx', 'src/dashboard.test.tsx', 'GLOSSARY.md', 'src/pages/Profile.tsx']
    expect(checkPr({ files, migrations: [], tests: [] })).toEqual([])
  })
})

describe('migrations', () => {
  it('aceita coluna nova com índice', () => {
    expect(check('alter table public.accounts add column note text;\ncreate index on public.accounts (note);')).toEqual([])
  })

  it.each([
    ['drop table public.accounts;', 'DROP'],
    ['alter table public.accounts drop column note;', 'DROP'],
    ['truncate public.accounts;', 'TRUNCATE'],
    ['delete from public.accounts;', 'DELETE'],
    ['alter table public.accounts disable row level security;', 'DISABLE ROW LEVEL SECURITY'],
    ['create function public.f() returns int language sql security definer as $$ select 1 $$;', 'SECURITY DEFINER'],
    ['create or replace function public.f() returns int language sql as $$ select 1 $$;', 'CREATE FUNCTION'],
    ['create trigger t before insert on public.accounts for each row execute function public.f();', 'CREATE TRIGGER'],
  ])('reprova %s', (sql, label) => {
    expect(check(sql).some((p) => p.includes(label))).toBe(true)
  })

  it('ignora comentários e textos que citam os comandos', () => {
    const sql = "-- nunca drop table\n/* delete from x */\ncomment on table public.accounts is 'drop table, truncate';"
    expect(check(sql)).toEqual([])
    expect(stripSql(sql)).not.toMatch(/drop|truncate|delete/i)
  })

  it('a política "for delete" não é DELETE', () => {
    const sql = 'create policy p on public.accounts for delete to authenticated using (user_id = auth.uid());'
    expect(check(sql)).toEqual([])
  })

  describe('grant', () => {
    it('aceita o padrão do projeto', () => {
      expect(check('revoke all on public.accounts from anon;\ngrant select, insert on public.accounts to authenticated;')).toEqual([])
    })
    it.each([
      'grant select on public.accounts to anon;',
      'grant all on public.accounts to authenticated, service_role;',
      'grant select on public.accounts to public;',
      'grant execute on function public.f() to authenticated;',
      'grant usage on schema public to authenticated;',
    ])('reprova %s', (sql) => {
      expect(check(sql).some((p) => p.includes('GRANT'))).toBe(true)
    })
  })

  describe('views', () => {
    it('aceita com security_invoker', () => {
      expect(check('create view public.v with (security_invoker = true) as select 1;')).toEqual([])
    })
    it('reprova sem security_invoker', () => {
      expect(check('create view public.v as select 1;')).toEqual(['supabase/migrations/20261201000000_x.sql: view sem security_invoker = true'])
    })
    it('reprova com security_invoker = false', () => {
      expect(check('create or replace view public.v with (security_invoker = false) as select 1;')).toHaveLength(1)
    })
  })

  describe('tabela nova', () => {
    const table = `create table public.notes (id uuid primary key, user_id uuid not null);
      alter table public.notes enable row level security;`

    it('aceita com RLS e teste que a cita', () => {
      expect(check(table, ["select ok((select relrowsecurity from pg_class where oid = 'public.notes'::regclass));"])).toEqual([])
    })
    it('reprova sem RLS', () => {
      const problems = check('create table public.notes (id uuid primary key);', ['select 1 from public.notes;'])
      expect(problems).toEqual(['supabase/migrations/20261201000000_x.sql: tabela notes sem ENABLE ROW LEVEL SECURITY'])
    })
    it('reprova sem teste pgTAP', () => {
      const problems = check(table, ['select 1 from public.accounts;'])
      expect(problems).toEqual(['supabase/migrations/20261201000000_x.sql: tabela notes sem teste pgTAP em supabase/tests/ nesta PR'])
    })
    it('reprova sem nenhum teste na PR', () => {
      expect(check(table)).toHaveLength(1)
    })
    it('o nome da tabela é palavra inteira: "notes_old" no teste não vale', () => {
      expect(check(table, ['select 1 from public.notes_old;'])).toHaveLength(1)
    })
  })

  it('junta os problemas de várias migrations', () => {
    const problems = checkPr({
      files: ['.github/workflows/x.yml'],
      migrations: [migration('drop table a;'), { path: 'supabase/migrations/2.sql', sql: 'truncate b;' }],
      tests: [],
    })
    expect(problems).toHaveLength(3)
  })
})
