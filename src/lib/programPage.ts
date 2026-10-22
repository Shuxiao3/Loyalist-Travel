// What the program pages need beyond the shared queries (mockup: program.html): the tiers'
// benefits as plain lines, the milestone table read from the program's milestone guide, the
// program's guides, its brands with their segment, and whether it has club lounges on record.

import type { Where } from 'payload'

import type { Article, StatusLevel } from '@/payload-types'

import { getPayloadClient } from './payload'

const published: Where = { _status: { equals: 'published' } }

// The program as a hotel's name says it, for "Stayed at a Hyatt?" and "Hyatt club lounges"
const SHORT: Record<string, { name: string; article: 'a' | 'an' }> = {
  'world-of-hyatt': { name: 'Hyatt', article: 'a' },
  'marriott-bonvoy': { name: 'Marriott', article: 'a' },
  'hilton-honors': { name: 'Hilton', article: 'a' },
  'ihg-one-rewards': { name: 'IHG', article: 'an' },
}
export const programShortName = (p: { slug: string; name: string }) => SHORT[p.slug]?.name ?? p.name
export const programStayQuestion = (p: { slug: string; name: string }) => {
  const s = SHORT[p.slug]
  if (!s) return 'Stayed at one of these hotels?'
  return s.name === 'IHG' ? 'Stayed at an IHG hotel?' : `Stayed at ${s.article} ${s.name}?`
}

// ---------- Rich text as plain lines ----------

type LexNode = { type?: string; tag?: string; text?: string; format?: number | string; children?: LexNode[] }
const kids = (n: LexNode | undefined): LexNode[] => (Array.isArray(n?.children) ? n.children : [])
const textOf = (n: LexNode): string => (typeof n.text === 'string' ? n.text : n.type === 'linebreak' ? ' ' : kids(n).map(textOf).join(''))
const rootOf = (data: unknown): LexNode | undefined => (data && typeof data === 'object' ? (data as { root?: LexNode }).root : undefined)

// A rich text field that holds nothing but bullet lists, as its items; null when it holds
// anything else (paragraphs of text, headings), so the page shows the rich text as written.
export function listLines(data: unknown): string[] | null {
  const root = rootOf(data)
  if (!root) return null
  const lines: string[] = []
  for (const n of kids(root)) {
    if (n.type === 'list') {
      for (const li of kids(n)) {
        const t = textOf(li).replace(/\s+/g, ' ').trim()
        if (t) lines.push(t)
      }
    } else if (n.type === 'paragraph' && !textOf(n).trim()) {
      continue
    } else {
      return null
    }
  }
  return lines.length ? lines : null
}

// The tier's benefits from its short description, minus the requirement before the semicolon,
// split into its clauses (for a tier whose benefits field is empty).
export function benefitLinesFromDescription(t: StatusLevel): string[] {
  const text = (t.shortDescription ?? '').replace(/^[^;]*;\s*/, '').trim()
  if (!text || !t.shortDescription?.includes(';')) return []
  return text
    .replace(/\.$/, '')
    .split(/,\s*(?![^()]*\))/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
}

// ---------- Milestones from the guide ----------

export type MilestoneRow = {
  nights: string // "20", "70, 80 and 90", "110 to 140"
  all: string | null // what everyone receives
  choice: string | null // the choices, as one line
  pick: string | null // the guide's pick
  key: boolean // a milestone that gives everything listed, no choice
}
export type MilestoneTerm = { term: string; text: string }
export type MilestoneGuide = { article: Article; rows: MilestoneRow[]; terms: MilestoneTerm[] }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const clean = (s: string) => cap(s.replace(/\s+/g, ' ').trim().replace(/^:\s*/, '').replace(/\.$/, '').trim())
const isBold = (n: LexNode) => typeof n.format === 'number' && (n.format & 1) === 1

// The milestone guide's table: one row per "## 20 Nights" heading, filled from the paragraphs
// that open with a bold "Everyone receives:", "You receive:", "Choice:" or "My pick:", in the
// guide's own words. The award terms come from the "### Suite Upgrade Award" headings above
// the first milestone, each with the paragraph that gives the program's definition. Null when
// the guide is not written that way (fewer than two milestones found).
export function parseMilestoneGuide(article: Article): MilestoneGuide | null {
  const root = rootOf(article.body)
  if (!root) return null
  const rows: MilestoneRow[] = []
  const terms: MilestoneTerm[] = []
  let row: MilestoneRow | null = null
  let term: string | null = null
  for (const n of kids(root)) {
    const text = textOf(n).replace(/\s+/g, ' ').trim()
    if (n.type === 'heading') {
      const m = /^(.+?)\s+nights?$/i.exec(text)
      if (n.tag === 'h2' && m && /\d/.test(m[1])) {
        row = { nights: m[1], all: null, choice: null, pick: null, key: false }
        rows.push(row)
        term = null
      } else {
        row = null
        term = rows.length === 0 && n.tag === 'h3' ? text : null
      }
      continue
    }
    if (n.type !== 'paragraph' || !text) continue
    if (term) {
      const d = /^[^:]{0,40}\bdefinition:\s*(.+)$/i.exec(text)
      if (d) {
        terms.push({ term, text: cap(d[1].trim()) })
        term = null
      }
      continue
    }
    if (!row) continue
    const [first, ...rest] = kids(n)
    if (!first || !isBold(first)) continue
    // "Choice:" in bold, then the choices; or the whole line in bold
    const lead = textOf(first)
    const colon = lead.indexOf(':')
    if (colon < 0) continue
    const label = lead.slice(0, colon).trim().toLowerCase()
    const value = clean(lead.slice(colon + 1) + rest.map(textOf).join(''))
    if (!value) continue
    if (label === 'everyone receives') row.all = value
    else if (label === 'you receive') {
      row.all = value
      row.key = true
    } else if (label === 'choice' || label === 'choose one') row.choice = value
    else if (label === 'my pick' || label === 'our pick') row.pick = value
  }
  const filled = rows.filter((r) => r.all || r.choice)
  return filled.length >= 2 ? { article, rows: filled, terms } : null
}

// The program's milestone guide: the article linked from the program in the admin, else its
// newest published guide about milestones.
export async function milestoneGuide(programId: number, linked: Article | number | null | undefined): Promise<MilestoneGuide | null> {
  const payload = await getPayloadClient()
  let article = linked && typeof linked === 'object' ? linked : null
  if (linked && typeof linked === 'number') article = await payload.findByID({ collection: 'articles', id: linked, depth: 0 }).catch(() => null)
  if (article && article._status !== 'published') article = null
  if (!article) {
    const res = await payload.find({
      collection: 'articles',
      where: { and: [published, { 'related.programs': { in: [programId] } }, { or: [{ slug: { contains: 'milestone' } }, { title: { contains: 'milestone' } }] }] },
      sort: '-publishedDate',
      depth: 0,
      limit: 1,
    })
    article = res.docs[0] ?? null
  }
  return article ? parseMilestoneGuide(article) : null
}

// ---------- Guides, brands, lounges ----------

// The program's guides, newest first
export async function programGuides(programId: number, limit = 6) {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'articles',
    where: { and: [published, { categories: { in: ['guides'] } }, { 'related.programs': { in: [programId] } }] },
    sort: ['-publishedDate', '-id'],
    depth: 1,
    limit,
  })
  return res.docs
}

// Brand names A to Z, a leading "The" set aside ("The Unbound Collection" under U)
export const brandSortKey = (name: string) => name.replace(/^the\s+/i, '').toLocaleLowerCase('en-US')

// Whether the program has a published club lounge on record
export async function programHasLounges(programId: number): Promise<boolean> {
  const payload = await getPayloadClient()
  const res = await payload.count({ collection: 'lounges', where: { and: [published, { 'hotel.program': { equals: programId } }] } })
  return res.totalDocs > 0
}
