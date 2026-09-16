import { TextTransformTool } from '../components/TextTransformTool'
import { urlDecode, urlEncode } from '../lib/converters'

export default function UrlEncode() {
  return (
    <TextTransformTool
      title="URL Encode / Decode"
      description="Codifica e decodifica componentes de URL."
      sample={"https://x.dev/?q=ação & cia"}
      modes={[
        { id: 'encode', label: 'Codificar', run: urlEncode },
        { id: 'decode', label: 'Decodificar', run: urlDecode },
      ]}
    />
  )
}
