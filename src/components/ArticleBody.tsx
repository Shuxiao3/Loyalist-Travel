import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { type JSXConvertersFunction, RichText as LexicalRichText } from '@payloadcms/richtext-lexical/react'

import { headingId, textOf } from '@/lib/outline'

import styles from './ArticleBody.module.css'

const BOLD = 1

// Article text with two additions over the plain renderer: headings carry
// ids so the table of contents can jump to them, and a paragraph that opens
// with a bold "Pro tip" becomes a callout card.
export function ArticleBody({ data }: { data?: SerializedEditorState | null }) {
  if (!data) return null
  const seen = new Map<string, number>()
  const converters: JSXConvertersFunction = ({ defaultConverters }) => ({
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
  })
  return (
    <div className="prose">
      <LexicalRichText data={data} converters={converters} />
    </div>
  )
}
