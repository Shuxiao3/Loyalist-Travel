import Link from 'next/link'
import { Fragment, type ReactNode } from 'react'

import { score } from '@/lib/format'
import { type HotelRowExtras, MIN_UPGRADE_STAYS, segmentLabel } from '@/lib/hotelBrowse'
import type { Brand, Destination, Hotel, Program } from '@/payload-types'

import styles from './HotelTable.module.css'

// The kit's hotel table (mockups: hotels.html, destination.html, brand.html; .table.ht). Each
// row is the hotel's name over a muted line of its brand and place, chosen per page, ending in a
// small mark for a review ("Our review 87.5/100") or a club lounge, never a column of its own.
// Then, as the page asks, the program and the segment, and always "Got an upgrade": the share of
// stays that got one, out of those that said, once enough have said, else a muted dash. On
// phones only the hotel and the upgrade figure stay.

export type HotelTableColumns = { brand?: boolean; place?: boolean; program?: boolean; segment?: boolean }

const obj = <T extends object>(v: unknown): T | null => (v && typeof v === 'object' ? (v as T) : null)

// Between the parts of the second line: the dot keeps to the part before it
const SEP = ' · '

export function HotelTable({ hotels, extras, caption, columns = {} }: { hotels: Hotel[]; extras: HotelRowExtras; caption: string; columns?: HotelTableColumns }) {
  return (
    <table className={`table ${styles.ht}`}>
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          <th className={styles.hotel}>Hotel</th>
          {columns.program && <th className={styles.prog}>Program</th>}
          {columns.segment && <th className={styles.type}>Segment</th>}
          <th className={`r ${styles.up}`}>Got an upgrade</th>
        </tr>
      </thead>
      <tbody>
        {hotels.map((h) => {
          const brand = obj<Brand>(h.brand)
          const dest = obj<Destination>(h.destination)
          const program = obj<Program>(h.program)
          const review = extras.reviews.get(h.id)
          const lounge = extras.lounges.get(h.id)
          const snap = extras.snapshots[h.id]
          const parts: ReactNode[] = []
          if (columns.brand && brand?.name) parts.push(brand.name)
          if (columns.place && dest) parts.push(dest.locationLabel?.trim() || dest.name)
          if (review)
            parts.push(
              <span className={styles.mk}>
                Our review{' '}
                <Link className="score-inline" href={`/reviews/${review.slug}`} aria-label={`Our review: ${score(review.score)} out of 100`}>
                  {score(review.score)}
                  <small>/100</small>
                </Link>
              </span>,
            )
          if (lounge)
            parts.push(
              <Link className={styles.mk} href={`/lounges/${lounge}`}>
                Club lounge
              </Link>,
            )
          else if (h.clubLounge === 'yes') parts.push(<span className={styles.mk}>Club lounge</span>)
          const rated = snap && typeof snap.upgradeRate === 'number' && snap.rated >= MIN_UPGRADE_STAYS
          return (
            <tr key={h.id}>
              <td className={styles.hotel}>
                <Link className="hn" href={`/hotels/${h.slug}`}>
                  {h.name}
                </Link>
                {parts.length > 0 && (
                  <span className="sub-b">
                    {parts.map((p, i) => (
                      <Fragment key={i}>
                        {i > 0 && SEP}
                        {p}
                      </Fragment>
                    ))}
                  </span>
                )}
              </td>
              {columns.program && <td className={styles.prog}>{program?.name ?? ''}</td>}
              {columns.segment && <td className={styles.type}>{segmentLabel(h.segment) ?? <span className="na">&ndash;</span>}</td>}
              <td className={`r ${styles.up}`}>
                {rated ? (
                  <>
                    <span className="pct">{Math.round(snap.upgradeRate as number)}%</span> <span className="n">of {snap.rated}</span>
                  </>
                ) : (
                  <>
                    <span className="na" title="Not enough stays yet" aria-hidden="true">
                      &ndash;
                    </span>
                    <span className="sr-only">Not enough stays yet</span>
                  </>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// The line under every hotel table
export function HotelTableNote({ pool }: { pool?: 'aggregated' | 'reader' }) {
  return (
    <p className={`note ${styles.note}`}>
      <b>Got an upgrade</b> is the share of stays that got any room upgrade, out of those that said, with recent stays counting more. It shows once {MIN_UPGRADE_STAYS} stays have said; until then, a dash.
      {pool === 'aggregated' && ' Sorted this way, each figure comes from the aggregated data alone.'}
      {pool === 'reader' && ' Sorted this way, each figure comes from reader stays alone.'}
    </p>
  )
}
