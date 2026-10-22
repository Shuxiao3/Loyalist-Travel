import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { HotelTable, HotelTableNote } from '@/components/HotelTable'
import { PageNumbers } from '@/components/PageNumbers'
import { RichText } from '@/components/RichText'
import { SortSelect } from '@/components/SortSelect'
import { rel, score, shortDate, shortMonthYear } from '@/lib/format'
import { articleImage } from '@/lib/articles'
import { hotelRowExtras, hotelSideCounts, segmentLabel } from '@/lib/hotelBrowse'
import { programLogo } from '@/lib/photos'
import { benefitLinesFromDescription, brandSortKey, listLines, milestoneGuide, type MilestoneGuide, programGuides, programHasLounges, programShortName, programStayQuestion } from '@/lib/programPage'
import { brandsOf, findHotels, getHotelFilterOptions, getPayloadClient, getProgram, type HotelFilters, topTierOf, upgradePoolOf } from '@/lib/queries'
import { getSeo, metaText, pageMeta } from '@/lib/seo'
import { noRankText } from '@/lib/upgradeRanking'
import type { Article, Destination, Hotel, StatusLevel } from '@/payload-types'

import styles from './page.module.css'

export const revalidate = 300

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProgram((await params).slug)
  if (!p) return {}
  const text = metaText((await getSeo())?.program, { Program: p.name, Elite: await topTierOf(p), Description: p.shortDescription }, { title: p.name, description: p.shortDescription })
  return pageMeta({ title: p.seo?.title ?? text.title, description: p.seo?.description ?? text.description, path: `/programs/${p.slug}`, image: p.images?.heroImageUrl })
}

// The hotel list's sort menu. Name, A to Z is the default (no sort in the address).
const SORTS = [
  { value: '', label: 'Name, A to Z' },
  { value: 'za', label: 'Name, Z to A' },
  { value: 'stays', label: 'Most stays reported' },
  { value: 'popular', label: 'Most viewed' },
  { value: 'aggregated', label: 'Highest upgrade chance: aggregated data' },
  { value: 'reader', label: 'Highest upgrade chance: reader data' },
]

const FORM_ID = 'program-hotels'

// "60 nights" is "60" after the tier's name ("Globalist at 60"); anything longer stays whole
const nightsAfterName = (nights: string) => /^(\d+)\s+nights$/i.exec(nights.trim())?.[1] ?? nights.trim()

// A program (mockup: program.html). The band carries the logo, the name, its line, where elite
// status starts and the top tier, a link to its club lounges, and jump links to the sections.
// Main column: the elite tiers, the milestone rewards and the program's hotels (filter, sort,
// table, page numbers). Side column: the brands, the site's reviews of its hotels, its guides,
// the "Add your stay" box and the regions with its hotels. One column at 960px and below, the
// sections in reading order. No counts of the site's content.
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
    sort: first(sp.sort) || 'az',
    page: Math.max(1, Math.floor(Number(first(sp.page))) || 1),
  }
  const payload = await getPayloadClient()
  const [hotels, options, reviews, tiers, brandList, guide, guides, hasLounges, side] = await Promise.all([
    findHotels(filters),
    getHotelFilterOptions(),
    payload.find({ collection: 'reviews', where: { and: [{ _status: { equals: 'published' } }, { 'hotel.program': { equals: program.id } }] }, sort: ['-stayDate', '-publishedDate'], depth: 2, limit: 6 }),
    payload.find({ collection: 'status-levels', where: { program: { equals: program.id } }, sort: 'rank', limit: 10, depth: 1 }),
    brandsOf(program.id),
    milestoneGuide(program.id, program.milestonesArticle),
    programGuides(program.id),
    programHasLounges(program.id),
    hotelSideCounts(program.slug),
  ])
  const base = `/programs/${program.slug}`
  // The list's address with the filters, on the given page, landing on the hotels
  const href = (page: number) => {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(filters)) if (k !== 'page' && k !== 'program' && v && !(k === 'sort' && v === 'az')) q.set(k, String(v))
    if (page > 1) q.set('page', String(page))
    const s = q.toString()
    return s ? `${base}?${s}#hotels` : `${base}#hotels`
  }
  // a page past the end (an old link after the list shrank) goes to the first page
  if (hotels.docs.length === 0 && (filters.page ?? 1) > 1) redirect(href(1))

  const pool = upgradePoolOf(filters.sort) ?? undefined
  const rows = await hotelRowExtras(hotels.docs, pool)
  const levels: StatusLevel[] = tiers.docs
  const brandProgram = (b: (typeof options.brands)[number]) => (typeof b.program === 'object' ? b.program?.id : b.program)
  const segmentOf = new Map(options.brands.filter((b) => brandProgram(b) === program.id).map((b) => [b.id, segmentLabel(b.segment)]))
  // the brands with a hotel on the site, A to Z
  const brands = brandList
    .filter((b) => b.n > 0)
    .map((b) => ({ ...b, segment: segmentOf.get(b.id) ?? null }))
    .sort((a, b) => brandSortKey(a.name).localeCompare(brandSortKey(b.name)))
  const regions = [...side.regions].sort((a, b) => a.name.localeCompare(b.name))

  const folded = Boolean(filters.brand || filters.country || filters.lounge)
  const active = folded || Boolean(filters.q) || filters.sort !== 'az'
  const brandName = filters.brand ? brands.find((b) => b.slug === filters.brand)?.name ?? filters.brand : null
  const foldSummary = [brandName, filters.country, filters.lounge === 'yes' ? 'Club lounge' : null].filter(Boolean).join(', ')
  const hotelsQuery = new URLSearchParams({ program: program.slug })
  for (const k of ['q', 'brand', 'country', 'lounge'] as const) if (filters[k]) hotelsQuery.set(k, String(filters[k]))

  // The band's line: where elite status starts and the top tier ("Globalist at 60")
  const firstElite = levels.find((t) => t.nights && /\d/.test(t.nights))
  const top = levels.find((t) => t.isTopTier) ?? levels[levels.length - 1]
  const topName = top ? (top.shortName ?? top.name) : null
  const topAt = top?.nights && /\d/.test(top.nights) ? nightsAfterName(top.nights) : null
  const simple = Boolean(firstElite?.nights && /^\d+\s+nights$/i.test(firstElite.nights) && top?.nights && /^\d+\s+nights$/i.test(top.nights))
  const metaParts = [firstElite?.nights ? `Elite status from ${firstElite.nights.trim()}` : null, topName && topAt ? `${topName} at ${topAt}` : null].filter((p): p is string => Boolean(p))
  const metaLine = metaParts.join(simple ? ', ' : ' · ')
  const short = programShortName(program)
  const logo = programLogo(program)

  const milestonesArticle = guide?.article ?? rel<Article>(program.milestonesArticle)
  const hasMilestones = Boolean(guide) || (program.milestoneList?.length ?? 0) > 0 || Boolean(program.milestones)
  const tabs = [
    levels.length > 0 ? { id: 'tiers', label: 'Elite tiers' } : null,
    hasMilestones ? { id: 'milestones', label: 'Milestones' } : null,
    { id: 'hotels', label: 'Hotels' },
    brands.length > 0 ? { id: 'brands', label: 'Brands' } : null,
    reviews.docs.length > 0 ? { id: 'reviews', label: 'Reviews' } : null,
    guides.length > 0 ? { id: 'guides', label: 'Guides' } : null,
  ].filter((t): t is { id: string; label: string } => Boolean(t))

  return (
    <>
      <section className="band page-band">
        <div className="wrap">
          <div className="pb-row">
            <div className={`pb-title${logo ? ` ${styles.title}` : ''}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {logo && <img className={`${styles.logo}${/\.svg(\?|$)/i.test(logo) ? '' : ` ${styles.logoTile}`}`} src={logo} alt="" />}
              <div>
                <h1>{program.name}</h1>
                {program.shortDescription && <p className="pb-dek">{program.shortDescription}</p>}
                {(metaLine || hasLounges) && (
                  <p className="pb-meta">
                    {metaLine}
                    {metaLine && hasLounges && ' · '}
                    {hasLounges && (
                      <Link className={styles.nw} href={`/lounges?program=${encodeURIComponent(program.slug)}`}>
                        {short} club lounges
                      </Link>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
          <nav className="tabs" aria-label="On this page">
            {tabs.map((t) => (
              <a key={t.id} href={`#${t.id}`}>
                {t.label}
              </a>
            ))}
          </nav>
        </div>
      </section>

      <main className="wrap main">
        <div className={`grid-side ${styles.grid}`}>
          <div className={styles.col}>
            {levels.length > 0 && (
              <section className={`mod ${styles.tiers}`} id="tiers" aria-labelledby="tiers-h">
                <div className="mod-head">
                  <h2 id="tiers-h">Elite tiers</h2>
                </div>
                <table className={`table ${styles.tierTable}`}>
                  <thead>
                    <tr>
                      <th className={styles.cTier}>Tier</th>
                      <th className={styles.cQ}>To qualify</th>
                      <th className={styles.cBen}>Benefits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {levels.map((t) => {
                      const lines = listLines(t.benefits) ?? (t.benefits ? null : benefitLinesFromDescription(t))
                      const article = rel<Article>(t.article)
                      const isTop = t === top && Boolean(t.isTopTier)
                      return (
                        <tr key={t.id} className={isTop ? styles.isTop : undefined}>
                          <th className={styles.cTier} scope="row">
                            <span className={styles.tn}>{t.shortName ?? t.name}</span>
                            {isTop && <span className={styles.tTop}>Top tier</span>}
                            {t.memberShare && (
                              <span className={styles.tShare} title={t.memberShareNote ?? undefined}>
                                {t.memberShare} of members
                              </span>
                            )}
                          </th>
                          <td className={styles.cQ}>
                            {t.nights ?? <span className="na">&ndash;</span>}
                            {t.creditCard?.grantsStatus && (
                              <span className={styles.tCard}>
                                <CardIcon />
                                {t.creditCard.source ? `With the ${t.creditCard.source}` : 'Comes with a credit card'}
                              </span>
                            )}
                          </td>
                          <td className={styles.cBen}>
                            {lines && lines.length > 0 ? (
                              <ul className={styles.tb}>
                                {lines.map((l, i) => (
                                  <li key={i}>{l}</li>
                                ))}
                              </ul>
                            ) : t.benefits ? (
                              <RichText data={t.benefits} className={`prose ${styles.benProse}`} />
                            ) : (
                              <span className="na">No printed elite benefits</span>
                            )}
                            {article && (
                              <Link className={`link ${styles.tLink}`} href={`/articles/${article.slug}`}>
                                Full breakdown
                              </Link>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {levels.some((t) => t.creditCard?.grantsStatus) && (
                  <p className="mod-note">
                    <CardIcon />
                    Card tiers come with the card itself, no stays or minimum spend.
                  </p>
                )}
              </section>
            )}

            {hasMilestones && (
              <section className={`mod ${styles.ms}`} id="milestones" aria-labelledby="ms-h">
                <div className="mod-head">
                  <h2 id="ms-h">Milestone rewards</h2>
                  {milestonesArticle && <Link href={`/articles/${milestonesArticle.slug}`}>Full breakdown</Link>}
                </div>
                {guide ? (
                  <GuideMilestones guide={guide} />
                ) : (program.milestoneList?.length ?? 0) > 0 ? (
                  <table className={`table ${styles.msTable}`}>
                    <thead>
                      <tr>
                        <th className={styles.cN}>Milestone</th>
                        <th>Rewards</th>
                      </tr>
                    </thead>
                    <tbody>
                      {program.milestoneList!.map((m, i) => {
                        const lines = (m.rewards ?? '')
                          .split(/\r?\n/)
                          .map((l) => l.trim())
                          .filter(Boolean)
                        return (
                          <tr key={m.id ?? i}>
                            <th className={styles.cN} scope="row">
                              {m.at}
                            </th>
                            <td className={styles.cAll}>
                              {lines.length > 1 ? (
                                <ul className={styles.msList}>
                                  {lines.map((l, j) => (
                                    <li key={j}>{l}</li>
                                  ))}
                                </ul>
                              ) : (
                                (lines[0] ?? <span className="na">&ndash;</span>)
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : (
                  <RichText data={program.milestones!} className={`prose ${styles.msProse}`} />
                )}
              </section>
            )}

            <section className={`mod ${styles.hotels}`} id="hotels" aria-labelledby="hotels-h">
              <div className="mod-head">
                <h2 id="hotels-h">{program.name} hotels</h2>
                <Link href={`/hotels?${hotelsQuery.toString()}`}>Open in Hotels</Link>
              </div>
              <form className={`filter-bar hf ${styles.filter}`} id={FORM_ID} role="search" aria-label={`Filter ${program.name} hotels`} method="get" action={`${base}#hotels`}>
                <div className="field grow">
                  <label className="label" htmlFor="pg-q">
                    Search
                  </label>
                  <input key={filters.q ?? ''} className="input" id="pg-q" type="search" name="q" defaultValue={filters.q ?? ''} placeholder="Hotel name" />
                </div>
                <details className="hf-more" open={folded || undefined}>
                  <summary>
                    <span className="hf-sum">Filters</span>
                    <span className="hf-sum-sub">{foldSummary || 'Brand, country, club lounge'}</span>
                  </summary>
                  <div className="hf-fields">
                    <div className="field">
                      <label className="label" htmlFor="pg-brand">
                        Brand
                      </label>
                      <select key={filters.brand ?? ''} className="select" id="pg-brand" name="brand" defaultValue={filters.brand ?? ''}>
                        <option value="">All brands</option>
                        {brands.map((b) => (
                          <option key={b.id} value={b.slug}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label className="label" htmlFor="pg-country">
                        Country
                      </label>
                      <select key={filters.country ?? ''} className="select" id="pg-country" name="country" defaultValue={filters.country ?? ''}>
                        <option value="">All countries</option>
                        {options.countries.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <fieldset className="field hf-only">
                      <legend className="label">Show only</legend>
                      <div className="choices">
                        <label className="choice">
                          <input key={`l${filters.lounge ?? ''}`} type="checkbox" name="lounge" value="yes" defaultChecked={filters.lounge === 'yes'} />
                          With a club lounge
                        </label>
                      </div>
                    </fieldset>
                  </div>
                </details>
                <div className="fb-actions">
                  <button className="btn" type="submit">
                    Filter
                  </button>
                  {active && (
                    <Link className="link" href={`${base}#hotels`}>
                      Clear
                    </Link>
                  )}
                </div>
              </form>
              <div className={`results-line ${styles.rlEnd}`}>
                <SortSelect form={FORM_ID} options={SORTS} value={filters.sort === 'az' ? '' : filters.sort} />
              </div>
              {hotels.docs.length > 0 ? (
                <>
                  <HotelTable hotels={hotels.docs} extras={rows} caption={`${program.name} hotels`} columns={{ brand: true, place: true, segment: true }} />
                  <HotelTableNote pool={pool} />
                </>
              ) : (
                <p className={`empty ${styles.empty}`}>
                  {pool ? noRankText(pool) : 'No hotels match those filters.'}{' '}
                  {active && <Link href={`${base}#hotels`}>See every {program.name} hotel</Link>}
                </p>
              )}
              <div className={styles.pagerEnd}>
                <PageNumbers page={hotels.page ?? 1} totalPages={hotels.totalPages} href={href} />
              </div>
            </section>
          </div>

          <aside className={styles.side} aria-label={`More on ${program.name}`}>
            {brands.length > 0 && (
              <section className={`mod ${styles.brands}`} id="brands" aria-labelledby="brands-h">
                <div className="mod-head">
                  <h2 id="brands-h">Brands</h2>
                </div>
                <table className={`table ${styles.sideTable} ${styles.brandTable}`}>
                  <thead>
                    <tr>
                      <th>Brand</th>
                      <th className="r">Segment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brands.map((b) => (
                      <tr key={b.id}>
                        <th scope="row">
                          <Link href={`/brands/${b.slug}`}>{b.name}</Link>
                        </th>
                        <td className="r">{b.segment ? <span className="sub">{b.segment}</span> : <span className="na">&ndash;</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {reviews.docs.length > 0 && (
              <section className={`mod ${styles.reviews}`} id="reviews" aria-labelledby="rev-h">
                <div className="mod-head">
                  <h2 id="rev-h">Our {program.name} reviews</h2>
                  <Link href={`/reviews?program=${encodeURIComponent(program.slug)}`}>All reviews</Link>
                </div>
                <ol className={`rev-list ${styles.revList}`}>
                  {reviews.docs.map((r) => {
                    const hotel = rel<Hotel>(r.hotel)
                    const place = rel<Destination>(hotel?.destination)?.name
                    const stayed = shortMonthYear(r.stayDate)
                    const meta = [place, stayed ? `Stayed ${stayed}` : null].filter(Boolean).join(' · ')
                    const s = score(r.totals?.overall)
                    const reviewHref = `/reviews/${r.slug}`
                    return (
                      <li key={r.id}>
                        <Link className="score" href={reviewHref} aria-label={`Score ${s} out of 100`}>
                          <b>{s}</b>
                          <span>of 100</span>
                        </Link>
                        <div>
                          <h3>
                            <Link href={reviewHref}>{r.title}</Link>
                          </h3>
                          {meta && <p className="meta">{meta}</p>}
                          {r.shortVerdict && <p className="verdict">{r.shortVerdict}</p>}
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </section>
            )}

            {guides.length > 0 && (
              <section className={`mod ${styles.guides}`} id="guides" aria-labelledby="guides-h">
                <div className="mod-head">
                  <h2 id="guides-h">{program.name} guides</h2>
                  <Link href="/guides">All guides</Link>
                </div>
                <ol className="stories stories-tight">
                  {guides.map((a) => {
                    const img = articleImage(a)
                    const articleHref = `/articles/${a.slug}`
                    return (
                      <li key={a.id} className={img ? undefined : 'no-img'}>
                        {img && (
                          <Link className="img-box" href={articleHref} tabIndex={-1} aria-hidden="true">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img} alt="" />
                          </Link>
                        )}
                        <div>
                          <h3>
                            <Link href={articleHref}>{a.title}</Link>
                          </h3>
                          <p className="byline">{shortDate(a.publishedDate)}</p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </section>
            )}

            <section className={`box ${styles.box}`} aria-labelledby="stay-h">
              <h2 id="stay-h">{programStayQuestion(program)}</h2>
              <p>Two minutes, dropdowns only. Your upgrade outcome joins the data for that property, and the upgrade odds update for everyone. No name, no email.</p>
              <Link className="btn" href="/submit-a-stay">
                Add your stay
              </Link>
            </section>

            {regions.length > 0 && (
              <section className={`mod ${styles.regions}`} aria-labelledby="regions-h">
                <div className="mod-head">
                  <h2 id="regions-h">Hotels by region</h2>
                </div>
                <table className={`table ${styles.sideTable}`}>
                  <tbody>
                    {regions.map((r) => (
                      <tr key={r.slug}>
                        <th scope="row">
                          <Link href={`/hotels?program=${encodeURIComponent(program.slug)}&region=${encodeURIComponent(r.slug)}`}>{r.name}</Link>
                        </th>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </aside>
        </div>
      </main>
    </>
  )
}

const numbersIn = (s: string) => (s.match(/\d+/g) ?? []).map(Number)
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)

// "Rewards start at 20 nights and come every 10 nights up to 150", when the milestones follow
// one another at a steady step ("70, 80 and 90" and "110 to 140" count as runs of it)
function milestoneSpan(rows: MilestoneGuide['rows']): string | null {
  const spans = rows.map((r) => numbersIn(r.nights)).filter((n) => n.length > 0)
  if (spans.length < 2) return null
  const from = spans[0][0]
  const to = spans[spans.length - 1][spans[spans.length - 1].length - 1]
  if (!(to > from)) return null
  const step = spans.flat().reduce((g, n) => gcd(g, n), 0)
  const steady = step > 0 && spans.every((n, i) => i === 0 || n[0] === spans[i - 1][spans[i - 1].length - 1] + step)
  return steady ? `Rewards start at ${from} nights and come every ${step} nights up to ${to}.` : `Rewards start at ${from} nights and run to ${to}.`
}

// The milestones as the program's guide lays them out: what everyone receives, the choices and
// the guide's pick, a milestone that gives everything on one shaded row, then the award terms
function GuideMilestones({ guide }: { guide: MilestoneGuide }) {
  const { rows, terms, article } = guide
  const choices = rows.filter((r) => r.choice).length
  const keys = rows.filter((r) => r.key).length
  const intro = [milestoneSpan(rows), keys > 0 && choices > rows.length / 2 ? 'Most milestones offer a choice; key ones give everything listed.' : null].filter(Boolean).join(' ')
  const anyPick = rows.some((r) => r.pick)
  const dash = (
    <>
      <span className="na" aria-hidden="true">
        &ndash;
      </span>
      <span className="sr-only">Nothing listed</span>
    </>
  )
  return (
    <>
      {intro && <p className={styles.intro}>{intro}</p>}
      <table className={`table ${styles.msTable}`}>
        <thead>
          <tr>
            <th className={styles.cN}>Nights</th>
            <th className={styles.cAll}>Everyone receives</th>
            <th className={styles.cChoice}>Choose one</th>
            {anyPick && <th className={styles.cPick}>Our pick</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.nights} className={r.key ? styles.isKey : undefined}>
              <th className={styles.cN} scope="row">
                {r.nights}
                <span className={styles.msUnit}> nights</span>
              </th>
              {r.key && !r.choice ? (
                <td className={styles.cAll} colSpan={anyPick ? 3 : 2} data-label="Everyone receives">
                  Everyone receives, no choice: <b>{r.all}</b>
                </td>
              ) : (
                <>
                  <td className={`${styles.cAll}${r.all ? '' : ` ${styles.isEmpty}`}`} data-label="Everyone receives">
                    {r.all ?? dash}
                  </td>
                  <td className={styles.cChoice} data-label="Choose one">
                    {r.choice ?? dash}
                  </td>
                  {anyPick && (
                    <td className={styles.cPick} data-label="Our pick">
                      {r.pick ? <b>{r.pick}</b> : dash}
                    </td>
                  )}
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {terms.length > 0 && (
        <dl className={styles.defs}>
          {terms.map((t) => (
            <div key={t.term}>
              <dt>{t.term}</dt>
              <dd>{t.text}</dd>
            </div>
          ))}
        </dl>
      )}
      {anyPick && (
        <p className="mod-note">
          Picks from our guide,{' '}
          <Link className="link" href={`/articles/${article.slug}`}>
            {article.title}
          </Link>
        </p>
      )}
    </>
  )
}

function CardIcon() {
  return (
    <svg className={styles.cardI} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <line x1="2.5" y1="10" x2="21.5" y2="10" />
    </svg>
  )
}
