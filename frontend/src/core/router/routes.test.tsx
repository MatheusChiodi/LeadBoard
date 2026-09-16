import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { AppRoutes } from './routes'

function abrir(rota: string) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

describe('rotas', () => {
  it('manda a raiz para o catálogo', async () => {
    abrir('/')
    expect(await screen.findByRole('heading', { name: 'Ferramentas' })).toBeInTheDocument()
  })

  it('lista as 44 ferramentas no catálogo', async () => {
    abrir('/ferramentas')
    await screen.findByRole('heading', { name: 'Ferramentas' })
    expect(screen.getAllByRole('link', { name: /.+/ }).length).toBeGreaterThanOrEqual(44)
  })

  it('carrega a tela de uma ferramenta pelo id da URL', async () => {
    abrir('/ferramentas/gerador-uuid')
    expect(
      await screen.findByRole('heading', { name: 'Gerador de UUID' }),
    ).toBeInTheDocument()
  })

  it('carrega outra ferramenta pela mesma rota', async () => {
    abrir('/ferramentas/formatador-json')
    expect(
      await screen.findByRole('heading', { name: 'Formatador de JSON' }),
    ).toBeInTheDocument()
  })

  it('mostra não encontrado para ferramenta inexistente', async () => {
    abrir('/ferramentas/nao-existe')
    expect(
      await screen.findByRole('heading', { name: /não encontrada/i }),
    ).toBeInTheDocument()
  })

  it('mostra não encontrado para rota desconhecida', async () => {
    abrir('/rota/que/nao/existe')
    expect(
      await screen.findByRole('heading', { name: /não encontrada/i }),
    ).toBeInTheDocument()
  })

  it('avisa quando a ferramenta ainda não foi portada', async () => {
    abrir('/ferramentas/gerador-qrcode')
    expect(await screen.findByRole('heading', { name: /em migração/i })).toBeInTheDocument()
  })
})

describe('catálogo', () => {
  it('filtra pela busca', async () => {
    abrir('/ferramentas')
    await screen.findByRole('heading', { name: 'Ferramentas' })

    await userEvent.type(screen.getByLabelText('Buscar ferramenta'), 'uuid')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Gerador de UUID/ })).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /Minificador de CSS/ })).not.toBeInTheDocument()
    })
  })

  it('acha por sinônimo, não só pelo nome', async () => {
    abrir('/ferramentas')
    await screen.findByRole('heading', { name: 'Ferramentas' })

    await userEvent.type(screen.getByLabelText('Buscar ferramenta'), 'guid')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Gerador de UUID/ })).toBeInTheDocument()
    })
  })

  it('filtra por categoria', async () => {
    abrir('/ferramentas')
    await screen.findByRole('heading', { name: 'Ferramentas' })

    await userEvent.click(screen.getByRole('button', { name: /^Rede/ }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Rede/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      expect(screen.queryByRole('link', { name: /Gerador de UUID/ })).not.toBeInTheDocument()
    })
  })

  it('respeita a busca que veio na URL', async () => {
    // Filtro na URL é o que torna um resultado compartilhável.
    abrir('/ferramentas?q=json')
    await screen.findByRole('heading', { name: 'Ferramentas' })
    expect(screen.getByLabelText('Buscar ferramenta')).toHaveValue('json')
    expect(screen.queryByRole('link', { name: /Gerador de UUID/ })).not.toBeInTheDocument()
  })

  it('avisa quando a busca não acha nada', async () => {
    abrir('/ferramentas?q=xyzabc')
    expect(await screen.findByText(/Nenhuma ferramenta encontrada/)).toBeInTheDocument()
  })

  it('marca as ferramentas que saem para a rede', async () => {
    abrir('/ferramentas?categoria=rede')
    await screen.findByRole('heading', { name: 'Ferramentas' })
    // Duas das três de rede; a terceira (CEP) está em documentos.
    expect(screen.getAllByTitle('Consulta um serviço externo')).toHaveLength(2)
  })
})

describe('uma ferramenta de ponta a ponta', () => {
  it('gera, mostra e permite copiar', async () => {
    abrir('/ferramentas/gerador-uuid')
    await screen.findByRole('heading', { name: 'Gerador de UUID' })

    expect(screen.getByRole('button', { name: /copiar/i })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: /Gerar 5 UUIDs/ }))

    const itens = await screen.findAllByText(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
    expect(itens).toHaveLength(5)
    expect(screen.getByRole('button', { name: /copiar/i })).toBeEnabled()
  })

  it('transforma a entrada e reporta erro de sintaxe', async () => {
    abrir('/ferramentas/formatador-json')
    await screen.findByRole('heading', { name: 'Formatador de JSON' })

    const entrada = screen.getByLabelText('Entrada')
    await userEvent.type(entrada, '{{"a":1}')
    expect(await screen.findByText(/"a": 1/)).toBeInTheDocument()

    await userEvent.clear(entrada)
    await userEvent.type(entrada, '{{')
    expect(await screen.findByRole('alert')).toHaveTextContent(/JSON inválido/)
  })

  it('carrega o exemplo quando pedido', async () => {
    abrir('/ferramentas/formatador-json')
    await screen.findByRole('heading', { name: 'Formatador de JSON' })

    await userEvent.click(screen.getByRole('button', { name: 'Usar exemplo' }))
    expect(screen.getByLabelText('Entrada')).not.toHaveValue('')
  })
})
