/**
 * Hash, JWT e cartão — funções puras, sem React.
 *
 * Nada aqui verifica assinatura nem valida credencial de verdade: são
 * ferramentas de inspeção e de geração de dado de teste. Onde a distinção
 * importa, ela está explícita no tipo de retorno.
 */

import blueimpMd5 from 'blueimp-md5'

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'elo'

export interface JwtParts {
  header: Record<string, unknown>
  payload: Record<string, unknown>
  signature: string
  /** Sempre `false`: verificar exigiria o segredo, que não existe no cliente. */
  verified: false
  issuedAt?: Date
  expiresAt?: Date
  /** `undefined` quando o token não declara `exp`. */
  expired?: boolean
}

export interface CreditCard {
  number: string
  brand: CardBrand
  cvv: string
  expiry: string
}

// ------------------------------------------------------------------ hash

export function md5(texto: string): string {
  return blueimpMd5(texto)
}

/**
 * SHA-256 via SubtleCrypto.
 *
 * É assíncrono porque a API do navegador é — não dá para esconder isso atrás de
 * uma função síncrona sem trazer uma implementação própria de SHA-2, que seria
 * mais código para manter e mais lenta que a nativa.
 */
export async function sha256(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

// ------------------------------------------------------------------ JWT

/**
 * Decodifica um JWT SEM verificar a assinatura.
 *
 * `verified` é sempre `false` e o tipo não permite outra coisa. Uma ferramenta
 * de inspeção que dissesse "token válido" sem conferir a assinatura ensinaria a
 * confiar no conteúdo de um token forjado — o payload de um JWT é apenas base64,
 * legível e forjável por qualquer um.
 */
export function decodeJwt(token: string): JwtParts {
  const partes = token.trim().split('.')
  if (partes.length !== 3) {
    throw new Error('JWT precisa ter três partes separadas por ponto.')
  }

  const [header, payload, signature] = partes
  const decodificado: JwtParts = {
    header: parseSegmento(header, 'cabeçalho'),
    payload: parseSegmento(payload, 'payload'),
    signature,
    verified: false,
  }

  const { iat, exp } = decodificado.payload
  if (typeof iat === 'number') decodificado.issuedAt = new Date(iat * 1000)
  if (typeof exp === 'number') {
    decodificado.expiresAt = new Date(exp * 1000)
    decodificado.expired = exp * 1000 < Date.now()
  }
  return decodificado
}

function parseSegmento(segmento: string, nome: string): Record<string, unknown> {
  try {
    // base64url troca + por -, / por _ e descarta o padding: `atob` direto falha
    // em qualquer token que contenha esses caracteres.
    const base64 = segmento.replace(/-/g, '+').replace(/_/g, '/')
    const preenchido = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const binario = atob(preenchido)
    const bytes = Uint8Array.from(binario, (caractere) => caractere.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>
  } catch (erro) {
    throw new Error(`JWT inválido: não foi possível ler o ${nome}.`, { cause: erro })
  }
}

// ------------------------------------------------------------------ Luhn

/** Algoritmo de Luhn: dobra os dígitos em posição par a partir da direita. */
export function isValidLuhn(numero: string): boolean {
  const digitos = numero.replace(/[\s-]/g, '')
  if (!/^\d+$/.test(digitos)) return false

  let soma = 0
  let dobrar = false
  for (let i = digitos.length - 1; i >= 0; i -= 1) {
    let valor = Number(digitos[i])
    if (dobrar) {
      valor *= 2
      if (valor > 9) valor -= 9
    }
    soma += valor
    dobrar = !dobrar
  }
  return soma % 10 === 0
}

function luhnCheckDigit(parcial: string): number {
  // O dígito verificador é o que completa a soma até o próximo múltiplo de 10.
  let soma = 0
  let dobrar = true
  for (let i = parcial.length - 1; i >= 0; i -= 1) {
    let valor = Number(parcial[i])
    if (dobrar) {
      valor *= 2
      if (valor > 9) valor -= 9
    }
    soma += valor
    dobrar = !dobrar
  }
  return (10 - (soma % 10)) % 10
}

// ------------------------------------------------------------------ cartão

const BANDEIRAS: Record<CardBrand, { prefixos: string[]; tamanho: number; cvv: number }> = {
  visa: { prefixos: ['4'], tamanho: 16, cvv: 3 },
  mastercard: { prefixos: ['51', '52', '53', '54', '55'], tamanho: 16, cvv: 3 },
  amex: { prefixos: ['34', '37'], tamanho: 15, cvv: 4 },
  elo: { prefixos: ['4011', '4312', '5041', '6362'], tamanho: 16, cvv: 3 },
}

const MARCAS = Object.keys(BANDEIRAS) as CardBrand[]

function sorteio(max: number): number {
  const buffer = new Uint32Array(1)
  crypto.getRandomValues(buffer)
  return buffer[0] % max
}

/**
 * Gera dado de cartão sintaticamente válido para teste.
 *
 * Passa no Luhn de propósito: sistemas de pagamento em sandbox recusam números
 * que não passam, e o objetivo é justamente exercitar esse caminho. Não
 * corresponde a conta nenhuma — o Luhn é checksum de digitação, não autorização.
 */
export function generateCreditCard(
  options: { brand?: CardBrand; masked?: boolean } = {},
): CreditCard {
  const brand = options.brand ?? MARCAS[sorteio(MARCAS.length)]
  const { prefixos, tamanho, cvv } = BANDEIRAS[brand]
  const prefixo = prefixos[sorteio(prefixos.length)]

  const meio = Array.from({ length: tamanho - prefixo.length - 1 }, () => sorteio(10)).join('')
  const parcial = `${prefixo}${meio}`
  const numero = `${parcial}${luhnCheckDigit(parcial)}`

  const agora = new Date()
  const validade = new Date(agora.getFullYear() + 1 + sorteio(4), sorteio(12))

  return {
    number: options.masked ? mascarar(numero, brand) : numero,
    brand,
    cvv: Array.from({ length: cvv }, () => sorteio(10)).join(''),
    expiry: `${String(validade.getMonth() + 1).padStart(2, '0')}/${String(
      validade.getFullYear() % 100,
    ).padStart(2, '0')}`,
  }
}

function mascarar(numero: string, brand: CardBrand): string {
  // Amex agrupa 4-6-5; as demais, de quatro em quatro.
  if (brand === 'amex') {
    return `${numero.slice(0, 4)} ${numero.slice(4, 10)} ${numero.slice(10)}`
  }
  return numero.replace(/(\d{4})(?=\d)/g, '$1 ')
}
