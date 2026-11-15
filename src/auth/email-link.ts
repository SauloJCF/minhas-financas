const SET_PASSWORD_PATH = '/definir-senha'

/**
 * Leva os links dos e-mails padrão do Supabase para a tela de definir senha.
 *
 * O e-mail padrão de convite/recuperação devolve a pessoa à Site URL com o resultado
 * no fragmento: `#access_token=…&type=invite` ou `#error_code=otp_expired`. Aqui só
 * trocamos o caminho; o fragmento com a sessão fica intacto para o supabase-js ler.
 * Precisa rodar antes de o cliente Supabase e o roteador serem criados.
 */
export function routeEmailLink(
  location: Pick<Location, 'pathname' | 'hash'> = window.location,
  history: Pick<History, 'replaceState'> = window.history,
): void {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''))

  if (hash.has('error_code') || hash.has('error')) {
    history.replaceState(null, '', `${SET_PASSWORD_PATH}?erro=link`)
    return
  }

  const type = hash.get('type')
  if ((type === 'invite' || type === 'recovery') && hash.has('access_token')) {
    history.replaceState(null, '', `${SET_PASSWORD_PATH}?type=${type}${location.hash}`)
  }
}
