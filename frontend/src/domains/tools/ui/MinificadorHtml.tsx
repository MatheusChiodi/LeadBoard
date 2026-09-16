import { TextTransformTool } from '../components/TextTransformTool'
import { minifyHtml } from '../lib/minifiers'

export default function MinificadorHtml() {
  return (
    <TextTransformTool
      title="Minificador de HTML"
      description="Remove espaços e comentários preservando pre e script."
      sample={'<div>\n  <p>oi     mundo</p>\n  <pre>  indentado\n  de propósito</pre>\n</div><!-- nota -->'}
      modes={[
        { id: 'minificar', label: 'Minificar HTML', run: minifyHtml },
      ]}
    />
  )
}
