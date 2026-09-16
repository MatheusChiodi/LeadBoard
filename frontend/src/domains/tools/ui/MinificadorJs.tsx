import { TextTransformTool } from '../components/TextTransformTool'
import { minifyJs } from '../lib/minifiers'

export default function MinificadorJs() {
  return (
    <TextTransformTool
      title="Minificador de JS"
      description="Remove espaços e comentários sem quebrar strings nem regex."
      sample={'const url = "https://x.dev" // nao pode ser cortado'}
      modes={[
        { id: 'minificar', label: 'Minificar JavaScript', run: minifyJs },
      ]}
    />
  )
}
