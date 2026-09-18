import type { Metadata } from 'next'

import { pageMeta } from '@/lib/seo'
import Link from 'next/link'

import { LandingHero } from '@/components/LandingHero'
import { LoungeRows } from '@/components/LoungeRows'
import { count } from '@/lib/format'
import { getLoungeDirectory } from '@/lib/lounges'
import { getHotelFilterOptions } from '@/lib/queries'

import styles from './page.module.css'

export const revalidate = 300

export const metadata: Metadata = pageMeta({ title: 'Lounges', description: 'Club and executive lounges: who gets in, hours, what is served, and whether it beats the restaurant, scored by readers who sat in them.', path: '/lounges' })

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined

export default async function LoungesIndex({ searchParams }: Props) {
  const sp = await searchParams
  const filters = { program: first(sp.program), country: first(sp.country) }
  const [rows, all, options] = await Promise.all([getLoungeDirectory(filters), getLoungeDirectory(), getHotelFilterOptions()])
  const active = Boolean(filters.program || filters.country)
  const rated = all.filter((r) => r.data?.score != null)
  const top = rated[0]
  return (
    <>
      <LandingHero
        eyebrow="Lounges"
        title="Hotel lounges rated"
        text="Readers score every club lounge on food, drink, space and ambiance, and service, give it an overall mark out of five, and say whether it was worth booking a club room. Access rules and hours sit alongside, as printed."
        photo={top?.lounge.externalImageUrl ?? top?.hotel?.externalImageUrl}
        card={
          top
            ? {
                eyebrow: 'Top rated lounge',
                image: top.lounge.externalImageUrl ?? top.hotel?.externalImageUrl,
                meta: [top.hotel?.name, `${top.data?.stays ?? 0} rated ${top.data?.stays === 1 ? 'stay' : 'stays'}`].filter((m): m is string => Boolean(m)),
                title: top.lounge.name,
                figure: top.data?.score != null ? { value: top.data.score.toFixed(1), label: 'of 5' } : null,
                cta: 'See the lounge',
                href: `/lounges/${top.lounge.slug}`,
              }
            : null
        }
      />

      <section className={`section ${styles.filters}`}>
        <div className="wrap">
          <form className={styles.form} method="get" action="/lounges">
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
                {count(rows.length)} {rows.length === 1 ? 'lounge' : 'lounges'}
                {active ? ' match' : ''}
              </h2>
            </div>
            <span className={styles.fineHead}>Open a lounge to rate it</span>
          </div>
          {rows.length > 0 ? <LoungeRows rows={rows} /> : <p className={styles.empty}>No lounges on record yet{active ? ' for those filters' : ''}.</p>}
          <p className={styles.fine}>Reader scores appear once a lounge has five rated stays. Access and hours are as printed; whether access was honoured is reported by readers.</p>
        </div>
      </section>
    </>
  )
}
