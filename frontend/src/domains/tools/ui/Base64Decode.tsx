import { TextTransformTool } from '../components/TextTransformTool'
import { decodeBase64 } from '../lib/converters'

export default function Base64Decode() {
  return (
    <TextTransformTool
      title="Base64 Decode"
      description="Decodifica uma string Base64 de volta para texto."
      sample={'YcOnw6NvIGUgZW1vamkg8J+agA=='}
      modes={[
        { id: 'decode', label: 'Decodificar de Base64', run: decodeBase64 },
      ]}
    />
  )
}
