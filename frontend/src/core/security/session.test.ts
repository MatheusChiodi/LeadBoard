import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSession, memoryStorage } from './session'

describe('session', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('começa sem token', () => {
    expect(createSession(memoryStorage()).getToken()).toBeNull()
  })

  it('guarda e devolve o token', () => {
    const session = createSession(memoryStorage())
    session.setToken('abc123')
    expect(session.getToken()).toBe('abc123')
  })

  it('limpa o token ao encerrar', () => {
    const session = createSession(memoryStorage())
    session.setToken('abc123')
    session.clear()
    expect(session.getToken()).toBeNull()
  })

  it('avisa quem observa quando a sessão muda', () => {
    const session = createSession(memoryStorage())
    const observador = vi.fn()
    session.subscribe(observador)

    session.setToken('abc123')
    session.clear()

    expect(observador).toHaveBeenCalledTimes(2)
    expect(observador).toHaveBeenLastCalledWith(null)
  })

  it('para de avisar depois do unsubscribe', () => {
    const session = createSession(memoryStorage())
    const observador = vi.fn()
    session.subscribe(observador)()

    session.setToken('abc123')

    expect(observador).not.toHaveBeenCalled()
  })

  it('sobrevive a recarregar a página quando persiste no navegador', () => {
    createSession(window.localStorage).setToken('abc123')
    expect(createSession(window.localStorage).getToken()).toBe('abc123')
  })

  it('não sobrevive a recarregar a página quando fica só em memória', () => {
    createSession(memoryStorage()).setToken('abc123')
    expect(createSession(memoryStorage()).getToken()).toBeNull()
  })

  it('sobrevive a um storage que lança', () => {
    // Modo anônimo, cota estourada e cookies bloqueados fazem localStorage
    // lançar. Sessão que quebra a aplicação nesse caso é pior que sessão que
    // não persiste.
    const quebrado: Storage = {
      ...window.localStorage,
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('bloqueado')
      },
    }
    const session = createSession(quebrado)
    expect(() => session.setToken('abc123')).not.toThrow()
    expect(session.getToken()).toBe('abc123')
  })
})
