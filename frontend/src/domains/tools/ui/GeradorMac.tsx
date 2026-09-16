import { GeneratorTool } from '../components/GeneratorTool'
import { generateMacAddress } from '../lib/generators'

export default function GeradorMac() {
  return (
    <GeneratorTool
      title="Gerador de MAC Address"
      description="Gera endereços MAC unicast administrados localmente, que não colidem com fabricante real."
      actionLabel="Gerar endereços"
      batch={5}
      generate={() => generateMacAddress()}
    />
  )
}
