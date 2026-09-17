import Link from 'next/link'

import { rel } from '@/lib/format'
import type { Brand, Destination, Hotel } from '@/payload-types'

import styles from './HotelCard.module.css'

const SEGMENT: Record<string, string> = {
  'ultra-luxury': 'Ultra luxury',
  luxury: 'Luxury',
  upscale: 'Upscale',
  midscale: 'Midscale',
  budget: 'Budget',
  'extended-stay': 'Extended stay',
}

// A hotel row on index and reference pages: name, brand and place, and
// whether it has been scored.
export function HotelCard({ hotel }: { hotel: Hotel }) {
  const brand = rel<Brand>(hotel.brand)
  const destination = rel<Destination>(hotel.destination)
  return (
    <Link className={styles.row} href={`/hotels/${hotel.slug}`}>
      <span>
        <span className="label">
          {[brand?.name, hotel.segment ? SEGMENT[hotel.segment] : null].filter(Boolean).join(' · ')}
        </span>
        <span className={styles.title}>{hotel.name}</span>
        {destination && <span className={styles.place}>{destination.locationLabel ?? destination.name}</span>}
      </span>
      <span className={styles.right}>{hotel.reviewStatus === 'reviewed' ? 'Scored' : hotel.reviewStatus === 'coming-soon' ? 'Coming soon' : ''}</span>
    </Link>
  )
}

export function HotelList({ hotels }: { hotels: Hotel[] }) {
  return (
    <div className={styles.list}>
      {hotels.map((h) => (
        <HotelCard key={h.id} hotel={h} />
      ))}
    </div>
  )
}
