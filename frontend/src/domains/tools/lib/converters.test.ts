import { describe, expect, it } from 'vitest'

import {
  changeCase,
  decodeBase64,
  decodeHtmlEntities,
  encodeBase64,
  encodeHtmlEntities,
  formatTimestamp,
  hexToRgb,
  parseTimestamp,
  rgbToHex,
  urlDecode,
  urlEncode,
} from './converters'

describe('base64', () => {
  it('vai e volta', () => {
    expect(decodeBase64(encodeBase64('LeadBoard'))).toBe('LeadBoard')
  })

  it('codifica acento corretamente', () => {
    // `btoa` puro estoura em caractere fora de Latin-1. O original não tratava,
    // então "ação" quebrava a ferramenta com InvalidCharacterError.
    expect(decodeBase64(encodeBase64('ação é coração'))).toBe('ação é coração')
  })

  it('codifica emoji', () => {
    expect(decodeBase64(encodeBase64('🚀 deploy'))).toBe('🚀 deploy')
  })

  it('bate com o valor canônico', () => {
    expect(encodeBase64('hello')).toBe('aGVsbG8=')
  })

  it('aceita string vazia', () => {
    expect(encodeBase64('')).toBe('')
    expect(decodeBase64('')).toBe('')
  })

  it('recusa base64 inválido com mensagem clara', () => {
    expect(() => decodeBase64('não é base64!!')).toThrow(/base64/i)
  })
})

describe('hexToRgb', () => {
  it('converte hex de 6 dígitos', () => {
    expect(hexToRgb('#ff5555')).toEqual({ r: 255, g: 85, b: 85 })
  })

  it('aceita sem cerquilha', () => {
    expect(hexToRgb('ff5555')).toEqual({ r: 255, g: 85, b: 85 })
  })

  it('expande hex de 3 dígitos', () => {
    expect(hexToRgb('#f55')).toEqual({ r: 255, g: 85, b: 85 })
  })

  it('lê o canal alfa de hex de 8 dígitos', () => {
    expect(hexToRgb('#ff555580')).toEqual({ r: 255, g: 85, b: 85, a: 128 })
  })

  it('expande hex de 4 dígitos como RGBA', () => {
    // #RGBA é forma curta válida em CSS, não entrada inválida.
    expect(hexToRgb('#ff55')).toEqual({ r: 255, g: 255, b: 85, a: 85 })
  })

  it('recusa hex inválido', () => {
    expect(() => hexToRgb('#zzz')).toThrow(/hex/i)
    expect(() => hexToRgb('#ff555')).toThrow(/hex/i)
    expect(() => hexToRgb('#f')).toThrow(/hex/i)
  })
})

describe('rgbToHex', () => {
  it('converte para hex com cerquilha', () => {
    expect(rgbToHex({ r: 255, g: 85, b: 85 })).toBe('#ff5555')
  })

  it('preenche com zero à esquerda', () => {
    expect(rgbToHex({ r: 0, g: 0, b: 5 })).toBe('#000005')
  })

  it('inclui alfa quando existe', () => {
    expect(rgbToHex({ r: 255, g: 85, b: 85, a: 128 })).toBe('#ff555580')
  })

  it('recusa canal fora da faixa', () => {
    expect(() => rgbToHex({ r: 256, g: 0, b: 0 })).toThrow(/0 a 255/)
    expect(() => rgbToHex({ r: -1, g: 0, b: 0 })).toThrow(/0 a 255/)
  })

  it('vai e volta com hexToRgb', () => {
    expect(rgbToHex(hexToRgb('#1a2b3c'))).toBe('#1a2b3c')
  })
})

describe('timestamp', () => {
  it('formata epoch em segundos', () => {
    expect(formatTimestamp(1757894400, { unit: 'seconds', utc: true })).toMatch(/^2025-09-15/)
  })

  it('formata epoch em milissegundos', () => {
    expect(formatTimestamp(1757894400000, { unit: 'milliseconds', utc: true })).toMatch(
      /^2025-09-15/,
    )
  })

  it('detecta a unidade sozinho', () => {
    // 10 dígitos é segundo, 13 é milissegundo. Sem isso, colar um timestamp em
    // ms e ler como segundo joga a data para o ano 57000.
    expect(formatTimestamp(1757894400, { utc: true })).toBe(
      formatTimestamp(1757894400000, { utc: true }),
    )
  })

  it('converte data ISO de volta para epoch', () => {
    expect(parseTimestamp('2025-09-15T00:00:00Z')).toBe(1757894400)
  })

  it('recusa data inválida', () => {
    expect(() => parseTimestamp('não é data')).toThrow(/data/i)
  })
})

describe('urlEncode', () => {
  it('codifica caracteres reservados', () => {
    expect(urlEncode('a b&c=d')).toBe('a%20b%26c%3Dd')
  })

  it('vai e volta', () => {
    expect(urlDecode(urlEncode('https://x.dev/?q=ação & cia'))).toBe('https://x.dev/?q=ação & cia')
  })

  it('recusa sequência percent inválida', () => {
    expect(() => urlDecode('%ZZ')).toThrow(/url/i)
  })
})

describe('html entities', () => {
  it('escapa os cinco caracteres perigosos', () => {
    expect(encodeHtmlEntities('<a href="x">&\'</a>')).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;',
    )
  })

  it('vai e volta', () => {
    expect(decodeHtmlEntities(encodeHtmlEntities('<b>&amp;</b>'))).toBe('<b>&amp;</b>')
  })

  it('decodifica entidade numérica', () => {
    expect(decodeHtmlEntities('&#65;&#x42;')).toBe('AB')
  })

  it('escapa o & primeiro para não corromper as demais', () => {
    // Substituir na ordem errada transforma `<` em `&amp;lt;`.
    expect(encodeHtmlEntities('&<')).toBe('&amp;&lt;')
  })
})

describe('changeCase', () => {
  const frase = 'olá mundo cruel'

  it('para MAIÚSCULAS', () => {
    expect(changeCase(frase, 'upper')).toBe('OLÁ MUNDO CRUEL')
  })

  it('para minúsculas', () => {
    expect(changeCase('OLÁ MUNDO', 'lower')).toBe('olá mundo')
  })

  it('para Título', () => {
    expect(changeCase(frase, 'title')).toBe('Olá Mundo Cruel')
  })

  it('para Sentença', () => {
    expect(changeCase('olá mundo. tudo bem?', 'sentence')).toBe('Olá mundo. Tudo bem?')
  })

  it('para camelCase', () => {
    expect(changeCase(frase, 'camel')).toBe('olaMundoCruel')
  })

  it('para PascalCase', () => {
    expect(changeCase(frase, 'pascal')).toBe('OlaMundoCruel')
  })

  it('para snake_case', () => {
    expect(changeCase(frase, 'snake')).toBe('ola_mundo_cruel')
  })

  it('para kebab-case', () => {
    expect(changeCase(frase, 'kebab')).toBe('ola-mundo-cruel')
  })

  it('para CONSTANT_CASE', () => {
    expect(changeCase(frase, 'constant')).toBe('OLA_MUNDO_CRUEL')
  })

  it('inverte a caixa', () => {
    expect(changeCase('aBc', 'invert')).toBe('AbC')
  })

  it('separa palavras de camelCase na entrada', () => {
    expect(changeCase('minhaVariavelLonga', 'kebab')).toBe('minha-variavel-longa')
  })

  it('aceita string vazia', () => {
    expect(changeCase('', 'camel')).toBe('')
  })
})
