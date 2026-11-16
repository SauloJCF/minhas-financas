import { expect, test } from 'vitest'
import { centavosToInput, formatBRL, parseBRL } from './money'

test.each([
  ['1.234,56', 123456],
  ['1234,56', 123456],
  ['1234,5', 123450],
  ['1234', 123400],
  ['1.234', 123400],
  ['10.50', 1050],
  ['0', 0],
  ['-0', 0],
  ['-50', -5000],
  ['- 1.500,00', -150000],
  ['R$ 10,00', 1000],
  ['0,07', 7],
])('parseBRL lê "%s" como %i centavos', (text, centavos) => {
  expect(parseBRL(text)).toBe(centavos)
})

test.each(['', 'abc', '1,234', '1,2,3', '12,345', '--5', '1.23.4'])('parseBRL recusa "%s"', (text) => {
  expect(parseBRL(text)).toBeNull()
})

test('formatBRL mostra reais com separadores brasileiros', () => {
  expect(formatBRL(123456).replace(/\s/g, ' ')).toBe('R$ 1.234,56')
  expect(formatBRL(-5000).replace(/\s/g, ' ')).toBe('-R$ 50,00')
})

test('centavosToInput ida e volta com parseBRL', () => {
  for (const centavos of [0, 7, 1050, 123456, -150000]) {
    expect(parseBRL(centavosToInput(centavos))).toBe(centavos)
  }
})
