import { describe, expect, it } from 'vitest'

import { CATEGORY_LABEL, TOOLS, countByCategory, searchTools, toolById } from './catalog'

describe('catálogo', () => {
  it('tem as 44 ferramentas do projeto de origem', () => {
    expect(TOOLS).toHaveLength(44)
  })

  it('não tem id repetido', () => {
    // No original o id, a rota e o nome do arquivo divergiam entre si; aqui o id
    // é a única chave e precisa ser único.
    const ids = TOOLS.map((tool) => tool.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('não tem nome repetido', () => {
    const nomes = TOOLS.map((tool) => tool.name)
    expect(new Set(nomes).size).toBe(nomes.length)
  })

  it('usa só categorias declaradas', () => {
    for (const tool of TOOLS) {
      expect(CATEGORY_LABEL[tool.category]).toBeDefined()
    }
  })

  it('toda ferramenta tem descrição e ao menos um sinônimo', () => {
    for (const tool of TOOLS) {
      expect(tool.description.length).toBeGreaterThan(10)
      expect(tool.keywords.length).toBeGreaterThan(0)
    }
  })

  it('mantém a distribuição por categoria do original', () => {
    expect(countByCategory()).toEqual({
      documentos: 4,
      devtools: 12,
      texto: 3,
      seguranca: 4,
      conversores: 10,
      design: 5,
      rede: 3,
      seo: 3,
    })
  })

  it('só três ferramentas tocam a rede', () => {
    // O princípio 8 em forma de teste: se alguém marcar uma quarta, o motivo
    // precisa ser defendido aqui antes de virar endpoint.
    const rede = TOOLS.filter((tool) => tool.needsNetwork === true).map((tool) => tool.id)
    expect(rede).toEqual(['busca-cep', 'dns-lookup', 'ip-locator'])
  })
})

describe('searchTools', () => {
  it('devolve tudo com busca vazia', () => {
    expect(searchTools('')).toHaveLength(44)
  })

  it('acha por nome', () => {
    expect(searchTools('uuid').map((t) => t.id)).toContain('gerador-uuid')
  })

  it('acha por sinônimo', () => {
    // Quem procura "guid" quer o gerador de UUID.
    expect(searchTools('guid').map((t) => t.id)).toContain('gerador-uuid')
  })

  it('ignora acento na busca e nos dados', () => {
    // A keyword é "código"; quem digita sem acento precisa achar do mesmo jeito.
    expect(searchTools('codigo').map((t) => t.id)).toContain('gerador-qrcode')
    expect(searchTools('código').map((t) => t.id)).toContain('gerador-qrcode')
    expect(searchTools('dominio').map((t) => t.id)).toContain('dns-lookup')
    expect(searchTools('expressao regular').map((t) => t.id)).toContain('regex-tester')
  })

  it('ignora caixa', () => {
    expect(searchTools('JSON').length).toBe(searchTools('json').length)
  })

  it('filtra por categoria', () => {
    expect(searchTools('', 'rede')).toHaveLength(3)
  })

  it('combina termo e categoria', () => {
    expect(searchTools('gerador', 'rede').map((t) => t.id)).toEqual(['gerador-mac'])
  })

  it('devolve vazio quando nada casa', () => {
    expect(searchTools('xyzabc')).toEqual([])
  })
})

describe('toolById', () => {
  it('acha a ferramenta', () => {
    expect(toolById('hash-md5')?.name).toBe('Hash MD5')
  })

  it('devolve undefined para id inexistente', () => {
    expect(toolById('nao-existe')).toBeUndefined()
  })
})
