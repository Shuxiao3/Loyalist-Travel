import type { SerializedEditorState, SerializedLexicalNode } from '@payloadcms/richtext-lexical/lexical'
import type { DefaultNodeTypes, SerializedParagraphNode, SerializedTableCellNode, SerializedTableNode, SerializedTableRowNode } from '@payloadcms/richtext-lexical'
import { type JSXConvertersFunction, RichText as LexicalRichText } from '@payloadcms/richtext-lexical/react'
import type { ReactNode } from 'react'

import { headingId, outlineOf, textOf } from '@/lib/outline'
import type { Media } from '@/payload-types'

import styles from './ArticleBody.module.css'

const BOLD = 1

// Lexical's TableCellHeaderStates: 1 marks a cell of the header row, 2 a
// cell of the header column.
const HEADER_ROW = 1
const HEADER_COLUMN = 2

type Nodes = DefaultNodeTypes | SerializedTableNode | SerializedTableRowNode | SerializedTableCellNode
type Node = SerializedLexicalNode & { tag?: string; children?: Node[] }

// The headings that open an article's end notes: its sources and image credits.
const NOTES_HEADING = /^(sources?|image credits?|photo credits?|sources and (image|photo) credits?)$/i

// The id each heading carries, worked out once for the whole text so the ids hold however the
// text is split up. The section headings (h2) take theirs from outlineOf (src/lib/outline.ts),
// which builds the contents, so every contents link lands on its heading; the other headings
// then take a free id, never one a section heading already has.
function headingIds(data: SerializedEditorState, nodes: Node[]): Map<Node, string> {
  const ids = new Map<Node, string>()
  const used = new Set<string>()
  const outline = outlineOf(data)
  // outlineOf lists the h2s with any text, in order
  const sections = nodes.filter((n) => n.type === 'heading' && n.tag === 'h2' && textOf(n as never).trim())
  sections.forEach((n, i) => {
    const id = outline[i]?.id
    if (!id) return
    ids.set(n, id)
    used.add(id)
  })
  for (const n of nodes) {
    if (n.type !== 'heading' || ids.has(n)) continue
    const base = headingId(textOf(n as never))
    let id = base
    for (let k = 2; used.has(id); k++) id = `${base}-${k}`
    ids.set(n, id)
    used.add(id)
  }
  return ids
}

// Article text in the kit's article style (the mockups' article.html and article-news.html).
// Headings carry ids so the contents can jump to them; a paragraph that opens with a bold
// "Pro tip" becomes a tip panel, a quote a panel without the label; photos render as figures
// with caption and credit; tables keep their header row and header column, scroll sideways
// inside themselves when too wide, and on phones turn into one labelled block per row (the
// kit's .table-stack). The sources and image credits at the end (from a "Sources" or "Image
// credits" heading on) read as end notes: the same words, in smaller type under a rule.
export function ArticleBody({ data, className }: { data?: SerializedEditorState | null; className?: string }) {
  if (!data) return null
  const all = ((data.root as unknown as Node).children ?? []) as Node[]
  const ids = headingIds(data, all)
  const notesAt = all.findIndex((n) => n.type === 'heading' && n.tag === 'h2' && NOTES_HEADING.test(textOf(n as never).trim()))
  const part = (children: Node[]): SerializedEditorState => ({ ...data, root: { ...data.root, children: children as never } })
  const text = notesAt >= 0 ? part(all.slice(0, notesAt)) : data
  const notes = notesAt >= 0 ? part(all.slice(notesAt)) : null

  const converters: JSXConvertersFunction<Nodes> = ({ defaultConverters }) => ({
    ...defaultConverters,
    heading: ({ node, nodesToJSX }) => {
      const Tag = node.tag as 'h2' | 'h3' | 'h4'
      return <Tag id={ids.get(node as never) ?? headingId(textOf(node as never))}>{nodesToJSX({ nodes: node.children })}</Tag>
    },
    paragraph: ({ node, nodesToJSX }) => {
      const first = node.children[0] as { type?: string; text?: string; format?: number } | undefined
      const isTip = first?.type === 'text' && ((first.format ?? 0) & BOLD) !== 0 && /^pro[\s-]?tip\b/i.test(first.text ?? '')
      if (isTip) {
        const rest = node.children.slice(1)
        // drop the punctuation that followed the label
        const next = rest[0] as { type?: string; text?: string } | undefined
        if (next?.type === 'text' && next.text) next.text = next.text.replace(/^[\s:.–—-]+/, '')
        return (
          <aside className={styles.tip}>
            <p className={styles.tipLabel}>Pro tip</p>
            <p>{nodesToJSX({ nodes: rest })}</p>
          </aside>
        )
      }
      const children = nodesToJSX({ nodes: node.children })
      return <p>{children.length ? children : <br />}</p>
    },
    quote: ({ node, nodesToJSX }) => <blockquote className={styles.quote}>{nodesToJSX({ nodes: node.children })}</blockquote>,
    horizontalrule: () => <hr className={styles.rule} />,
    upload: ({ node }) => {
      // Only a populated media document can be drawn; a bare id means the
      // query did not reach this depth.
      const media = node.value
      if (!media || typeof media !== 'object') return null
      const { url: stored, staticUrl, alt, credit, width, height, mimeType, filename } = media as Media
      // a photo the site serves itself shows from there
      const url = staticUrl || stored
      if (!url) return null
      if (mimeType && !mimeType.startsWith('image/')) {
        return (
          <a href={url} rel="noopener noreferrer">
            {filename ?? url}
          </a>
        )
      }
      const fields = (node.fields ?? {}) as { caption?: unknown }
      const caption = typeof fields.caption === 'string' ? fields.caption.trim() : ''
      const by = (credit ?? '').trim()
      const words = (caption + (by ? ` Photo: ${by}.` : '')).trim()
      return (
        <figure className={styles.figure}>
          <img src={url} alt={alt ?? ''} width={width ?? undefined} height={height ?? undefined} loading="lazy" decoding="async" />
          {words && <figcaption className="caption">{words}</figcaption>}
        </figure>
      )
    },
    table: ({ node, nodesToJSX }) => {
      const rows = node.children.filter((r): r is SerializedTableRowNode => r.type === 'tablerow')
      const cells = (row: SerializedTableRowNode) => row.children.filter((c): c is SerializedTableCellNode => c.type === 'tablecell')
      const first = rows[0]
      const headCells = first ? cells(first) : []
      const hasHead = headCells.length > 0 && headCells.every((c) => (c.headerState & HEADER_ROW) !== 0)
      const body = hasHead ? rows.slice(1) : rows
      const cellText = (c: SerializedTableCellNode) => textOf(c as never).trim()
      // each column's heading, for the labels a stacked row shows on a phone
      const heads: string[] = []
      for (const c of headCells) for (let i = 0; i < (c.colSpan ?? 1); i++) heads.push(cellText(c))
      const cols = rows.reduce((max, row) => Math.max(max, cells(row).reduce((n, c) => n + (c.colSpan ?? 1), 0)), 0)
      const named = heads.filter(Boolean)
      return (
        <div className={styles.table} role="region" aria-label={named.length ? `Table: ${named.join(', ')}` : 'Table'} tabIndex={0}>
          <table className={`table${hasHead ? ' table-stack' : ''}${cols === 2 ? ` ${styles.cols2}` : ''}`}>
            {hasHead && first && <thead>{nodesToJSX({ nodes: [first] })}</thead>}
            <tbody>
              {body.map((row, r) => {
                let col = 0
                return (
                  <tr key={r}>
                    {cells(row).map((cell, i) => {
                      const at = col
                      col += cell.colSpan ?? 1
                      return <Cell key={i} cell={cell} label={hasHead ? heads[at] : undefined} content={nodesToJSX({ nodes: cellContent(cell) })} />
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )
    },
    tablerow: ({ node, nodesToJSX }) => <tr>{nodesToJSX({ nodes: node.children })}</tr>,
    tablecell: ({ node, nodesToJSX }) => <Cell cell={node} content={nodesToJSX({ nodes: cellContent(node) })} />,
  })

  return (
    <div className={`prose ${styles.body}${className ? ` ${className}` : ''}`} data-article-text="">
      <LexicalRichText data={text} converters={converters as JSXConvertersFunction} disableContainer />
      {notes && (
        <div className={styles.notes}>
          <LexicalRichText data={notes} converters={converters as JSXConvertersFunction} disableContainer />
        </div>
      )}
    </div>
  )
}

// A cell that holds a single paragraph renders the paragraph's inline content directly;
// anything richer keeps its blocks.
function cellContent(cell: SerializedTableCellNode) {
  const kid = cell.children.length === 1 ? cell.children[0] : undefined
  return kid?.type === 'paragraph' ? (kid as SerializedParagraphNode).children : cell.children
}

// A header-row cell is a column head, a header-column cell a row head (the first line of a
// stacked row on a phone); every other cell carries its column's label for the stacked view.
function Cell({ cell, content, label }: { cell: SerializedTableCellNode; content: ReactNode; label?: string }) {
  const colSpan = cell.colSpan && cell.colSpan > 1 ? cell.colSpan : undefined
  const rowSpan = cell.rowSpan && cell.rowSpan > 1 ? cell.rowSpan : undefined
  if (cell.headerState & HEADER_ROW) {
    return (
      <th scope="col" colSpan={colSpan} rowSpan={rowSpan}>
        {content}
      </th>
    )
  }
  if (cell.headerState & HEADER_COLUMN) {
    return (
      <th scope="row" colSpan={colSpan} rowSpan={rowSpan}>
        {content}
      </th>
    )
  }
  return (
    <td colSpan={colSpan} rowSpan={rowSpan} data-label={label || undefined}>
      {content}
    </td>
  )
}
