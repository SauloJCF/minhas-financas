import { expect, test } from 'vitest'
import { addMonths, formatDate, formatMonth, isMonth, monthRange } from './dates'

test('addMonths atravessa a virada do ano nos dois sentidos', () => {
  expect(addMonths('2026-11', 1)).toBe('2026-12')
  expect(addMonths('2026-12', 1)).toBe('2027-01')
  expect(addMonths('2026-01', -1)).toBe('2025-12')
  expect(addMonths('2026-03', -14)).toBe('2025-01')
})

test('monthRange dá o primeiro e o último dia do mês', () => {
  expect(monthRange('2026-11')).toEqual({ first: '2026-11-01', last: '2026-11-30' })
  expect(monthRange('2026-02')).toEqual({ first: '2026-02-01', last: '2026-02-28' })
  expect(monthRange('2028-02')).toEqual({ first: '2028-02-01', last: '2028-02-29' })
})

test('formatMonth e formatDate escrevem em português', () => {
  expect(formatMonth('2026-11')).toBe('novembro de 2026')
  expect(formatDate('2026-11-16')).toBe('16/11/2026')
})

test('isMonth só aceita ano e mês válidos', () => {
  expect(isMonth('2026-11')).toBe(true)
  expect(isMonth('2026-13')).toBe(false)
  expect(isMonth('2026-11-01')).toBe(false)
  expect(isMonth(null)).toBe(false)
})
