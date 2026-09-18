import type { Metadata } from 'next'
import Link from 'next/link'

import { LandingHero } from '@/components/LandingHero'
import { Pager } from '@/components/Pager'
import { ReviewCard } from '@/components/ReviewCard'
import { count, rel, score } from '@/lib/format'
import { getHotelFilterOptions, getReviews, type ReviewFilters } from '@/lib/queries'
import type { Hotel } from '@/payload-types'

import styles from './page.module.css'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Reviews',
  description: 'Every scored stay, on a 100-point rubric, written from a full stay and never a site inspection.',
}

const PER_PAGE = 12

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined

export default async function ReviewsIndex({ searchParams }: Props) {
  const sp = await searchParams
  const page = Math.max(1, Number(first(sp.page)) || 1)
  const filters: ReviewFilters = { q: first(sp.q)?.trim() || undefined, program: first(sp.program), country: first(sp.country), type: first(sp.type), sort: first(sp.sort) }
  const active = Boolean(filters.q || filters.program || filters.country || filters.type)
  const [result, latestRes, topRes, options] = await Promise.all([getReviews({ limit: PER_PAGE, page, ...filters }), getReviews({ limit: 1 }), getReviews({ limit: 3, sort: 'top' }), getHotelFilterOptions()])
  const podium = topRes.docs.filter((r) => typeof r.totals?.overall === 'number')

  const href = (p: number) => {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(filters)) if (v) q.set(k, v)
    if (p > 1) q.set('page', String(p))
    const s = q.toString()
    return s ? `/reviews?${s}` : '/reviews'
  }

  const latest = latestRes.docs[0]
  const latestHotel = latest ? rel<Hotel>(latest.hotel) : null
  const image = latest?.externalImageUrl ?? latestHotel?.externalImageUrl

  return (
    <>
      <LandingHero
        eyebrow="Scored stays"
        title="Brand hotel reviews"
        text="Every stay is booked under a private name and paid for in full, so the hotel has no idea it is being reviewed. Sixteen categories, one hundred points, the same rubric every time."
        photo={image}
        aside={
          podium.length > 0 ? (
            <aside className={styles.podium} aria-labelledby="podium-h">
              <span className="eyebrow" id="podium-h">
                Highest scored
              </span>
              <ol className={styles.podiumList}>
                {podium.map((r, i) => (
                  <li key={r.id}>
                    <Link className={styles.podiumRow} href={`/reviews/${r.slug}`}>
                      <span className={`${styles.medal} ${[styles.gold, styles.silver, styles.bronze][i]}`} aria-label={['First', 'Second', 'Third'][i]}>
                        {i + 1}
                      </span>
                      <span className={styles.podiumName}>{r.title}</span>
                      <span className={styles.podiumScore}>
                        {score(r.totals?.overall)}
                        <small>/100</small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
              <Link className={styles.podiumMore} href="/reviews?sort=top">
                Full ranking
              </Link>
            </aside>
          ) : null
        }
      />

      <section className={`section ${styles.filters}`}>
        <div className="wrap">
          <form className={styles.form} method="get" action="/reviews">
            <label className={styles.q}>
              <span className="label">Search</span>
              <input type="search" name="q" defaultValue={filters.q ?? ''} placeholder="Hotel or city" />
            </label>
            <label>
              <span className="label">Program</span>
              <select name="program" defaultValue={filters.program ?? ''}>
                <option value="">All programs</option>
                {options.programs.map((p) => (
                  <option key={p.id} value={p.slug}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Country</span>
              <select name="country" defaultValue={filters.country ?? ''}>
                <option value="">All countries</option>
                {options.countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Type</span>
              <select name="type" defaultValue={filters.type ?? ''}>
                <option value="">City and resort</option>
                <option value="city">City hotels</option>
                <option value="resort">Resorts</option>
              </select>
            </label>
            <label>
              <span className="label">Sort</span>
              <select name="sort" defaultValue={filters.sort ?? ''}>
                <option value="">Newest first</option>
                <option value="top">Highest score</option>
                <option value="low">Lowest score</option>
              </select>
            </label>
            <div className={styles.actions}>
              <button className="btn" type="submit">
                Filter
              </button>
              {(active || filters.sort) && (
                <Link className="more" href="/reviews">
                  Clear
                </Link>
              )}
            </div>
          </form>
        </div>
      </section>

      <section className={`section ${styles.list}`}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow on-light">{active ? 'Filtered' : filters.sort ? 'Ranked' : 'Most recent'}</span>
              <h2>
                {count(result.totalDocs)} {result.totalDocs === 1 ? 'review' : 'reviews'}
                {active ? ' match' : ''}
              </h2>
            </div>
          </div>
          {result.docs.length > 0 ? (
            <div className="cards">
              {result.docs.map((r, i) => (
                <ReviewCard key={r.id} review={r} tone={(['a', 'b', 'c'] as const)[i % 3]} />
              ))}
            </div>
          ) : (
            <p className={styles.empty}>No reviews match those filters yet.</p>
          )}
          <Pager page={result.page ?? 1} totalPages={result.totalPages} totalDocs={result.totalDocs} perPage={PER_PAGE} href={href} />
        </div>
      </section>
    </>
  )
}
