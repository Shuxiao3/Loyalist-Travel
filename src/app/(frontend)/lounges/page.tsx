import type { Metadata } from 'next'

import { getSeo, metaText, pageMeta } from '@/lib/seo'
import Link from 'next/link'

import { HERO_FALLBACK_PHOTO, LandingHero } from '@/components/LandingHero'
import { LoungeRows } from '@/components/LoungeRows'
import { Pager } from '@/components/Pager'
import { count } from '@/lib/format'
import { getLoungeDirectory, getTopLounge, type LoungeFilters, LOUNGES_PER_PAGE } from '@/lib/lounges'
import { getHotelFilterOptions } from '@/lib/queries'

import styles from './page.module.css'

export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeo()
  return pageMeta({ ...metaText(seo?.lounges, {}, { title: 'Lounges', description: 'Club and executive lounges: who gets in, hours, what is served, and whether it beats the restaurant, scored by readers who sat in them.' }), path: '/lounges' })
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined

export default async function LoungesIndex({ searchParams }: Props) {
  const sp = await searchParams
  const filters: LoungeFilters = { q: first(sp.q)?.trim() || undefined, program: first(sp.program), country: first(sp.country), rated: first(sp.rated), page: Math.max(1, Number(first(sp.page)) || 1) }
  const [result, top, options] = await Promise.all([getLoungeDirectory(filters), getTopLounge(), getHotelFilterOptions()])
  const active = Boolean(filters.q || filters.program || filters.country || filters.rated)
  const href = (page: number) => {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(filters)) if (k !== 'page' && v) q.set(k, String(v))
    if (page > 1) q.set('page', String(page))
    const s = q.toString()
    return s ? `/lounges?${s}` : '/lounges'
  }
  return (
    <>
      <LandingHero
        eyebrow="Lounges"
        title="Hotel lounges rated"
        text="Readers score every club lounge on food, drink, space and ambiance, and service, give it an overall mark out of five, and say whether it was worth booking a club room. Access rules and hours sit alongside, as printed."
        photo={top?.lounge.externalImageUrl ?? top?.hotel?.externalImageUrl ?? HERO_FALLBACK_PHOTO}
      />

      <section className={`section ${styles.filters}`}>
        <div className="wrap">
          <form className={styles.form} method="get" action="/lounges">
            <label className={styles.q}>
              <span className="label">Search</span>
              <input type="search" name="q" defaultValue={filters.q ?? ''} placeholder="Lounge, hotel or city" />
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
              <span className="label">Reader scores</span>
              <select name="rated" defaultValue={filters.rated ?? ''}>
                <option value="">All lounges</option>
                <option value="yes">Rated by readers</option>
              </select>
            </label>
            <div className={styles.actions}>
              <button className="btn" type="submit">
                Filter
              </button>
              {active && (
                <Link className="more" href="/lounges">
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
              <span className="eyebrow on-light">The directory</span>
              <h2>
                {count(result.totalDocs)} {result.totalDocs === 1 ? 'lounge' : 'lounges'}
                {active ? ' match' : ''}
              </h2>
            </div>
            <span className={styles.fineHead}>Open a lounge to rate it</span>
          </div>
          {result.rows.length > 0 ? <LoungeRows rows={result.rows} /> : <p className={styles.empty}>No lounges on record yet{active ? ' for those filters' : ''}.</p>}
          <Pager page={result.page} totalPages={result.totalPages} totalDocs={result.totalDocs} perPage={LOUNGES_PER_PAGE} href={href} />
          <p className={styles.fine}>Reader scores appear once a lounge has five rated stays. Access and hours are as printed; whether access was honoured is reported by readers.</p>
        </div>
      </section>
    </>
  )
}
