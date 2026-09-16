import clsx, { type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Junta classes resolvendo conflito do Tailwind.
 *
 * `clsx` monta a lista e `twMerge` desempata: sem ele, passar `className="p-8"`
 * para um componente que já tem `p-4` deixa as duas na marcação e o vencedor
 * passa a ser a ordem no CSS gerado, não a intenção de quem chamou.
 */
export function cn(...valores: ClassValue[]): string {
  return twMerge(clsx(valores))
}
