import type { Metadata } from 'next'
import Link from 'next/link'

import { LandingHero } from '@/components/LandingHero'
import { Pager } from '@/components/Pager'
import { ReviewCard } from '@/components/ReviewCard'
import { count, monthYear, rel, score } from '@/lib/format'
import { getHotelFilterOptions, getReviews, getReviewStats, type ReviewFilters } from '@/lib/queries'
import type { Hotel, Program } from '@/payload-types'

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
  const filters: ReviewFilters = { program: first(sp.program), country: first(sp.country), type: first(sp.type), sort: first(sp.sort) }
  const active = Boolean(filters.program || filters.country || filters.type)
  const [result, latestRes, topRes, stats, options] = await Promise.all([getReviews({ limit: PER_PAGE, page, ...filters }), getReviews({ limit: 1 }), getReviews({ limit: 3, sort: 'top' }), getReviewStats(), getHotelFilterOptions()])
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
  const latestProgram = latestHotel ? rel<Program>(latestHotel.program) : null
  const image = latest?.externalImageUrl ?? latestHotel?.externalImageUrl

  return (
    <>
      <LandingHero
        eyebrow="Scored stays"
        title="Brand Hotel Reviews"
        text="Every stay is booked under a private name and paid for in full, so the hotel has no idea it is being reviewed. Sixteen categories, one hundred points, the same rubric every time."
        photo={image}
        stats={[
          { n: count(stats.count), l: 'Scored stays' },
          { n: count(stats.hotels), l: 'Hotels reviewed' },
          { n: stats.average != null ? score(stats.average) : '–', l: 'Average score of 100' },
          { n: stats.best != null ? score(stats.best) : '–', l: 'Highest score so far' },
        ]}
        card={
          latest
            ? {
                eyebrow: 'Latest scored stay',
                image,
                meta: [latestProgram?.name ?? (latest.propertyType === 'resort' ? 'Resort' : 'City hotel'), latest.stayDate ? `Stayed ${monthYear(latest.stayDate)}` : null].filter((m): m is string => Boolean(m)),
                title: latest.title,
                text: latest.shortVerdict,
                figure: { value: score(latest.totals?.overall), label: 'of 100' },
                cta: 'Read the review',
                href: `/reviews/${latest.slug}`,
              }
            : null
        }
      />

      <section className={`section ${styles.filters}`}>
        <div className="wrap">
          <form className={styles.form} method="get" action="/reviews">
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

      {!active && !filters.sort && page === 1 && podium.length === 3 && (
        <section className={`section ${styles.podium}`} aria-labelledby="podium-h">
          <div className="wrap">
            <div className="section-head">
              <div>
                <span className="eyebrow on-light">The podium</span>
                <h2 id="podium-h">Highest scored stays</h2>
              </div>
              <Link className="more" href="/reviews?sort=top">
                Ranked list
              </Link>
            </div>
            <div className={`cards ${styles.podiumCards}`}>
              {podium.map((r, i) => (
                <div className={`${styles.place} ${[styles.gold, styles.silver, styles.bronze][i]}`} key={r.id}>
                  <span className={styles.medal} aria-label={['First', 'Second', 'Third'][i]}>
                    {i + 1}
                  </span>
                  <ReviewCard review={r} tone={(['a', 'b', 'c'] as const)[i]} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

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
