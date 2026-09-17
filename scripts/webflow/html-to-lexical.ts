// Converts Webflow rich text (a small HTML subset: p, ul/ol/li, strong/b,
// em/i, u, a, br, and the rare figure/img) into Payload's Lexical JSON.
// Anything unrecognised is flattened to text so nothing is lost silently;
// images are dropped and reported, since the media pipeline is a later step.

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
type Block = Paragraph | List

export type LexicalRoot = {
  root: { type: 'root'; children: Block[]; direction: 'ltr'; format: ''; indent: 0; version: 1 }
}

export type ConvertResult = { value: LexicalRoot | null; droppedImages: string[] }

const paragraph = (): Paragraph => ({ type: 'paragraph', children: [], direction: 'ltr', format: '', indent: 0, version: 1, textFormat: 0, textStyle: '' })
const listItem = (value: number): ListItem => ({ type: 'listitem', children: [], value, direction: 'ltr', format: '', indent: 0, version: 1 })
const list = (tag: 'ul' | 'ol'): List => ({ type: 'list', listType: tag === 'ul' ? 'bullet' : 'number', tag, start: 1, children: [], direction: 'ltr', format: '', indent: 0, version: 1 })

export function htmlToLexical(html: string | null | undefined): ConvertResult {
  const droppedImages: string[] = []
  if (!html || !html.trim()) return { value: null, droppedImages }

  const blocks: Block[] = []
  let current: Paragraph | ListItem | null = null
  let currentList: List | null = null
  let format = 0
  let link: LinkNode | null = null

  const target = (): Inline[] => {
    if (link) return link.children
    if (!current) {
      current = paragraph()
      blocks.push(current)
    }
    return current.children
  }

  const closeBlock = () => {
    if (current && current.type === 'paragraph' && current.children.length === 0) {
      blocks.splice(blocks.indexOf(current), 1)
    }
    current = null
  }

  const parser = new Parser(
    {
      onopentag(name, attrs) {
        switch (name) {
          case 'p':
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6':
          case 'div':
          case 'blockquote':
            closeBlock()
            current = paragraph()
            blocks.push(current)
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
            if (attrs.href) {
              link = { type: 'link', fields: { linkType: 'custom', url: attrs.href, newTab: attrs.target === '_blank' }, children: [], direction: 'ltr', format: '', indent: 0, version: 3 }
              target().push(link)
            }
            break
          case 'img':
            if (attrs.src) droppedImages.push(attrs.src)
            break
          default:
            break
        }
      },
      ontext(text) {
        const cleaned = text.replace(/\s+/g, ' ')
        if (!cleaned) return
        if (!current && !link && cleaned.trim() === '') return
        target().push({ type: 'text', text: cleaned, format, detail: 0, mode: 'normal', style: '', version: 1 })
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
    const items = block.type === 'list' ? block.children : [block]
    for (const item of items) trimInline(item.children)
  }

  const children = blocks.filter((b) => (b.type === 'list' ? b.children.length > 0 : b.children.length > 0))
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
