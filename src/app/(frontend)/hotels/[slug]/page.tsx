import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Arrow, Band } from '@/components/Band'
import { HotelList } from '@/components/HotelCard'
import { ReaderPanel } from '@/components/ReaderPanel'
import { ReviewCard } from '@/components/ReviewCard'
import { StayForm } from '@/components/StayForm'
import { rel, score } from '@/lib/format'
import { getHotel, getHotelsIn, getPayloadClient, getReviewsForHotel } from '@/lib/queries'
import { hotelReaderData } from '@/lib/readerData'
import { PROPERTY_TYPE_LABEL } from '@/lib/site'
import type { Amenity, Brand, Destination, Program } from '@/payload-types'

import styles from './page.module.css'

export const revalidate = 300

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const hotel = await getHotel(slug)
  if (!hotel) return {}
  const destination = rel<Destination>(hotel.destination)
  return {
    title: `${hotel.name}${destination ? `, ${destination.name}` : ''}`,
    description: [rel<Brand>(hotel.brand)?.name, destination ? `in ${destination.locationLabel ?? destination.name}` : null].filter(Boolean).join(' ') || undefined,
  }
}

export default async function HotelPage({ params }: Props) {
  const { slug } = await params
  const hotel = await getHotel(slug)
  if (!hotel) notFound()

  const brand = rel<Brand>(hotel.brand)
  const program = rel<Program>(hotel.program)
  const destination = rel<Destination>(hotel.destination)
  const amenities = (hotel.amenities ?? []).map((a) => rel<Amenity>(a)).filter((a): a is Amenity => Boolean(a))
  const payload = await getPayloadClient()
  const [reviewsRes, readerData, tiersRes] = await Promise.all([
    getReviewsForHotel(hotel.id),
    hotelReaderData(hotel.id),
    program ? payload.find({ collection: 'status-levels', where: { program: { equals: program.id } }, sort: 'rank', limit: 20, depth: 0 }) : Promise.resolve(null),
  ])
  const reviews = reviewsRes.docs
  const tiers = (tiersRes?.docs ?? []).map((t) => ({ id: t.id, name: t.name, shortName: t.shortName }))
  const latest = reviews[0]
  const nearby = destination
    ? (await getHotelsIn({ and: [{ destination: { equals: destination.id } }, { id: { not_equals: hotel.id } }] }, 6)).docs
    : []

  const facts: { label: string; value: string | null | undefined }[] = [
    { label: 'Address', value: hotel.streetAddress ?? destination?.locationLabel ?? destination?.name },
    { label: 'Check-in', value: hotel.checkInTime },
    { label: 'Checkout', value: hotel.checkOutTime },
    { label: 'Rooms', value: hotel.numberOfRooms ? `${hotel.numberOfRooms} keys` : null },
    { label: 'Opened', value: [hotel.openingYear, hotel.renovationYear ? `renovated ${hotel.renovationYear}` : null].filter(Boolean).join(', ') },
    { label: 'Resort fee', value: hotel.resortFee },
    { label: 'Pet fee', value: hotel.petFee },
    { label: 'Points', value: hotel.pointsEligible === false ? 'Not bookable on points' : 'Bookable on points' },
    { label: 'Phone', value: hotel.phone },
    { label: 'Amenities', value: amenities.map((a) => a.name).join(', ') },
  ].filter((f) => f.value)

  return (
    <>
      <header className={`hero ${styles.hero}`}>
        <div className="wrap">
          <ol className="crumbs" aria-label="Breadcrumb">
            <li>
              <Link href="/hotels">Hotels</Link>
            </li>
            {program && (
              <>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href={`/programs/${program.slug}`}>{program.name}</Link>
                </li>
              </>
            )}
            {destination && (
              <>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href={`/destinations/${destination.slug}`}>{destination.name}</Link>
                </li>
              </>
            )}
          </ol>

          <div className={styles.heroGrid}>
            <div>
              <span className="eyebrow">{brand?.name ?? 'Hotel'}</span>
              <h1 className={styles.h1}>{hotel.name}</h1>
              <div className="chips">
                {hotel.propertyType && <span className="chip solid">{PROPERTY_TYPE_LABEL[hotel.propertyType]}</span>}
                {program && (
                  <Link className="chip" href={`/programs/${program.slug}`}>
                    {program.name}
                  </Link>
                )}
                {brand && (
                  <Link className="chip" href={`/brands/${brand.slug}`}>
                    {brand.name}
                  </Link>
                )}
              </div>
            </div>

            {latest && (
              <Link className={styles.scorePanel} href={`/reviews/${latest.slug}`} aria-label={`Loyalist Travel score ${score(latest.totals?.overall)} of 100`}>
                <span className={`label ${styles.scoreLabel}`}>Loyalist Travel score</span>
                <span className={styles.scoreBig}>{score(latest.totals?.overall)}</span>
                <span className={styles.scoreNote}>Out of 100. Read the review</span>
              </Link>
            )}
          </div>

          <div className={`byline ${styles.byline}`}>
            {hotel.bookingLink && (
              <a className="ghost" href={hotel.bookingLink} rel="noopener" target="_blank">
                Book direct
                <Arrow />
              </a>
            )}
          </div>
        </div>
      </header>

      <div className="hero-img" role="img" aria-label={hotel.name} style={hotel.externalImageUrl ? { backgroundImage: `url(${hotel.externalImageUrl}), var(--img-a)` } : undefined} />

      {facts.length > 0 && (
        <section className={`section ${styles.facts}`} aria-labelledby="facts-h">
          <div className="wrap">
            <span className="eyebrow on-light" id="facts-h">
              The property
            </span>
            <div className="grid-cells">
              {facts.map((f) => (
                <div className="cell" key={f.label}>
                  <span className="label">{f.label}</span>
                  <span className="val">{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {reviews.length > 0 && (
        <section className="section" aria-labelledby="rev-h">
          <div className="wrap">
            <div className="section-head">
              <div>
                <span className="eyebrow on-light">Scored stays</span>
                <h2 id="rev-h">Reviews of {hotel.name}</h2>
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

      <section className={`section ${styles.reader}`} aria-labelledby="reader-h">
        <div className="wrap">
          <div className={styles.readerGrid}>
            <ReaderPanel data={readerData} hotelName={hotel.name} />
            <div className={`panel ${styles.stayPanel}`}>
              <span className="eyebrow">Stayed here on status?</span>
              <h3 className={styles.stayTitle}>Add your stay. Two minutes.</h3>
              {program && tiers.length > 0 ? (
                <StayForm hotel={{ id: hotel.id, name: hotel.name }} programName={program.name} tiers={tiers} compact />
              ) : (
                <p className={styles.empty}>This program's tiers are not set up yet.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {nearby.length > 0 && destination && (
        <section className={`section ${styles.nearby}`} aria-labelledby="near-h">
          <div className="wrap">
            <div className="section-head">
              <div>
                <span className="eyebrow on-light">{destination.name}</span>
                <h2 id="near-h">More hotels in {destination.name}</h2>
              </div>
              <Link className="more" href={`/destinations/${destination.slug}`}>
                All in {destination.name}
              </Link>
            </div>
            <HotelList hotels={nearby} />
          </div>
        </section>
      )}

      <Band eyebrow="Not a review" title="The hotel index" text="Every property across four programs, with brand and place. Filter by program, brand, country, or scored stays only." cta="Browse hotels" href="/hotels" />
    </>
  )
}
