const MESSAGES: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  weak_password: 'Senha fraca. Use pelo menos 8 caracteres.',
  same_password: 'A nova senha precisa ser diferente da atual.',
  otp_expired: 'Este link expirou ou já foi usado. Peça um novo.',
  over_email_send_rate_limit: 'Muitos e-mails enviados. Tente de novo em alguns minutos.',
  over_request_rate_limit: 'Muitas tentativas. Tente de novo em alguns minutos.',
  user_banned: 'Este usuário está bloqueado.',
}

/** Traduz um erro do Supabase Auth para uma mensagem que o usuário entende. */
export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code
  if (code && MESSAGES[code]) return MESSAGES[code]
  return 'Não foi possível concluir. Verifique sua conexão e tente de novo.'
}
