/**
 * Guarda a sessão. Único lugar do frontend que conhece o token.
 *
 * A estratégia de persistência é injetada em vez de escolhida aqui dentro
 * porque ela é um trade-off de segurança, não um detalhe: `localStorage`
 * sobrevive ao recarregar a página mas é legível por qualquer script que entre
 * na origem; memória força novo login a cada F5 e não deixa nada para um XSS
 * roubar.
 *
 * O token fica sempre em memória também, para que uma falha de storage
 * (modo anônimo, cota, cookies bloqueados) nunca derrube a sessão em curso.
 */

const STORAGE_KEY = 'leadboard.session'

export type SessionListener = (token: string | null) => void

export interface Session {
  getToken: () => string | null
  setToken: (token: string) => void
  clear: () => void
  subscribe: (listener: SessionListener) => () => void
}

/** Persistência que não persiste: o token morre com a aba. */
export function memoryStorage(): Storage {
  const dados = new Map<string, string>()
  return {
    get length() {
      return dados.size
    },
    clear: () => dados.clear(),
    getItem: (chave) => dados.get(chave) ?? null,
    key: (indice) => [...dados.keys()][indice] ?? null,
    removeItem: (chave) => {
      dados.delete(chave)
    },
    setItem: (chave, valor) => {
      dados.set(chave, valor)
    },
  }
}

export function createSession(storage: Storage): Session {
  let token = leia(storage)
  const listeners = new Set<SessionListener>()

  const avisar = () => {
    for (const listener of listeners) listener(token)
  }

  return {
    getToken: () => token,

    setToken: (novo) => {
      token = novo
      grave(storage, novo)
      avisar()
    },

    clear: () => {
      token = null
      apague(storage)
      avisar()
    },

    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

function leia(storage: Storage): string | null {
  try {
    return storage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function grave(storage: Storage, token: string): void {
  try {
    storage.setItem(STORAGE_KEY, token)
  } catch {
    // Sessão continua válida em memória. Perder a persistência é degradação
    // aceitável; deixar a exceção subir tiraria o usuário do meio do fluxo.
  }
}

function apague(storage: Storage): void {
  try {
    storage.removeItem(STORAGE_KEY)
  } catch {
    // idem
  }
}
