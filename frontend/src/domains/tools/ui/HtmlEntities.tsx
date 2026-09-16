import { TextTransformTool } from '../components/TextTransformTool'
import { decodeHtmlEntities, encodeHtmlEntities } from '../lib/converters'

export default function HtmlEntities() {
  return (
    <TextTransformTool
      title="Entidades HTML"
      description="Escapa e desescapa entidades HTML."
      sample={'<a href="x">link & cia</a>'}
      modes={[
        { id: 'encode', label: 'Escapar', run: encodeHtmlEntities },
        { id: 'decode', label: 'Desescapar', run: decodeHtmlEntities },
      ]}
    />
  )
}
