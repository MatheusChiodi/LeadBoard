# Design System do LeadBoard

Documento irmão da arquitetura. Aqui se decide como o LeadBoard **parece** e como ele **se move**, com o mesmo grau de rigor que a seção 6 da arquitetura aplica à estrutura do frontend.

Duas premissas fixas, decididas antes de qualquer componente:

**O LeadBoard é escuro e só escuro.** Não existe tema claro, nem alternância, nem `prefers-color-scheme`. Isso não é uma versão inicial — é a decisão final, e a seção 3.0 explica o que ela libera e o que ela obriga.

**Todo componente tem entrada e saída animadas.** Não é enfeite — é a diferença entre uma interface que aparece e uma que é trocada na sua frente sem você entender o que mudou.

---

## 1. O que vem do portfólio

Herança direta de `mchiodi.vercel.app`, já validada e já sua:

| Elemento | Origem | Status no LeadBoard |
| --- | --- | --- |
| Acento `#FF5555` | 37 ocorrências no portfólio | Mantido, é a assinatura |
| Paleta Dracula | `#282A36`, `#44475A`, `#F8F8F2`, `#BD93F9`, `#FF79C6` | Vira a base semântica completa |
| Framer Motion 12 | já em uso | Vira sistema, não uso pontual |
| lucide-react | já em uso | Única fonte de ícone |
| Tailwind v4 | já em uso | Tokens via `@theme` |
| Sublinhado do centro (`.linkMenu`) | CSS próprio | Promovido a interação-assinatura |
| Scrollbar `#FF5555` | CSS próprio | Mantida, ajustada por superfície |

A descoberta útil: seu `#FF5555` **é** o vermelho do Dracula. A paleta inteira já é coerente com o acento que você usa há anos — não precisa inventar cor nenhuma, só formalizar o que já está lá.

### O que não pode vir junto

```css
* {
  transition: all 0.5s !important;
}
```

Essa regra precisa morrer antes da primeira linha do LeadBoard. Três motivos:

1. **`all` anima propriedade de layout.** `width`, `height`, `top`, `box-shadow` entram na conta. Num portfólio com trinta elementos isso passa despercebido; numa tabela com duzentas linhas, num canvas de diagrama ou num drag de card, é queda de frame garantida.
2. **`0.5s` é lento demais para aplicação.** Meio segundo é ritmo de página institucional. Ferramenta de trabalho responde em 120–220ms — acima disso o usuário sente que está esperando o software.
3. **`!important` briga com o Framer Motion.** As duas engines disputam a mesma propriedade e o resultado é animação que engasga sem motivo aparente.

A substituição é transição explícita por token, aplicada a `transform`, `opacity` e `color` — nunca a `all`.

---

## 2. Posicionamento contra o Monday

O Monday ganha por escala e por integração, e perde por ruído. Ele é claro, multicolorido e denso ao ponto de cansar: a cor lá carrega estado, status, prioridade e grupo ao mesmo tempo, e o resultado é um arco-íris onde nada se destaca porque tudo se destaca.

**A estratégia não é ser mais colorido. É ser o oposto disciplinado.**

| Dimensão | Monday | LeadBoard |
| --- | --- | --- |
| Base | claro, branco | escuro, `#282A36` |
| Cor | muitas, decorativas e semânticas ao mesmo tempo | uma de acento, o resto só semântico |
| Entrada | mouse, menus | teclado primeiro, `⌘K` |
| Navegação | abas e páginas | janelas no shell |
| Público | equipe inteira, qualquer papel | um tech lead, uso diário |
| Movimento | funcional, discreto | é parte do produto |

O que vale copiar do Monday: a densidade de informação (um dark app arejado demais parece brinquedo), a legibilidade dos chips de status e a ideia de board como visão primária.

O que não vale: chrome colorido, superfícies brancas, ilustração decorativa em estado vazio, e cor usada para diferenciar coisas que já se diferenciam por texto.

Sua vantagem competitiva real não é feature — é que o Monday precisa servir a todo mundo e o LeadBoard precisa servir a **uma** pessoa, cujo fluxo você conhece de cor. Design que assume um único usuário pode ser opinativo de um jeito que produto de mercado não pode.

---

## 3. Tokens

Todos como CSS variables e expostos ao Tailwind v4 por `@theme`. Componente de domínio **nunca** escreve cor literal — mesma regra 7 da arquitetura.

### 3.0 Escuro é a única superfície

Não existe tema claro. Nenhum componente recebe prop de tema, nenhuma cor tem contraparte clara, e não há `@media (prefers-color-scheme: light)` em lugar nenhum.

**O que isso apaga do projeto:**

- Zero alternador de tema e zero persistência dessa preferência. O `useTheme` que existe hoje no InfraDraw e no Focus **sai na migração** — é código morto no LeadBoard, e código morto de tema é o tipo que sobrevive anos.
- Storybook com um fundo só. Nada de revisar cada componente duas vezes.
- Nenhum par de token. Um valor por conceito.
- Metade da QA visual deixa de existir.

**O que isso não libera.** Tokens continuam obrigatórios. A razão deixa de ser "trocar para claro" e passa a ser densidade, contraste e ajuste global — mas hex literal espalhado continua sendo o que impede corrigir uma cor em um lugar só.

#### `color-scheme: dark` é obrigatório

```css
:root {
  color-scheme: dark;
}
```

Uma linha, e é a que mais evita vergonha. Sem ela, o navegador continua desenhando os controles nativos em claro: o seletor de `input type="date"` abre branco, o autofill do Chrome pinta o campo de amarelo, a scrollbar nativa volta cinza e o menu de contexto de `select` destoa de tudo. Tema escuro sem essa declaração é escuro só até alguém clicar num campo de data.

#### Nada de preto puro nem branco puro

`#000000` como fundo e `#FFFFFF` como texto produzem halation — o texto claro "vaza" na retina sobre fundo totalmente preto, e leitura longa vira cansaço. Seus tokens já resolvem isso: `#282A36` e `#F8F8F2`. É Dracula, e é por isso que ele foi desenhado assim.

#### Contraste medido, não estimado

Interface escura falha em contraste com mais frequência do que clara, porque texto esmaecido some. Os números reais dos tokens desta seção, em WCAG:

| Token | `--color-bg` | `--color-surface` | `--color-surface-2` | `--color-surface-3` |
| --- | --- | --- | --- | --- |
| `text` | 14.8 | 13.4 | 11.7 | 10.2 |
| `text-muted` | 6.8 | 6.1 | 5.4 | 4.7 |
| `text-subtle` | 3.4 | 3.0 | **2.7** | **2.3** |
| `accent` | 5.0 | 4.5 | 4.0 | 3.5 |
| `success` | 11.5 | 10.4 | 9.1 | 8.0 |
| `warning` | 9.3 | 8.4 | 7.3 | 6.4 |
| `focus` | 6.6 | 5.9 | 5.2 | 4.5 |

Três regras que saem daí:

- **`text-subtle` nunca em superfície elevada.** Em `surface-2` e `surface-3` ele fica em 2.7 e 2.3, abaixo de qualquer critério. Dentro de card e popover, metadado usa `text-muted`.
- **`accent` não é cor de texto corrido.** A 4.0 em `surface-2`, serve para rótulo grande, ícone e borda — não para parágrafo.
- **Texto sobre o acento é escuro, não branco.** `#F8F8F2` sobre `#FF5555` dá 2.95 e reprova; `#1A1B23` dá 5.46. Vale notar que o `Button` atual do portfólio faz exatamente isso — `text-white` com `hover:bg-[#ff5555]` — e é a primeira coisa a corrigir na migração.

#### O app é escuro; o que sai dele, não necessariamente

Essa é a consequência menos óbvia e a que mais dói se for descoberta tarde.

O InfraDraw exporta PNG, SVG e PDF. O Journal gera relatório que vai para a gestão. **Esses artefatos saem do app e são lidos em outro lugar** — colados num documento, num e-mail, num Confluence claro, ou impressos.

Diagrama exportado com fundo `#282A36` colado num documento branco fica horrível, e impresso gasta tinta e some. Então:

- Export do Draw oferece fundo claro como **padrão**, com o escuro como opção.
- Relatório do Journal é composto em tema claro na visualização de impressão e no HTML de e-mail, independentemente da interface.
- Paleta de export é um conjunto próprio de tokens, em `tokens/export.css`, separada da paleta de tela.

Isso não é tema claro voltando pela porta dos fundos. É reconhecer que a tela é escura porque você escolheu, e o papel é branco porque ele já era.

### Superfícies

Em interface escura, elevação é **luminosidade da superfície mais borda**, não sombra. Sombra preta sobre fundo preto não existe.

```css
@theme {
  --color-bg:          #21222C;  /* fundo da aplicação */
  --color-surface:     #282A36;  /* painel, janela */
  --color-surface-2:   #313341;  /* card sobre painel */
  --color-surface-3:   #3A3C4A;  /* popover, dropdown */
  --color-border:      #44475A;  /* borda padrão */
  --color-border-soft: #343746;  /* divisória interna */
}
```

Quatro níveis bastam. Se precisar de um quinto, o layout tem hierarquia demais.

### Texto

```css
  --color-text:        #F8F8F2;  /* primário */
  --color-text-muted:  #A6A9BC;  /* secundário, label */
  --color-text-subtle: #6272A4;  /* metadado, timestamp */
  --color-text-on-accent: #1A1B23;
```

`#6272A4` é o comment do Dracula: nasceu para ser lido como informação de segundo plano. Nunca use para texto que precisa ser lido — e nunca sobre `surface-2` ou `surface-3`, pelos números da seção 3.0.

### Acento e semântica

```css
  --color-accent:       #FF5555;
  --color-accent-hover: #FF6E6E;
  --color-accent-press: #CA3434;  /* já existia no seu CSS */

  --color-success: #50FA7B;
  --color-warning: #FFB86C;
  --color-danger:  #FF5555;
  --color-info:    #8BE9FD;
  --color-focus:   #BD93F9;
```

#### O conflito que precisa ser resolvido agora

**Seu acento e a cor de perigo são o mesmo vermelho.** Isso funciona num portfólio, onde não existe ação destrutiva. Num app com "excluir diagrama", "apagar entrada do diário" e "enviar relatório para a gestão", é um problema real: se o botão primário e o botão de destruir têm a mesma cor, a cor para de comunicar.

Resolução adotada:

- **Ação primária** é sólida em `--color-accent`. É a identidade, fica.
- **Ação destrutiva nunca é sólida.** Ela é outline com borda e texto em `--color-danger`, sobre superfície transparente, e sempre acompanhada de confirmação.
- A distinção passa a ser **peso**, não matiz: cheio é o que você quer fazer, vazado é o que dá para desfazer difícil.
- Estado de erro em formulário usa `--color-danger` em borda e mensagem, nunca em preenchimento — senão um campo inválido compete visualmente com o botão de salvar.

`--color-focus` é roxo de propósito: o anel de foco precisa ser visível sobre um botão vermelho, e vermelho sobre vermelho não é.

### Espaçamento, raio, tipografia

```css
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px;
  --space-4: 16px; --space-6: 24px; --space-8: 32px; --space-12: 48px;

  --radius-sm: 6px;  --radius-md: 10px;  --radius-lg: 14px;  --radius-full: 999px;

  --font-sans: 'Inter Variable', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
```

Base 4px. Mono não é decoração: id de diagrama, duração de pomodoro, timestamp do diário e qualquer número que o olho compara em coluna vão em mono, com `font-variant-numeric: tabular-nums`. Número proporcional em tabela desalinha e faz a interface parecer amadora por um motivo que ninguém consegue nomear.

### Densidade

Dois modos, trocados por token e não por componente:

```css
[data-density='comfortable'] { --row-h: 44px; --pad-y: var(--space-3); }
[data-density='compact']     { --row-h: 32px; --pad-y: var(--space-1); }
```

Diário e notas pedem `comfortable`. Tabela de tarefas e lista de ferramentas pedem `compact`. Essa é exatamente a alavanca que permite competir com a densidade do Monday sem perder respiro nas telas de leitura.

---

## 4. Sistema de movimento

O requisito é que **todo componente tenha entrada e saída**. Isso só funciona como sistema — se cada tela inventar seu número, o resultado é um app que se move em dezessete ritmos diferentes, que é pior do que não animar.

### Durações e curvas

```css
  --dur-instant: 80ms;   /* feedback de toque, hover */
  --dur-fast:   140ms;   /* saída de overlay, tooltip */
  --dur-base:   200ms;   /* entrada padrão */
  --dur-slow:   320ms;   /* modal, painel lateral */
  --dur-shell:  420ms;   /* abrir e fechar janela */

  --ease-out:  cubic-bezier(0.16, 1, 0.3, 1);    /* entrada */
  --ease-in:   cubic-bezier(0.4, 0, 1, 1);       /* saída */
  --ease-soft: cubic-bezier(0.4, 0, 0.2, 1);     /* estado, cor */
```

### Entrada e saída não são simétricas

A regra mais importante da seção, e a que quase todo app erra:

> **Saída dura cerca de 60% da entrada e usa curva de aceleração.**

Entrar pode ser expressivo: o elemento está chegando, você quer que a pessoa perceba de onde ele veio. Sair precisa ser rápido: a pessoa já decidiu, o elemento agora é obstáculo. Modal que fecha na mesma velocidade que abre passa sensação de software lento — e é o defeito que mais aparece em app bonito.

Entrada 320ms com `--ease-out`, saída 190ms com `--ease-in`.

### Só `transform` e `opacity`

Animar `width`, `height`, `top`, `left`, `margin` ou `box-shadow` força recálculo de layout a cada frame. Em lista, canvas ou drag, isso é queda de frame visível.

Toda a linguagem de movimento do LeadBoard se expressa em quatro coisas: `opacity`, `translate`, `scale`, `rotate`. Precisa mudar tamanho? `scale`. Precisa mudar posição? `translate`. Precisa de elevação? Troca a superfície, não a sombra animada.

Exceção única e justificada: `layout` do Framer Motion, que usa transform por baixo e é o que permite o card viajar entre colunas do board.

### Saída só existe se alguém segurar o componente

Detalhe técnico que precisa virar regra de arquitetura, não lembrete: **um componente desmontado não anima.** A saída depende de `AnimatePresence` manter o nó vivo até o fim da animação.

Se cada página lembrar de embrulhar, metade vai esquecer. Então quem embrulha é o design system:

```tsx
export function Presence({ show, variant = 'fadeRise', children }: PresenceProps) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {show && (
        <motion.div
          variants={motionVariants[variant]}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

Página de domínio nunca escreve `AnimatePresence` na mão. Ela usa `Presence` ou um componente que já o contém. Mesma lógica de "página não monta URL, usa a flag".

### Variantes centralizadas

Números mágicos de animação são tão proibidos quanto hex literal. Tudo vive em `design-system/motion/variants.ts`:

```ts
export const motionVariants = {
  fadeRise: {
    hidden:  { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE_OUT } },
    exit:    { opacity: 0, y: 6, transition: { duration: 0.13, ease: EASE_IN } },
  },
  popIn: {
    hidden:  { opacity: 0, scale: 0.94 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: EASE_OUT } },
    exit:    { opacity: 0, scale: 0.97, transition: { duration: 0.12, ease: EASE_IN } },
  },
  slideOver: {
    hidden:  { opacity: 0, x: 24 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.32, ease: EASE_OUT } },
    exit:    { opacity: 0, x: 16, transition: { duration: 0.19, ease: EASE_IN } },
  },
  windowOpen: {
    hidden:  { opacity: 0, scale: 0.92, y: 16 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.42, ease: EASE_OUT } },
    exit:    { opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.25, ease: EASE_IN } },
  },
} as const;
```

Seu portfólio já converge para esse vocabulário sozinho — `opacity + y: 20`, `scale: 0.8`, `whileHover: 1.05`, `whileTap: 0.95` são os padrões que mais aparecem lá. O sistema só está dando nome e limite ao que você já faz por instinto.

### Cascata em lista

Lista que entra item a item é o efeito mais bonito e o mais fácil de estragar:

- 30ms entre itens, `fadeRise`.
- **Máximo de 8 itens com atraso.** Do nono em diante, entrada simultânea. Uma lista de 200 tarefas com 30ms cada leva seis segundos para terminar de aparecer — é lentidão disfarçada de charme.
- Cascata só na primeira montagem. Reordenar, filtrar ou paginar usa `layout`, não `stagger`.
- Item removido sai em 130ms e os vizinhos fecham o espaço com `layout`.

### Animação de layout é o golpe contra o Monday

`layoutId` é onde o LeadBoard ganha diferença perceptível:

- Card de tarefa que muda de coluna **desliza**, não pisca.
- Janela que maximiza cresce a partir de onde estava.
- Entrada do diário que vira item do relatório viaja para o compositor.
- Ferramenta aberta a partir do card do catálogo expande do próprio card.

Custa pouco (é um atributo), e é a diferença entre "mudou alguma coisa" e "eu vi o que mudou".

### `prefers-reduced-motion` é obrigatório

```ts
const reduce = useReducedMotion();
const variants = reduce ? motionVariants.fadeOnly : motionVariants[variant];
```

Com movimento reduzido: só `opacity`, 100ms, sem `translate`, sem `scale`, sem cascata. Isso é acessibilidade e também respeito por quem usa o app oito horas por dia — animação que encanta na primeira semana irrita na terceira se não puder ser desligada.

### Orçamento de performance

- 60fps com 200 linhas em tela e uma lista animando.
- Nenhuma animação bloqueia entrada: tudo interrompível, sempre.
- `will-change` só durante a animação, nunca fixo no CSS.
- Canvas do InfraDraw é zona livre de Framer Motion: React Flow já controla transform do próprio nó, e as duas engines na mesma propriedade é jank garantido.

---

## 5. Inventário de componentes

Cada linha é um contrato de movimento. Componente novo só entra no design system com essa linha preenchida.

| Componente | Entrada | Saída | Duração (in/out) |
| --- | --- | --- | --- |
| Janela do shell | `windowOpen`, origem no ícone do dock | escala para o dock | 420 / 250 |
| Modal | `popIn` + backdrop em fade | `popIn` reverso | 320 / 190 |
| Painel lateral | `slideOver` da direita | volta pela direita | 320 / 190 |
| Dropdown / menu | `popIn`, origem no gatilho | fade + scale 0.97 | 160 / 110 |
| Tooltip | fade + `y: 4`, atraso de 400ms | fade sem atraso | 120 / 80 |
| Toast | entra de baixo com `y: 16` | sai lateral com `x: 24` | 240 / 160 |
| Card de lista | `fadeRise` em cascata | fade + `y: 6`, vizinhos com `layout` | 200 / 130 |
| Linha de tabela | fade, sem `y` | fade, colapso por `layout` | 160 / 110 |
| Aba / painel | crossfade com `mode="wait"` | — | 180 / 120 |
| Command palette | `popIn` + backdrop desfocado | fade rápido | 200 / 120 |
| Card do board | `layoutId` entre colunas | — | 280 spring |
| Entrada do diário | `fadeRise`, acento pulsa 1x se veio de evento | fade | 200 / 130 |
| Timer do pomodoro | anel em `pathLength` | fade | 400 / 200 |
| Estado vazio | fade + `scale: 0.96` | fade | 240 / 140 |
| Skeleton | fade in imediato | crossfade com conteúdo real | 0 / 200 |

Regra dos dois estados irmãos: skeleton e conteúdo real **nunca** aparecem em sequência com um salto. O conteúdo entra por cima em crossfade, no mesmo tamanho — senão a página pula e a sensação é de página quebrada, não de página carregando.

---

## 6. Estrutura do design system

Espelha a seção 6 da arquitetura, com `motion/` como camada de primeira classe:

```
frontend/src/design-system/
├─ tokens/
│  ├─ colors.css       superfícies, texto, acento, semântica
│  ├─ space.css        escala 4px, raio, densidade
│  ├─ type.css         famílias, escala, tabular-nums
│  ├─ motion.css       durações e curvas como CSS vars
│  └─ export.css       paleta clara, só para artefato que sai do app
├─ motion/
│  ├─ variants.ts      fadeRise, popIn, slideOver, windowOpen
│  ├─ Presence.tsx     wrapper de AnimatePresence
│  ├─ Stagger.tsx      cascata com corte em 8
│  └─ useReducedMotion.ts
├─ primitives/
│  ├─ Surface/         níveis de elevação
│  ├─ Text/            escala tipográfica
│  └─ Stack/ Grid/     layout
├─ components/
│  ├─ Button/ Input/ Select/ Checkbox/
│  ├─ Card/ Table/ Tabs/ Badge/ Avatar/
│  ├─ Modal/ Drawer/ Dropdown/ Tooltip/ Toast/
│  ├─ Window/ Dock/    shell, vindos do Focus
│  └─ CommandPalette/
└─ patterns/
   ├─ EmptyState/
   ├─ PageHeader/
   └─ DataView/        tabela, board e lista sobre o mesmo dado
```

### Storybook precisa de uma story a mais

A regra da arquitetura — componente sem story não entra na branch — ganha um item: **toda story tem um caso `Motion`**, com um botão que monta e desmonta o componente.

Story estática prova que a entrada existe. Só a desmontagem prova que a saída existe, e saída quebrada é invisível em review: o componente simplesmente some, e ninguém percebe que deveria ter saído animando.

---

## 7. Assinatura visual

O que faz alguém olhar uma tela e reconhecer que é o LeadBoard, não mais um dark SaaS:

**Sublinhado que abre do centro.** Seu `.linkMenu` vira o comportamento de foco de toda navegação: aba ativa, item de menu, link. É gesto seu, já pronto, e ninguém mais faz.

**Vidro só no chrome.** Dock, backdrop do command palette e barra de janela ativa usam `backdrop-filter`. Conteúdo não usa. Vidro em card de tabela e em painel de leitura é onde o glassmorphism vira ilegibilidade — e num app que você usa o dia inteiro, contraste vence estilo.

**Um fio de acento na janela em foco.** Borda superior de 2px em `--color-accent` marca qual janela recebe o teclado. Resolve um problema real do shell de janelas e vira identidade visual de graça.

**Mono para número, sans para texto.** Duração, id, timestamp, contagem. Dá cara de ferramenta de engenharia sem precisar de cliché de terminal.

**Estado vazio em traço, não em ilustração.** Line art de um traço em `--color-text-subtle`, com o acento em um detalhe só. Ilustração colorida em estado vazio é onde produto sério vira landing page.

**Scrollbar de 8px com thumb `#FF5555`.** Já é sua, já está no portfólio, e é o tipo de detalhe que ninguém consegue nomear mas todo mundo registra.

---

## 8. `⌘K` é o produto, não um atalho

O Monday assume que você navega com o mouse porque assume que você usa o produto às vezes. Você vai usar o LeadBoard o dia inteiro, entre interrupções, com uma incidente aberto em outra tela.

O command palette precisa abrir tudo: criar entrada no diário, iniciar pomodoro, abrir uma das 44 ferramentas, buscar diagrama, compor relatório. Você já tem a busca inteligente do Tools — é ela, promovida a porta de entrada do produto inteiro.

Isso muda uma decisão de design: **toda ação do app precisa ter nome.** Se uma funcionalidade só existe como ícone numa barra, ela não existe no palette. Nomear tudo é trabalho chato e é o que separa ferramenta de protótipo bonito.

---

## 9. Ordem de construção

Design system não se constrói por componente, se constrói por camada — senão o quinto componente obriga a refazer os quatro primeiros.

1. `tokens/` completo, inclusive `motion.css`. Nada visual antes disso.
2. `motion/`: variantes, `Presence`, `Stagger`, `useReducedMotion`.
3. `primitives/`: `Surface`, `Text`, `Stack`. É onde a elevação escura é resolvida de vez.
4. `Button`, `Input`, `Card` — os três que aparecem em toda tela, cada um com story `Motion`.
5. Shell: `Window` e `Dock`, migrados do Focus e reescritos sobre os tokens.
6. `CommandPalette`, porque ele define como as ações são nomeadas e isso influencia todo o resto.
7. Overlays: `Modal`, `Drawer`, `Dropdown`, `Toast`.
8. `DataView` (tabela, board, lista), o componente mais caro e o que compete de frente com o Monday.

Estado vazio, skeleton e erro entram junto com cada componente, nunca depois. São eles que decidem se o app parece acabado — e são sempre os primeiros a serem adiados.
