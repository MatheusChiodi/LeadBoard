import { TextTransformTool } from '../components/TextTransformTool'
import { jsonToYaml, yamlToJson } from '../lib/data'

export default function JsonYaml() {
  return (
    <TextTransformTool
      title="Conversor JSON ↔ YAML"
      description="Converte entre JSON e YAML nos dois sentidos."
      sample={'{"servico":"api","portas":[80,443]}'}
      modes={[
        { id: 'json-yaml', label: 'JSON para YAML', run: jsonToYaml },
        { id: 'yaml-json', label: 'YAML para JSON', run: (texto) => yamlToJson(texto) },
      ]}
    />
  )
}
