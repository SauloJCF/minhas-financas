import { screen, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { db } from '@/test/fake-supabase'
import { renderAt } from '@/test/render'

vi.mock('@/lib/supabase', () => import('@/test/fake-supabase'))

function category(overrides: Record<string, unknown>) {
  return { id: 'category-x', name: 'Categoria', type: 'expense', color: '#059669', icon: 'ellipsis', archived: false, ...overrides }
}

beforeEach(() => {
  db.reset()
  db.tables.categories = [
    category({ id: 'food', name: 'Alimentação', icon: 'utensils' }),
    category({ id: 'salary', name: 'Salário', type: 'income', icon: 'briefcase' }),
  ]
})

test('a lista separa categorias de despesa e de receita', async () => {
  db.tables.categories.push(category({ id: 'old', name: 'Antiga', archived: true }))
  renderAt('/categorias')

  const expenses = (await screen.findByRole('heading', { name: 'Despesas' })).closest('section')!
  expect(within(expenses).getByRole('link', { name: /Alimentação/ })).toBeInTheDocument()
  expect(within(expenses).queryByText('Salário')).not.toBeInTheDocument()
  expect(within(expenses).queryByText('Antiga')).not.toBeInTheDocument()

  const incomes = screen.getByRole('heading', { name: 'Receitas' }).closest('section')!
  expect(within(incomes).getByRole('link', { name: /Salário/ })).toBeInTheDocument()

  expect(screen.getByText('Arquivadas (1)')).toBeInTheDocument()
})

test('criar categoria de receita', async () => {
  const user = renderAt('/categorias')
  await user.click(await screen.findByRole('link', { name: 'Nova categoria' }))

  await user.click(screen.getByRole('radio', { name: 'Receita' }))
  await user.type(screen.getByLabelText('Nome'), 'Freelas')
  await user.click(screen.getByRole('radio', { name: 'Roxo' }))
  await user.click(screen.getByRole('radio', { name: 'Moedas' }))
  await user.click(screen.getByRole('button', { name: 'Criar categoria' }))

  const incomes = (await screen.findByRole('heading', { name: 'Receitas' })).closest('section')!
  expect(await within(incomes).findByRole('link', { name: /Freelas/ })).toBeInTheDocument()
  expect(db.tables.categories.at(-1)).toMatchObject({
    name: 'Freelas',
    type: 'income',
    color: '#9333ea',
    icon: 'coins',
  })
})

test('criar categoria exige nome', async () => {
  const user = renderAt('/categorias/nova')
  await user.click(await screen.findByRole('button', { name: 'Criar categoria' }))
  expect(await screen.findByText('Informe o nome da categoria.')).toBeInTheDocument()
  expect(db.tables.categories).toHaveLength(2)
})

test('editar categoria muda o nome, mas não oferece trocar o tipo', async () => {
  const user = renderAt('/categorias/food')
  const name = await screen.findByLabelText('Nome')
  expect(name).toHaveValue('Alimentação')
  expect(screen.getByText(/Categoria de despesa/)).toBeInTheDocument()
  expect(screen.queryByRole('radio', { name: 'Receita' })).not.toBeInTheDocument()

  await user.clear(name)
  await user.type(name, 'Mercado')
  await user.click(screen.getByRole('button', { name: 'Salvar' }))

  expect(await screen.findByRole('link', { name: /Mercado/ })).toBeInTheDocument()
  expect(db.tables.categories[0]).toMatchObject({ id: 'food', name: 'Mercado', type: 'expense' })
})

test('arquivar tira a categoria da lista principal', async () => {
  const user = renderAt('/categorias/food')
  await user.click(await screen.findByRole('button', { name: 'Arquivar' }))

  expect(await screen.findByText('Arquivadas (1)')).toBeInTheDocument()
  expect(screen.getByText('Nenhuma categoria de despesa.')).toBeInTheDocument()
  expect(db.tables.categories[0]).toMatchObject({ archived: true })
})

test('excluir categoria sem uso, depois de confirmar', async () => {
  const user = renderAt('/categorias/food')
  await user.click(await screen.findByRole('button', { name: 'Excluir' }))
  await user.click(screen.getByRole('button', { name: 'Sim, excluir' }))

  expect(await screen.findByRole('heading', { name: 'Categorias' })).toBeInTheDocument()
  expect(db.tables.categories.map((row) => row.id)).toEqual(['salary'])
})

test('categoria em uso não é excluída: o app manda arquivar', async () => {
  db.errors['delete:categories'] = { code: '23503' }
  const user = renderAt('/categorias/food')
  await user.click(await screen.findByRole('button', { name: 'Excluir' }))
  await user.click(screen.getByRole('button', { name: 'Sim, excluir' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('não pode ser excluída. Arquive-a.')
  expect(db.tables.categories).toHaveLength(2)
})

test('categoria de despesa aceita um limite mensal; a de receita não tem o campo', async () => {
  const user = renderAt('/categorias/nova')
  const limit = await screen.findByLabelText('Limite mensal (R$, opcional)')
  await user.click(screen.getByRole('radio', { name: 'Receita' }))
  expect(screen.queryByLabelText('Limite mensal (R$, opcional)')).not.toBeInTheDocument()
  expect(limit).not.toBeInTheDocument()

  await user.click(screen.getByRole('radio', { name: 'Despesa' }))
  await user.type(screen.getByLabelText('Nome'), 'Pets')
  await user.type(screen.getByLabelText('Limite mensal (R$, opcional)'), '0')
  await user.click(screen.getByRole('button', { name: 'Criar categoria' }))
  expect(await screen.findByText('Informe um valor maior que zero, ou deixe em branco.')).toBeInTheDocument()

  await user.clear(screen.getByLabelText('Limite mensal (R$, opcional)'))
  await user.type(screen.getByLabelText('Limite mensal (R$, opcional)'), '150')
  await user.click(screen.getByRole('button', { name: 'Criar categoria' }))

  expect(await screen.findByRole('link', { name: /Pets/ })).toBeInTheDocument()
  expect(db.tables.categories.at(-1)).toMatchObject({ name: 'Pets', type: 'expense', monthly_budget: 15000 })
})

test('editar altera e remove o limite mensal', async () => {
  db.tables.categories[0].monthly_budget = 80000
  const user = renderAt('/categorias/food')
  const limit = await screen.findByLabelText('Limite mensal (R$, opcional)')
  expect(limit).toHaveValue('800,00')

  await user.clear(limit)
  await user.type(limit, '950,50')
  await user.click(screen.getByRole('button', { name: 'Salvar' }))
  await screen.findByRole('heading', { name: 'Categorias' })
  expect(db.tables.categories[0]).toMatchObject({ id: 'food', monthly_budget: 95050 })

  await user.click(screen.getByRole('link', { name: /Alimentação/ }))
  await user.clear(await screen.findByLabelText('Limite mensal (R$, opcional)'))
  await user.click(screen.getByRole('button', { name: 'Salvar' }))
  await screen.findByRole('heading', { name: 'Categorias' })
  expect(db.tables.categories[0]).toMatchObject({ id: 'food', monthly_budget: null })
})
