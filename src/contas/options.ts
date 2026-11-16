import {
  Banknote,
  Briefcase,
  Coins,
  CreditCard,
  Landmark,
  PiggyBank,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { Database } from '@/lib/database.types'

export type TipoConta = Database['public']['Enums']['tipo_conta']

/** Tipos de conta, na ordem em que agrupam a lista. O ícone é a sugestão ao criar. */
export const TIPOS_CONTA = [
  { value: 'corrente', label: 'Conta corrente', plural: 'Contas correntes', icone: 'landmark' },
  { value: 'poupanca', label: 'Poupança', plural: 'Poupanças', icone: 'piggy-bank' },
  { value: 'dinheiro', label: 'Dinheiro', plural: 'Dinheiro', icone: 'wallet' },
  { value: 'cartao', label: 'Cartão', plural: 'Cartões', icone: 'credit-card' },
  { value: 'investimento', label: 'Investimento', plural: 'Investimentos', icone: 'trending-up' },
] as const satisfies readonly { value: TipoConta; label: string; plural: string; icone: string }[]

/** Cores oferecidas no formulário; o banco guarda o hexadecimal. */
export const CORES_CONTA = [
  { value: '#059669', label: 'Verde' },
  { value: '#0284c7', label: 'Azul' },
  { value: '#4f46e5', label: 'Anil' },
  { value: '#9333ea', label: 'Roxo' },
  { value: '#db2777', label: 'Rosa' },
  { value: '#dc2626', label: 'Vermelho' },
  { value: '#ea580c', label: 'Laranja' },
  { value: '#475569', label: 'Cinza' },
] as const

/** Ícones oferecidos no formulário; o banco guarda a chave. */
export const ICONES_CONTA: Record<string, { label: string; Icon: LucideIcon }> = {
  landmark: { label: 'Banco', Icon: Landmark },
  'piggy-bank': { label: 'Cofrinho', Icon: PiggyBank },
  wallet: { label: 'Carteira', Icon: Wallet },
  'credit-card': { label: 'Cartão', Icon: CreditCard },
  'trending-up': { label: 'Gráfico', Icon: TrendingUp },
  banknote: { label: 'Cédula', Icon: Banknote },
  coins: { label: 'Moedas', Icon: Coins },
  briefcase: { label: 'Maleta', Icon: Briefcase },
}

export const ICONE_RESERVA = Wallet
