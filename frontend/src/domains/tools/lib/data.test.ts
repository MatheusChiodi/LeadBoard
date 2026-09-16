import { describe, expect, it } from 'vitest'

import {
  csvToJson,
  diffJson,
  formatJson,
  jsonToCsv,
  jsonToYaml,
  minifyJson,
  xmlToJson,
  yamlToJson,
} from './data'

describe('formatJson', () => {
  it('indenta com 2 espaços por padrão', () => {
    expect(formatJson('{"a":1}')).toBe('{\n  "a": 1\n}')
  })

  it('aceita indentação customizada', () => {
    expect(formatJson('{"a":1}', { indent: 4 })).toBe('{\n    "a": 1\n}')
  })

  it('ordena as chaves quando pedido', () => {
    expect(formatJson('{"b":1,"a":2}', { sortKeys: true })).toBe('{\n  "a": 2,\n  "b": 1\n}')
  })

  it('preserva a ordem original por padrão', () => {
    expect(formatJson('{"b":1,"a":2}')).toBe('{\n  "b": 1,\n  "a": 2\n}')
  })

  it('preserva a localização quando a runtime a fornece', () => {
    // "JSON inválido" sozinho não ajuda em um arquivo de 400 linhas.
    expect(() => formatJson('{')).toThrow(/line 1 column 2/)
  })

  it('repassa a mensagem nativa quando a runtime não dá posição', () => {
    // O V8 alterna entre dar o offset e dar só um trecho truncado. Prometer
    // linha e coluna sempre seria mentira; o contrato é não engolir o motivo.
    expect(() => formatJson('{"a":}')).toThrow(/JSON inválido — .+/)
  })

  it('reporta entrada vazia', () => {
    expect(() => formatJson('')).toThrow(/JSON inválido/)
  })

  it('aceita array na raiz', () => {
    expect(formatJson('[1,2]')).toBe('[\n  1,\n  2\n]')
  })
})

describe('minifyJson', () => {
  it('remove espaços', () => {
    expect(minifyJson('{\n  "a": 1\n}')).toBe('{"a":1}')
  })

  it('recusa entrada inválida', () => {
    expect(() => minifyJson('{')).toThrow()
  })
})

describe('csvToJson', () => {
  it('usa a primeira linha como cabeçalho', () => {
    expect(csvToJson('nome,idade\nAna,30')).toEqual([{ nome: 'Ana', idade: '30' }])
  })

  it('respeita campo entre aspas com vírgula dentro', () => {
    expect(csvToJson('nome,obs\nAna,"mora em SP, capital"')).toEqual([
      { nome: 'Ana', obs: 'mora em SP, capital' },
    ])
  })

  it('respeita aspas escapadas', () => {
    expect(csvToJson('t\n"ele disse ""oi"""')).toEqual([{ t: 'ele disse "oi"' }])
  })

  it('respeita quebra de linha dentro de aspas', () => {
    // Split por \n quebra aqui — é o bug clássico de parser de CSV caseiro.
    expect(csvToJson('t\n"linha1\nlinha2"')).toEqual([{ t: 'linha1\nlinha2' }])
  })

  it('aceita separador alternativo', () => {
    expect(csvToJson('a;b\n1;2', { delimiter: ';' })).toEqual([{ a: '1', b: '2' }])
  })

  it('converte números quando pedido', () => {
    expect(csvToJson('n\n42', { parseNumbers: true })).toEqual([{ n: 42 }])
  })

  it('ignora linha final vazia', () => {
    expect(csvToJson('a\n1\n')).toHaveLength(1)
  })

  it('aceita CRLF', () => {
    expect(csvToJson('a,b\r\n1,2')).toEqual([{ a: '1', b: '2' }])
  })

  it('recusa CSV vazio', () => {
    expect(() => csvToJson('')).toThrow(/vazio/i)
  })
})

describe('jsonToCsv', () => {
  it('monta cabeçalho a partir das chaves', () => {
    expect(jsonToCsv([{ nome: 'Ana', idade: 30 }])).toBe('nome,idade\nAna,30')
  })

  it('une as chaves de todos os objetos', () => {
    // Usar só as chaves do primeiro item perde colunas silenciosamente.
    expect(jsonToCsv([{ a: 1 }, { b: 2 }])).toBe('a,b\n1,\n,2')
  })

  it('protege valor com vírgula', () => {
    expect(jsonToCsv([{ t: 'a,b' }])).toBe('t\n"a,b"')
  })

  it('protege valor com aspas', () => {
    expect(jsonToCsv([{ t: 'diz "oi"' }])).toBe('t\n"diz ""oi"""')
  })

  it('protege valor com quebra de linha', () => {
    expect(jsonToCsv([{ t: 'a\nb' }])).toBe('t\n"a\nb"')
  })

  it('vai e volta com csvToJson', () => {
    const original = [{ nome: 'Ana', obs: 'mora em SP, capital' }]
    expect(csvToJson(jsonToCsv(original))).toEqual(original)
  })

  it('recusa lista vazia', () => {
    expect(() => jsonToCsv([])).toThrow(/vazia/i)
  })
})

describe('yaml', () => {
  it('converte JSON para YAML', () => {
    expect(jsonToYaml('{"a":1,"b":["x"]}')).toBe('a: 1\nb:\n  - x\n')
  })

  it('converte YAML para JSON', () => {
    expect(JSON.parse(yamlToJson('a: 1'))).toEqual({ a: 1 })
  })

  it('vai e volta', () => {
    const original = { nome: 'Ana', tags: ['a', 'b'], ativo: true }
    expect(JSON.parse(yamlToJson(jsonToYaml(JSON.stringify(original))))).toEqual(original)
  })

  it('recusa YAML inválido', () => {
    // Tabulação é proibida como indentação em YAML.
    expect(() => yamlToJson('a:\n\tb: 1')).toThrow(/YAML inválido/)
    expect(() => yamlToJson('a: [1, 2')).toThrow(/YAML inválido/)
  })
})

describe('xmlToJson', () => {
  it('converte elementos aninhados', () => {
    expect(JSON.parse(xmlToJson('<r><a>1</a></r>'))).toEqual({ r: { a: 1 } })
  })

  it('lê atributos', () => {
    expect(JSON.parse(xmlToJson('<r id="7"/>'))).toEqual({ r: { '@_id': 7 } })
  })

  it('recusa XML malformado', () => {
    expect(() => xmlToJson('<r><a></r>')).toThrow()
  })
})

describe('diffJson', () => {
  it('não acha diferença entre iguais', () => {
    expect(diffJson('{"a":1}', '{"a":1}')).toEqual([])
  })

  it('ignora ordem das chaves', () => {
    expect(diffJson('{"a":1,"b":2}', '{"b":2,"a":1}')).toEqual([])
  })

  it('aponta valor alterado', () => {
    expect(diffJson('{"a":1}', '{"a":2}')).toEqual([
      { path: 'a', kind: 'alterado', left: 1, right: 2 },
    ])
  })

  it('aponta chave adicionada', () => {
    expect(diffJson('{}', '{"a":1}')).toEqual([{ path: 'a', kind: 'adicionado', right: 1 }])
  })

  it('aponta chave removida', () => {
    expect(diffJson('{"a":1}', '{}')).toEqual([{ path: 'a', kind: 'removido', left: 1 }])
  })

  it('desce em objetos aninhados', () => {
    expect(diffJson('{"a":{"b":1}}', '{"a":{"b":2}}')).toEqual([
      { path: 'a.b', kind: 'alterado', left: 1, right: 2 },
    ])
  })

  it('compara array por índice', () => {
    expect(diffJson('{"a":[1,2]}', '{"a":[1,3]}')).toEqual([
      { path: 'a[1]', kind: 'alterado', left: 2, right: 3 },
    ])
  })

  it('detecta mudança de tipo', () => {
    expect(diffJson('{"a":1}', '{"a":"1"}')).toEqual([
      { path: 'a', kind: 'alterado', left: 1, right: '1' },
    ])
  })
})
