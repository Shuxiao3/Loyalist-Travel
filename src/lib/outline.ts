import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

// Headings of a Lexical document, for a table of contents. Ids are derived
// from the heading text, so the body renderer and the list agree without
// storing anything.
export type OutlineItem = { id: string; text: string; tag: 'h2' | 'h3' }

export function headingId(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'section'
  )
}

type Node = { type?: string; tag?: string; text?: string; children?: Node[] }

export function textOf(node: Node): string {
  if (node.type === 'text') return node.text ?? ''
  return (node.children ?? []).map(textOf).join('')
}

export function outlineOf(doc: SerializedEditorState | null | undefined, tags: ('h2' | 'h3')[] = ['h2']): OutlineItem[] {
  const root = (doc?.root as Node | undefined)?.children ?? []
  const seen = new Map<string, number>()
  const out: OutlineItem[] = []
  for (const n of root) {
    if (n.type !== 'heading' || !tags.includes(n.tag as 'h2' | 'h3')) continue
    const text = textOf(n).trim()
    if (!text) continue
    let id = headingId(text)
    const k = seen.get(id) ?? 0
    seen.set(id, k + 1)
    if (k) id = `${id}-${k + 1}`
    out.push({ id, text, tag: n.tag as 'h2' | 'h3' })
  }
  return out
}
