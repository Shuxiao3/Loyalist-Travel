import Link from 'next/link'
import { Fragment } from 'react'

import { score } from '@/lib/format'

// A review's picture with its score in the corner, and the review rows built on it: the homepage's
// "Latest reviews", "More reviews" on a review page, and the reviews of a program, brand or
// destination. The Reviews page puts the same picture in its own, larger rows. A hotel's own page
// keeps its compact review strip with no picture (its band already shows the hotel).
//
// The picture is a background, so one that fails to load leaves the navy frame rather than a broken
// image. With no picture at all, the score fills the frame as a navy tile.

export function ReviewThumb({ href, photo, value, className }: { href: string; photo: string | null; value: number | null | undefined; className?: string }) {
  const s = score(value)
  return (
    <Link className={['rev-thumb', photo ? null : 'no-photo', className].filter(Boolean).join(' ')} href={href} aria-label={`Score ${s} out of 100`}>
      {photo && <span className="rev-photo" style={{ backgroundImage: `url(${photo})` }} />}
      <span className="score">
        <b>{s}</b>
        <span>of 100</span>
      </span>
    </Link>
  )
}

export type ReviewRow = {
  id: number | string
  slug: string
  title: string
  score: number | null | undefined
  photo: string | null
  meta?: (string | null | undefined)[] // "Vienna", "World of Hyatt", "Stayed Aug 2026"; each part kept on one line
  verdict?: string | null
}

// Between the parts of a meta line: the dot keeps to the part before it, so a line never starts with one
const SEP = '\u00a0· '

// size "side": the narrower rows of a side column
export function ReviewRows({ rows, size }: { rows: ReviewRow[]; size?: 'side' }) {
  if (rows.length === 0) return null
  return (
    <ol className={`rev-list${size === 'side' ? ' rev-list-side' : ''}`}>
      {rows.map((r) => {
        const href = `/reviews/${r.slug}`
        const meta = (r.meta ?? []).filter((m): m is string => Boolean(m))
        return (
          <li key={r.id}>
            <ReviewThumb href={href} photo={r.photo} value={r.score} />
            <div className="rev-head">
              <h3>
                <Link href={href}>{r.title}</Link>
              </h3>
              {meta.length > 0 && (
                <p className="meta">
                  {meta.map((m, i) => (
                    <Fragment key={i}>
                      {i > 0 && SEP}
                      <span>{m}</span>
                    </Fragment>
                  ))}
                </p>
              )}
            </div>
            {r.verdict && <p className="verdict">{r.verdict}</p>}
          </li>
        )
      })}
    </ol>
  )
}
