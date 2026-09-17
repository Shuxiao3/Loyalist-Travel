import type { Metadata } from 'next'
import Link from 'next/link'

import { LoungeRows } from '@/components/LoungeRows'
import { count } from '@/lib/format'
import { getLoungeDirectory } from '@/lib/lounges'
import { getHotelFilterOptions } from '@/lib/queries'

import styles from './page.module.css'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Lounges',
  description: 'Club and executive lounges: who gets in, hours, what is served, and whether it beats the restaurant, scored by readers who sat in them.',
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined

export default async function LoungesIndex({ searchParams }: Props) {
  const sp = await searchParams
  const filters = { program: first(sp.program), country: first(sp.country) }
  const [rows, options] = await Promise.all([getLoungeDirectory(filters), getHotelFilterOptions()])
  const active = Boolean(filters.program || filters.country)
  return (
    <>
      <header className={`hero ${styles.hero}`}>
        <div className="wrap">
          <span className="eyebrow">Lounges</span>
          <h1 className={styles.h1}>Is the club lounge worth the room category?</h1>
          <p className="sub">Access rules by status, hours, what actually gets served, and whether it beats the restaurant downstairs. Every lounge scored by readers who sat in it.</p>
        </div>
      </header>

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
            <Link className="more" href="/submit-a-stay">
              Rate one
            </Link>
          </div>
          {rows.length > 0 ? <LoungeRows rows={rows} /> : <p className={styles.empty}>No lounges on record yet{active ? ' for those filters' : ''}.</p>}
          <p className={styles.fine}>Reader scores appear once a lounge has five rated stays. Access and hours are as printed; whether access was honoured is reported by readers.</p>
        </div>
      </section>
    </>
  )
}
