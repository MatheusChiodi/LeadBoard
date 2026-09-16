import { TextTransformTool } from '../components/TextTransformTool'
import { encodeBase64 } from '../lib/converters'

export default function Base64Encode() {
  return (
    <TextTransformTool
      title="Base64 Encode"
      description="Codifica texto em Base64, com suporte a acento e emoji."
      sample={"ação é coração 🚀"}
      modes={[
        { id: 'encode', label: 'Codificar para Base64', run: encodeBase64 },
      ]}
    />
  )
}
