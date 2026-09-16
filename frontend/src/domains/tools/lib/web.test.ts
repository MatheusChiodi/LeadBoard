import { describe, expect, it } from 'vitest'

import {
  buildMetaTags,
  buildRobotsTxt,
  buildSitemap,
  describeCron,
  testRegex,
} from './web'

describe('describeCron', () => {
  it('descreve execução a cada minuto', () => {
    expect(describeCron('* * * * *').description).toMatch(/a cada minuto/i)
  })

  it('descreve horário fixo diário', () => {
    expect(describeCron('30 9 * * *').description).toMatch(/09:30/)
  })

  it('descreve dia da semana', () => {
    expect(describeCron('0 9 * * 1').description).toMatch(/segunda/i)
  })

  it('descreve intervalo com barra', () => {
    expect(describeCron('*/15 * * * *').description).toMatch(/15 minutos/i)
  })

  it('aceita lista de valores', () => {
    expect(describeCron('0 9,18 * * *').valid).toBe(true)
  })

  it('aceita faixa com hífen', () => {
    expect(describeCron('0 9 * * 1-5').valid).toBe(true)
  })

  it('recusa expressão com número errado de campos', () => {
    expect(describeCron('* * *').valid).toBe(false)
    expect(describeCron('* * *').error).toMatch(/cinco campos/i)
  })

  it('recusa minuto fora da faixa', () => {
    const resultado = describeCron('60 * * * *')
    expect(resultado.valid).toBe(false)
    expect(resultado.error).toMatch(/minuto/i)
  })

  it('recusa hora fora da faixa', () => {
    expect(describeCron('0 24 * * *').valid).toBe(false)
  })

  it('recusa dia do mês fora da faixa', () => {
    expect(describeCron('0 0 32 * *').valid).toBe(false)
  })

  it('aceita domingo como 0 e como 7', () => {
    expect(describeCron('0 0 * * 0').valid).toBe(true)
    expect(describeCron('0 0 * * 7').valid).toBe(true)
  })
})

describe('testRegex', () => {
  it('acha todas as ocorrências com flag global', () => {
    expect(testRegex('a', 'g', 'banana').matches).toHaveLength(3)
  })

  it('devolve a posição de cada ocorrência', () => {
    expect(testRegex('an', 'g', 'banana').matches[0]).toMatchObject({ index: 1, value: 'an' })
  })

  it('devolve os grupos capturados', () => {
    const { matches } = testRegex('(\\d+)-(\\d+)', '', '10-20')
    expect(matches[0].groups).toEqual(['10', '20'])
  })

  it('devolve grupos nomeados', () => {
    const { matches } = testRegex('(?<ano>\\d{4})', '', '2026')
    expect(matches[0].named).toEqual({ ano: '2026' })
  })

  it('reporta regex inválida em vez de estourar', () => {
    const resultado = testRegex('(', '', 'x')
    expect(resultado.valid).toBe(false)
    expect(resultado.error).toBeTruthy()
  })

  it('não trava com padrão que casa string vazia e flag global', () => {
    // `/a*/g` sobre "b" pode fazer laço infinito se o índice não avançar.
    expect(testRegex('a*', 'g', 'bbb').matches.length).toBeLessThan(10)
  })

  it('devolve lista vazia quando não casa', () => {
    expect(testRegex('z', 'g', 'banana').matches).toEqual([])
  })
})

describe('buildMetaTags', () => {
  const base = {
    title: 'LeadBoard',
    description: 'Painel do tech lead',
    url: 'https://leadboard.dev',
    image: 'https://leadboard.dev/og.png',
  }

  it('gera title e description', () => {
    const html = buildMetaTags(base)
    expect(html).toContain('<title>LeadBoard</title>')
    expect(html).toContain('name="description" content="Painel do tech lead"')
  })

  it('gera Open Graph', () => {
    expect(buildMetaTags(base)).toContain('property="og:title"')
  })

  it('gera Twitter Card', () => {
    expect(buildMetaTags(base)).toContain('name="twitter:card"')
  })

  it('escapa aspas do conteúdo', () => {
    // Sem escape, um título com aspas fecha o atributo e quebra o HTML.
    expect(buildMetaTags({ ...base, title: 'diz "oi"' })).toContain('&quot;oi&quot;')
  })

  it('omite a tag quando o campo não foi informado', () => {
    expect(buildMetaTags({ title: 'x' })).not.toContain('og:image')
  })
})

describe('buildRobotsTxt', () => {
  it('libera tudo por padrão', () => {
    expect(buildRobotsTxt({})).toContain('User-agent: *')
    expect(buildRobotsTxt({})).toContain('Allow: /')
  })

  it('bloqueia os caminhos informados', () => {
    expect(buildRobotsTxt({ disallow: ['/admin', '/api'] })).toContain('Disallow: /admin')
  })

  it('inclui o sitemap', () => {
    expect(buildRobotsTxt({ sitemap: 'https://x.dev/sitemap.xml' })).toContain(
      'Sitemap: https://x.dev/sitemap.xml',
    )
  })

  it('inclui crawl-delay quando informado', () => {
    expect(buildRobotsTxt({ crawlDelay: 10 })).toContain('Crawl-delay: 10')
  })

  it('bloqueia tudo quando pedido', () => {
    const texto = buildRobotsTxt({ disallowAll: true })
    expect(texto).toContain('Disallow: /')
    expect(texto).not.toContain('Allow: /')
  })
})

describe('buildSitemap', () => {
  it('gera XML válido com as URLs', () => {
    const xml = buildSitemap([{ loc: 'https://x.dev/' }])
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<loc>https://x.dev/</loc>')
  })

  it('inclui lastmod, changefreq e priority', () => {
    const xml = buildSitemap([
      { loc: 'https://x.dev/', lastmod: '2026-09-15', changefreq: 'daily', priority: 1 },
    ])
    expect(xml).toContain('<lastmod>2026-09-15</lastmod>')
    expect(xml).toContain('<changefreq>daily</changefreq>')
    expect(xml).toContain('<priority>1.0</priority>')
  })

  it('escapa & na URL', () => {
    // & cru torna o XML malformado e o Google recusa o sitemap inteiro.
    expect(buildSitemap([{ loc: 'https://x.dev/?a=1&b=2' }])).toContain('&amp;b=2')
  })

  it('recusa lista vazia', () => {
    expect(() => buildSitemap([])).toThrow(/vazia/i)
  })

  it('recusa prioridade fora da faixa', () => {
    expect(() => buildSitemap([{ loc: 'https://x.dev/', priority: 2 }])).toThrow(/0 a 1/)
  })
})
