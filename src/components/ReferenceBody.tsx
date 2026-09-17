import Link from 'next/link'

import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import type { Hotel, Review } from '@/payload-types'

import { HotelList } from './HotelCard'
import { ReviewCard } from './ReviewCard'
import { RichText } from './RichText'
import styles from './ReferenceBody.module.css'

// Shared body for brand, destination and program pages: an overview, the
// scored stays, and the hotel list.
export function ReferenceBody({
  overview,
  reviews,
  hotels,
  hotelsTotal,
  hotelsHref,
  name,
}: {
  overview?: SerializedEditorState | null
  reviews: Review[]
  hotels: Hotel[]
  hotelsTotal: number
  hotelsHref: string
  name: string
}) {
  return (
    <>
      {overview && (
        <section className={`section ${styles.overview}`}>
          <div className="wrap">
            <RichText data={overview} className={styles.prose} />
          </div>
        </section>
      )}

      {reviews.length > 0 && (
        <section className="section" aria-labelledby="rev-h">
          <div className="wrap">
            <div className="section-head">
              <div>
                <span className="eyebrow on-light">Scored stays</span>
                <h2 id="rev-h">Reviews</h2>
              </div>
              <Link className="more" href="/reviews">
                All reviews
              </Link>
            </div>
            <div className="cards">
              {reviews.map((r, i) => (
                <ReviewCard key={r.id} review={r} tone={(['a', 'b', 'c'] as const)[i % 3]} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className={`section ${styles.hotels}`} aria-labelledby="hot-h">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow on-light">Hotels</span>
              <h2 id="hot-h">
                {hotelsTotal.toLocaleString('en-US')} {hotelsTotal === 1 ? 'hotel' : 'hotels'} indexed for {name}
              </h2>
            </div>
            {hotelsTotal > hotels.length && (
              <Link className="more" href={hotelsHref}>
                All {hotelsTotal.toLocaleString('en-US')}
              </Link>
            )}
          </div>
          {hotels.length > 0 ? <HotelList hotels={hotels} /> : <p className={styles.empty}>No published hotels yet.</p>}
        </div>
      </section>
    </>
  )
}
