/**
 * Minificadores — funções puras, sem React.
 *
 * Todos são scanners que percorrem o texto mantendo estado, NUNCA
 * `replace(/regex/)` sobre o arquivo inteiro. A diferença não é estilo: um
 * `replace(/\/\/.*$/gm, '')` num arquivo JS trunca `"https://x.dev"` no meio e
 * entrega código quebrado sem avisar. Uma ferramenta que corrompe em silêncio é
 * pior que uma que não existe.
 *
 * Limite honesto: isto reduz tamanho removendo espaço e comentário. Não renomeia
 * variável, não elimina código morto e não reordena nada — para isso o caminho é
 * um minificador de verdade (esbuild, terser), não um utilitário de navegador.
 */

type Aspas = '"' | "'" | '`' | null

/**
 * Cofre de trechos intocáveis.
 *
 * Não basta o scanner reconhecer strings: o colapso de espaço acontece DEPOIS,
 * sobre o texto inteiro, e colapsaria o espaço de dentro delas também. Trocar
 * cada trecho por um marcador antes e devolvê-lo no fim é o que garante que
 * `"oi   mundo"` sobreviva.
 *
 * O marcador vem da área de uso privado do Unicode: não aparece em código-fonte,
 * não é whitespace nem operador — então nenhuma regra de colapso o toca — e,
 * diferente de NUL, não é caractere de controle dentro de um regex.
 *
 * As sentinelas em volta do índice não são decorativas: sem elas o padrão de volta
 * seria `/(\d+)/`, que casaria com qualquer número do próprio código e trocaria
 * `const a = 1` pelo trecho guardado na posição 1.
 */
const MARCA = ''

class Cofre {
  private readonly trechos: string[] = []

  guardar(trecho: string): string {
    this.trechos.push(trecho)
    return `${MARCA}${this.trechos.length - 1}${MARCA}`
  }

  devolver(texto: string): string {
    return texto.replace(
      new RegExp(`${MARCA}(\\d+)${MARCA}`, 'g'),
      (_, indice: string) => this.trechos[Number(indice)],
    )
  }
}

// ------------------------------------------------------------------ CSS

export function minifyCss(css: string): string {
  const cofre = new Cofre()
  let saida = ''
  let aspas: Aspas = null
  let literal = ''

  for (let i = 0; i < css.length; i += 1) {
    const atual = css[i]

    if (aspas !== null) {
      literal += atual
      if (atual === aspas && css[i - 1] !== '\\') {
        saida += cofre.guardar(literal)
        aspas = null
      }
      continue
    }

    if (atual === '"' || atual === "'") {
      aspas = atual
      literal = atual
      continue
    }

    // Comentário só conta fora de string — `content: "/* x */"` é texto.
    if (atual === '/' && css[i + 1] === '*') {
      const fim = css.indexOf('*/', i + 2)
      i = fim === -1 ? css.length : fim + 1
      continue
    }

    saida += atual
  }

  const compacto = saida
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>~+])\s*/g, '$1')
    // O último `;` antes de `}` é redundante.
    .replace(/;}/g, '}')
    .replace(/@media\s*/g, '@media')
    .trim()

  return cofre.devolver(compacto)
}

// ------------------------------------------------------------------ JS

/**
 * Minificação conservadora de JavaScript.
 *
 * O scanner precisa distinguir quatro contextos que se parecem: comentário,
 * string, template literal e regex literal. Os três últimos podem conter `//`,
 * e um minificador ingênuo corta o arquivo ali.
 *
 * Quebras de linha são preservadas porque o JavaScript insere ponto e vírgula
 * automaticamente no fim da linha (ASI): juntar duas linhas pode mudar o que o
 * programa faz.
 */
export function minifyJs(js: string): string {
  const cofre = new Cofre()
  let saida = ''
  let aspas: Aspas = null
  let emRegex = false
  let literal = ''

  for (let i = 0; i < js.length; i += 1) {
    const atual = js[i]
    const proximo = js[i + 1]

    if (aspas !== null) {
      literal += atual
      if (atual === '\\') {
        // Copia o escapado inteiro para `\"` não encerrar a string.
        literal += js[i + 1] ?? ''
        i += 1
      } else if (atual === aspas) {
        saida += cofre.guardar(literal)
        aspas = null
      }
      continue
    }

    if (emRegex) {
      literal += atual
      if (atual === '\\') {
        literal += js[i + 1] ?? ''
        i += 1
      } else if (atual === '/') {
        // Os flags (g, i, m…) fazem parte do literal e não podem ser separados.
        while (/[a-z]/.test(js[i + 1] ?? '')) {
          i += 1
          literal += js[i]
        }
        saida += cofre.guardar(literal)
        emRegex = false
      }
      continue
    }

    if (atual === '"' || atual === "'" || atual === '`') {
      aspas = atual
      literal = atual
      continue
    }

    if (atual === '/' && proximo === '/') {
      while (i < js.length && js[i] !== '\n') i += 1
      // Mantém a quebra de linha: ela pode ser o fim do comando (ASI).
      saida += '\n'
      continue
    }

    if (atual === '/' && proximo === '*') {
      const fim = js.indexOf('*/', i + 2)
      i = fim === -1 ? js.length : fim + 1
      saida += ' '
      continue
    }

    // `/` inicia regex quando o token anterior não pode terminar uma expressão;
    // depois de `)`, identificador ou número ele é divisão.
    if (atual === '/' && iniciaRegex(saida)) {
      emRegex = true
      literal = atual
      continue
    }

    saida += atual
  }

  const compacto = saida
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n+ */g, '\n')
    .replace(/\s*([=+\-*/%<>!&|,;:?{}()[\]])\s*/g, '$1')
    .trim()

  return cofre.devolver(compacto)
}

function iniciaRegex(anterior: string): boolean {
  const ultimo = anterior.trimEnd().slice(-1)
  return ultimo === '' || !/[\w)\]$]/.test(ultimo)
}

// ------------------------------------------------------------------ HTML

const PRESERVAR = ['pre', 'textarea', 'script', 'style']

/**
 * Minificação de HTML preservando o que é sensível a espaço.
 *
 * O conteúdo de `<pre>`, `<textarea>`, `<script>` e `<style>` é extraído antes e
 * devolvido depois: colapsar espaço dentro deles muda o que aparece na tela ou
 * quebra o código.
 *
 * O espaço entre palavras é colapsado, nunca removido — `oi     mundo` vira
 * `oi mundo`, e não `oimundo`.
 */
export function minifyHtml(html: string): string {
  const guardados: string[] = []

  const protegido = html.replace(
    new RegExp(`<(${PRESERVAR.join('|')})\\b[^>]*>[\\s\\S]*?</\\1>`, 'gi'),
    (trecho) => {
      guardados.push(trecho)
      return `${MARCA}${guardados.length - 1}${MARCA}`
    },
  )

  const minificado = protegido
    // Comentário condicional do IE é instrução, não comentário: preservar.
    .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim()

  return minificado.replace(
    new RegExp(`${MARCA}(\\d+)${MARCA}`, 'g'),
    (_, indice: string) => guardados[Number(indice)],
  )
}
