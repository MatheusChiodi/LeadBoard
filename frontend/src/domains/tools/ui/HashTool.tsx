import { useEffect, useMemo, useState } from 'react'

import { CopyButton } from '../../../design-system/components/CopyButton'
import { Field, Textarea } from '../../../design-system/components/Field'
import { ToolShell } from '../components/ToolShell'
import { md5, sha256 } from '../lib/security'

export interface HashToolProps {
  algorithm: 'md5' | 'sha256'
}

const INFO = {
  md5: {
    title: 'Hash MD5',
    description:
      'Calcula o MD5 de um texto. Serve para checksum e comparação de arquivo — não use para senha: MD5 tem colisão conhecida desde 2004.',
  },
  sha256: {
    title: 'Hash SHA-256',
    description:
      'Calcula o SHA-256 de um texto usando a implementação nativa do navegador.',
  },
} as const

/**
 * Hash de texto.
 *
 * Tela própria em vez de `TextTransformTool` porque SHA-256 é assíncrono: a
 * SubtleCrypto do navegador devolve `Promise`, e forçá-la num transformador
 * síncrono exigiria trazer uma implementação própria de SHA-2 — mais código e
 * mais lenta que a nativa.
 */
export default function HashTool({ algorithm }: HashToolProps) {
  const [entrada, setEntrada] = useState('')
  const [digestAssincrono, setDigestAssincrono] = useState('')

  // MD5 é síncrono: derivar no render mantém entrada e saída sempre coerentes.
  // Passar por estado exigiria um efeito, e efeito é onde nasce o resultado que
  // não corresponde ao que está escrito na caixa.
  const digestSincrono = useMemo(
    () => (algorithm === 'md5' && entrada !== '' ? md5(entrada) : ''),
    [algorithm, entrada],
  )

  useEffect(() => {
    if (algorithm !== 'sha256' || entrada === '') return

    // Texto longo pode fazer o hash chegar fora de ordem em relação à digitação.
    // O sinal descarta o resultado de uma entrada que já não é a atual.
    let atual = true
    void sha256(entrada).then((resultado) => {
      if (atual) setDigestAssincrono(resultado)
    })
    return () => {
      atual = false
    }
  }, [entrada, algorithm])

  const saida = algorithm === 'md5' ? digestSincrono : entrada === '' ? '' : digestAssincrono
  const { title, description } = INFO[algorithm]

  return (
    <ToolShell
      title={title}
      description={description}
      result={saida === '' ? undefined : <code className="break-all font-mono">{saida}</code>}
      actions={<CopyButton value={saida} />}
    >
      <Field label="Texto">
        <Textarea
          rows={6}
          value={entrada}
          placeholder="Digite ou cole o texto…"
          onChange={(evento) => setEntrada(evento.target.value)}
        />
      </Field>
    </ToolShell>
  )
}
