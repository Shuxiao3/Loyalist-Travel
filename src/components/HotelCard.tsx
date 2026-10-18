import Link from 'next/link'

import { count, rel } from '@/lib/format'
import { EMPTY_SNAPSHOT, type HotelSnapshot } from '@/lib/hotelSnapshot'
import { hotelPhoto } from '@/lib/photos'
import type { Brand, Destination, Hotel } from '@/payload-types'

import styles from './HotelCard.module.css'

// A hotel on index and reference pages. In a grid each hotel is its own
// card: the photo (or a placeholder gradient, cycled by position like the
// article cards), then brand, name and place, then a snapshot of what
// readers and the forums have reported there, with a Lounge tag when the
// hotel has one. Rows, used for the related hotels on a hotel page, keep
// the plain name-and-place form.
const TONES = ['a', 'b', 'c'] as const

// The upgrade rate is printed only once this many stays have said whether
// an upgrade came (the floor for medium confidence in blockConfidence);
// below it a card shows the count instead, so one stay never reads as 0%
// or 100%.
const MIN_RATE_STAYS = 3

const NO_STAYS: HotelSnapshot = { ...EMPTY_SNAPSHOT }

type CardProps = { hotel: Hotel; grid?: boolean; index?: number; snapshot?: HotelSnapshot }

export function HotelCard({ hotel, grid, index = 0, snapshot }: CardProps) {
  const brand = rel<Brand>(hotel.brand)
  const destination = rel<Destination>(hotel.destination)
  const place = destination ? destination.locationLabel ?? destination.name : null
  const lounge = hotel.clubLounge === 'yes'
  const href = `/hotels/${hotel.slug}`

  if (!grid) {
    return (
      <Link className={styles.row} href={href}>
        <span className={styles.main}>
          <span className="label">{brand?.name}</span>
          <span className={styles.title}>{hotel.name}</span>
          {place && <span className={styles.place}>{place}</span>}
        </span>
        {lounge && <span className={styles.right}>Lounge</span>}
      </Link>
    )
  }

  // A photo uploaded in the admin first, then the Webflow-hosted one; the
  // gradient shows until a photo loads, and stays when there is none. The
  // image is decorative (the link already carries the hotel's name) and
  // lazy, so a page of cards fetches only the photos that scroll into view.
  // The tone shifts by one each row so a column is not one colour top to
  // bottom.
  const photo = hotelPhoto(hotel)
  const tone = TONES[(index + Math.floor(index / TONES.length)) % TONES.length]
  return (
    <Link className={styles.card} href={href}>
      <span className={`${styles.photo} ${styles[tone]}`}>{photo && <img className={styles.img} src={photo} alt="" loading="lazy" decoding="async" />}</span>
      <span className={styles.body}>
        <span className={styles.text}>
          <span className="label">{brand?.name}</span>
          <span className={styles.title}>{hotel.name}</span>
          {place && <span className={styles.place}>{place}</span>}
        </span>
        {(snapshot || lounge) && (
          <span className={styles.foot}>
            {snapshot ? <Snapshot data={snapshot} /> : <span />}
            {lounge && <span className={styles.tag}>Lounge</span>}
          </span>
        )}
      </span>
    </Link>
  )
}

// The foot of a card, always a figure, a label and a line under them so the
// feet of a row sit level: the upgrade rate over the stays reported there
// once enough of them have said, otherwise how many stays there are, or
// that there are none yet.
function Snapshot({ data }: { data: HotelSnapshot }) {
  const one = data.stays === 1
  if (typeof data.upgradeRate === 'number' && data.rated >= MIN_RATE_STAYS) {
    return <Figure big={`${Math.round(data.upgradeRate)}%`} label="upgraded" note={`${count(data.stays)} ${one ? 'stay' : 'stays'}`} />
  }
  if (data.stays > 0) {
    return <Figure big={count(data.stays)} label={one ? 'stay' : 'stays'} note={data.stays < MIN_RATE_STAYS ? `Rate shown from ${MIN_RATE_STAYS} stays` : 'Upgrade rate unknown'} />
  }
  return <Figure big="0" label="stays" note="None reported yet" />
}

function Figure({ big, label, note }: { big: string; label: string; note: string }) {
  return (
    <span className={styles.snap}>
      <span className={styles.figure}>
        <span className={styles.rate}>{big}</span>
        <span className="label">{label}</span>
      </span>
      <span className={styles.stays}>{note}</span>
    </span>
  )
}

// `snapshots` is keyed by hotel id; a hotel missing from it has no stays.
// Without the map (reference pages) the cards carry no snapshot line.
export function HotelList({ hotels, grid, snapshots }: { hotels: Hotel[]; grid?: boolean; snapshots?: Record<number, HotelSnapshot> }) {
  return (
    <div className={grid ? styles.grid : styles.list}>
      {hotels.map((h, i) => (
        <HotelCard key={h.id} hotel={h} grid={grid} index={i} snapshot={snapshots ? (snapshots[h.id] ?? NO_STAYS) : undefined} />
      ))}
    </div>
  )
}
