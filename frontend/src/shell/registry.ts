/**
 * Registro de janelas do LeadBoard.
 *
 * Espelha no frontend exatamente o que o registry de flags faz no backend: app
 * novo é entrada nova no registro, sem tocar no shell. O `data/apps.jsx` do
 * Focus original tinha só `{ id, icon, name, component }` e nenhuma noção de
 * tamanho, posição ou singleton — tudo ficava hardcoded dentro do `MacWindow`.
 *
 * CONTRATO COMPARTILHADO: o shell consome este arquivo; cada domínio contribui
 * suas entradas. Quem implementa um app preenche `WindowDefinition` e mais nada
 * do shell precisa mudar.
 */

import type { ComponentType } from 'react'

export interface WindowSize {
  width: number
  height: number
}

export interface WindowDefinition {
  /** Chave única e estável: vira chave de persistência do estado da janela. */
  id: string
  title: string
  /** Nome do ícone lucide-react, resolvido pelo Dock. Nunca um elemento JSX. */
  icon: string
  /** Domínio dono, para agrupar no Dock e para telemetria por caso de uso. */
  domain: 'tools' | 'draw' | 'focus' | 'journal' | 'user'
  /** Carregada sob demanda: abrir o app é que paga o custo do bundle dele. */
  load: () => Promise<{ default: ComponentType }>
  defaultSize?: WindowSize
  minSize?: WindowSize
  /** `true` impede duas instâncias da mesma janela (ex.: configurações). */
  singleton?: boolean
  resizable?: boolean
}

export const DEFAULT_WINDOW_SIZE: WindowSize = { width: 900, height: 560 }
export const DEFAULT_MIN_SIZE: WindowSize = { width: 360, height: 240 }

/**
 * Janelas registradas.
 *
 * Cada domínio exporta suas definições e elas são concatenadas aqui. Manter a
 * lista neste arquivo, e não espalhada, é o que permite ao Dock e ao
 * WindowManager existirem sem conhecer domínio nenhum.
 */
const registro: WindowDefinition[] = []

export function registerWindows(...definicoes: WindowDefinition[]): void {
  for (const definicao of definicoes) {
    if (registro.some((existente) => existente.id === definicao.id)) {
      // Mesma regra do registry de flags do backend: duplicata explode no boot,
      // nunca vira uma janela que abre a errada em produção.
      throw new Error(`Janela "${definicao.id}" registrada mais de uma vez.`)
    }
    registro.push(definicao)
  }
}

export function allWindows(): readonly WindowDefinition[] {
  return registro
}

export function windowById(id: string): WindowDefinition | undefined {
  return registro.find((definicao) => definicao.id === id)
}

/** Só para teste: devolve o registro ao estado vazio entre casos. */
export function resetRegistry(): void {
  registro.length = 0
}
