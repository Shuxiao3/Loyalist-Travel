import type { Metadata } from 'next'
import Link from 'next/link'

import { HotelList } from '@/components/HotelCard'
import { Pager } from '@/components/Pager'
import { count } from '@/lib/format'
import { findHotels, getHotelFilterOptions, HOTELS_PER_PAGE, type HotelFilters } from '@/lib/queries'

import styles from './page.module.css'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Hotels',
  description: 'Every hotel indexed across World of Hyatt, Marriott Bonvoy, IHG One Rewards and Hilton Honors, filterable by program, brand and country.',
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined

export default async function HotelsIndex({ searchParams }: Props) {
  const sp = await searchParams
  const filters: HotelFilters = {
    q: first(sp.q)?.trim() || undefined,
    program: first(sp.program),
    brand: first(sp.brand),
    country: first(sp.country),
    scored: first(sp.scored),
    page: Math.max(1, Number(first(sp.page)) || 1),
  }
  const [result, options] = await Promise.all([findHotels(filters), getHotelFilterOptions()])
  const active = Object.entries(filters).filter(([k, v]) => k !== 'page' && v).length

  const href = (page: number) => {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(filters)) if (k !== 'page' && v) q.set(k, String(v))
    if (page > 1) q.set('page', String(page))
    const s = q.toString()
    return s ? `/hotels?${s}` : '/hotels'
  }

  const brands = filters.program
    ? options.brands.filter((b) => {
        const p = options.programs.find((x) => x.slug === filters.program)
        return p && (typeof b.program === 'object' ? b.program?.id : b.program) === p.id
      })
    : options.brands

  return (
    <>
      <header className={`hero ${styles.hero}`}>
        <div className="wrap">
          <span className="eyebrow">Hotel index</span>
          <h1 className={styles.h1}>
            {count(result.totalDocs)} {result.totalDocs === 1 ? 'hotel' : 'hotels'}
            {active ? ' match' : ''}
          </h1>
          <p className="sub">Every property across four programs, with brand and place. Scored stays are marked. The rest are indexed so a hotel page exists before the review does.</p>
        </div>
      </header>

      <section className={`section ${styles.filters}`}>
        <div className="wrap">
          <form className={styles.form} method="get" action="/hotels">
            <label className={styles.q}>
              <span className="label">Search</span>
              <input type="search" name="q" defaultValue={filters.q ?? ''} placeholder="Hotel name" />
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
              <span className="label">Scored</span>
              <select name="scored" defaultValue={filters.scored ?? ''}>
                <option value="">All hotels</option>
                <option value="yes">Scored stays only</option>
              </select>
            </label>
            <div className={styles.actions}>
              <button className="btn" type="submit">
                Filter
              </button>
              {active > 0 && (
                <Link className="more" href="/hotels">
                  Clear
                </Link>
              )}
            </div>
          </form>
        </div>
      </section>

      <section className={`section ${styles.results}`}>
        <div className="wrap">
          {result.docs.length > 0 ? (
            <HotelList hotels={result.docs} />
          ) : (
            <p className={styles.empty}>No hotels match those filters.</p>
          )}
          <Pager page={result.page ?? 1} totalPages={result.totalPages} totalDocs={result.totalDocs} perPage={HOTELS_PER_PAGE} href={href} />
        </div>
      </section>
    </>
  )
}
