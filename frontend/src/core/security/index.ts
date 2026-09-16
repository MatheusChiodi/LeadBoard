/**
 * Sessão da aplicação.
 *
 * A escolha de `localStorage` é deliberada e tem um custo conhecido: qualquer
 * script que entre na origem consegue ler o token. Ela se justifica porque o
 * LeadBoard é um shell de janelas que o usuário mantém aberto e recarrega o dia
 * inteiro — exigir novo login a cada F5 tornaria o produto inutilizável.
 *
 * A contrapartida é que o XSS passa a ser a superfície crítica: por isso o
 * design system não renderiza HTML de terceiro e nada no app usa
 * `dangerouslySetInnerHTML`. Trocar para `memoryStorage()` é uma linha, se a
 * decisão mudar.
 */

import { createSession, memoryStorage } from './session'

export type { Session, SessionListener } from './session'
export { createSession, memoryStorage }

export const session = createSession(
  typeof window === 'undefined' ? memoryStorage() : window.localStorage,
)
