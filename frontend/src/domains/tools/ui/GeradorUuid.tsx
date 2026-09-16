import { GeneratorTool } from '../components/GeneratorTool'
import { generateUuid } from '../lib/generators'

export default function GeradorUuid() {
  return (
    <GeneratorTool
      title="Gerador de UUID"
      description="Gera identificadores únicos versão 4, usando o gerador criptográfico do navegador."
      actionLabel="Gerar 5 UUIDs"
      batch={5}
      generate={generateUuid}
    />
  )
}
