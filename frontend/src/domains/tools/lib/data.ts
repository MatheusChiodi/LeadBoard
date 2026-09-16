/**
 * Conversores de formato de dados — funções puras, sem React.
 *
 * O CSV é feito à mão em vez de `split(',')` porque campo entre aspas pode
 * conter vírgula, aspas escapadas e quebra de linha. Parser caseiro por split é
 * o defeito mais comum desta categoria de ferramenta e corrompe dados em
 * silêncio, sem erro nenhum.
 */

import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { dump as dumpYaml, load as loadYaml } from 'js-yaml'

export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue }

export interface JsonDiff {
  path: string
  kind: 'adicionado' | 'removido' | 'alterado'
  left?: JsonValue
  right?: JsonValue
}

// ------------------------------------------------------------------ JSON

function parseOrThrow(texto: string): JsonValue {
  try {
    return JSON.parse(texto) as JsonValue
  } catch (erro) {
    // A mensagem do V8 muda entre versões do Node e nem sempre traz o offset.
    // Calcular linha e coluna aqui é o que permite achar o erro num arquivo de
    // 400 linhas em vez de reler tudo — e não depende do formato da mensagem.
    throw new Error(`JSON inválido — ${comPosicao(texto, erro as Error)}`, { cause: erro })
  }
}

/**
 * Enriquece a mensagem do V8 com linha e coluna quando dá para calcular.
 *
 * A runtime tem dois formatos e nenhum é confiável sozinho: em alguns erros ela
 * dá `at position N`, em outros só um trecho truncado com reticências. Quando
 * vem o offset, convertemos para linha/coluna, que é o que serve para navegar
 * até o ponto no editor; quando não vem, repassamos o que ela deu.
 */
function comPosicao(texto: string, erro: Error): string {
  if (/line \d+/i.test(erro.message)) return erro.message

  const offset = Number(/position (\d+)/i.exec(erro.message)?.[1])
  if (!Number.isInteger(offset)) return erro.message

  const ate = texto.slice(0, offset)
  const linha = ate.split('\n').length
  const coluna = offset - ate.lastIndexOf('\n')
  return `${erro.message} (linha ${linha}, coluna ${coluna})`
}

export function formatJson(texto: string, options: { indent?: number; sortKeys?: boolean } = {}) {
  const { indent = 2, sortKeys = false } = options
  const valor = parseOrThrow(texto)
  return JSON.stringify(sortKeys ? ordenar(valor) : valor, null, indent)
}

export function minifyJson(texto: string): string {
  return JSON.stringify(parseOrThrow(texto))
}

function ordenar(valor: JsonValue): JsonValue {
  if (Array.isArray(valor)) return valor.map(ordenar)
  if (valor === null || typeof valor !== 'object') return valor
  return Object.fromEntries(
    Object.keys(valor)
      .sort()
      .map((chave) => [chave, ordenar(valor[chave])]),
  )
}

// ------------------------------------------------------------------ CSV

export interface CsvOptions {
  delimiter?: string
  parseNumbers?: boolean
}

/**
 * Tokenizador de CSV conforme RFC 4180.
 *
 * Percorre caractere a caractere mantendo o estado "dentro de aspas", que é o
 * que faz vírgula, quebra de linha e aspas escapadas dentro de um campo
 * funcionarem.
 */
function parseCsvRows(texto: string, delimiter: string): string[][] {
  const linhas: string[][] = []
  let campos: string[] = []
  let atual = ''
  let entreAspas = false

  for (let i = 0; i < texto.length; i += 1) {
    const caractere = texto[i]

    if (entreAspas) {
      if (caractere === '"') {
        // Aspas duplicadas dentro do campo representam uma aspa literal.
        if (texto[i + 1] === '"') {
          atual += '"'
          i += 1
        } else {
          entreAspas = false
        }
      } else {
        atual += caractere
      }
      continue
    }

    if (caractere === '"') {
      entreAspas = true
    } else if (caractere === delimiter) {
      campos.push(atual)
      atual = ''
    } else if (caractere === '\n' || caractere === '\r') {
      // Consome o \n do par \r\n para não gerar uma linha vazia entre as duas.
      if (caractere === '\r' && texto[i + 1] === '\n') i += 1
      campos.push(atual)
      linhas.push(campos)
      campos = []
      atual = ''
    } else {
      atual += caractere
    }
  }

  if (atual.length > 0 || campos.length > 0) {
    campos.push(atual)
    linhas.push(campos)
  }
  return linhas
}

export function csvToJson(
  texto: string,
  options: CsvOptions = {},
): Array<Record<string, JsonValue>> {
  const { delimiter = ',', parseNumbers = false } = options
  if (texto.trim().length === 0) throw new Error('CSV vazio.')

  const [cabecalho, ...corpo] = parseCsvRows(texto, delimiter)
  if (cabecalho === undefined) throw new Error('CSV vazio.')

  return corpo
    .filter((linha) => linha.some((campo) => campo.length > 0))
    .map((linha) =>
      Object.fromEntries(
        cabecalho.map((coluna, indice) => {
          const bruto = linha[indice] ?? ''
          const valor: JsonValue =
            parseNumbers && bruto.trim() !== '' && !Number.isNaN(Number(bruto))
              ? Number(bruto)
              : bruto
          return [coluna, valor]
        }),
      ),
    )
}

export function jsonToCsv(
  registros: Array<Record<string, JsonValue>>,
  options: { delimiter?: string } = {},
): string {
  const { delimiter = ',' } = options
  if (registros.length === 0) throw new Error('Lista vazia: nada para converter.')

  // União das chaves de TODOS os registros. Usar só as do primeiro perderia
  // colunas em silêncio quando os objetos têm formatos diferentes.
  const colunas = [...new Set(registros.flatMap((registro) => Object.keys(registro)))]

  const escapar = (valor: JsonValue | undefined): string => {
    if (valor === undefined || valor === null) return ''
    const texto = typeof valor === 'object' ? JSON.stringify(valor) : String(valor)
    const precisaAspas = new RegExp(`["\\n\\r${escapeRegExp(delimiter)}]`).test(texto)
    return precisaAspas ? `"${texto.replace(/"/g, '""')}"` : texto
  }

  return [
    colunas.join(delimiter),
    ...registros.map((registro) =>
      colunas.map((coluna) => escapar(registro[coluna])).join(delimiter),
    ),
  ].join('\n')
}

/** O delimitador entra numa classe de caracteres; `-` e `]` mudariam o sentido. */
function escapeRegExp(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\-]/g, String.raw`\$&`)
}

// ------------------------------------------------------------------ YAML

export function jsonToYaml(texto: string): string {
  return dumpYaml(parseOrThrow(texto), { indent: 2, lineWidth: -1 })
}

export function yamlToJson(texto: string, options: { indent?: number } = {}): string {
  try {
    // `load` do js-yaml v4 e o antigo `safeLoad`: usa o schema padrao, que nao
    // constroi tipos arbitrarios. O equivalente perigoso seria passar
    // `{ schema: DEFAULT_FULL_SCHEMA }` — nao fazemos, e nao deve ser feito
    // aqui, porque a entrada vem colada pelo usuario.
    return JSON.stringify(loadYaml(texto), null, options.indent ?? 2)
  } catch (erro) {
    throw new Error(`YAML inválido — ${(erro as Error).message}`, { cause: erro })
  }
}

// ------------------------------------------------------------------ XML

export function xmlToJson(texto: string, options: { indent?: number } = {}): string {
  // `XMLParser` sozinho aceita entrada malformada e devolve resultado parcial;
  // validar antes é o que transforma isso em erro visível.
  const valido = XMLValidator.validate(texto)
  if (valido !== true) {
    throw new Error(`XML inválido — ${valido.err.msg} (linha ${valido.err.line})`)
  }
  const parser = new XMLParser({ ignoreAttributes: false, parseAttributeValue: true })
  return JSON.stringify(parser.parse(texto), null, options.indent ?? 2)
}

// ------------------------------------------------------------------ diff

export function diffJson(esquerda: string, direita: string): JsonDiff[] {
  return comparar(parseOrThrow(esquerda), parseOrThrow(direita), '')
}

function comparar(esquerda: JsonValue, direita: JsonValue, caminho: string): JsonDiff[] {
  if (Array.isArray(esquerda) && Array.isArray(direita)) {
    const diferencas: JsonDiff[] = []
    for (let i = 0; i < Math.max(esquerda.length, direita.length); i += 1) {
      const filho = `${caminho}[${i}]`
      if (i >= esquerda.length) {
        diferencas.push({ path: filho, kind: 'adicionado', right: direita[i] })
      } else if (i >= direita.length) {
        diferencas.push({ path: filho, kind: 'removido', left: esquerda[i] })
      } else {
        diferencas.push(...comparar(esquerda[i], direita[i], filho))
      }
    }
    return diferencas
  }

  if (ehObjeto(esquerda) && ehObjeto(direita)) {
    const chaves = [...new Set([...Object.keys(esquerda), ...Object.keys(direita)])]
    return chaves.flatMap((chave) => {
      const filho = caminho === '' ? chave : `${caminho}.${chave}`
      if (!(chave in esquerda)) {
        return [{ path: filho, kind: 'adicionado' as const, right: direita[chave] }]
      }
      if (!(chave in direita)) {
        return [{ path: filho, kind: 'removido' as const, left: esquerda[chave] }]
      }
      return comparar(esquerda[chave], direita[chave], filho)
    })
  }

  // `Object.is` distingue 1 de "1" e separa NaN de NaN, o que `===` não faz.
  return Object.is(esquerda, direita)
    ? []
    : [{ path: caminho, kind: 'alterado', left: esquerda, right: direita }]
}

function ehObjeto(valor: JsonValue): valor is { [k: string]: JsonValue } {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}
