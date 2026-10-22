import type { Metadata } from 'next'
import Link from 'next/link'
import { Fragment } from 'react'

import { PageNumbers } from '@/components/PageNumbers'
import { ReviewThumb } from '@/components/ReviewRows'
import { SortSelect } from '@/components/SortSelect'
import { monthYear, score, shortDate } from '@/lib/format'
import { reviewPhoto } from '@/lib/photos'
import { getReviews, type ReviewFilters } from '@/lib/queries'
import { reviewFacets, reviewRowFacts } from '@/lib/reviewsIndex'
import { bandFor, categoriesFor, REVIEW_SECTIONS, SCORE_BANDS, sectionTotal } from '@/lib/rubric'
import { getSeo, metaText, pageMeta } from '@/lib/seo'
import { PROPERTY_TYPE_LABEL, SITE } from '@/lib/site'
import { RUBRIC_V16 } from '@/rubric/v16'
import type { Review } from '@/payload-types'

import styles from './page.module.css'

export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeo()
  return pageMeta({ ...metaText(seo?.reviews, {}, { title: 'Reviews', description: 'Every scored stay, on a 100-point rubric, written from a full stay and never a site inspection.' }), path: '/reviews' })
}

// Reviews (mockup: reviews.html). The band carries the title and its line (no program tabs: the
// list is not split by program, and an old link's `program` is ignored); below, the search bar,
// the sort menu and the review rows, each with its picture and score, and its six category totals, and a side column of
// countries, types, the rubric and the score bands. No counts of the site's reviews.

const PER_PAGE = 12
const FORM_ID = 'reviews-filter'

const SORTS = [
  { value: '', label: 'Newest stay' },
  { value: 'top', label: 'Highest score' },
  { value: 'low', label: 'Lowest score' },
]

const TYPE_LINKS: Record<'city' | 'resort', string> = { city: 'City hotels', resort: 'Resorts' }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined

// Score bands as ranges: "95 and up", "90 to 94.5", ... "Under 50"
const BAND_RANGES = SCORE_BANDS.map((b, i) => ({
  label: b.label,
  range: i === 0 ? `${b.min} and up` : b.min === 0 ? `Under ${SCORE_BANDS[i - 1].min}` : `${b.min} to ${SCORE_BANDS[i - 1].min - 0.5}`,
}))

// Between the items of a meta line: the dot keeps to the item before it, so a line never starts with one
const SEP = '\u00a0· '


// A section's total, or a dash when none of its sub-scores is in
function sectionScore(review: Review, keys: (typeof REVIEW_SECTIONS)[number]['keys']): string {
  if (!keys.some((k) => review.scores?.[k] != null)) return '–'
  return score(sectionTotal(review, categoriesFor(review), keys).got)
}

export default async function ReviewsIndex({ searchParams }: Props) {
  const sp = await searchParams
  const page = Math.max(1, Number(first(sp.page)) || 1)
  const filters: ReviewFilters = { q: first(sp.q)?.trim() || undefined, country: first(sp.country), type: first(sp.type), sort: first(sp.sort) }
  const active = Boolean(filters.q || filters.country || filters.type)
  const [result, facets] = await Promise.all([getReviews({ limit: PER_PAGE, page, ...filters }), reviewFacets()])
  const facts = await reviewRowFacts(result.docs)

  // The list's address with some filters changed; the page always goes back to 1
  const with_ = (change: Partial<ReviewFilters>, p = 1) => {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...filters, ...change })) if (v) q.set(k, v)
    if (p > 1) q.set('page', String(p))
    const s = q.toString()
    return s ? `/reviews?${s}` : '/reviews'
  }
  // A filter link: picks the value, or clears it when it is the one already picked
  const toggle = (key: 'country' | 'type', value: string) => with_({ [key]: filters[key] === value ? undefined : value })

  return (
    <>
      <section className="band page-band">
        <div className="wrap">
          <div className={`pb-row ${styles.head}`}>
            <div className="pb-title">
              <h1>Reviews</h1>
              <p className="pb-dek">Every stay is booked under a private name and paid for in full, so the hotel has no idea it is being reviewed.</p>
              <p className="pb-meta">By {SITE.author}. Six categories and 100 points, the same rubric every time.</p>
            </div>
          </div>
        </div>
      </section>

      <main className="wrap main">
        <div className="grid-side">
          <div>
            <form className={`filter-bar ${styles.filter}`} id={FORM_ID} role="search" method="get" action="/reviews">
              <div className="field grow">
                <label className="label" htmlFor="reviews-q">
                  Search
                </label>
                <input key={filters.q ?? ''} className="input" id="reviews-q" type="search" name="q" defaultValue={filters.q ?? ''} placeholder="Hotel or city" />
              </div>
              {filters.country && <input type="hidden" name="country" value={filters.country} />}
              {filters.type && <input type="hidden" name="type" value={filters.type} />}
              <div className="fb-actions">
                <button className="btn" type="submit">
                  Filter
                </button>
                {(active || filters.sort) && (
                  <Link className={styles.clear} href="/reviews">
                    Clear
                  </Link>
                )}
              </div>
              {(facets.countries.length > 0 || facets.types.length > 0) && (
                <details className={styles.fold} open={Boolean(filters.country || filters.type) || undefined}>
                  {/* as the other lists' folds: "Filters", its caret, then what it holds or what is chosen */}
                  <summary>
                    <span className={styles.sum}>Filters</span>
                    <span className={styles.sumSub}>
                      {[filters.country, filters.type ? TYPE_LINKS[filters.type as 'city' | 'resort'] : null].filter(Boolean).join(', ') ||
                        [facets.countries.length > 0 ? 'Country' : null, facets.types.length > 0 ? 'type' : null].filter(Boolean).join(', ')}
                    </span>
                  </summary>
                  <div className={styles.foldBody}>
                    {facets.countries.length > 0 && (
                      <>
                        <p className={styles.foldH}>Country</p>
                        <ul className={styles.flinks}>
                          {facets.countries.map((c) => (
                            <li key={c}>
                              <Link href={toggle('country', c)} aria-current={filters.country === c ? 'true' : undefined}>
                                {c}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {facets.types.length > 0 && (
                      <>
                        <p className={styles.foldH}>Type</p>
                        <ul className={styles.flinks}>
                          {facets.types.map((t) => (
                            <li key={t}>
                              <Link href={toggle('type', t)} aria-current={filters.type === t ? 'true' : undefined}>
                                {TYPE_LINKS[t]}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </details>
              )}
            </form>

            <div className={`results-line ${styles.results}`}>
              <SortSelect form={FORM_ID} options={SORTS} value={filters.sort ?? ''} />
              {result.docs.length > 0 && (
                <div className={styles.colhead} aria-hidden="true">
                  {REVIEW_SECTIONS.map((s) => (
                    <span key={s.id}>
                      {s.title}
                      <small>of {s.max}</small>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {result.docs.length > 0 ? (
              <ol className={styles.rows}>
                {result.docs.map((r) => {
                  const href = `/reviews/${r.slug}`
                  const band = bandFor(r.totals?.overall, 100)
                  const f = facts.get(r.id)
                  const meta = [f?.place, f?.brand, f?.program, PROPERTY_TYPE_LABEL[r.propertyType]].filter((m): m is string => Boolean(m))
                  const stayed = monthYear(r.stayDate)
                  const published = shortDate(r.publishedDate)
                  const byline = [stayed ? `Stayed ${stayed}` : null, published ? `Published ${published}` : null, r.readTime ? `${r.readTime} min read` : null].filter((b): b is string => Boolean(b))
                  return (
                    <li key={r.id}>
                      <div className={styles.mark}>
                        <ReviewThumb href={href} photo={reviewPhoto(r)} value={r.totals?.overall} />
                        {band && <p className={styles.bandname}>{band}</p>}
                      </div>
                      <div className={styles.text}>
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
                      <div className={styles.body}>
                        {r.shortVerdict && <p className={styles.verdict}>{r.shortVerdict}</p>}
                        {byline.length > 0 && (
                          <p className="byline">
                            {byline.map((b, i) => (
                              <Fragment key={i}>
                                {i > 0 && SEP}
                                <span>{b}</span>
                              </Fragment>
                            ))}
                          </p>
                        )}
                      </div>
                      <dl className={styles.subs} aria-label="Category scores">
                        {REVIEW_SECTIONS.map((sec) => (
                          <div key={sec.id}>
                            <dt>{sec.title}</dt>
                            <dd>{sectionScore(r, sec.keys)}</dd>
                          </div>
                        ))}
                      </dl>
                    </li>
                  )
                })}
              </ol>
            ) : (
              <p className={`empty ${styles.empty}`}>
                No reviews match those filters yet. <Link href="/reviews">See every review</Link>
              </p>
            )}

            <PageNumbers page={result.page ?? 1} totalPages={result.totalPages} href={(p) => with_({}, p)} />
          </div>

          <aside className={styles.side}>
            {facets.countries.length > 0 && (
              <section className={`mod ${styles.sideFilter}`} aria-labelledby="by-country">
                <div className="mod-head">
                  <h2 id="by-country">By country</h2>
                </div>
                <table className={`table ${styles.sideTable}`}>
                  <tbody>
                    {facets.countries.map((c) => {
                      const on = filters.country === c
                      return (
                        <tr key={c}>
                          <td>
                            <Link className="hn" href={toggle('country', c)} aria-current={on ? 'true' : undefined}>
                              {c}
                            </Link>
                          </td>
                          {filters.country && (
                            <td className="r">
                              {on && (
                                <Link href={toggle('country', c)} aria-label={`Clear ${c}`}>
                                  Clear
                                </Link>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </section>
            )}
            {facets.types.length > 0 && (
              <section className={`mod ${styles.sideFilter}`} aria-labelledby="by-type">
                <div className="mod-head">
                  <h2 id="by-type">By type</h2>
                </div>
                <table className={`table ${styles.sideTable}`}>
                  <tbody>
                    {facets.types.map((t) => {
                      const on = filters.type === t
                      return (
                        <tr key={t}>
                          <td>
                            <Link className="hn" href={toggle('type', t)} aria-current={on ? 'true' : undefined}>
                              {TYPE_LINKS[t]}
                            </Link>
                          </td>
                          {filters.type && (
                            <td className="r">
                              {on && (
                                <Link href={toggle('type', t)} aria-label={`Clear ${TYPE_LINKS[t]}`}>
                                  Clear
                                </Link>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </section>
            )}
            <section className="mod" aria-labelledby="how-scores">
              <div className="mod-head">
                <h2 id="how-scores">How the scores work</h2>
                <span className="aside">Rubric v16</span>
              </div>
              <p className={styles.p}>Every sub-score is out of 5, the same for city hotels and resorts, 100 points in all. Value is reported with each verdict and never scored.</p>
              <table className={`table ${styles.rubric}`}>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="r">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {REVIEW_SECTIONS.map((s) => (
                    <tr key={s.id}>
                      <th scope="row">
                        {s.title}
                        <span className="sub-b">
                          {RUBRIC_V16.filter((c) => c.section === s.id)
                            .map((c) => c.label)
                            .join(', ')}
                        </span>
                      </th>
                      <td className="r">
                        <span className="n">{s.max}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="mod" aria-labelledby="score-bands">
              <div className="mod-head">
                <h2 id="score-bands">Score bands</h2>
              </div>
              <table className={`table ${styles.bands}`}>
                <tbody>
                  {BAND_RANGES.map((b) => (
                    <tr key={b.label}>
                      <td className="hn">{b.label}</td>
                      <td className="r">{b.range}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </aside>
        </div>
      </main>
    </>
  )
}
