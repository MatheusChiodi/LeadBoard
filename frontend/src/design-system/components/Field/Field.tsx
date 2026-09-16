import {
  cloneElement,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

import { cn } from '../../utils/cn'

/**
 * Controles de formulário do design system.
 *
 * Nenhum define cor, espaçamento ou raio literal: tudo sai dos tokens. É o que
 * permite trocar o tema inteiro sem abrir um único componente de domínio.
 */
const CONTROLE_BASE = cn(
  'w-full rounded-md border bg-surface-raised px-3 py-2 text-sm text-text',
  'border-border placeholder:text-text-muted',
  'focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40',
  'disabled:cursor-not-allowed disabled:opacity-50',
  'aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/40',
)

export type InputProps = InputHTMLAttributes<HTMLInputElement>
export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>
export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export function Input({ className, ...props }: InputProps) {
  return <input {...props} className={cn(CONTROLE_BASE, className)} />
}

export function Textarea({ className, rows = 6, ...props }: TextareaProps) {
  return <textarea {...props} rows={rows} className={cn(CONTROLE_BASE, 'font-mono', className)} />
}

export function Select({ className, ...props }: SelectProps) {
  return <select {...props} className={cn(CONTROLE_BASE, className)} />
}

export interface FieldProps {
  label: string
  /** Texto de apoio. Some quando há erro — dois textos disputando atenção viram nenhum. */
  hint?: string
  error?: string
  required?: boolean
  children: ReactElement
}

/**
 * Rótulo, dica e erro em volta de um controle.
 *
 * Faz a ligação acessível sozinho — `id`, `htmlFor`, `aria-invalid` e
 * `aria-describedby`. Deixar isso a cargo de quem usa significa que metade dos
 * formulários vai esquecer, e o esquecimento é invisível para quem enxerga.
 */
export function Field({ label, hint, error, required, children }: FieldProps) {
  const gerado = useId()
  const controleId = `${gerado}-controle`
  const mensagemId = `${gerado}-mensagem`
  const temErro = error !== undefined && error !== ''
  const mensagem = temErro ? error : hint

  const controle = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id: controleId,
        required,
        'aria-invalid': temErro ? true : undefined,
        'aria-describedby': mensagem === undefined ? undefined : mensagemId,
      })
    : children

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={controleId} className="text-sm font-medium text-text">
        {label}
        {required === true && (
          <span aria-hidden="true" className="ml-0.5 text-danger">
            *
          </span>
        )}
      </label>

      {controle}

      {mensagem !== undefined && (
        <p
          id={mensagemId}
          // `role="alert"` só no erro: anunciar a dica interromperia a leitura
          // de quem está navegando pelo formulário sem nada de errado.
          role={temErro ? 'alert' : undefined}
          className={cn('text-xs', temErro ? 'text-danger' : 'text-text-muted')}
        >
          {mensagem}
        </p>
      )}
    </div>
  )
}
