import { TextTransformTool } from '../components/TextTransformTool'
import { changeCase, type CaseStyle } from '../lib/converters'

const ESTILOS: Array<{ id: CaseStyle; label: string }> = [
  { id: 'upper', label: 'MAIÚSCULAS' },
  { id: 'lower', label: 'minúsculas' },
  { id: 'title', label: 'Título' },
  { id: 'sentence', label: 'Sentença' },
  { id: 'camel', label: 'camelCase' },
  { id: 'pascal', label: 'PascalCase' },
  { id: 'snake', label: 'snake_case' },
  { id: 'kebab', label: 'kebab-case' },
  { id: 'constant', label: 'CONSTANT_CASE' },
  { id: 'invert', label: 'iNVERTER cAIXA' },
]

export default function ConversorTexto() {
  return (
    <TextTransformTool
      title="Conversor de Texto"
      description="Troca a caixa do texto entre dez estilos. Reconhece palavras separadas por espaço, hífen, underscore e camelCase."
      sample="minhaVariavelLonga de exemplo"
      rows={5}
      modes={ESTILOS.map(({ id, label }) => ({
        id,
        label,
        run: (texto: string) => changeCase(texto, id),
      }))}
    />
  )
}
