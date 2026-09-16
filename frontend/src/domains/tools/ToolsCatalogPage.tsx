import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Button } from '../../design-system/components/Button'
import { Input } from '../../design-system/components/Field'
import { cn } from '../../design-system/utils/cn'
import {
  CATEGORY_LABEL,
  TOOLS,
  countByCategory,
  searchTools,
  type ToolCategory,
} from './catalog'

const CATEGORIAS = Object.keys(CATEGORY_LABEL) as ToolCategory[]
const CONTAGEM = countByCategory()

/**
 * Catálogo das ferramentas: busca e filtro por categoria.
 *
 * Busca e categoria vivem na URL (`?q=` e `?categoria=`), não em estado local.
 * Isso torna um resultado compartilhável e faz o botão voltar do navegador
 * desfazer o filtro, que é o que a pessoa espera dele.
 */
export function ToolsCatalogPage() {
  const [params, setParams] = useSearchParams()
  const termo = params.get('q') ?? ''
  const categoria = (params.get('categoria') ?? undefined) as ToolCategory | undefined

  const encontradas = useMemo(() => searchTools(termo, categoria), [termo, categoria])

  const atualizar = (chave: string, valor: string | undefined) => {
    const proximo = new URLSearchParams(params)
    if (valor === undefined || valor === '') proximo.delete(chave)
    else proximo.set(chave, valor)
    // `replace` para a busca não encher o histórico com uma entrada por tecla.
    setParams(proximo, { replace: true })
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-text md:text-3xl">Ferramentas</h1>
        <p className="text-sm text-text-muted">
          {TOOLS.length} utilitários. Tudo roda no seu navegador, exceto as três que consultam
          serviços externos.
        </p>
      </header>

      <Input
        type="search"
        aria-label="Buscar ferramenta"
        placeholder="Buscar por nome ou pelo que você precisa fazer…"
        value={termo}
        onChange={(evento) => atualizar('q', evento.target.value)}
      />

      <div className="flex flex-wrap gap-2">
        <FiltroCategoria
          ativo={categoria === undefined}
          onClick={() => atualizar('categoria', undefined)}
        >
          Todas ({TOOLS.length})
        </FiltroCategoria>
        {CATEGORIAS.map((chave) => (
          <FiltroCategoria
            key={chave}
            ativo={categoria === chave}
            onClick={() => atualizar('categoria', chave)}
          >
            {CATEGORY_LABEL[chave]} ({CONTAGEM[chave]})
          </FiltroCategoria>
        ))}
      </div>

      <p aria-live="polite" className="text-xs text-text-muted">
        {encontradas.length === 0
          ? 'Nenhuma ferramenta encontrada.'
          : `${encontradas.length} ${encontradas.length === 1 ? 'ferramenta' : 'ferramentas'}.`}
      </p>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {encontradas.map((tool) => (
          <li key={tool.id}>
            <Link
              to={`/ferramentas/${tool.id}`}
              className={cn(
                'flex h-full flex-col gap-1.5 rounded-lg border border-border bg-surface-raised p-4',
                'transition hover:border-accent focus:border-accent focus:outline-none',
                'focus:ring-2 focus:ring-accent/40',
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-text">{tool.name}</span>
                {tool.needsNetwork === true && (
                  <span
                    // O usuário merece saber, antes de colar um dado, quais das
                    // ferramentas mandam a entrada para fora da máquina.
                    title="Consulta um serviço externo"
                    className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-text-muted"
                  >
                    rede
                  </span>
                )}
              </span>
              <span className="text-xs text-text-muted">{tool.description}</span>
            </Link>
          </li>
        ))}
      </ul>

      {encontradas.length === 0 && termo !== '' && (
        <Button variant="secondary" onClick={() => setParams(new URLSearchParams())}>
          Limpar busca
        </Button>
      )}
    </section>
  )
}

function FiltroCategoria({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // `aria-pressed` comunica o estado do filtro a quem não vê a cor mudar.
      aria-pressed={ativo}
      className={cn(
        'rounded-full border px-3 py-1 text-xs transition',
        'focus:outline-none focus:ring-2 focus:ring-accent/40',
        ativo
          ? 'border-accent bg-accent text-surface'
          : 'border-border text-text-muted hover:border-accent hover:text-accent',
      )}
    >
      {children}
    </button>
  )
}
