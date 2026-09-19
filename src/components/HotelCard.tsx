import Link from 'next/link'

import { rel } from '@/lib/format'
import type { Brand, Destination, Hotel } from '@/payload-types'

import styles from './HotelCard.module.css'

// A hotel on index and reference pages: name, brand and place, and the
// marks that matter (a club lounge, a scored stay). Rows in a card by
// default; `grid` packs them three across so a long index needs less
// scrolling.
export function HotelCard({ hotel, grid }: { hotel: Hotel; grid?: boolean }) {
  const brand = rel<Brand>(hotel.brand)
  const destination = rel<Destination>(hotel.destination)
  const marks = [hotel.clubLounge === 'yes' ? 'Lounge' : null, hotel.reviewStatus === 'reviewed' ? 'Scored' : hotel.reviewStatus === 'coming-soon' ? 'Coming soon' : null].filter(Boolean).join(' · ')
  return (
    <Link className={grid ? styles.tile : styles.row} href={`/hotels/${hotel.slug}`}>
      <span className={styles.main}>
        <span className="label">{brand?.name}</span>
        <span className={styles.title}>{hotel.name}</span>
        {destination && <span className={styles.place}>{destination.locationLabel ?? destination.name}</span>}
      </span>
      {marks && <span className={styles.right}>{marks}</span>}
    </Link>
  )
}

export function HotelList({ hotels, grid }: { hotels: Hotel[]; grid?: boolean }) {
  return (
    <div className={grid ? styles.grid : styles.list}>
      {hotels.map((h) => (
        <HotelCard key={h.id} hotel={h} grid={grid} />
      ))}
    </div>
  )
}
