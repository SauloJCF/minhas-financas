import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { db } from '@/test/fake-supabase'
import { brl, renderAt } from '@/test/render'

vi.mock('@/lib/supabase', () => import('@/test/fake-supabase'))

beforeEach(() => {
  db.reset()
  db.tables.accounts = [
    {
      id: 'nubank',
      name: 'Nubank',
      type: 'corrente',
      initial_balance: 123456,
      initial_balance_date: '2026-11-01',
      color: '#059669',
      icon: 'landmark',
      archived: false,
    },
  ]
})

test('ocultar valores troca os saldos pela máscara e mostrar traz de volta', async () => {
  const user = renderAt('/')
  const balances = (await screen.findByRole('heading', { name: 'Saldo total' })).closest('section')!
  await waitFor(() => expect(balances).toHaveTextContent(brl(123456)))

  // O app tem a barra do celular e o menu do desktop: um botão em cada, os dois ligados ao mesmo estado.
  const [button] = screen.getAllByRole('button', { name: 'Ocultar valores' })
  expect(button).toHaveAttribute('aria-pressed', 'false')
  await user.click(button)

  expect(balances).not.toHaveTextContent('1.234,56')
  expect(balances).toHaveTextContent('R$ •••••')
  expect(within(balances).getAllByText('valor oculto').length).toBeGreaterThan(0)

  const [show] = screen.getAllByRole('button', { name: 'Mostrar valores' })
  expect(show).toHaveAttribute('aria-pressed', 'true')
  await user.click(show)
  expect(balances).toHaveTextContent(brl(123456))
})

test('a escolha fica guardada no aparelho', async () => {
  const user = renderAt('/')
  await user.click((await screen.findAllByRole('button', { name: 'Ocultar valores' }))[0])
  expect(localStorage.getItem('valores-ocultos')).toBe('1')
})
