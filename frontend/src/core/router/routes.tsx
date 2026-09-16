import { Suspense, createElement, lazy } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'

import { toolById, type ToolDefinition } from '../../domains/tools/catalog'
import { ToolsCatalogPage } from '../../domains/tools/ToolsCatalogPage'

/**
 * Mapa de rotas do LeadBoard.
 *
 * O roteador conhece domínios, nunca ferramentas individuais: a rota de
 * ferramenta é uma só, com parâmetro, e o catálogo diz o que carregar. No
 * projeto de origem eram 44 `<Route>` escritos à mão, e acrescentar uma
 * ferramenta significava lembrar de editar este arquivo também.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/ferramentas" replace />} />
      <Route path="/ferramentas" element={<ToolsCatalogPage />} />
      <Route path="/ferramentas/:toolId" element={<ToolRoute />} />
      <Route path="*" element={<NaoEncontrado />} />
    </Routes>
  )
}

/**
 * Cache dos componentes preguiçosos, fora do render.
 *
 * `lazy()` precisa devolver a MESMA referência entre renders: criá-lo durante o
 * render faz o React tratar cada render como um componente novo, remontando a
 * tela e jogando fora o que o usuário já tinha digitado. Um `useMemo` não
 * resolve — ele pode descartar o valor a qualquer momento, e o React é explícito
 * em que memo é dica de performance, não garantia de identidade.
 */
const telas = new Map<string, LazyExoticComponent<ComponentType>>()

function telaDe(tool: ToolDefinition): LazyExoticComponent<ComponentType> {
  const existente = telas.get(tool.id)
  if (existente !== undefined) return existente

  const criada = lazy(tool.load)
  telas.set(tool.id, criada)
  return criada
}

/** Resolve a ferramenta pelo id da URL e carrega a tela sob demanda. */
function ToolRoute() {
  const { toolId = '' } = useParams()
  const tool = toolById(toolId)

  if (tool === undefined) return <NaoEncontrado />

  // `createElement` em vez de `<Tela />`: o componente vem do catálogo em tempo
  // de execução, e a forma JSX faria a regra de componentes estáticos apontar um
  // problema que aqui não existe — a identidade já está garantida pelo cache.
  return <Suspense fallback={<Carregando />}>{createElement(telaDe(tool))}</Suspense>
}

function Carregando() {
  return (
    <p role="status" className="px-4 py-16 text-center text-sm text-text-muted">
      Carregando…
    </p>
  )
}

function NaoEncontrado() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-text">Página não encontrada</h1>
      <p className="text-sm text-text-muted">O endereço acessado não existe no LeadBoard.</p>
    </section>
  )
}
