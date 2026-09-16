/**
 * Geradores — funções puras, sem React.
 *
 * No projeto de origem cada uma destas vivia dentro do componente que a exibia,
 * o que as tornava impossíveis de testar sem montar a árvore inteira. Separadas
 * daqui, a UI vira composição e o algoritmo vira teste.
 */

const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const DIGITS = '0123456789'
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.<>?'

const LOREM_WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
  'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
  'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
  'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
  'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
  'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint',
  'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia',
  'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum',
]

/**
 * Sorteio uniforme sobre `max` usando o CSPRNG do navegador.
 *
 * `Math.random()` não é criptograficamente seguro — aceitável para lorem ipsum,
 * inaceitável para senha. Como o mesmo sorteio serve os dois casos, usar o
 * gerador forte em ambos custa nada e remove a chance de alguém reaproveitar o
 * fraco no lugar errado.
 *
 * O laço descarta valores da cauda que não dividem igualmente o intervalo; sem
 * ele, os primeiros caracteres do alfabeto sairiam com probabilidade maior.
 */
function randomBelow(max: number): number {
  const limite = Math.floor(0xffffffff / max) * max
  const buffer = new Uint32Array(1)
  let valor: number
  do {
    crypto.getRandomValues(buffer)
    valor = buffer[0]
  } while (valor >= limite)
  return valor % max
}

function randomDigits(quantidade: number): number[] {
  return Array.from({ length: quantidade }, () => randomBelow(10))
}

function shuffle<T>(itens: T[]): T[] {
  const copia = [...itens]
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = randomBelow(i + 1)
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

// ------------------------------------------------------------------ UUID

export function generateUuid(): string {
  return crypto.randomUUID()
}

// ------------------------------------------------------------------ CPF

/** Dígito verificador do módulo 11, com peso decrescente. */
function checkDigit(numeros: number[], pesoInicial: number): number {
  const soma = numeros.reduce((total, numero, indice) => total + numero * (pesoInicial - indice), 0)
  const resto = soma % 11
  return resto < 2 ? 0 : 11 - resto
}

export function generateCpf(options: { masked?: boolean } = {}): string {
  const base = randomDigits(9)
  const primeiro = checkDigit(base, 10)
  const segundo = checkDigit([...base, primeiro], 11)
  const cru = `${base.join('')}${primeiro}${segundo}`
  return options.masked ? formatCpf(cru) : cru
}

export function formatCpf(cpf: string): string {
  return onlyDigits(cpf).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export function isValidCpf(cpf: string): boolean {
  const digitos = onlyDigits(cpf)
  if (digitos.length !== 11) return false
  // 111.111.111-11 e seus pares passam no módulo 11 mas não são CPF válido.
  // O gerador de origem não fazia esta checagem e podia emitir um deles.
  if (/^(\d)\1{10}$/.test(digitos)) return false

  const numeros = [...digitos].map(Number)
  const base = numeros.slice(0, 9)
  return (
    checkDigit(base, 10) === numeros[9] && checkDigit([...base, numeros[9]], 11) === numeros[10]
  )
}

// ------------------------------------------------------------------ CNPJ

/** O CNPJ usa pesos cíclicos de 9 a 2, não uma escala contínua como o CPF. */
function cnpjCheckDigit(numeros: number[]): number {
  const soma = numeros.reduce((total, numero, indice) => {
    const peso = ((numeros.length - indice - 1) % 8) + 2
    return total + numero * peso
  }, 0)
  const resto = soma % 11
  return resto < 2 ? 0 : 11 - resto
}

export function generateCnpj(options: { masked?: boolean } = {}): string {
  const base = [...randomDigits(8), 0, 0, 0, 1]
  const primeiro = cnpjCheckDigit(base)
  const segundo = cnpjCheckDigit([...base, primeiro])
  const cru = `${base.join('')}${primeiro}${segundo}`
  return options.masked ? formatCnpj(cru) : cru
}

export function formatCnpj(cnpj: string): string {
  return onlyDigits(cnpj).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

export function isValidCnpj(cnpj: string): boolean {
  const digitos = onlyDigits(cnpj)
  if (digitos.length !== 14) return false
  if (/^(\d)\1{13}$/.test(digitos)) return false

  const numeros = [...digitos].map(Number)
  const base = numeros.slice(0, 12)
  return (
    cnpjCheckDigit(base) === numeros[12] && cnpjCheckDigit([...base, numeros[12]]) === numeros[13]
  )
}

function onlyDigits(valor: string): string {
  return valor.replace(/\D/g, '')
}

// ------------------------------------------------------------------ senha

export interface PasswordOptions {
  length?: number
  lowercase?: boolean
  uppercase?: boolean
  digits?: boolean
  symbols?: boolean
}

export function generatePassword(options: PasswordOptions = {}): string {
  const {
    length = 16,
    lowercase = true,
    uppercase = true,
    digits = true,
    symbols = true,
  } = options

  const conjuntos = [
    lowercase ? LOWERCASE : '',
    uppercase ? UPPERCASE : '',
    digits ? DIGITS : '',
    symbols ? SYMBOLS : '',
  ].filter((conjunto) => conjunto.length > 0)

  if (conjuntos.length === 0) {
    throw new Error('Habilite ao menos um conjunto de caracteres.')
  }
  if (length < conjuntos.length) {
    throw new Error(
      `O comprimento precisa ser ao menos ${conjuntos.length} para caber um caractere de cada conjunto.`,
    )
  }

  // Um de cada conjunto primeiro: sorteio puro pode devolver senha sem nenhum
  // dígito, que o sistema de destino rejeita depois de o usuário já ter copiado.
  const obrigatorios = conjuntos.map((conjunto) => conjunto[randomBelow(conjunto.length)])
  const todos = conjuntos.join('')
  const restantes = Array.from(
    { length: length - obrigatorios.length },
    () => todos[randomBelow(todos.length)],
  )

  // Embaralhar para os obrigatórios não ficarem sempre no começo.
  return shuffle([...obrigatorios, ...restantes]).join('')
}

// ------------------------------------------------------------------ MAC

export function generateMacAddress(options: { separator?: string } = {}): string {
  const { separator = ':' } = options
  const octetos = Array.from({ length: 6 }, () => randomBelow(256))
  // Bit 0 zerado = unicast; bit 1 ligado = administrado localmente. Sem isso o
  // endereço poderia colidir com um OUI real de fabricante.
  octetos[0] = (octetos[0] & 0b11111100) | 0b10
  return octetos.map((octeto) => octeto.toString(16).padStart(2, '0').toUpperCase()).join(separator)
}

// ------------------------------------------------------------------ slug

export function slugify(texto: string): string {
  return texto
    .normalize('NFD')
    // Remove os diacríticos que o NFD separou da letra base.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ------------------------------------------------------------------ lorem

export interface LoremOptions {
  paragraphs?: number
  words?: number
  wordsPerParagraph?: number
  classicOpening?: boolean
}

export function generateLorem(options: LoremOptions = {}): string {
  const { paragraphs, words, wordsPerParagraph = 45, classicOpening = false } = options

  if (words !== undefined) {
    return frase(words, classicOpening).replace(/\.$/, '')
  }

  return Array.from({ length: paragraphs ?? 3 }, (_, indice) =>
    frase(wordsPerParagraph, classicOpening && indice === 0),
  ).join('\n\n')
}

function frase(quantidade: number, aberturaClassica: boolean): string {
  const abertura = aberturaClassica ? ['Lorem', 'ipsum', 'dolor', 'sit', 'amet'] : []
  const sorteadas = Array.from(
    { length: Math.max(0, quantidade - abertura.length) },
    () => LOREM_WORDS[randomBelow(LOREM_WORDS.length)],
  )
  const todas = [...abertura, ...sorteadas]
  if (todas.length === 0) return ''
  if (abertura.length === 0) {
    todas[0] = todas[0][0].toUpperCase() + todas[0].slice(1)
  }
  return `${todas.join(' ')}.`
}
