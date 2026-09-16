import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Field, Input, Select, Textarea } from '.'

describe('Field', () => {
  it('liga o rótulo ao controle', async () => {
    render(
      <Field label="Nome">
        <Input />
      </Field>,
    )
    // Buscar por rótulo só funciona se o `for`/`id` estiverem ligados — que é a
    // mesma ligação de que o leitor de tela depende.
    await userEvent.type(screen.getByLabelText('Nome'), 'Ana')
    expect(screen.getByLabelText('Nome')).toHaveValue('Ana')
  })

  it('mostra a dica quando não há erro', () => {
    render(
      <Field label="CEP" hint="Só números">
        <Input />
      </Field>,
    )
    expect(screen.getByText('Só números')).toBeInTheDocument()
  })

  it('troca a dica pelo erro', () => {
    render(
      <Field label="CEP" hint="Só números" error="CEP inválido">
        <Input />
      </Field>,
    )
    expect(screen.getByText('CEP inválido')).toBeInTheDocument()
    expect(screen.queryByText('Só números')).not.toBeInTheDocument()
  })

  it('anuncia o erro como alerta', () => {
    render(
      <Field label="CEP" error="CEP inválido">
        <Input />
      </Field>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('CEP inválido')
  })

  it('marca o controle como inválido', () => {
    render(
      <Field label="CEP" error="ruim">
        <Input />
      </Field>,
    )
    expect(screen.getByLabelText('CEP')).toHaveAttribute('aria-invalid', 'true')
  })

  it('associa a mensagem ao controle por aria-describedby', () => {
    render(
      <Field label="CEP" error="ruim">
        <Input />
      </Field>,
    )
    const controle = screen.getByLabelText('CEP')
    const descricao = controle.getAttribute('aria-describedby')
    expect(descricao).toBeTruthy()
    expect(document.getElementById(descricao ?? '')).toHaveTextContent('ruim')
  })

  it('marca visualmente o campo obrigatório', () => {
    render(
      <Field label="Nome" required>
        <Input />
      </Field>,
    )
    expect(screen.getByLabelText(/Nome/)).toBeRequired()
  })
})

describe('Input', () => {
  it('encaminha o que o usuário digita', async () => {
    const aoMudar = vi.fn()
    render(<Input aria-label="teste" onChange={aoMudar} />)
    await userEvent.type(screen.getByLabelText('teste'), 'a')
    expect(aoMudar).toHaveBeenCalled()
  })

  it('respeita desabilitado', async () => {
    render(<Input aria-label="teste" disabled />)
    await userEvent.type(screen.getByLabelText('teste'), 'a')
    expect(screen.getByLabelText('teste')).toHaveValue('')
  })
})

describe('Textarea', () => {
  it('aceita texto de várias linhas', async () => {
    render(<Textarea aria-label="corpo" />)
    await userEvent.type(screen.getByLabelText('corpo'), 'a{enter}b')
    expect(screen.getByLabelText('corpo')).toHaveValue('a\nb')
  })
})

describe('Select', () => {
  it('lista e escolhe as opções', async () => {
    render(
      <Select aria-label="bandeira" defaultValue="visa">
        <option value="visa">Visa</option>
        <option value="amex">Amex</option>
      </Select>,
    )
    await userEvent.selectOptions(screen.getByLabelText('bandeira'), 'amex')
    expect(screen.getByLabelText('bandeira')).toHaveValue('amex')
  })
})
