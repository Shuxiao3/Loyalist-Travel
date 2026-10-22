import Link from 'next/link'

import { accessLine, type LoungeRow } from '@/lib/lounges'
import type { Destination, Program } from '@/payload-types'

import styles from './LoungeTable.module.css'

const obj = <T extends object>(v: unknown): T | null => (v && typeof v === 'object' ? (v as T) : null)

// Where a hotel is, under its city: the state for the United States ("Georgia, US"), else the country
function cityLine(d: Destination | null): string | null {
  if (!d) return null
  if (d.country === 'United States') return d.stateOrRegion ? `${d.stateOrRegion}, US` : 'US'
  return d.country && d.country !== d.name ? d.country : null
}

// The lounge directory's table (mockup: lounges.html, .table.lt): each row is the hotel, as the
// link to its lounge page, over the lounge's name and, once readers have scored it, the reader
// score; then the city, the program and who gets in, as printed. On phones the row keeps the
// hotel and the lounge, with the place and who gets in on one muted line under them.
export function LoungeTable({ rows, caption }: { rows: LoungeRow[]; caption: string }) {
  return (
    <table className={`table ${styles.lt}`}>
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          <th className={styles.hotel}>Hotel and lounge</th>
          <th className={styles.city}>City</th>
          <th className={styles.prog}>Program</th>
          <th className={styles.who}>Who gets in</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ lounge, hotel, data }) => {
          const dest = obj<Destination>(hotel?.destination)
          const program = obj<Program>(hotel?.program)
          const who = accessLine(lounge)
          const place = dest ? dest.locationLabel?.trim() || dest.name : null
          const href = `/lounges/${lounge.slug}`
          return (
            <tr key={lounge.id}>
              <td className={styles.hotel}>
                <Link className="hn" href={href}>
                  {hotel?.name ?? lounge.name}
                </Link>
                <span className="sub-b">
                  {hotel ? lounge.name : null}
                  {data?.score != null && (
                    <>
                      {hotel ? ' · ' : null}
                      <span className={styles.mk}>
                        Readers{' '}
                        <span className="score-inline" aria-label={`Reader score ${data.score.toFixed(1)} out of 5`}>
                          {data.score.toFixed(1)}
                          <small>/5</small>
                        </span>
                      </span>
                    </>
                  )}
                </span>
                <span className={styles.m}>{[place, who].filter(Boolean).join(' · ')}</span>
              </td>
              <td className={styles.city}>
                {dest?.name ?? <span className="na">&ndash;</span>}
                {cityLine(dest) && <span className="sub-b">{cityLine(dest)}</span>}
              </td>
              <td className={styles.prog}>{program?.name ?? ''}</td>
              <td className={styles.who}>{who}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
