import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from './App'

test('mostra o nome do app', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Minhas Finanças' })).toBeInTheDocument()
})

test('não mostra o aviso de atualização quando não há versão nova', () => {
  render(<App />)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
