import { useCallback, useEffect, useRef, useState } from 'react'

import { Button, type ButtonProps } from '../Button'

type Estado = 'ocioso' | 'copiado' | 'falhou'

const ROTULO: Record<Estado, string> = {
  ocioso: 'Copiar',
  copiado: 'Copiado',
  falhou: 'Falhou',
}

export interface CopyButtonProps extends Omit<ButtonProps, 'onCopy' | 'children' | 'value'> {
  /** Texto que vai para a área de transferência. Vazio desabilita o botão. */
  value: string
  /** Quanto tempo o rótulo de confirmação fica na tela. */
  resetAfterMs?: number
  onCopied?: () => void
}

/**
 * Copiar-para-a-área-de-transferência existe UMA vez no produto.
 *
 * As 43 ferramentas do Tools repetiam este mesmo par `copied` + `setTimeout`,
 * cada uma com sua cor literal e nenhuma com cleanup — fechar a janela antes do
 * timer disparava `setState` em componente desmontado. Concentrar aqui resolve o
 * vazamento em todas de uma vez e mantém o comportamento idêntico entre elas.
 */
export function CopyButton({
  value,
  resetAfterMs = 2000,
  onCopied,
  variant = 'secondary',
  disabled,
  ...props
}: CopyButtonProps) {
  const [estado, setEstado] = useState<Estado>('ocioso')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const limpar = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  // O cleanup que faltava no original.
  useEffect(() => limpar, [limpar])

  const copiar = useCallback(async () => {
    limpar()
    try {
      await navigator.clipboard.writeText(value)
      setEstado('copiado')
      onCopied?.()
    } catch {
      // Área de transferência recusa fora de contexto seguro e quando o usuário
      // nega a permissão. Silenciar deixaria o botão parecendo que funcionou.
      setEstado('falhou')
    }
    timer.current = setTimeout(() => setEstado('ocioso'), resetAfterMs)
  }, [limpar, onCopied, resetAfterMs, value])

  return (
    <Button
      {...props}
      variant={estado === 'falhou' ? 'danger' : variant}
      disabled={disabled ?? value.length === 0}
      onClick={() => void copiar()}
      // Leitor de tela anuncia a confirmação sem precisar mover o foco.
      aria-live="polite"
    >
      {ROTULO[estado]}
    </Button>
  )
}
