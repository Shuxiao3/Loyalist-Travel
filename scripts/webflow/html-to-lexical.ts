// Converts Webflow rich text and the article pipeline's HTML (a small subset:
// p, h2/h3, ul/ol/li, blockquote, hr, table/thead/tbody/tr/th/td, strong/b,
// em/i, u, a, br, img) into Payload's Lexical JSON. Anything unrecognised is
// flattened to text so nothing is lost silently. An <img> becomes an upload
// node when the caller has already put its src into Media (options.uploads);
// otherwise it is dropped and reported.

import { randomUUID } from 'crypto'

import { Parser } from 'htmlparser2'

const BOLD = 1
const ITALIC = 2
const UNDERLINE = 8

type TextNode = { type: 'text'; text: string; format: number; detail: 0; mode: 'normal'; style: ''; version: 1 }
type LineBreak = { type: 'linebreak'; version: 1 }
type LinkNode = {
  type: 'link'
  fields: { linkType: 'custom'; url: string; newTab: boolean }
  children: Inline[]
  direction: 'ltr'
  format: ''
  indent: 0
  version: 3
}
type Inline = TextNode | LineBreak | LinkNode
type Paragraph = { type: 'paragraph'; children: Inline[]; direction: 'ltr'; format: ''; indent: 0; version: 1; textFormat: 0; textStyle: '' }
type ListItem = { type: 'listitem'; children: Inline[]; value: number; direction: 'ltr'; format: ''; indent: 0; version: 1 }
type List = { type: 'list'; listType: 'bullet' | 'number'; tag: 'ul' | 'ol'; start: 1; children: ListItem[]; direction: 'ltr'; format: ''; indent: 0; version: 1 }
type Heading = { type: 'heading'; tag: 'h2' | 'h3'; children: Inline[]; direction: 'ltr'; format: ''; indent: 0; version: 1 }
// Payload's BlockquoteFeature node (Lexical QuoteNode): one paragraph of inline content.
type Quote = { type: 'quote'; children: Inline[]; direction: 'ltr'; format: ''; indent: 0; version: 1 }
// Payload's HorizontalRuleFeature node.
type HorizontalRule = { type: 'horizontalrule'; version: 1 }
// @lexical/table nodes, as EXPERIMENTAL_TableFeature stores them. headerState
// is TableCellHeaderStates: 1 ROW (a header-row cell), 2 COLUMN (a header-
// column cell), 3 both, 0 NO_STATUS.
const HEADER_ROW = 1
const HEADER_COLUMN = 2
type TableCell = {
  type: 'tablecell'
  headerState: 0 | 1 | 2 | 3
  colSpan: 1
  rowSpan: 1
  backgroundColor: null
  children: [Paragraph]
  direction: 'ltr'
  format: ''
  indent: 0
  version: 1
}
type TableRow = { type: 'tablerow'; children: TableCell[]; direction: 'ltr'; format: ''; indent: 0; version: 1 }
// colWidths is only for the admin editor, which otherwise draws every column
// 92px wide; the site's renderer sizes columns itself.
type Table = { type: 'table'; children: TableRow[]; colWidths?: number[]; direction: 'ltr'; format: ''; indent: 0; version: 1 }
// Payload's UploadFeature node (version 3: value is the media id, id is unique per node).
type Upload = { type: 'upload'; relationTo: 'media'; value: number; fields: { caption: string }; id: string; format: ''; version: 3 }
type Block = Paragraph | Heading | List | Quote | HorizontalRule | Table | Upload

export type LexicalRoot = {
  root: { type: 'root'; children: Block[]; direction: 'ltr'; format: ''; indent: 0; version: 1 }
}

export type ConvertResult = { value: LexicalRoot | null; droppedImages: string[] }

// uploads: <img src> -> Media id, for images the caller has already stored.
export type HtmlToLexicalOptions = { uploads?: Map<string, number> }

const paragraph = (): Paragraph => ({ type: 'paragraph', children: [], direction: 'ltr', format: '', indent: 0, version: 1, textFormat: 0, textStyle: '' })
const listItem = (value: number): ListItem => ({ type: 'listitem', children: [], value, direction: 'ltr', format: '', indent: 0, version: 1 })
const list = (tag: 'ul' | 'ol'): List => ({ type: 'list', listType: tag === 'ul' ? 'bullet' : 'number', tag, start: 1, children: [], direction: 'ltr', format: '', indent: 0, version: 1 })
const quote = (): Quote => ({ type: 'quote', children: [], direction: 'ltr', format: '', indent: 0, version: 1 })
const table = (): Table => ({ type: 'table', children: [], direction: 'ltr', format: '', indent: 0, version: 1 })
const tableRow = (): TableRow => ({ type: 'tablerow', children: [], direction: 'ltr', format: '', indent: 0, version: 1 })
const tableCell = (headerState: TableCell['headerState']): TableCell => ({ type: 'tablecell', headerState, colSpan: 1, rowSpan: 1, backgroundColor: null, children: [paragraph()], direction: 'ltr', format: '', indent: 0, version: 1 })

// A link keeps a web, mail or phone scheme, or none (a path or a fragment);
// any other scheme, javascript: above all, is not a link. Whitespace and
// control characters are ignored, as browsers ignore them in a scheme.
const safeHref = (href: string): boolean => {
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(href.replace(/[\s\u0000-\u001f]+/g, ''))
  return !scheme || ['http', 'https', 'mailto', 'tel'].includes(scheme[1].toLowerCase())
}

export function htmlToLexical(html: string | null | undefined, options: HtmlToLexicalOptions = {}): ConvertResult {
  const droppedImages: string[] = []
  if (!html || !html.trim()) return { value: null, droppedImages }
  const uploads = options.uploads ?? new Map<string, number>()

  const blocks: Block[] = []
  // the inline container text goes into: a top-level paragraph, heading or
  // quote, a list item, or a table cell's paragraph
  let current: Paragraph | Heading | ListItem | Quote | null = null
  let currentList: List | null = null
  let currentTable: Table | null = null
  let currentRow: TableRow | null = null
  let currentCell: TableCell | null = null
  let format = 0
  let link: LinkNode | null = null

  const target = (): Inline[] => {
    if (link) return link.children
    if (!current) {
      if (currentCell) {
        current = currentCell.children[0]
      } else {
        current = paragraph()
        blocks.push(current)
      }
    }
    return current.children
  }

  // Ends the open inline container. An empty top-level paragraph or heading
  // is removed; a cell's paragraph stays, since every cell holds exactly one.
  const closeBlock = () => {
    if (current && (current.type === 'paragraph' || current.type === 'heading') && current.children.length === 0) {
      const i = blocks.indexOf(current)
      if (i >= 0) blocks.splice(i, 1)
    }
    current = null
  }

  // Where a new top-level block goes.
  const pushBlock = (block: Block) => {
    closeBlock()
    blocks.push(block)
  }

  const parser = new Parser(
    {
      onopentag(name, attrs) {
        switch (name) {
          case 'h2':
          case 'h3': {
            if (currentCell) break
            const heading: Heading = { type: 'heading', tag: name, children: [], direction: 'ltr', format: '', indent: 0, version: 1 }
            pushBlock(heading)
            current = heading
            break
          }
          case 'p':
          case 'h1':
          case 'h4':
          case 'h5':
          case 'h6':
          case 'div': {
            // a quote or a table cell is one paragraph; a further <p> inside
            // it continues on a new line rather than starting a block
            if (current?.type === 'quote') {
              if (current.children.length) current.children.push({ type: 'linebreak', version: 1 })
              break
            }
            if (currentCell) {
              const cell = currentCell.children[0]
              if (cell.children.length) cell.children.push({ type: 'linebreak', version: 1 })
              current = cell
              break
            }
            const p = paragraph()
            pushBlock(p)
            current = p
            break
          }
          case 'blockquote': {
            const q = quote()
            pushBlock(q)
            current = q
            break
          }
          case 'hr':
            pushBlock({ type: 'horizontalrule', version: 1 })
            break
          case 'ul':
          case 'ol':
            closeBlock()
            currentList = list(name)
            blocks.push(currentList)
            break
          case 'li':
            if (!currentList) {
              currentList = list('ul')
              blocks.push(currentList)
            }
            current = listItem(currentList.children.length + 1)
            currentList.children.push(current)
            break
          case 'table':
            closeBlock()
            currentTable = table()
            blocks.push(currentTable)
            break
          case 'tr':
            closeBlock()
            if (!currentTable) {
              currentTable = table()
              blocks.push(currentTable)
            }
            currentRow = tableRow()
            currentTable.children.push(currentRow)
            break
          case 'th':
          case 'td': {
            closeBlock()
            if (!currentTable) {
              currentTable = table()
              blocks.push(currentTable)
            }
            if (!currentRow) {
              currentRow = tableRow()
              currentTable.children.push(currentRow)
            }
            // under a header row, a body row's first cell names what the row
            // is about, so it is a row header
            const firstRow = currentTable.children[0]
            const underHeader = firstRow !== currentRow && firstRow.children.length > 0 && firstRow.children.every((c) => (c.headerState & HEADER_ROW) !== 0)
            const rowHeader = underHeader && currentRow.children.length === 0 ? HEADER_COLUMN : 0
            currentCell = tableCell(((name === 'th' ? HEADER_ROW : 0) | rowHeader) as TableCell['headerState'])
            currentRow.children.push(currentCell)
            current = currentCell.children[0]
            break
          }
          case 'br':
            target().push({ type: 'linebreak', version: 1 })
            break
          case 'strong':
          case 'b':
            format |= BOLD
            break
          case 'em':
          case 'i':
            format |= ITALIC
            break
          case 'u':
            format |= UNDERLINE
            break
          case 'a':
            // an unsafe href leaves its text as plain text
            if (attrs.href && safeHref(attrs.href)) {
              const parent = target()
              link = { type: 'link', fields: { linkType: 'custom', url: attrs.href, newTab: attrs.target === '_blank' }, children: [], direction: 'ltr', format: '', indent: 0, version: 3 }
              parent.push(link)
            }
            break
          case 'img': {
            if (!attrs.src) break
            const id = uploads.get(attrs.src)
            if (id == null) {
              droppedImages.push(attrs.src)
              break
            }
            pushBlock({ type: 'upload', relationTo: 'media', value: id, fields: { caption: attrs['data-caption'] ?? '' }, id: randomUUID(), format: '', version: 3 })
            break
          }
          default:
            break
        }
      },
      ontext(text) {
        const cleaned = text.replace(/\s+/g, ' ')
        if (!cleaned) return
        if (!current && !link && cleaned.trim() === '') return
        // the parser hands the text around an entity (&amp;) over in pieces;
        // one run of equally formatted text is one node, as the editor keeps it
        const siblings = target()
        const last = siblings[siblings.length - 1]
        if (last && last.type === 'text' && last.format === format) last.text = (last.text + cleaned).replace(/ {2,}/g, ' ')
        else siblings.push({ type: 'text', text: cleaned, format, detail: 0, mode: 'normal', style: '', version: 1 })
      },
      onclosetag(name) {
        switch (name) {
          case 'p':
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6':
          case 'div':
            if (current?.type === 'quote' || currentCell) break
            closeBlock()
            break
          case 'blockquote':
            closeBlock()
            break
          case 'li':
            current = null
            break
          case 'ul':
          case 'ol':
            currentList = null
            current = null
            break
          case 'th':
          case 'td':
            currentCell = null
            current = null
            break
          case 'tr':
            currentCell = null
            currentRow = null
            current = null
            break
          case 'table':
            if (currentTable) {
              // equal columns that together fill the admin editor's column
              // (about 780px); a wide table scrolls there
              const cols = Math.max(0, ...currentTable.children.map((row) => row.children.length))
              if (cols > 0) currentTable.colWidths = Array<number>(cols).fill(Math.max(130, Math.floor(780 / cols)))
            }
            currentCell = null
            currentRow = null
            currentTable = null
            current = null
            break
          case 'strong':
          case 'b':
            format &= ~BOLD
            break
          case 'em':
          case 'i':
            format &= ~ITALIC
            break
          case 'u':
            format &= ~UNDERLINE
            break
          case 'a':
            link = null
            break
          default:
            break
        }
      },
    },
    { decodeEntities: true },
  )
  parser.write(html)
  parser.end()
  closeBlock()

  // Trim leading and trailing whitespace inside each block so paragraphs do
  // not start with a stray space from source formatting.
  for (const block of blocks) {
    if (block.type === 'list') for (const item of block.children) trimInline(item.children)
    else if (block.type === 'table') for (const row of block.children) for (const cell of row.children) trimInline(cell.children[0].children)
    else if (block.type !== 'horizontalrule' && block.type !== 'upload') trimInline(block.children)
  }

  const children = blocks.filter((b) => {
    switch (b.type) {
      case 'horizontalrule':
      case 'upload':
        return true
      case 'table':
        return b.children.some((row) => row.children.length > 0)
      default:
        return b.children.length > 0
    }
  })
  if (children.length === 0) return { value: null, droppedImages }
  return { value: { root: { type: 'root', children, direction: 'ltr', format: '', indent: 0, version: 1 } }, droppedImages }
}

function trimInline(children: Inline[]) {
  const first = children[0]
  if (first && first.type === 'text') first.text = first.text.replace(/^\s+/, '')
  const last = children[children.length - 1]
  if (last && last.type === 'text') last.text = last.text.replace(/\s+$/, '')
  for (let i = children.length - 1; i >= 0; i--) {
    const c = children[i]
    if (c.type === 'text' && c.text === '') children.splice(i, 1)
  }
}

// Plain-text word count of a Lexical document, for read-time estimates.
export function lexicalWordCount(doc: LexicalRoot | null): number {
  if (!doc) return 0
  let words = 0
  const walk = (nodes: unknown[]) => {
    for (const n of nodes as { type: string; text?: string; children?: unknown[] }[]) {
      if (n.type === 'text' && n.text) words += n.text.trim().split(/\s+/).filter(Boolean).length
      if (n.children) walk(n.children)
    }
  }
  walk(doc.root.children)
  return words
}
