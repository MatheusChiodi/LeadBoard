import { useMemo, useState } from 'react'

import { Button } from '../../../design-system/components/Button'
import { CopyButton } from '../../../design-system/components/CopyButton'
import { Field, Select, Textarea } from '../../../design-system/components/Field'
import { ToolShell } from './ToolShell'

/**
 * Ferramenta de "texto entra, texto sai".
 *
 * Cobre a maior parte do catálogo — base64, URL, entidades HTML, slug, caixa,
 * JSON/YAML/XML/CSV, minificadores — porque todas têm a mesma forma: uma entrada,
 * uma transformação, uma saída e um botão copiar.
 *
 * É a regra 7 levada a sério: em vez de 20 arquivos com o mesmo esqueleto e
 * cores próprias, uma variante por configuração.
 */
export interface TextTransformMode {
  id: string
  label: string
  /** Lança `Error` com mensagem em português quando a entrada não serve. */
  run: (entrada: string) => string
  placeholder?: string
}

export interface TextTransformToolProps {
  title: string
  description: string
  modes: TextTransformMode[]
  /** Exemplo carregado pelo botão "Usar exemplo". */
  sample?: string
  rows?: number
}

export function TextTransformTool({
  title,
  description,
  modes,
  sample,
  rows = 8,
}: TextTransformToolProps) {
  const [entrada, setEntrada] = useState('')
  const [modoId, setModoId] = useState(modes[0].id)

  const modo = modes.find((item) => item.id === modoId) ?? modes[0]

  // A transformação roda no render, derivada da entrada — sem `useEffect` e sem
  // estado espelho, que é onde nasce o resultado dessincronizado do texto.
  const { saida, erro } = useMemo(() => {
    if (entrada.trim() === '') return { saida: '', erro: undefined }
    try {
      return { saida: modo.run(entrada), erro: undefined }
    } catch (falha) {
      return { saida: '', erro: (falha as Error).message }
    }
  }, [entrada, modo])

  return (
    <ToolShell
      title={title}
      description={description}
      error={erro}
      result={
        saida === '' ? undefined : (
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap font-mono text-xs">
            {saida}
          </pre>
        )
      }
      actions={
        <>
          <CopyButton value={saida} />
          <Button variant="ghost" onClick={() => setEntrada('')} disabled={entrada === ''}>
            Limpar
          </Button>
          {sample !== undefined && (
            <Button variant="ghost" onClick={() => setEntrada(sample)}>
              Usar exemplo
            </Button>
          )}
        </>
      }
    >
      {modes.length > 1 && (
        <Field label="Operação">
          <Select value={modoId} onChange={(evento) => setModoId(evento.target.value)}>
            {modes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="Entrada">
        <Textarea
          rows={rows}
          value={entrada}
          placeholder={modo.placeholder}
          onChange={(evento) => setEntrada(evento.target.value)}
        />
      </Field>
    </ToolShell>
  )
}
