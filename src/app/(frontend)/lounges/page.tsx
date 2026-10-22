import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { LoungeTable } from '@/components/LoungeTable'
import { PageNumbers } from '@/components/PageNumbers'
import { SortSelect } from '@/components/SortSelect'
import { getLoungeDirectory, loungeDirectoryOptions, type LoungeFilters } from '@/lib/lounges'
import { MIN_STAYS } from '@/lib/readerData'
import { getSeo, metaText, pageMeta } from '@/lib/seo'

import styles from './page.module.css'

export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeo()
  return pageMeta({ ...metaText(seo?.lounges, {}, { title: 'Lounges', description: 'Club and executive lounges: who gets in, hours, what is served, and whether it beats the restaurant, scored by readers who sat in them.' }), path: '/lounges' })
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined

const FORM_ID = 'lounges-filter'

// Lounges (mockup: lounges.html). The band carries the title, one line on what the directory
// holds, and a tab per program with a lounge. Below: the filter bar (search, then country and
// "Rated by readers", folded under "Filters" on phones), the sort menu, the table of lounges, the
// page numbers, and a side column with the box on rating a lounge and the regions. No counts.
//
// The address carries the filters: q, program, country, region, rated=yes, sort and page.
export default async function LoungesIndex({ searchParams }: Props) {
  const sp = await searchParams
  const filters: LoungeFilters = {
    q: first(sp.q)?.trim() || undefined,
    program: first(sp.program),
    country: first(sp.country),
    region: first(sp.region),
    rated: first(sp.rated),
    sort: first(sp.sort),
    page: Math.max(1, Math.floor(Number(first(sp.page))) || 1),
  }
  const [result, options] = await Promise.all([getLoungeDirectory(filters), loungeDirectoryOptions()])
  // The list's address with some filters changed; the page goes back to 1 unless given
  const with_ = (change: Partial<LoungeFilters>, page = 1) => {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...filters, ...change, page: undefined })) if (v) q.set(k, String(v))
    if (page > 1) q.set('page', String(page))
    const s = q.toString()
    return s ? `/lounges?${s}` : '/lounges'
  }
  // a page past the end (an old link after the list shrank) goes to the first page
  if (result.rows.length === 0 && (filters.page ?? 1) > 1) redirect(with_({}))

  const folded = Boolean(filters.country || filters.rated)
  const active = folded || Boolean(filters.q || filters.program || filters.region || filters.sort)
  // a filter that narrows the list besides "Rated by readers" (for the empty line's "among these")
  const narrowed = Boolean(filters.q || filters.program || filters.region || filters.country)
  const regionName = filters.region ? options.regions.find((r) => r.slug === filters.region)?.name : undefined
  const foldSummary = [filters.country, filters.rated === 'yes' ? 'Rated by readers' : null].filter(Boolean).join(', ')
  const sorts = [
    { value: '', label: 'City, A to Z' },
    { value: 'hotel', label: 'Hotel, A to Z' },
    // once a lounge has its reader score
    ...(result.rated > 0 || filters.sort === 'score' ? [{ value: 'score', label: 'Reader score' }] : []),
  ]
  const programName = filters.program ? options.programs.find((p) => p.slug === filters.program)?.name : undefined
  const caption = [programName ? `${programName} lounges` : 'Lounges', regionName ? `in ${regionName}` : null, filters.sort === 'hotel' ? 'by hotel' : filters.sort === 'score' ? 'by reader score' : 'by city'].filter(Boolean).join(' ')

  return (
    <>
      <section className="band page-band">
        <div className="wrap">
          <div className="pb-row">
            <div className="pb-title">
              <h1>Lounges</h1>
              <p className="pb-dek">Club and executive lounges: who gets in, as printed, and reader scores out of five for food, drink, space and ambiance, and service.</p>
            </div>
          </div>
          {options.programs.length > 1 && (
            <nav className="tabs" aria-label="Programs">
              <Link className={!filters.program ? 'on' : undefined} aria-current={!filters.program ? 'page' : undefined} href={with_({ program: undefined })}>
                All
              </Link>
              {options.programs.map((p) => {
                const on = filters.program === p.slug
                return (
                  <Link key={p.slug} className={on ? 'on' : undefined} aria-current={on ? 'page' : undefined} href={with_({ program: p.slug })}>
                    {p.name}
                  </Link>
                )
              })}
            </nav>
          )}
        </div>
      </section>

      <main className="wrap main">
        <form className={`filter-bar hf ${styles.filter}`} id={FORM_ID} role="search" aria-label="Filter lounges" method="get" action="/lounges">
          <div className={`field grow ${styles.grow}`}>
            <label className="label" htmlFor="lounges-q">
              Search
            </label>
            <input key={filters.q ?? ''} className="input" id="lounges-q" type="search" name="q" defaultValue={filters.q ?? ''} placeholder="Lounge, hotel or city" />
          </div>
          {filters.program && <input type="hidden" name="program" value={filters.program} />}
          {filters.region && <input type="hidden" name="region" value={filters.region} />}
          <details className="hf-more" open={folded || undefined}>
            <summary>
              <span className="hf-sum">Filters</span>
              <span className="hf-sum-sub">{foldSummary || 'Country, rated by readers'}</span>
            </summary>
            <div className="hf-fields">
              <div className={`field ${styles.field}`}>
                <label className="label" htmlFor="lounges-country">
                  Country
                </label>
                <select key={filters.country ?? ''} className="select" id="lounges-country" name="country" defaultValue={filters.country ?? ''}>
                  <option value="">All countries</option>
                  {options.countries.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <fieldset className={`field hf-only ${styles.field}`}>
                <legend className="label">Show only</legend>
                <div className="choices">
                  <label className="choice">
                    <input key={`r${filters.rated ?? ''}`} type="checkbox" name="rated" value="yes" defaultChecked={filters.rated === 'yes'} />
                    Rated by readers
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
              <Link className="link" href="/lounges">
                Clear
              </Link>
            )}
          </div>
        </form>

        <div className="grid-side">
          <div>
            <div className={`results-line ${styles.results}`}>
              {regionName && (
                <p className={styles.region}>
                  <b>{regionName}</b>{' '}
                  <Link className="link" href={with_({ region: undefined })}>
                    Every region
                  </Link>
                </p>
              )}
              <SortSelect form={FORM_ID} options={sorts} value={filters.sort ?? ''} />
            </div>
            {result.rows.length > 0 ? (
              <>
                <LoungeTable rows={result.rows} caption={caption} />
                <p className={`note ${styles.note}`}>
                  Who gets in is as printed by the hotel. Reader scores, out of five, join the list once a lounge has {MIN_STAYS} checked ratings.
                </p>
              </>
            ) : (
              <p className={`empty ${styles.empty}`}>
                {filters.rated === 'yes' ? `No lounge has ${MIN_STAYS} checked ratings yet${narrowed ? ' among these' : ''}.` : 'No lounges match those filters.'}{' '}
                {active && <Link href="/lounges">See every lounge</Link>}
              </p>
            )}
            <div className={styles.pagerEnd}>
              <PageNumbers page={result.page} totalPages={result.totalPages} href={(p) => with_({}, p)} />
            </div>
          </div>

          <aside className={styles.side} aria-label="More on lounges">
            <section className="box" aria-labelledby="rate-h">
              <h2 id="rate-h">Sat in a club lounge?</h2>
              <p>Rate it from the lounge&rsquo;s page: food, drink, space and ambiance, and service out of five, an overall mark, and whether it was worth a club room. Two minutes.</p>
            </section>
            {options.regions.length > 0 && (
              <section className="mod" aria-labelledby="regions-h">
                <div className="mod-head">
                  <h2 id="regions-h">Lounges by region</h2>
                </div>
                <table className={`table ${styles.sideTable}`}>
                  <tbody>
                    {options.regions.map((r) => (
                      <tr key={r.slug}>
                        <th scope="row">
                          <Link href={with_({ region: r.slug, country: undefined })} aria-current={filters.region === r.slug ? 'true' : undefined}>
                            {r.name}
                          </Link>
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
