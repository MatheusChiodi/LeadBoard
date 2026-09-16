import { useMemo, useState } from 'react'

import { Field, Textarea } from '../../../design-system/components/Field'
import { ToolShell } from '../components/ToolShell'
import { decodeJwt, type JwtParts } from '../lib/security'

export default function JwtDecoder() {
  const [token, setToken] = useState('')

  const { partes, erro } = useMemo(() => {
    if (token.trim() === '') return { partes: undefined, erro: undefined }
    try {
      return { partes: decodeJwt(token), erro: undefined }
    } catch (falha) {
      return { partes: undefined, erro: (falha as Error).message }
    }
  }, [token])

  return (
    <ToolShell
      title="Decodificador de JWT"
      description="Lê o cabeçalho e o payload de um token. Não verifica a assinatura — isso exige o segredo, que não existe no navegador."
      error={erro}
      result={partes === undefined ? undefined : <Resultado partes={partes} />}
    >
      <Field
        label="Token"
        hint="O conteúdo de um JWT é apenas base64: qualquer pessoa consegue lê-lo. Não cole um token de produção aqui."
      >
        <Textarea
          rows={5}
          value={token}
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
          onChange={(evento) => setToken(evento.target.value)}
        />
      </Field>
    </ToolShell>
  )
}

function Resultado({ partes }: { partes: JwtParts }) {
  return (
    <div className="flex flex-col gap-4">
      <Bloco titulo="Cabeçalho" valor={partes.header} />
      <Bloco titulo="Payload" valor={partes.payload} />

      <div className="flex flex-col gap-1 text-xs text-text-muted">
        {partes.issuedAt !== undefined && <p>Emitido em {partes.issuedAt.toLocaleString()}</p>}
        {partes.expiresAt !== undefined && (
          <p className={partes.expired === true ? 'text-danger' : undefined}>
            {partes.expired === true ? 'Expirou em ' : 'Expira em '}
            {partes.expiresAt.toLocaleString()}
          </p>
        )}
        <p>
          Assinatura presente, <strong className="text-text">não verificada</strong>. Um token
          forjado é lido aqui exatamente como um legítimo.
        </p>
      </div>
    </div>
  )
}

function Bloco({ titulo, valor }: { titulo: string; valor: Record<string, unknown> }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">{titulo}</h2>
      <pre className="overflow-auto rounded-md bg-surface p-3 font-mono text-xs text-text">
        {JSON.stringify(valor, null, 2)}
      </pre>
    </div>
  )
}
