import Link from 'next/link'

import { monthYear, rel, score } from '@/lib/format'
import type { Hotel, Program, Review } from '@/payload-types'

// A scored stay on the homepage and index. The whole card is the link.
// Image tone cycles a/b/c until a property has owned photography.
export function ReviewCard({ review, tone = 'a' }: { review: Review; tone?: 'a' | 'b' | 'c' }) {
  const hotel = rel<Hotel>(review.hotel)
  const program = hotel ? rel<Program>(hotel.program) : null
  const image = review.externalImageUrl ?? hotel?.externalImageUrl
  return (
    <Link className="card card-link" href={`/reviews/${review.slug}`}>
      <div className={`img ${tone}`} role="img" aria-label={review.title} style={image ? { backgroundImage: `url(${image}), var(--img-${tone})` } : undefined} />
      <div className="body">
        <div className="meta">
          <span>{program?.name ?? 'Scored stay'}</span>
          <span className="dot">·</span>
          <span>{review.propertyType === 'resort' ? 'Resort' : 'City hotel'}</span>
        </div>
        <h3>{review.title}</h3>
        {review.shortVerdict && <p>{review.shortVerdict}</p>}
        <div className="foot">
          <div className="score">
            {score(review.totals?.overall)}
            <small>/100</small>
          </div>
          {review.stayDate && <div className="when">Stayed {monthYear(review.stayDate)}</div>}
        </div>
      </div>
    </Link>
  )
}
