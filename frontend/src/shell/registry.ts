/**
 * Registro de janelas do LeadBoard — espelha, no frontend, o registry
 * de flags do backend (ver leadboard-arquitetura.md, seção 6, "Shell unificado").
 * App novo é entrada nova aqui; o WindowManager e o Dock nunca conhecem
 * o domínio por dentro, só o que está anunciado neste registro.
 */
import type { ComponentType } from 'react'

export interface WindowDefinition {
  id: string
  title: string
  component: ComponentType
}

const registry = new Map<string, WindowDefinition>()

export function registerWindow(definition: WindowDefinition): void {
  if (registry.has(definition.id)) {
    throw new Error(`Janela duplicada no registry: ${definition.id}`)
  }
  registry.set(definition.id, definition)
}

export function getWindow(id: string): WindowDefinition | undefined {
  return registry.get(id)
}

export function listWindows(): WindowDefinition[] {
  return Array.from(registry.values())
}
