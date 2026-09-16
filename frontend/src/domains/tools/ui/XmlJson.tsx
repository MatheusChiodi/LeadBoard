import { TextTransformTool } from '../components/TextTransformTool'
import { xmlToJson } from '../lib/data'

export default function XmlJson() {
  return (
    <TextTransformTool
      title="Conversor XML → JSON"
      description="Converte XML em JSON, recusando XML malformado."
      sample={'<config><porta>8000</porta><debug>true</debug></config>'}
      modes={[
        { id: 'xml-json', label: 'XML para JSON', run: (texto) => xmlToJson(texto) },
      ]}
    />
  )
}
