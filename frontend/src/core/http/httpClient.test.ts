import { afterEach, describe, expect, it, vi } from 'vitest'

import { session } from '../security'
import {
  ContractError,
  ForbiddenError,
  UnauthorizedError,
  VersionConflictError,
  createDispatch,
  httpClient,
} from './httpClient'

function mockFetchOnce(status: number, body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
      clone() {
        return this
      },
    }),
  )
}

describe('httpClient.dispatch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('faz POST em /api/dispatch com o header X-Domain-Flag e o payload serializado', async () => {
    mockFetchOnce(200, { ok: true })

    await httpClient.dispatch('USER.LOGIN', { email: 'a@a.com' })

    expect(fetch).toHaveBeenCalledWith(
      '/api/dispatch',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Domain-Flag': 'USER.LOGIN',
        }),
        body: JSON.stringify({ email: 'a@a.com' }),
      }),
    )
  })

  it('resolve com o corpo tipado quando a resposta é 2xx', async () => {
    mockFetchOnce(200, { token: 'abc' })

    const result = await httpClient.dispatch<{ token: string }>('USER.LOGIN', {})

    expect(result).toEqual({ token: 'abc' })
  })

  it('lança UnauthorizedError em 401', async () => {
    mockFetchOnce(401, { detail: 'sem sessão' })

    await expect(httpClient.dispatch('USER.PROFILE', {})).rejects.toBeInstanceOf(
      UnauthorizedError,
    )
  })

  it('lança ForbiddenError em 403', async () => {
    mockFetchOnce(403, { detail: 'sem permissão' })

    await expect(httpClient.dispatch('DRAW.SHARE', {})).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('lança VersionConflictError em 409', async () => {
    mockFetchOnce(409, { detail: 'versão divergente' })

    await expect(httpClient.dispatch('DRAW.DIAGRAM', {})).rejects.toBeInstanceOf(
      VersionConflictError,
    )
  })

  it('lança ContractError em 422', async () => {
    mockFetchOnce(422, { detail: 'flag desconhecida' })

    await expect(httpClient.dispatch('USER.NAOEXISTE', {})).rejects.toBeInstanceOf(ContractError)
  })
})

describe('injeção de credencial', () => {
  function capturaRequisicao(status = 200) {
    const chamadas: RequestInit[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        chamadas.push(init)
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }),
    )
    return chamadas
  }

  it('envia Bearer quando existe token', async () => {
    const chamadas = capturaRequisicao()
    await createDispatch(() => 'abc123')('JOURNAL.ENTRY', { op: 'list' })
    const headers = chamadas[0].headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer abc123')
  })

  it('omite Authorization quando não existe token', async () => {
    const chamadas = capturaRequisicao()
    await createDispatch(() => null)('USER.LOGIN', { email: 'a@b.dev' })
    const headers = chamadas[0].headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })

  it('envia sempre a flag no header, nunca na URL', async () => {
    const chamadas = capturaRequisicao()
    await createDispatch(() => null)('JOURNAL.ENTRY', {})
    const headers = chamadas[0].headers as Record<string, string>
    expect(headers['X-Domain-Flag']).toBe('JOURNAL.ENTRY')
  })

  it('derruba a sessão quando o servidor recusa a credencial', async () => {
    capturaRequisicao(401)
    session.setToken('token-expirado')
    await expect(createDispatch(() => 'token-expirado')('JOURNAL.ENTRY', {})).rejects.toThrow(
      UnauthorizedError,
    )
    expect(session.getToken()).toBeNull()
  })
})
