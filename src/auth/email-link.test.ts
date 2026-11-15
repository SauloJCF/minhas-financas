import { expect, test, vi } from 'vitest'
import { routeEmailLink } from './email-link'

function run(pathname: string, hash: string) {
  const replaceState = vi.fn()
  routeEmailLink({ pathname, hash }, { replaceState })
  return replaceState
}

test('convite padrão vai para definir senha, mantendo a sessão no fragmento', () => {
  const hash = '#access_token=abc&refresh_token=def&type=invite'
  expect(run('/', hash)).toHaveBeenCalledWith(null, '', `/definir-senha?type=invite${hash}`)
})

test('recuperação padrão vai para definir senha', () => {
  const hash = '#access_token=abc&refresh_token=def&type=recovery'
  expect(run('/', hash)).toHaveBeenCalledWith(null, '', `/definir-senha?type=recovery${hash}`)
})

test('link expirado vai para a tela de erro, sem o fragmento', () => {
  const hash = '#error=access_denied&error_code=otp_expired&error_description=expired'
  expect(run('/', hash)).toHaveBeenCalledWith(null, '', '/definir-senha?erro=link')
})

test('navegação comum não é alterada', () => {
  expect(run('/conta', '')).not.toHaveBeenCalled()
  expect(run('/', '#secao')).not.toHaveBeenCalled()
  // Sem token não é link de e-mail: não deixa forjar a tela com um fragmento solto.
  expect(run('/', '#type=invite')).not.toHaveBeenCalled()
})
