import { GeneratorTool } from '../components/GeneratorTool'
import { generateCpf } from '../lib/generators'

export default function GeradorCpf() {
  return (
    <GeneratorTool
      title="Gerador de CPF"
      description="Gera CPFs com dígito verificador válido, para teste. Nunca corresponde a pessoa real."
      actionLabel="Gerar CPFs"
      batch={5}
      generate={() => generateCpf({ masked: true })}
    />
  )
}
