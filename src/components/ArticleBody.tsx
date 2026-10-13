import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import type { DefaultNodeTypes, SerializedParagraphNode, SerializedTableCellNode, SerializedTableNode, SerializedTableRowNode } from '@payloadcms/richtext-lexical'
import { type JSXConvertersFunction, RichText as LexicalRichText } from '@payloadcms/richtext-lexical/react'

import { headingId, textOf } from '@/lib/outline'
import type { Media } from '@/payload-types'

import styles from './ArticleBody.module.css'
import { TableScroll } from './TableScroll'

const BOLD = 1

// Lexical's TableCellHeaderStates: 1 marks a cell of the header row, 2 a
// cell of the header column.
const HEADER_ROW = 1
const HEADER_COLUMN = 2

type Nodes = DefaultNodeTypes | SerializedTableNode | SerializedTableRowNode | SerializedTableCellNode

// Article text with a few additions over the plain renderer: headings carry
// ids so the table of contents can jump to them, a paragraph that opens with
// a bold "Pro tip" becomes a callout card, a quote becomes a callout without
// the label, photos render as figures with caption and credit, and tables get
// a real header row inside a wrapper that scrolls sideways on narrow screens,
// fading the edge that hides more columns and keeping the first column put.
export function ArticleBody({ data }: { data?: SerializedEditorState | null }) {
  if (!data) return null
  const seen = new Map<string, number>()
  const converters: JSXConvertersFunction<Nodes> = ({ defaultConverters }) => ({
    ...defaultConverters,
    heading: ({ node, nodesToJSX }) => {
      const Tag = node.tag as 'h2' | 'h3'
      let id = headingId(textOf(node as never))
      const k = seen.get(id) ?? 0
      seen.set(id, k + 1)
      if (k) id = `${id}-${k + 1}`
      return <Tag id={id}>{nodesToJSX({ nodes: node.children })}</Tag>
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
            <span className={styles.tipLabel}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z" />
              </svg>
              Pro tip
            </span>
            <p>{nodesToJSX({ nodes: rest })}</p>
          </aside>
        )
      }
      const children = nodesToJSX({ nodes: node.children })
      return <p>{children.length ? children : <br />}</p>
    },
    quote: ({ node, nodesToJSX }) => <blockquote className={styles.quote}>{nodesToJSX({ nodes: node.children })}</blockquote>,
    upload: ({ node }) => {
      // Only a populated media document can be drawn; a bare id means the
      // query did not reach this depth.
      const media = node.value
      if (!media || typeof media !== 'object') return null
      const { url, alt, credit, width, height, mimeType, filename } = media as Media
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
      const text = (caption + (by ? ` Photo: ${by}.` : '')).trim()
      return (
        <figure className={styles.figure}>
          <img src={url} alt={alt ?? ''} width={width ?? undefined} height={height ?? undefined} loading="lazy" decoding="async" />
          {text && <figcaption>{text}</figcaption>}
        </figure>
      )
    },
    table: ({ node, nodesToJSX }) => {
      const rows = node.children.filter((r): r is SerializedTableRowNode => r.type === 'tablerow')
      const cells = (row: SerializedTableRowNode) => row.children.filter((c): c is SerializedTableCellNode => c.type === 'tablecell')
      const cols = rows.reduce((max, row) => Math.max(max, cells(row).reduce((n, c) => n + (c.colSpan ?? 1), 0)), 0)
      const first = rows[0]
      const headCells = first ? cells(first) : []
      const hasHead = headCells.length > 0 && headCells.every((c) => (c.headerState & HEADER_ROW) !== 0)
      const body = hasHead ? rows.slice(1) : rows
      const text = (c: SerializedTableCellNode) => textOf(c as never).trim()
      // a table wider than a phone column scrolls there; three columns of
      // short cells lay out in the column as they are
      const longest = rows.reduce((max, row) => cells(row).reduce((m, c) => Math.max(m, text(c).length), max), 0)
      const wide = cols >= 4 || (cols === 3 && longest > 100)
      const headers = headCells.map(text).filter(Boolean)
      return (
        // the min-width steps stop at six columns, so wider tables share that step
        <TableScroll cols={Math.min(cols, 6)} wide={wide} label={headers.length ? `Table: ${headers.join(', ')}` : 'Table'}>
          <table>
            {hasHead && first && <thead>{nodesToJSX({ nodes: [first] })}</thead>}
            <tbody>{nodesToJSX({ nodes: body })}</tbody>
          </table>
        </TableScroll>
      )
    },
    tablerow: ({ node, nodesToJSX }) => <tr>{nodesToJSX({ nodes: node.children })}</tr>,
    tablecell: ({ node, nodesToJSX }) => {
      // A cell that holds a single paragraph renders the paragraph's inline
      // content directly; anything richer keeps its blocks.
      const kid = node.children.length === 1 ? node.children[0] : undefined
      const only = kid?.type === 'paragraph' ? (kid as SerializedParagraphNode) : null
      const content = nodesToJSX({ nodes: only ? only.children : node.children })
      const colSpan = node.colSpan && node.colSpan > 1 ? node.colSpan : undefined
      const rowSpan = node.rowSpan && node.rowSpan > 1 ? node.rowSpan : undefined
      if (node.headerState & HEADER_ROW) {
        return (
          <th scope="col" colSpan={colSpan} rowSpan={rowSpan}>
            {content}
          </th>
        )
      }
      if (node.headerState & HEADER_COLUMN) {
        return (
          <th scope="row" colSpan={colSpan} rowSpan={rowSpan}>
            {content}
          </th>
        )
      }
      return (
        <td colSpan={colSpan} rowSpan={rowSpan}>
          {content}
        </td>
      )
    },
  })
  return (
    <div className="prose">
      <LexicalRichText data={data} converters={converters as JSXConvertersFunction} />
    </div>
  )
}
