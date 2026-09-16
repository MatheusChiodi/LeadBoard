/**
 * Conversores — funções puras, sem React.
 *
 * Todas lançam `Error` com mensagem em português em vez de devolver `null` ou
 * string vazia: a ferramenta precisa distinguir "entrada inválida" de "resultado
 * vazio" para conseguir avisar o usuário do que está errado.
 */

export interface Rgb {
  r: number
  g: number
  b: number
  a?: number
}

export type CaseStyle =
  | 'upper'
  | 'lower'
  | 'title'
  | 'sentence'
  | 'camel'
  | 'pascal'
  | 'snake'
  | 'kebab'
  | 'constant'
  | 'invert'

// ------------------------------------------------------------------ base64

/**
 * `btoa` só aceita code points até 255 e estoura em qualquer acento.
 * Passar por UTF-8 antes é o que faz "ação" e emoji funcionarem — o projeto de
 * origem chamava `btoa` direto e quebrava com InvalidCharacterError.
 */
export function encodeBase64(texto: string): string {
  const bytes = new TextEncoder().encode(texto)
  let binario = ''
  for (const byte of bytes) binario += String.fromCharCode(byte)
  return btoa(binario)
}

export function decodeBase64(base64: string): string {
  try {
    const binario = atob(base64)
    const bytes = Uint8Array.from(binario, (caractere) => caractere.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch (erro) {
    throw new Error('Conteúdo não é base64 válido.', { cause: erro })
  }
}

// ------------------------------------------------------------------ cor

export function hexToRgb(hex: string): Rgb {
  const limpo = hex.trim().replace(/^#/, '')

  // 3 e 4 dígitos são a forma curta: cada dígito vale por dois.
  const expandido =
    limpo.length === 3 || limpo.length === 4
      ? [...limpo].map((digito) => digito + digito).join('')
      : limpo

  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(expandido)) {
    throw new Error('Cor hex inválida. Use #RGB, #RRGGBB ou #RRGGBBAA.')
  }

  const canal = (inicio: number) => Number.parseInt(expandido.slice(inicio, inicio + 2), 16)
  const rgb: Rgb = { r: canal(0), g: canal(2), b: canal(4) }
  if (expandido.length === 8) rgb.a = canal(6)
  return rgb
}

export function rgbToHex({ r, g, b, a }: Rgb): string {
  for (const [nome, valor] of Object.entries({ r, g, b, a })) {
    if (valor === undefined) continue
    if (!Number.isInteger(valor) || valor < 0 || valor > 255) {
      throw new Error(`Canal ${nome} precisa ser um inteiro de 0 a 255.`)
    }
  }
  const parte = (valor: number) => valor.toString(16).padStart(2, '0')
  return `#${parte(r)}${parte(g)}${parte(b)}${a === undefined ? '' : parte(a)}`
}

// ------------------------------------------------------------------ timestamp

export interface TimestampOptions {
  unit?: 'seconds' | 'milliseconds'
  utc?: boolean
}

/**
 * Sem `unit`, decide pelo tamanho: até 11 dígitos é segundo, acima é
 * milissegundo. Ler um valor em ms como se fosse segundo joga a data para o ano
 * 57000, que é o erro mais comum desta ferramenta.
 */
export function formatTimestamp(valor: number, options: TimestampOptions = {}): string {
  const { utc = false } = options
  const unidade = options.unit ?? (Math.abs(valor) >= 1e12 ? 'milliseconds' : 'seconds')
  const data = new Date(unidade === 'seconds' ? valor * 1000 : valor)

  if (Number.isNaN(data.getTime())) {
    throw new Error('Timestamp fora da faixa representável.')
  }
  return utc ? data.toISOString() : data.toLocaleString()
}

/** Devolve epoch em SEGUNDOS, que é a unidade que a maioria das APIs espera. */
export function parseTimestamp(iso: string): number {
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) {
    throw new Error('Data inválida. Use um formato ISO 8601.')
  }
  return Math.floor(data.getTime() / 1000)
}

// ------------------------------------------------------------------ URL

export function urlEncode(texto: string): string {
  return encodeURIComponent(texto).replace(/[!'()*]/g, (caractere) => {
    // encodeURIComponent deixa estes de fora, mas eles são reservados em
    // algumas gramáticas de URI e quebram links quando não escapados.
    return `%${caractere.charCodeAt(0).toString(16).toUpperCase()}`
  })
}

export function urlDecode(texto: string): string {
  try {
    return decodeURIComponent(texto)
  } catch (erro) {
    throw new Error('URL inválida: sequência percent malformada.', { cause: erro })
  }
}

// ------------------------------------------------------------------ HTML

const ENTIDADES: Array<[RegExp, string]> = [
  // O & precisa vir primeiro, ou as substituições seguintes viram `&amp;lt;`.
  [/&/g, '&amp;'],
  [/</g, '&lt;'],
  [/>/g, '&gt;'],
  [/"/g, '&quot;'],
  [/'/g, '&#39;'],
]

export function encodeHtmlEntities(texto: string): string {
  return ENTIDADES.reduce((atual, [padrao, entidade]) => atual.replace(padrao, entidade), texto)
}

const NOMEADAS: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

export function decodeHtmlEntities(texto: string): string {
  return texto.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (inteiro, corpo: string) => {
    if (corpo.startsWith('#x') || corpo.startsWith('#X')) {
      return String.fromCodePoint(Number.parseInt(corpo.slice(2), 16))
    }
    if (corpo.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(corpo.slice(1), 10))
    }
    return NOMEADAS[corpo.toLowerCase()] ?? inteiro
  })
}

// ------------------------------------------------------------------ caixa

/** Quebra em palavras entendendo espaço, hífen, underscore e camelCase. */
function palavras(texto: string): string[] {
  return texto
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s\-_]+/)
    .filter((palavra) => palavra.length > 0)
}

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function capitalizar(palavra: string): string {
  return palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase()
}

export function changeCase(texto: string, estilo: CaseStyle): string {
  if (texto.length === 0) return ''

  switch (estilo) {
    case 'upper':
      return texto.toUpperCase()
    case 'lower':
      return texto.toLowerCase()
    case 'title':
      return palavras(texto).map(capitalizar).join(' ')
    case 'sentence':
      // Maiúscula após ponto, interrogação ou exclamação — e na primeira letra.
      return texto
        .toLowerCase()
        .replace(/(^\s*|[.!?]\s+)([a-záàâãéêíóôõúç])/g, (_, prefixo: string, letra: string) => {
          return prefixo + letra.toUpperCase()
        })
    case 'camel': {
      const [primeira, ...resto] = palavras(semAcento(texto))
      return primeira.toLowerCase() + resto.map(capitalizar).join('')
    }
    case 'pascal':
      return palavras(semAcento(texto)).map(capitalizar).join('')
    case 'snake':
      return palavras(semAcento(texto)).join('_').toLowerCase()
    case 'kebab':
      return palavras(semAcento(texto)).join('-').toLowerCase()
    case 'constant':
      return palavras(semAcento(texto)).join('_').toUpperCase()
    case 'invert':
      return [...texto]
        .map((caractere) =>
          caractere === caractere.toUpperCase()
            ? caractere.toLowerCase()
            : caractere.toUpperCase(),
        )
        .join('')
  }
}
