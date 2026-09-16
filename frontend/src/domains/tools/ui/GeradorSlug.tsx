import { TextTransformTool } from '../components/TextTransformTool'
import { slugify } from '../lib/generators'

export default function GeradorSlug() {
  return (
    <TextTransformTool
      title="Gerador de Slug"
      description="Transforma um título em slug de URL."
      sample={"Ação e Coração: 10 dicas!"}
      rows={3}
      modes={[
        { id: 'slug', label: 'Gerar slug', run: slugify },
      ]}
    />
  )
}
