import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Button } from './Button'

describe('Button', () => {
  it('renderiza com o texto e o papel acessível de botão', () => {
    render(<Button>Confirmar</Button>)

    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument()
  })

  it('dispara onClick ao ser clicado', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Salvar</Button>)

    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('fica desabilitado e não dispara onClick quando disabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Enviar
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Enviar' })
    expect(button).toBeDisabled()

    await user.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('fica desabilitado e sinaliza aria-busy quando isLoading', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Button isLoading onClick={onClick}>
        Processando
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Processando' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')

    await user.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})
