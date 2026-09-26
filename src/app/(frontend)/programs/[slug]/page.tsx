import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { HotelList } from '@/components/HotelCard'
import { Pager } from '@/components/Pager'
import { ReferenceHero } from '@/components/ReferenceHero'
import { ReviewCard } from '@/components/ReviewCard'
import { RichText } from '@/components/RichText'
import { SortMenu } from '@/components/SortMenu'
import { count } from '@/lib/format'
import { brandsOf, findHotels, getHotelFilterOptions, getPayloadClient, getProgram, HOTELS_PER_PAGE, type HotelFilters } from '@/lib/queries'
import { pageMeta } from '@/lib/seo'
import { rel } from '@/lib/format'
import type { Article, StatusLevel } from '@/payload-types'

import styles from './page.module.css'

export const revalidate = 300

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProgram((await params).slug)
  return p ? pageMeta({ title: p.seo?.title ?? p.name, description: p.seo?.description ?? p.shortDescription, path: `/programs/${p.slug}`, image: p.images?.heroImageUrl }) : {}
}

// The tier's benefits as bullet points. The rich text field when it is
// filled in; otherwise the short description, minus the requirement that
// already sits in the eyebrow, split into its clauses.
function benefitLines(t: StatusLevel): string[] {
  const text = (t.shortDescription ?? '').replace(/^[^;]*;\s*/, '').trim()
  if (!text) return []
  return text
    .replace(/\.$/, '')
    .split(/,\s*(?![^()]*\))/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
}

export default async function ProgramPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const program = await getProgram(slug)
  if (!program) notFound()
  const filters: HotelFilters = {
    q: first(sp.q)?.trim() || undefined,
    program: program.slug,
    brand: first(sp.brand),
    country: first(sp.country),
    lounge: first(sp.lounge),
    sort: first(sp.sort),
    page: Math.max(1, Number(first(sp.page)) || 1),
  }
  const payload = await getPayloadClient()
  const [hotels, all, options, reviews, tiers, brandList] = await Promise.all([
    findHotels(filters),
    payload.count({ collection: 'hotels', where: { and: [{ _status: { equals: 'published' } }, { program: { equals: program.id } }] } }),
    getHotelFilterOptions(),
    payload.find({ collection: 'reviews', where: { and: [{ _status: { equals: 'published' } }, { 'hotel.program': { equals: program.id } }] }, sort: '-publishedDate', depth: 1, limit: 6 }),
    payload.find({ collection: 'status-levels', where: { program: { equals: program.id } }, sort: 'rank', limit: 10, depth: 1 }),
    brandsOf(program.id),
  ])
  const levels: StatusLevel[] = tiers.docs
  const brands = options.brands.filter((b) => (typeof b.program === 'object' ? b.program?.id : b.program) === program.id)
  const active = ['q', 'brand', 'country', 'lounge'].filter((k) => filters[k as keyof HotelFilters]).length
  const base = `/programs/${program.slug}`
  const href = (page: number) => {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(filters)) if (k !== 'page' && k !== 'program' && v) q.set(k, String(v))
    if (page > 1) q.set('page', String(page))
    const s = q.toString()
    return s ? `${base}?${s}#hotels-h` : base
  }

  return (
    <>
      <ReferenceHero
        eyebrow="Loyalty program"
        title={program.name}
        sub={program.shortDescription}
        crumbs={[{ href: '/hotels', label: 'Hotels' }, { href: base, label: program.name }]}
        stats={[
          { n: count(all.totalDocs), l: 'Hotels indexed' },
          { n: count(reviews.totalDocs), l: 'Scored stays' },
          { n: String(levels.length), l: 'Elite tiers' },
          ...(program.topTierName ? [{ n: program.topTierName, l: 'Top tier' }] : []),
        ]}
      />

      {levels.length > 0 && (
        <section className={`section ${styles.tiers}`} aria-labelledby="tiers-h">
          <div className="wrap">
            <span className="eyebrow on-light" id="tiers-h">
              Elite tiers
            </span>
            <div className={`grid-cells ${styles.tierGrid} rail-m`}>
              {levels.map((t) => {
                const lines = benefitLines(t)
                const article = rel<Article>(t.article)
                return (
                  <div className={`cell ${styles.tier}`} key={t.id}>
                    <span className="label">{t.nights ?? `Tier ${t.rank ?? ''}`}</span>
                    <span className={styles.tierName}>{t.shortName ?? t.name}</span>
                    {t.creditCard?.grantsStatus && (
                      <span className={styles.cardLine}>
                        <CardIcon />
                        <span>{t.creditCard.source ? `With the ${t.creditCard.source}` : 'Comes with a credit card'}</span>
                      </span>
                    )}
                    {t.benefits ? (
                      <RichText data={t.benefits} className={styles.benefits} />
                    ) : lines.length > 0 ? (
                      <ul className={`prose ${styles.benefits}`}>
                        {lines.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className={styles.none}>No printed elite benefits</span>
                    )}
                    {(t.memberShare || article) && (
                      <span className={styles.tierFoot}>
                        {t.memberShare && (
                          <span className={styles.share} title={t.memberShareNote ?? undefined}>
                            <b>{t.memberShare}</b> of members
                          </span>
                        )}
                        {article && (
                          <Link className={styles.breakdown} href={`/articles/${article.slug}`}>
                            Full breakdown
                          </Link>
                        )}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            {levels.some((t) => t.creditCard?.grantsStatus) && (
              <p className={styles.legend}>
                <CardIcon /> Card tiers come with the card itself, no stays or minimum spend.
              </p>
            )}
          </div>
        </section>
      )}

      {brandList.length > 0 && (
        <section className={`section ${styles.brandsSection}`} aria-labelledby="brands-h">
          <div className="wrap">
            <div className="section-head">
              <div>
                <span className="eyebrow on-light">Brands</span>
                <h2 id="brands-h">
                  {brandList.length} {brandList.length === 1 ? 'brand' : 'brands'} under {program.name}
                </h2>
              </div>
            </div>
            <ul className={styles.brandGrid}>
              {brandList.map((b) => (
                <li key={b.id}>
                  <Link className={styles.brand} href={`/brands/${b.slug}`} title={`${b.name}: ${b.n === 0 ? 'no hotels indexed yet' : `${count(b.n)} ${b.n === 1 ? 'hotel' : 'hotels'}`}`}>
                    {b.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className={styles.brandLogo} src={b.logo} alt={b.name} loading="lazy" />
                    ) : (
                      <span className={styles.brandMark}>{b.name}</span>
                    )}
                    <span className="sr-only">{b.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {((program.milestoneList?.length ?? 0) > 0 || program.milestones) && (
        <section className={`section ${styles.milestones}`} aria-labelledby="ms-h">
          <div className="wrap">
            <div className="section-head">
              <div>
                <span className="eyebrow on-light">Along the way</span>
                <h2 id="ms-h">Milestone rewards</h2>
              </div>
              {rel<Article>(program.milestonesArticle) && (
                <Link className="more" href={`/articles/${rel<Article>(program.milestonesArticle)!.slug}`}>
                  Full breakdown
                </Link>
              )}
            </div>
            <div className={styles.msCard}>
              {(program.milestoneList?.length ?? 0) > 0 ? (
                <ol className={styles.msList}>
                  {program.milestoneList!.map((m) => {
                    const lines = (m.rewards ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
                    return (
                      <li className={styles.msItem} key={m.id ?? m.at}>
                        <h3 className={styles.msAt}>{m.at}</h3>
                        {lines.length > 0 && (
                          <ul className={`prose ${styles.msRewards}`}>
                            {lines.map((l) => (
                              <li key={l}>{l}</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    )
                  })}
                </ol>
              ) : (
                <RichText data={program.milestones!} className={styles.msProse} />
              )}
            </div>
          </div>
        </section>
      )}

      {reviews.docs.length > 0 && (
        <section className="section" aria-labelledby="rev-h">
          <div className="wrap">
            <div className="section-head">
              <div>
                <span className="eyebrow on-light">Scored stays</span>
                <h2 id="rev-h">Reviews</h2>
              </div>
              <Link className="more" href={`/reviews?program=${program.slug}`}>
                All reviews
              </Link>
            </div>
            <div className="cards rail-m">
              {reviews.docs.map((r, i) => (
                <ReviewCard key={r.id} review={r} tone={(['a', 'b', 'c'] as const)[i % 3]} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className={`section ${styles.hotels}`} aria-labelledby="hotels-h">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow on-light">Hotels</span>
              <h2 id="hotels-h">
                {count(active ? hotels.totalDocs : all.totalDocs)} {hotels.totalDocs === 1 ? 'hotel' : 'hotels'}
                {active ? ' match' : ` indexed for ${program.name}`}
              </h2>
            </div>
          </div>
          <form className={styles.form} method="get" action={base}>
            <label className={styles.q}>
              <span className="label">Search</span>
              <input type="search" name="q" defaultValue={filters.q ?? ''} placeholder="Hotel name" />
            </label>
            <label>
              <span className="label">Brand</span>
              <select name="brand" defaultValue={filters.brand ?? ''}>
                <option value="">All brands</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.slug}>
                    {b.name}
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
              <span className="label">Club lounge</span>
              <select name="lounge" defaultValue={filters.lounge ?? ''}>
                <option value="">All hotels</option>
                <option value="yes">With a club lounge</option>
              </select>
            </label>
            <div className={styles.actions}>
              <button className="btn" type="submit">
                Filter
              </button>
              <SortMenu
                value={filters.sort}
                options={[
                  { value: '', label: 'Name, A to Z' },
                  { value: 'za', label: 'Name, Z to A' },
                  { value: 'popular', label: 'Most popular' },
                  { value: 'stays', label: 'Most submissions' },
                ]}
              />
              {(active > 0 || filters.sort) && (
                <Link className="more" href={base}>
                  Clear
                </Link>
              )}
            </div>
          </form>
          {hotels.docs.length > 0 ? <HotelList hotels={hotels.docs} grid /> : <p className={styles.empty}>No hotels match those filters.</p>}
          <Pager page={hotels.page ?? 1} totalPages={hotels.totalPages} totalDocs={hotels.totalDocs} perPage={HOTELS_PER_PAGE} href={href} />
        </div>
      </section>
    </>
  )
}

function CardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <line x1="2.5" y1="10" x2="21.5" y2="10" />
    </svg>
  )
}
