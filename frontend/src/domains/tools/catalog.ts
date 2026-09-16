/**
 * Catálogo das ferramentas.
 *
 * Fonte única de verdade: nome, categoria, busca e carregamento saem daqui.
 * No projeto de origem cadastrar uma ferramenta exigia editar TRÊS lugares —
 * `data/tools.ts`, o arquivo do componente e um `<Route>` em `App.tsx` — e os
 * três saíam de sincronia sozinhos (o id `hexto-rgb` apontava para a rota
 * `/hex-to-rgb` no arquivo `HexParaRgb.tsx`).
 *
 * Aqui a entrada carrega o próprio componente por `import()` dinâmico, o que faz
 * duas coisas: elimina o terceiro lugar e dá code splitting — as 44 ferramentas
 * deixam de entrar no bundle inicial de quem abriu o app para ver o diário.
 *
 * O catálogo é estático de propósito (§4): ele não muda por usuário. Só favorito
 * e histórico justificam estado no servidor.
 */

import type { ComponentType } from 'react'

export type ToolCategory =
  | 'devtools'
  | 'conversores'
  | 'design'
  | 'seguranca'
  | 'documentos'
  | 'texto'
  | 'seo'
  | 'rede'

export interface ToolDefinition {
  id: string
  name: string
  category: ToolCategory
  description: string
  /** Termos alternativos de busca — o usuário procura "guid", não "uuid". */
  keywords: string[]
  /**
   * `true` para as três que saem pelo Http Client do backend (§4).
   * As outras 41 são função pura e nunca deixam a máquina.
   */
  needsNetwork?: boolean
  load: () => Promise<{ default: ComponentType }>
}

export const CATEGORY_LABEL: Record<ToolCategory, string> = {
  devtools: 'Dev',
  conversores: 'Conversores',
  design: 'Design',
  seguranca: 'Segurança',
  documentos: 'Documentos',
  texto: 'Texto',
  seo: 'SEO',
  rede: 'Rede',
}

/**
 * Placeholder das telas que ainda não foram portadas.
 *
 * Explícito de propósito: a ferramenta aparece no catálogo e a tela avisa que
 * ela ainda não existe, em vez de sumir da lista ou abrir uma página em branco.
 */
const pendente = () => import('./ui/EmBreve')

export const TOOLS: ToolDefinition[] = [
  // ---------------------------------------------------------------- documentos
  { id: 'gerador-cpf', name: 'Gerador de CPF', category: 'documentos', description: 'Gera CPFs válidos para testes.', keywords: ['cpf', 'documento', 'validar'], load: () => import('./ui/GeradorCpf') },
  { id: 'gerador-cnpj', name: 'Gerador de CNPJ', category: 'documentos', description: 'Gera CNPJs válidos para testes.', keywords: ['cnpj', 'empresa', 'documento'], load: () => import('./ui/GeradorCnpj') },
  { id: 'busca-cep', name: 'Busca de CEP', category: 'documentos', description: 'Consulta endereço a partir do CEP.', keywords: ['cep', 'endereço', 'correios', 'viacep'], needsNetwork: true, load: pendente },
  { id: 'gerador-cartao', name: 'Gerador de Cartão de Crédito', category: 'documentos', description: 'Gera número de cartão que passa no Luhn, para teste.', keywords: ['cartão', 'credito', 'luhn', 'teste'], load: pendente },

  // ------------------------------------------------------------------ devtools
  { id: 'gerador-uuid', name: 'Gerador de UUID', category: 'devtools', description: 'Gera identificadores únicos versão 4.', keywords: ['uuid', 'guid', 'id', 'identificador'], load: () => import('./ui/GeradorUuid') },
  { id: 'gerador-qrcode', name: 'Gerador de QR Code', category: 'devtools', description: 'Transforma texto ou link em QR Code.', keywords: ['qr', 'qrcode', 'código'], load: pendente },
  { id: 'formatador-json', name: 'Formatador de JSON', category: 'devtools', description: 'Valida, indenta e ordena JSON.', keywords: ['json', 'formatar', 'indentar', 'beautify'], load: () => import('./ui/FormatadorJson') },
  { id: 'gerador-cron', name: 'Gerador de Cron', category: 'devtools', description: 'Monta e explica expressões cron em português.', keywords: ['cron', 'agendamento', 'crontab'], load: pendente },
  { id: 'regex-tester', name: 'Testador de Regex', category: 'devtools', description: 'Testa expressões regulares e mostra grupos capturados.', keywords: ['regex', 'regexp', 'expressão regular'], load: pendente },
  { id: 'comparador-json', name: 'Comparador de JSON', category: 'devtools', description: 'Mostra as diferenças entre dois JSON.', keywords: ['json', 'diff', 'comparar'], load: pendente },
  { id: 'minificador-css', name: 'Minificador de CSS', category: 'devtools', description: 'Remove espaços e comentários de CSS.', keywords: ['css', 'minificar', 'comprimir'], load: () => import('./ui/MinificadorCss') },
  { id: 'minificador-js', name: 'Minificador de JS', category: 'devtools', description: 'Remove espaços e comentários de JavaScript.', keywords: ['js', 'javascript', 'minificar'], load: () => import('./ui/MinificadorJs') },
  { id: 'minificador-html', name: 'Minificador de HTML', category: 'devtools', description: 'Remove espaços e comentários de HTML.', keywords: ['html', 'minificar'], load: () => import('./ui/MinificadorHtml') },
  { id: 'editor-markdown', name: 'Editor de Markdown', category: 'devtools', description: 'Edita Markdown com pré-visualização.', keywords: ['markdown', 'md', 'editor', 'preview'], load: pendente },
  { id: 'visualizador-json', name: 'Visualizador de JSON', category: 'devtools', description: 'Navega por um JSON em árvore.', keywords: ['json', 'visualizar', 'árvore'], load: () => import('./ui/VisualizadorJson') },
  { id: 'visualizador-csv', name: 'Visualizador de CSV', category: 'devtools', description: 'Mostra CSV como tabela.', keywords: ['csv', 'tabela', 'planilha'], load: pendente },

  // --------------------------------------------------------------- conversores
  { id: 'base64-encode', name: 'Base64 Encode', category: 'conversores', description: 'Codifica texto em Base64.', keywords: ['base64', 'codificar', 'encode'], load: () => import('./ui/Base64Encode') },
  { id: 'base64-decode', name: 'Base64 Decode', category: 'conversores', description: 'Decodifica Base64 para texto.', keywords: ['base64', 'decodificar', 'decode'], load: () => import('./ui/Base64Decode') },
  { id: 'json-yaml', name: 'Conversor JSON ↔ YAML', category: 'conversores', description: 'Converte entre JSON e YAML.', keywords: ['json', 'yaml', 'yml', 'converter'], load: () => import('./ui/JsonYaml') },
  { id: 'csv-json', name: 'Conversor CSV ↔ JSON', category: 'conversores', description: 'Converte entre CSV e JSON.', keywords: ['csv', 'json', 'planilha'], load: pendente },
  { id: 'xml-json', name: 'Conversor XML ↔ JSON', category: 'conversores', description: 'Converte entre XML e JSON.', keywords: ['xml', 'json', 'converter'], load: () => import('./ui/XmlJson') },
  { id: 'url-encode', name: 'URL Encode/Decode', category: 'conversores', description: 'Codifica e decodifica componentes de URL.', keywords: ['url', 'percent', 'encode', 'uri'], load: () => import('./ui/UrlEncode') },
  { id: 'html-entities', name: 'HTML Entities', category: 'conversores', description: 'Codifica e decodifica entidades HTML.', keywords: ['html', 'entities', 'escape'], load: () => import('./ui/HtmlEntities') },
  { id: 'timestamp', name: 'Conversor de Timestamp', category: 'conversores', description: 'Converte entre epoch e data legível.', keywords: ['timestamp', 'unix', 'epoch', 'data'], load: pendente },
  { id: 'hex-rgb', name: 'Conversor HEX → RGB', category: 'conversores', description: 'Converte cor hexadecimal para RGB.', keywords: ['hex', 'rgb', 'cor'], load: pendente },
  { id: 'rgb-hex', name: 'Conversor RGB → HEX', category: 'conversores', description: 'Converte cor RGB para hexadecimal.', keywords: ['rgb', 'hex', 'cor'], load: pendente },

  // -------------------------------------------------------------------- design
  { id: 'color-picker', name: 'Seletor de Cor', category: 'design', description: 'Escolhe uma cor e copia em vários formatos.', keywords: ['cor', 'color', 'picker', 'paleta'], load: pendente },
  { id: 'gerador-gradiente', name: 'Gerador de Gradiente', category: 'design', description: 'Monta gradientes CSS visualmente.', keywords: ['gradiente', 'gradient', 'css', 'cor'], load: pendente },
  { id: 'compressor-imagem', name: 'Compressor de Imagem', category: 'design', description: 'Reduz o peso de uma imagem para a web.', keywords: ['imagem', 'comprimir', 'otimizar'], load: pendente },
  { id: 'gerador-favicon', name: 'Gerador de Favicon', category: 'design', description: 'Gera favicons nos tamanhos padrão.', keywords: ['favicon', 'ícone', 'icon'], load: pendente },
  { id: 'buscador-emoji', name: 'Buscador de Emoji', category: 'design', description: 'Busca e copia emoji por nome.', keywords: ['emoji', 'emoticon', 'símbolo'], load: pendente },

  // ----------------------------------------------------------------- segurança
  { id: 'hash-md5', name: 'Hash MD5', category: 'seguranca', description: 'Calcula o hash MD5 de um texto.', keywords: ['md5', 'hash', 'checksum'], load: () => import('./ui/HashMd5') },
  { id: 'hash-sha256', name: 'Hash SHA-256', category: 'seguranca', description: 'Calcula o hash SHA-256 de um texto.', keywords: ['sha', 'sha256', 'hash'], load: () => import('./ui/HashSha256') },
  { id: 'jwt-decoder', name: 'Decodificador de JWT', category: 'seguranca', description: 'Lê o conteúdo de um token JWT sem verificar a assinatura.', keywords: ['jwt', 'token', 'decodificar'], load: () => import('./ui/JwtDecoder') },
  { id: 'gerador-senha', name: 'Gerador de Senhas', category: 'seguranca', description: 'Gera senha forte com os conjuntos escolhidos.', keywords: ['senha', 'password', 'aleatório'], load: () => import('./ui/GeradorSenha') },

  // --------------------------------------------------------------------- texto
  { id: 'gerador-slug', name: 'Gerador de Slug', category: 'texto', description: 'Transforma um título em slug de URL.', keywords: ['slug', 'url', 'permalink'], load: () => import('./ui/GeradorSlug') },
  { id: 'gerador-lorem', name: 'Gerador de Lorem Ipsum', category: 'texto', description: 'Gera texto de preenchimento.', keywords: ['lorem', 'ipsum', 'placeholder'], load: pendente },
  { id: 'conversor-texto', name: 'Conversor de Texto', category: 'texto', description: 'Troca a caixa do texto entre dez estilos.', keywords: ['maiúscula', 'minúscula', 'camel', 'snake', 'kebab'], load: () => import('./ui/ConversorTexto') },

  // ----------------------------------------------------------------------- seo
  { id: 'meta-tags', name: 'Gerador de Meta Tags', category: 'seo', description: 'Monta meta tags com Open Graph e Twitter Card.', keywords: ['meta', 'seo', 'og', 'twitter'], load: pendente },
  { id: 'robots-txt', name: 'Gerador de Robots.txt', category: 'seo', description: 'Monta o arquivo robots.txt.', keywords: ['robots', 'seo', 'crawler'], load: pendente },
  { id: 'sitemap', name: 'Gerador de Sitemap', category: 'seo', description: 'Monta o sitemap.xml a partir de uma lista de URLs.', keywords: ['sitemap', 'xml', 'seo'], load: pendente },

  // ---------------------------------------------------------------------- rede
  { id: 'dns-lookup', name: 'Consulta de DNS', category: 'rede', description: 'Consulta registros DNS de um domínio.', keywords: ['dns', 'domínio', 'mx', 'cname'], needsNetwork: true, load: pendente },
  { id: 'ip-locator', name: 'Localizador de IP', category: 'rede', description: 'Mostra a localização aproximada de um IP.', keywords: ['ip', 'geolocalização', 'localizar'], needsNetwork: true, load: pendente },
  { id: 'gerador-mac', name: 'Gerador de MAC Address', category: 'rede', description: 'Gera endereços MAC para teste.', keywords: ['mac', 'endereço', 'rede'], load: () => import('./ui/GeradorMac') },
]

/** Busca por nome, descrição e sinônimos, ignorando acento e caixa. */
export function searchTools(termo: string, categoria?: ToolCategory): ToolDefinition[] {
  const alvo = normalizar(termo)
  return TOOLS.filter((tool) => {
    if (categoria !== undefined && tool.category !== categoria) return false
    if (alvo === '') return true
    return (
      normalizar(tool.name).includes(alvo) ||
      normalizar(tool.description).includes(alvo) ||
      tool.keywords.some((palavra) => normalizar(palavra).includes(alvo))
    )
  })
}

export function toolById(id: string): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.id === id)
}

export function countByCategory(): Record<ToolCategory, number> {
  const contagem = Object.fromEntries(
    Object.keys(CATEGORY_LABEL).map((chave) => [chave, 0]),
  ) as Record<ToolCategory, number>
  for (const tool of TOOLS) contagem[tool.category] += 1
  return contagem
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}
