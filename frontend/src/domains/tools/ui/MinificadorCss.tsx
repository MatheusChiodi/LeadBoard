import { TextTransformTool } from '../components/TextTransformTool'
import { minifyCss } from '../lib/minifiers'

export default function MinificadorCss() {
  return (
    <TextTransformTool
      title="Minificador de CSS"
      description="Remove espaços e comentários preservando strings."
      sample={'/* tema */\na , b  {  color : red ; }\n.aviso { content: "mantém   o   espaço" }'}
      modes={[
        { id: 'minificar', label: 'Minificar CSS', run: minifyCss },
      ]}
    />
  )
}
