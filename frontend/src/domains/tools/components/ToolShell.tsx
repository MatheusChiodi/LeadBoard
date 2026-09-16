import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

import { cn } from '../../../design-system/utils/cn'

/**
 * Moldura comum a toda ferramenta.
 *
 * No projeto de origem este bloco — título, descrição, caixa de resultado, botão
 * copiar e botão voltar — estava copiado em 44 arquivos, cada um com sua cor
 * literal. Aqui ele existe uma vez, e cada ferramenta vira composição: o que
 * sobra no arquivo dela é a lógica e os controles que só ela tem.
 */
export interface ToolShellProps {
  title: string
  description: string
  /** Controles da ferramenta: entradas, botões, opções. */
  children: ReactNode
  /** Resultado. Fica numa região anunciada a leitores de tela quando muda. */
  result?: ReactNode
  /** Mensagem de erro da própria ferramenta (entrada inválida, por exemplo). */
  error?: string
  actions?: ReactNode
}

export function ToolShell({
  title,
  description,
  children,
  result,
  error,
  actions,
}: ToolShellProps) {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-text md:text-3xl">{title}</h1>
        <p className="text-sm text-text-muted">{description}</p>
      </header>

      <div className="flex flex-col gap-4">{children}</div>

      {error !== undefined && error !== '' && (
        <p
          role="alert"
          className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {result !== undefined && (
        <div
          // `polite` porque o resultado costuma aparecer logo após uma ação do
          // usuário: `assertive` cortaria a fala em curso sem necessidade.
          aria-live="polite"
          className={cn(
            'rounded-lg border border-border bg-surface-raised p-4',
            'break-words text-sm text-text',
          )}
        >
          {result}
        </div>
      )}

      {actions !== undefined && <div className="flex flex-wrap gap-3">{actions}</div>}

      <Link
        to="/ferramentas"
        className="text-sm text-text-muted underline-offset-4 hover:text-accent hover:underline"
      >
        ← Voltar para as ferramentas
      </Link>
    </section>
  )
}
