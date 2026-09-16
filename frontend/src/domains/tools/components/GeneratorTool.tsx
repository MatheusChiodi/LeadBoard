import { useState, type ReactNode } from 'react'

import { Button } from '../../../design-system/components/Button'
import { CopyButton } from '../../../design-system/components/CopyButton'
import { ToolShell } from './ToolShell'

/**
 * Ferramenta de "clica e sai um valor".
 *
 * Cobre UUID, CPF, CNPJ, senha, MAC, lorem e cartão. Todas têm a mesma forma:
 * opções, um botão que gera, um resultado e um botão copiar — e no projeto de
 * origem cada uma reescrevia esse esqueleto inteiro.
 */
export interface GeneratorToolProps {
  title: string
  description: string
  /** Lança `Error` quando as opções escolhidas são incompatíveis. */
  generate: () => string
  /** Controles de opção da ferramenta. */
  options?: ReactNode
  /** Rótulo do botão principal. */
  actionLabel?: string
  /** Quantos valores gerar de uma vez, quando a ferramenta permitir. */
  batch?: number
}

export function GeneratorTool({
  title,
  description,
  generate,
  options,
  actionLabel = 'Gerar',
  batch = 1,
}: GeneratorToolProps) {
  const [valores, setValores] = useState<string[]>([])
  const [erro, setErro] = useState<string | undefined>(undefined)

  const gerar = () => {
    try {
      setValores(Array.from({ length: batch }, generate))
      setErro(undefined)
    } catch (falha) {
      // Opções incompatíveis (senha curta demais para os conjuntos pedidos, por
      // exemplo) precisam aparecer na tela, não sumir no console.
      setValores([])
      setErro((falha as Error).message)
    }
  }

  return (
    <ToolShell
      title={title}
      description={description}
      error={erro}
      result={
        valores.length === 0 ? undefined : (
          <ul className="flex flex-col gap-1 font-mono text-sm">
            {valores.map((valor, indice) => (
              <li key={`${valor}-${indice}`} className="break-all">
                {valor}
              </li>
            ))}
          </ul>
        )
      }
      actions={
        <>
          <Button onClick={gerar}>{actionLabel}</Button>
          <CopyButton value={valores.join('\n')} />
        </>
      }
    >
      {options}
    </ToolShell>
  )
}
