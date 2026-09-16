import { TextTransformTool } from '../components/TextTransformTool'
import { formatJson } from '../lib/data'

export default function VisualizadorJson() {
  return (
    <TextTransformTool
      title="Visualizador de JSON"
      description="Abre um JSON legível, com as chaves ordenadas."
      sample={'{"nome":"Ana","tags":["a","b"]}'}
      modes={[
        { id: 'ver', label: 'Formatar para leitura', run: (texto) => formatJson(texto, { indent: 2, sortKeys: true }) },
      ]}
    />
  )
}
