import { z } from 'zod'
import { parseBRL } from '@/lib/money'

/** O que o formulário de conta guarda: tudo texto, como foi digitado. */
export const contaSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da conta.').max(60, 'Use até 60 caracteres.'),
  tipo: z.enum(['corrente', 'poupanca', 'dinheiro', 'cartao', 'investimento']),
  saldoInicial: z.string().refine((text) => parseBRL(text) !== null, 'Informe um valor, como 1.234,56.'),
  dataSaldoInicial: z.iso.date('Informe a data.'),
  cor: z.string(),
  icone: z.string(),
})
export type ContaFormValues = z.infer<typeof contaSchema>
