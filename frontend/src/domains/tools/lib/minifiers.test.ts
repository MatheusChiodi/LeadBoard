import { describe, expect, it } from 'vitest'

import { minifyCss, minifyHtml, minifyJs } from './minifiers'

describe('minifyCss', () => {
  it('remove comentários', () => {
    expect(minifyCss('/* nota */ a { color: red; }')).toBe('a{color:red}')
  })

  it('remove espaços em volta dos separadores', () => {
    expect(minifyCss('a , b  {  color : red ; }')).toBe('a,b{color:red}')
  })

  it('remove o último ponto e vírgula do bloco', () => {
    expect(minifyCss('a{color:red;}')).toBe('a{color:red}')
  })

  it('preserva espaço dentro de string', () => {
    expect(minifyCss('a{content:"oi   mundo"}')).toBe('a{content:"oi   mundo"}')
  })

  it('preserva o que parece comentário dentro de string', () => {
    expect(minifyCss('a{content:"/* nao e comentario */"}')).toBe(
      'a{content:"/* nao e comentario */"}',
    )
  })

  it('preserva espaço em media query', () => {
    expect(minifyCss('@media (min-width: 100px) { a { color: red } }')).toBe(
      '@media(min-width:100px){a{color:red}}',
    )
  })

  it('aceita CSS vazio', () => {
    expect(minifyCss('')).toBe('')
  })
})

describe('minifyJs', () => {
  it('remove comentário de linha', () => {
    expect(minifyJs('const a = 1 // nota\nconst b = 2')).toBe('const a=1\nconst b=2')
  })

  it('remove comentário de bloco', () => {
    expect(minifyJs('const /* nota */ a = 1')).toBe('const a=1')
  })

  it('NÃO corta // dentro de string', () => {
    // O bug clássico do minificador por regex: truncar a URL e quebrar o código.
    expect(minifyJs('const u = "https://x.dev/a"')).toBe('const u="https://x.dev/a"')
  })

  it('NÃO corta // dentro de string com aspas simples', () => {
    expect(minifyJs("const u = 'https://x.dev'")).toBe("const u='https://x.dev'")
  })

  it('NÃO corta // dentro de template literal', () => {
    expect(minifyJs('const u = `https://x.dev`')).toBe('const u=`https://x.dev`')
  })

  it('preserva espaços dentro de string', () => {
    expect(minifyJs('const a = "oi   mundo"')).toBe('const a="oi   mundo"')
  })

  it('NÃO trata / de divisão como início de comentário', () => {
    expect(minifyJs('const a = 10 / 2')).toBe('const a=10/2')
  })

  it('preserva o conteúdo de uma regex literal', () => {
    expect(minifyJs('const r = /a\\/\\/b/g')).toBe('const r=/a\\/\\/b/g')
  })

  it('preserva a quebra de linha que encerra comando sem ponto e vírgula', () => {
    // Juntar as linhas aqui mudaria o significado por ASI.
    expect(minifyJs('const a = 1\nconst b = 2')).toContain('\n')
  })

  it('preserva escape de aspas dentro de string', () => {
    expect(minifyJs('const a = "diz \\"oi\\""')).toBe('const a="diz \\"oi\\""')
  })

  it('aceita entrada vazia', () => {
    expect(minifyJs('')).toBe('')
  })
})

describe('minifyHtml', () => {
  it('remove comentários', () => {
    expect(minifyHtml('<p>a</p><!-- nota -->')).toBe('<p>a</p>')
  })

  it('colapsa espaço entre tags', () => {
    expect(minifyHtml('<div>\n  <p>a</p>\n</div>')).toBe('<div><p>a</p></div>')
  })

  it('colapsa espaço repetido no texto sem removê-lo', () => {
    // Remover de todo juntaria palavras: "oi mundo" viraria "oimundo".
    expect(minifyHtml('<p>oi     mundo</p>')).toBe('<p>oi mundo</p>')
  })

  it('preserva o conteúdo de <pre>', () => {
    expect(minifyHtml('<pre>  a\n  b</pre>')).toBe('<pre>  a\n  b</pre>')
  })

  it('preserva o conteúdo de <textarea>', () => {
    expect(minifyHtml('<textarea>  a  </textarea>')).toBe('<textarea>  a  </textarea>')
  })

  it('preserva o conteúdo de <script>', () => {
    expect(minifyHtml('<script>const a = "  b  "</script>')).toContain('"  b  "')
  })

  it('preserva comentário condicional do IE', () => {
    expect(minifyHtml('<!--[if IE]><p>a</p><![endif]-->')).toContain('[if IE]')
  })

  it('aceita entrada vazia', () => {
    expect(minifyHtml('')).toBe('')
  })
})
