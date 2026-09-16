/**
 * Único ponto do frontend que conhece a rota do backend.
 * Nenhuma tela monta URL — toda chamada passa por `dispatch`
 * com a flag `DOMINIO.SUBDOMINIO` (ver leadboard-arquitetura.md, seção 3).
 */

import { session } from '../security'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

/** Injetável para teste; em produção é sempre a sessão da aplicação. */
export type TokenProvider = () => string | null

export class UnauthorizedError extends Error {
  constructor(message = 'Sessão inválida ou ausente.') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Sem permissão para executar esta ação.') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export class VersionConflictError extends Error {
  constructor(message = 'A versão enviada diverge da versão atual.') {
    super(message)
    this.name = 'VersionConflictError'
  }
}

export class ContractError extends Error {
  constructor(message = 'Contrato inválido: flag ou payload rejeitados.') {
    super(message)
    this.name = 'ContractError'
  }
}

async function readErrorMessage(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.clone().json()
    if (body && typeof body === 'object' && 'detail' in body) {
      return String((body as { detail: unknown }).detail)
    }
  } catch {
    // corpo não é JSON — segue com a mensagem padrão de cada erro
  }
  return undefined
}

export function createDispatch(getToken: TokenProvider) {
  return async function dispatch<TOut>(flag: string, payload: unknown): Promise<TOut> {
    const token = getToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Domain-Flag': flag,
    }
    // O App Security exige Bearer em toda flag que não seja pública. Sem esta
    // injeção, USER.LOGIN funcionaria e todo o resto do produto devolveria 401.
    if (token !== null) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(`${BASE_URL}/dispatch`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    if (response.ok) {
      return (await response.json()) as TOut
    }

    const message = await readErrorMessage(response)

    switch (response.status) {
      case 401:
        // Token expirado ou revogado: derrubar a sessão aqui evita que a
        // aplicação siga com credencial morta, pedindo 401 em cada tela.
        session.clear()
        throw new UnauthorizedError(message)
      case 403:
        throw new ForbiddenError(message)
      case 409:
        throw new VersionConflictError(message)
      case 422:
        throw new ContractError(message)
      default:
        throw new Error(message ?? `Falha inesperada do servidor (${response.status}).`)
    }
  }
}

export const httpClient = { dispatch: createDispatch(() => session.getToken()) }
