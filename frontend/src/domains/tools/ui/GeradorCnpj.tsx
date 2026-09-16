import { GeneratorTool } from '../components/GeneratorTool'
import { generateCnpj } from '../lib/generators'

export default function GeradorCnpj() {
  return (
    <GeneratorTool
      title="Gerador de CNPJ"
      description="Gera CNPJs com dígito verificador válido, para teste. Nunca corresponde a empresa real."
      actionLabel="Gerar CNPJs"
      batch={5}
      generate={() => generateCnpj({ masked: true })}
    />
  )
}
