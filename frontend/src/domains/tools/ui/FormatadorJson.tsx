import { TextTransformTool } from '../components/TextTransformTool'
import { formatJson, minifyJson } from '../lib/data'

export default function FormatadorJson() {
  return (
    <TextTransformTool
      title="Formatador de JSON"
      description="Valida, indenta e ordena JSON."
      sample={'{"b":2,"a":{"z":1,"y":[3,2,1]}}'}
      modes={[
        { id: 'indentar', label: 'Indentar', run: (texto) => formatJson(texto) },
        { id: 'ordenar', label: 'Indentar e ordenar chaves', run: (texto) => formatJson(texto, { sortKeys: true }) },
        { id: 'minificar', label: 'Minificar', run: minifyJson },
      ]}
    />
  )
}
