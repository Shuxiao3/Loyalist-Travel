'use client'

import { useFormFields } from '@payloadcms/ui'
import type { UIFieldClientProps } from 'payload'

import { fill } from '@/lib/seoFill'

// A search-result style preview under a title and description pair, updated
// as you type. `sample` fills the placeholders of a template; `fallback` is
// the wording the site uses when a field is blank; `from` names other fields
// on the same form whose values stand in for blank ones (an article's title).
type Props = UIFieldClientProps & {
  sample?: Record<string, string>
  fallback?: { title?: string; description?: string }
  from?: { title?: string; description?: string }
  suffix?: boolean
  url?: string
}

const TITLE_MAX = 60
const DESC_MAX = 160

export function SeoPreview({ path, sample = {}, fallback = {}, from, suffix = true, url = 'loyalisttravel.com' }: Props) {
  const base = path.replace(/\.[^.]+$/, '')
  const title = useFormFields(([fields]) => (fields[`${base}.title`]?.value as string | undefined) ?? '')
  const description = useFormFields(([fields]) => (fields[`${base}.description`]?.value as string | undefined) ?? '')
  const fromTitle = useFormFields(([fields]) => (from?.title ? (fields[from.title]?.value as string | undefined) : undefined) ?? '')
  const fromDescription = useFormFields(([fields]) => (from?.description ? (fields[from.description]?.value as string | undefined) : undefined) ?? '')

  const t = title.trim() ? fill(title, sample) : fromTitle.trim() || fallback.title || ''
  const d = description.trim() ? fill(description, sample) : fromDescription.trim() || fallback.description || ''
  const shown = suffix && t ? `${t} | Loyalist Travel` : t
  const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)
  const count = (n: number, max: number) => (
    <span style={{ color: n > max ? '#b42318' : n > max - 10 ? '#b54708' : '#667085' }}>
      {n}/{max}
    </span>
  )

  return (
    <div style={{ margin: '0 0 24px', padding: '14px 16px', border: '1px solid var(--theme-elevation-150)', borderRadius: 6, background: 'var(--theme-elevation-0)', fontFamily: 'arial, sans-serif', maxWidth: 600 }}>
      <div style={{ fontSize: 12, color: '#4d5156', marginBottom: 2 }}>{url}</div>
      <div style={{ fontSize: 20, lineHeight: 1.3, color: '#1a0dab', marginBottom: 4 }}>{clip(shown, TITLE_MAX + 20) || <em style={{ color: '#999' }}>No title</em>}</div>
      <div style={{ fontSize: 14, lineHeight: 1.45, color: '#4d5156' }}>{clip(d, DESC_MAX) || <em style={{ color: '#999' }}>No description</em>}</div>
      <div style={{ marginTop: 8, fontSize: 12, fontFamily: 'var(--font-body)', display: 'flex', gap: 16 }}>
        <span>Title {count(shown.length, TITLE_MAX)}</span>
        <span>Description {count(d.length, DESC_MAX)}</span>
        {(!title.trim() || !description.trim()) && <span style={{ color: '#667085' }}>Blank fields show the built-in wording.</span>}
      </div>
    </div>
  )
}
