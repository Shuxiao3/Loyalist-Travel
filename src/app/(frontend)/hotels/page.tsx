import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { BrowseSide, SidePlaces, StayBox } from '@/components/BrowseSide'
import { CurrentTabInView } from '@/components/CurrentTabInView'
import { HotelTable, HotelTableNote } from '@/components/HotelTable'
import { PageNumbers } from '@/components/PageNumbers'
import { SortSelect } from '@/components/SortSelect'
import { hotelFilterExtras, hotelRowExtras, hotelSideCounts, programTabs } from '@/lib/hotelBrowse'
import { findHotels, getHotelFilterOptions, HOTEL_SORTS, type HotelFilters, upgradePoolOf } from '@/lib/queries'
import { getSeo, metaText, pageMeta } from '@/lib/seo'
import { noRankText } from '@/lib/upgradeRanking'

import styles from './page.module.css'

export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeo()
  return pageMeta({ ...metaText(seo?.hotels, {}, { title: 'Hotels', description: 'Every hotel indexed across World of Hyatt, Marriott Bonvoy, IHG One Rewards and Hilton Honors, filterable by program, brand and country.' }), path: '/hotels' })
}

// Hotels (mockup: hotels.html). The band carries the title and the program tabs. Below: the
// filter bar (search, then region or country, brand and two "Show only" boxes, folded under
// "Filters" on phones), the sort menu, the hotel table, the page numbers, and a side column of
// regions and cities, A to Z. No counts of the site's hotels anywhere on the page.
//
// The address carries the filters: q, program, brand, country, region, scored=yes, lounge=yes,
// sort and page. The "Region or country" menu sends one field, `where` ("region:europe" or
// "country:Austria"); the page moves it into region or country. An old link's `segment` (a
// filter the page no longer has) is ignored, and the page's own links drop it.

const FORM_ID = 'hotels-filter'
const FILTER_KEYS = ['q', 'program', 'brand', 'country', 'region', 'scored', 'lounge', 'sort'] as const

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)

export default async function HotelsIndex({ searchParams }: Props) {
  const sp = await searchParams

  // The filter form's "Region or country" choice, moved into the address as region or country
  if (sp.where !== undefined) {
    const where = first(sp.where) ?? ''
    const q = new URLSearchParams()
    for (const k of FILTER_KEYS) {
      if (k === 'region' || k === 'country') continue
      const v = first(sp[k])?.trim()
      if (v) q.set(k, v)
    }
    if (where.startsWith('region:') && where.length > 7) q.set('region', where.slice(7))
    else if (where.startsWith('country:') && where.length > 8) q.set('country', where.slice(8))
    const s = q.toString()
    redirect(s ? `/hotels?${s}` : '/hotels')
  }

  const filters: HotelFilters = {
    q: first(sp.q)?.trim() || undefined,
    program: first(sp.program),
    brand: first(sp.brand),
    country: first(sp.country),
    region: first(sp.region),
    scored: first(sp.scored),
    lounge: first(sp.lounge),
    sort: first(sp.sort),
    page: Math.max(1, Math.floor(Number(first(sp.page))) || 1),
  }
  const options = await getHotelFilterOptions()
  const programDoc = filters.program ? options.programs.find((p) => p.slug === filters.program) : undefined
  const brandProgram = (b: (typeof options.brands)[number]) => (typeof b.program === 'object' ? b.program?.id : b.program)
  const brands = programDoc ? options.brands.filter((b) => brandProgram(b) === programDoc.id) : options.brands
  const brandDoc = filters.brand ? options.brands.find((b) => b.slug === filters.brand) : undefined
  const brandProgramSlug = brandDoc ? options.programs.find((p) => p.id === brandProgram(brandDoc))?.slug : undefined

  // sorted by one pool's upgrade chance, the list holds the hotels that rank, and the rows show that pool's figure
  const pool = upgradePoolOf(filters.sort) ?? undefined
  const [result, extras, tabs, side] = await Promise.all([findHotels(filters), hotelFilterExtras(), programTabs(), hotelSideCounts(filters.program)])
  // The list's address with some filters changed; the page goes back to 1 unless given
  const with_ = (change: Partial<HotelFilters>, page = 1) => {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...filters, ...change, page: undefined })) if (v) q.set(k, String(v))
    if (page > 1) q.set('page', String(page))
    const s = q.toString()
    return s ? `/hotels?${s}` : '/hotels'
  }
  // A page past the end (an old link after the list shrank) goes to the first page.
  if (result.docs.length === 0 && (filters.page ?? 1) > 1) redirect(with_({}))

  const rows = await hotelRowExtras(result.docs, pool)
  // A program tab keeps the other filters, and the brand only when it belongs to that program
  const tabHref = (slug?: string) => with_({ program: slug, brand: !slug || !brandProgramSlug || brandProgramSlug === slug ? filters.brand : undefined })

  const folded = Boolean(filters.country || filters.region || filters.brand || filters.scored || filters.lounge)
  const active = folded || Boolean(filters.q || filters.program || filters.sort)
  const whereValue = filters.region ? `region:${filters.region}` : filters.country ? `country:${filters.country}` : ''
  const regionName = filters.region ? extras.regions.find((r) => r.slug === filters.region)?.name : undefined
  const foldSummary = [regionName ?? filters.region, filters.country, brandDoc?.name ?? filters.brand, filters.scored === 'yes' ? 'Reviewed' : null, filters.lounge === 'yes' ? 'Club lounge' : null].filter(Boolean).join(', ')

  const page = result.page ?? 1
  const programQuery = filters.program ? `?program=${encodeURIComponent(filters.program)}` : ''

  return (
    <>
      <section className="band page-band">
        <div className="wrap">
          <div className="pb-row">
            <div className="pb-title">
              <h1>Hotels</h1>
              <p className="pb-dek">Every hotel indexed across World of Hyatt, Marriott Bonvoy, IHG One Rewards and Hilton Honors.</p>
            </div>
          </div>
          <nav className="tabs tabs-bleed" aria-label="Programs">
            <Link className={!filters.program ? 'on' : undefined} aria-current={!filters.program ? 'page' : undefined} href={tabHref(undefined)}>
              All
            </Link>
            {tabs.map((t) => {
              const on = filters.program === t.slug
              return (
                <Link key={t.slug} className={on ? 'on' : undefined} aria-current={on ? 'page' : undefined} href={tabHref(t.slug)}>
                  {t.name}
                </Link>
              )
            })}
          </nav>
          <CurrentTabInView current={filters.program} />
        </div>
      </section>

      <main className="wrap main">
        <form className={`filter-bar hf ${styles.filters}`} id={FORM_ID} role="search" aria-label="Filter hotels" method="get" action="/hotels">
          <div className="field grow">
            <label className="label" htmlFor="hotels-q">
              Search
            </label>
            <input key={filters.q ?? ''} className="input" id="hotels-q" type="search" name="q" defaultValue={filters.q ?? ''} placeholder="Hotel name" />
          </div>
          {filters.program && <input type="hidden" name="program" value={filters.program} />}
          <details className="hf-more" open={folded || undefined}>
            <summary>
              <span className="hf-sum">Filters</span>
              <span className="hf-sum-sub">{foldSummary || 'Region, brand'}</span>
            </summary>
            <div className="hf-fields">
              <div className="field">
                <label className="label" htmlFor="hotels-where">
                  Region or country
                </label>
                <select key={whereValue} className="select" id="hotels-where" name="where" defaultValue={whereValue}>
                  <option value="">Anywhere</option>
                  <optgroup label="Regions">
                    {extras.regions.map((r) => (
                      <option key={r.slug} value={`region:${r.slug}`}>
                        {r.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Countries">
                    {options.countries.map((c) => (
                      <option key={c} value={`country:${c}`}>
                        {c}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div className="field">
                <label className="label" htmlFor="hotels-brand">
                  Brand
                </label>
                <select key={filters.brand ?? ''} className="select" id="hotels-brand" name="brand" defaultValue={filters.brand ?? ''}>
                  <option value="">All brands</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.slug}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <fieldset className="field hf-only">
                <legend className="label">Show only</legend>
                <div className="choices">
                  <label className="choice">
                    <input key={`s${filters.scored ?? ''}`} type="checkbox" name="scored" value="yes" defaultChecked={filters.scored === 'yes'} />
                    Reviewed hotels
                  </label>
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
              <Link className="link" href="/hotels">
                Clear
              </Link>
            )}
          </div>
        </form>

        <div className="grid-side">
          <div className={styles.list}>
            <div className={`results-line ${styles.results}`}>
              <SortSelect form={FORM_ID} options={HOTEL_SORTS} value={filters.sort ?? ''} />
            </div>
            {result.docs.length > 0 ? (
              <>
                <HotelTable hotels={result.docs} extras={rows} caption="Hotels" columns={{ brand: true, place: true, program: true }} />
                <HotelTableNote pool={pool} />
              </>
            ) : (
              <p className={`empty ${styles.empty}`}>
                {pool ? noRankText(pool) : 'No hotels match those filters.'}{' '}
                {active && <Link href="/hotels">See every hotel</Link>}
              </p>
            )}
            <PageNumbers page={page} totalPages={result.totalPages} href={(p) => with_({}, p)} />
          </div>

          <BrowseSide>
            <SidePlaces
              id="by-region"
              title="By region"
              rows={[...side.regions].sort(byName).map((r) => ({ href: `/hotels?${filters.program ? `program=${encodeURIComponent(filters.program)}&` : ''}region=${encodeURIComponent(r.slug)}`, name: r.name, on: filters.region === r.slug }))}
            />
            <SidePlaces id="top-cities" title="Cities" rows={[...side.cities].sort(byName).map((c) => ({ href: `/destinations/${c.slug}${programQuery}`, name: c.name, sub: c.country }))} />
            <StayBox id="stay-h" title="Stayed somewhere on status?" />
          </BrowseSide>
        </div>
      </main>
    </>
  )
}
