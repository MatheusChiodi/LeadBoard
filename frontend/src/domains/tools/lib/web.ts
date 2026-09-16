/**
 * Cron, regex e artefatos de SEO — funções puras, sem React.
 */

export interface CronResult {
  valid: boolean
  description: string
  error?: string
}

export interface RegexMatch {
  value: string
  index: number
  groups: string[]
  named: Record<string, string>
}

export interface RegexResult {
  valid: boolean
  matches: RegexMatch[]
  error?: string
}

export interface MetaTagsInput {
  title: string
  description?: string
  url?: string
  image?: string
  author?: string
  keywords?: string[]
}

export interface RobotsInput {
  disallow?: string[]
  allow?: string[]
  sitemap?: string
  crawlDelay?: number
  userAgent?: string
  disallowAll?: boolean
}

export interface SitemapEntry {
  loc: string
  lastmod?: string
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority?: number
}

// ------------------------------------------------------------------ cron

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const CAMPOS: Array<{ nome: string; min: number; max: number }> = [
  { nome: 'minuto', min: 0, max: 59 },
  { nome: 'hora', min: 0, max: 23 },
  { nome: 'dia do mês', min: 1, max: 31 },
  { nome: 'mês', min: 1, max: 12 },
  // 0 e 7 representam domingo; os dois são aceitos pela maioria dos cron.
  { nome: 'dia da semana', min: 0, max: 7 },
]

export function describeCron(expressao: string): CronResult {
  const campos = expressao.trim().split(/\s+/)
  if (campos.length !== 5) {
    return {
      valid: false,
      description: '',
      error: `A expressão precisa ter cinco campos, e recebeu ${campos.length}.`,
    }
  }

  for (const [indice, campo] of campos.entries()) {
    const erro = validarCampo(campo, CAMPOS[indice])
    if (erro !== null) return { valid: false, description: '', error: erro }
  }

  return { valid: true, description: descrever(campos) }
}

function validarCampo(campo: string, { nome, min, max }: (typeof CAMPOS)[number]): string | null {
  for (const parte of campo.split(',')) {
    const [valores, passo] = parte.split('/')
    if (passo !== undefined && !/^\d+$/.test(passo)) {
      return `Passo inválido no campo ${nome}.`
    }
    if (valores === '*') continue

    for (const numero of valores.split('-')) {
      if (!/^\d+$/.test(numero)) return `Valor inválido no campo ${nome}: "${numero}".`
      const valor = Number(numero)
      if (valor < min || valor > max) {
        return `O campo ${nome} aceita de ${min} a ${max}, e recebeu ${valor}.`
      }
    }
  }
  return null
}

function descrever([minuto, hora, diaMes, mes, diaSemana]: string[]): string {
  const partes: string[] = []

  if (minuto === '*' && hora === '*') {
    partes.push('A cada minuto')
  } else if (minuto.startsWith('*/')) {
    partes.push(`A cada ${minuto.slice(2)} minutos`)
  } else if (hora === '*') {
    partes.push(`No minuto ${minuto} de cada hora`)
  } else {
    const hh = String(Number(hora.split(',')[0])).padStart(2, '0')
    const mm = String(Number(minuto.split(',')[0])).padStart(2, '0')
    partes.push(`Às ${hh}:${mm}`)
  }

  if (diaSemana !== '*') {
    partes.push(`de ${nomearDias(diaSemana)}`)
  } else if (diaMes !== '*') {
    partes.push(`no dia ${diaMes}`)
  } else {
    partes.push('todos os dias')
  }

  if (mes !== '*') partes.push(`no mês ${mes}`)
  return `${partes.join(' ')}.`
}

function nomearDias(campo: string): string {
  // 7 é domingo em muitos cron; normalizar evita índice fora do array.
  const nome = (valor: string) => DIAS[Number(valor) % 7]
  return campo
    .split(',')
    .map((parte) => {
      const [de, ate] = parte.split('-')
      return ate === undefined ? nome(de) : `${nome(de)} a ${nome(ate)}`
    })
    .join(', ')
}

// ------------------------------------------------------------------ regex

export function testRegex(padrao: string, flags: string, texto: string): RegexResult {
  let expressao: RegExp
  try {
    expressao = new RegExp(padrao, flags)
  } catch (erro) {
    return { valid: false, matches: [], error: (erro as Error).message }
  }

  const matches: RegexMatch[] = []
  if (!flags.includes('g')) {
    const encontrado = expressao.exec(texto)
    if (encontrado !== null) matches.push(mapear(encontrado))
    return { valid: true, matches }
  }

  let encontrado: RegExpExecArray | null
  while ((encontrado = expressao.exec(texto)) !== null) {
    matches.push(mapear(encontrado))
    // Padrão que casa string vazia não move `lastIndex`: sem este empurrão,
    // `/a*/g` sobre "bbb" roda para sempre e trava a aba.
    if (encontrado[0] === '') expressao.lastIndex += 1
  }
  return { valid: true, matches }
}

function mapear(encontrado: RegExpExecArray): RegexMatch {
  return {
    value: encontrado[0],
    index: encontrado.index,
    groups: encontrado.slice(1).map((grupo) => grupo ?? ''),
    named: { ...encontrado.groups },
  }
}

// ------------------------------------------------------------------ SEO

/** Sem escape, um título com aspas fecha o atributo e quebra o HTML gerado. */
function escaparAtributo(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildMetaTags(input: MetaTagsInput): string {
  const { title, description, url, image, author, keywords } = input
  const e = escaparAtributo
  const linhas: string[] = [`<title>${e(title)}</title>`]

  const meta = (atributo: 'name' | 'property', chave: string, valor?: string) => {
    if (valor === undefined || valor === '') return
    linhas.push(`<meta ${atributo}="${chave}" content="${e(valor)}" />`)
  }

  meta('name', 'description', description)
  meta('name', 'author', author)
  meta('name', 'keywords', keywords?.join(', '))

  linhas.push('')
  meta('property', 'og:type', 'website')
  meta('property', 'og:title', title)
  meta('property', 'og:description', description)
  meta('property', 'og:url', url)
  meta('property', 'og:image', image)

  linhas.push('')
  meta('name', 'twitter:card', image === undefined ? 'summary' : 'summary_large_image')
  meta('name', 'twitter:title', title)
  meta('name', 'twitter:description', description)
  meta('name', 'twitter:image', image)

  return linhas.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function buildRobotsTxt(input: RobotsInput): string {
  const { disallow = [], allow = [], sitemap, crawlDelay, userAgent = '*', disallowAll } = input
  const linhas = [`User-agent: ${userAgent}`]

  if (disallowAll === true) {
    linhas.push('Disallow: /')
  } else {
    for (const caminho of disallow) linhas.push(`Disallow: ${caminho}`)
    for (const caminho of allow) linhas.push(`Allow: ${caminho}`)
    if (allow.length === 0) linhas.push('Allow: /')
  }

  if (crawlDelay !== undefined) linhas.push(`Crawl-delay: ${crawlDelay}`)
  if (sitemap !== undefined) linhas.push('', `Sitemap: ${sitemap}`)
  return `${linhas.join('\n')}\n`
}

export function buildSitemap(entradas: SitemapEntry[]): string {
  if (entradas.length === 0) throw new Error('Lista de URLs vazia.')

  const urls = entradas.map((entrada) => {
    if (entrada.priority !== undefined && (entrada.priority < 0 || entrada.priority > 1)) {
      throw new Error('A prioridade precisa estar entre 0 a 1.')
    }
    const campos = [`    <loc>${escaparAtributo(entrada.loc)}</loc>`]
    if (entrada.lastmod !== undefined) campos.push(`    <lastmod>${entrada.lastmod}</lastmod>`)
    if (entrada.changefreq !== undefined) {
      campos.push(`    <changefreq>${entrada.changefreq}</changefreq>`)
    }
    if (entrada.priority !== undefined) {
      campos.push(`    <priority>${entrada.priority.toFixed(1)}</priority>`)
    }
    return `  <url>\n${campos.join('\n')}\n  </url>`
  })

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')
}
