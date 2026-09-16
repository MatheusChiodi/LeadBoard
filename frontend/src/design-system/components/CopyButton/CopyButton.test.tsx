import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CopyButton } from './CopyButton'

describe('CopyButton', () => {
  let escrito: string[]

  beforeEach(() => {
    escrito = []
    Object.assign(navigator, {
      clipboard: {
        writeText: (texto: string) => {
          escrito.push(texto)
          return Promise.resolve()
        },
      },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('copia o valor recebido', async () => {
    render(<CopyButton value="abc123" />)
    await userEvent.click(screen.getByRole('button', { name: /copiar/i }))
    expect(escrito).toEqual(['abc123'])
  })

  it('confirma a cópia para quem usa', async () => {
    render(<CopyButton value="abc123" />)
    await userEvent.click(screen.getByRole('button', { name: /copiar/i }))
    expect(await screen.findByRole('button', { name: /copiado/i })).toBeInTheDocument()
  })

  it('volta ao rótulo original depois do intervalo', async () => {
    render(<CopyButton value="abc123" resetAfterMs={50} />)
    await userEvent.click(screen.getByRole('button', { name: /copiar/i }))
    await screen.findByRole('button', { name: /copiado/i })
    await waitFor(() => expect(screen.getByRole('button', { name: /copiar/i })).toBeInTheDocument())
  })

  it('fica desabilitado sem nada para copiar', () => {
    render(<CopyButton value="" />)
    expect(screen.getByRole('button', { name: /copiar/i })).toBeDisabled()
  })

  it('avisa quem escuta que a cópia aconteceu', async () => {
    const aoCopiar = vi.fn()
    render(<CopyButton value="abc" onCopied={aoCopiar} />)
    await userEvent.click(screen.getByRole('button', { name: /copiar/i }))
    await waitFor(() => expect(aoCopiar).toHaveBeenCalledTimes(1))
  })

  it('não deixa timer pendente ao desmontar', async () => {
    // O original faz `setTimeout(() => setCopied(false), 2000)` sem cleanup:
    // fechar a janela antes dos 2s dispara setState em componente desmontado.
    const spy = vi.spyOn(globalThis, 'clearTimeout')
    const { unmount } = render(<CopyButton value="abc" />)
    await userEvent.click(screen.getByRole('button', { name: /copiar/i }))
    await screen.findByRole('button', { name: /copiado/i })
    unmount()
    expect(spy).toHaveBeenCalled()
  })

  it('informa a falha quando a área de transferência recusa', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: () => Promise.reject(new Error('sem permissão')),
      },
    })
    render(<CopyButton value="abc" />)
    await userEvent.click(screen.getByRole('button', { name: /copiar/i }))
    expect(await screen.findByRole('button', { name: /falhou/i })).toBeInTheDocument()
  })
})
