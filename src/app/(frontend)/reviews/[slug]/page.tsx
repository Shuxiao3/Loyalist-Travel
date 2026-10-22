import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Fragment, type ReactNode } from 'react'

import { PlainComments } from '@/components/PlainComments'
import { ReadingProgress } from '@/components/ReadingProgress'
import { ReviewRows } from '@/components/ReviewRows'
import { RichText } from '@/components/RichText'
import { monthYear, rel, score, shortDate, shortMonthYear } from '@/lib/format'
import { reviewPhoto } from '@/lib/photos'
import { getReview, getReviews, topTierOf } from '@/lib/queries'
import { reviewRowFacts } from '@/lib/reviewsIndex'
import { bandFor, categoriesFor, REVIEW_SECTIONS, sectionTotal } from '@/lib/rubric'
import { getSeo, metaText, pageMeta } from '@/lib/seo'
import { PROPERTY_TYPE_LABEL, RATE_BASIS_LABEL, SITE } from '@/lib/site'
import type { Brand, Destination, Hotel, Program, RubricVersion, StatusLevel } from '@/payload-types'

import styles from './page.module.css'

export const revalidate = 300

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const review = await getReview(slug)
  if (!review) return {}
  const hotel = rel<Hotel>(review.hotel)
  const seo = await getSeo()
  const vars = { Title: review.title, Hotel: hotel?.name, Score: score(review.totals?.overall), Verdict: review.shortVerdict, Destination: rel<Destination>(hotel?.destination)?.name, Program: rel<Program>(hotel?.program)?.name, Elite: await topTierOf(rel<Program>(hotel?.program)), Brand: rel<Brand>(hotel?.brand)?.name }
  const text = metaText(seo?.review, vars, { title: `${review.title} review, scored ${score(review.totals?.overall)} of 100`, description: review.shortVerdict })
  return pageMeta({
    title: review.seo?.title ?? text.title,
    description: review.seo?.description ?? text.description,
    path: `/reviews/${review.slug}`,
    image: reviewPhoto(review, hotel),
    type: 'article',
  })
}

// One review (mockup: review.html), where the review lives in full. The band carries the title,
// the verdict, the facts and the score with its six categories; the main column the stay, the
// scorecard, the photo, the narrative category by category, the verdict with value and book it
// if / skip it if, and comments; the side column the hotel, more reviews and the page's sections.

const ELITE: { key: 'upgrade' | 'breakfast' | 'lateCheckout' | 'welcomeAmenity' | 'clubLounge' | 'guestOfHonor'; label: string; outcomes: Record<string, string> }[] = [
  { key: 'upgrade', label: 'Suite upgrade', outcomes: { none: 'None', 'room-category': 'Room category', suite: 'Suite', 'used-award': 'Used award' } },
  { key: 'breakfast', label: 'Breakfast', outcomes: { full: 'Full', capped: 'Capped', 'restaurant-credit': 'Restaurant credit', none: 'None' } },
  { key: 'lateCheckout', label: 'Late checkout', outcomes: { '4pm-confirmed': '4pm, confirmed', 'on-request': 'On request', refused: 'Refused', 'not-needed': 'Not needed' } },
  { key: 'welcomeAmenity', label: 'Welcome amenity', outcomes: { points: 'Points', gift: 'Gift', 'food-and-drink': 'Food and drink', none: 'None' } },
  { key: 'clubLounge', label: 'Club lounge', outcomes: { 'none-at-property': 'None at this property', access: 'Access', 'access-with-restrictions': 'Access with restrictions' } },
  { key: 'guestOfHonor', label: 'Guest of Honor', outcomes: { 'not-tested': 'Not tested', honoured: 'Honoured', refused: 'Refused' } },
]

const WOULD_STAY: Record<string, string> = { yes: 'Yes', maybe: 'Maybe', no: 'No' }
const capital = (s?: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : null)

// "hyatt.com" from a booking address, for "Book direct at hyatt.com"
function siteName(url?: string | null): string | null {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, '') : null
  } catch {
    return null
  }
}

// Items joined by middle dots, as the band's meta lines run. The dot keeps to the item before
// it, so a wrapped line never starts with one, and an item never breaks inside itself (a phone
// wraps between items, never in a date or a name).
const dotted = (items: ReactNode[]) =>
  items.map((item, i) => (
    <Fragment key={i}>
      {i > 0 && '\u00a0· '}
      <span className={styles.mi}>{item}</span>
    </Fragment>
  ))

export default async function ReviewPage({ params }: Props) {
  const { slug } = await params
  const review = await getReview(slug)
  if (!review) notFound()

  const hotel = rel<Hotel>(review.hotel)
  const brand = hotel ? rel<Brand>(hotel.brand) : null
  const program = hotel ? rel<Program>(hotel.program) : null
  const destination = hotel ? rel<Destination>(hotel.destination) : null
  const statusHeld = rel<StatusLevel>(review.statusHeld)
  const version = rel<RubricVersion>(review.rubricVersion)
  const categories = categoriesFor(review)
  const typeLabel = PROPERTY_TYPE_LABEL[review.propertyType]
  const band = bandFor(review.totals?.overall, 100)
  const image = reviewPhoto(review, hotel)
  const related = (await getReviews({ limit: 3, excludeId: review.id })).docs
  const relatedFacts = await reviewRowFacts(related)
  const overall = score(review.totals?.overall)
  const booking = siteName(hotel?.bookingLink)

  const elite = ELITE.map((e) => ({ ...e, value: review[e.key] })).filter((e) => e.value?.outcome || e.value?.note)
  const pros = review.pros ?? []
  const cons = review.cons ?? []
  const sections = REVIEW_SECTIONS.map((s) => ({
    ...s,
    total: sectionTotal(review, categories, s.keys),
    // sub-scores with a note, in the rubric's order
    written: s.keys.filter((k) => review.narrative?.[k]),
    // sub-scores scored without a note
    silent: s.keys.filter((k) => !review.narrative?.[k] && review.scores?.[k] != null),
  })).filter((s) => s.written.length > 0 || s.silent.length > 0)
  const cat = (k: (typeof REVIEW_SECTIONS)[number]['keys'][number]) => categories.find((c) => c.key === k)

  const facts: { label: string; value: string | null | undefined }[] = [
    { label: 'Room booked', value: review.roomBooked },
    { label: 'Room received', value: review.roomReceived },
    { label: 'Status held', value: statusHeld?.name },
    { label: 'Nights', value: review.nights ? String(review.nights) : null },
    { label: 'Rate basis', value: review.rateBasis ? RATE_BASIS_LABEL[review.rateBasis] : null },
    { label: 'Property', value: capital([hotel?.numberOfRooms ? `${hotel.numberOfRooms} keys` : null, hotel?.openingYear ? `opened ${hotel.openingYear}` : null].filter(Boolean).join(', ')) },
    { label: 'Club lounge', value: review.clubLounge?.outcome ? ELITE[4].outcomes[review.clubLounge.outcome] : null },
  ].filter((f) => f.value)

  const value = [
    { label: 'Would stay again', value: review.wouldStayAgain ? WOULD_STAY[review.wouldStayAgain] : null },
    { label: 'Value for cash', value: capital(review.valueForCash) },
    { label: 'Value for points', value: capital(review.valueForPoints) },
  ].filter((v) => v.value)
  const ifs = [
    { title: 'Book it if', data: review.bookItIf },
    { title: 'Skip it if', data: review.skipItIf },
  ].filter((x) => x.data)

  const what = [
    typeLabel,
    brand ? <Link href={`/brands/${brand.slug}`}>{brand.name}</Link> : null,
    program ? <Link href={`/programs/${program.slug}`}>{program.name}</Link> : null,
    destination ? <Link href={`/destinations/${destination.slug}`}>{destination.locationLabel?.trim() || destination.name}</Link> : null,
    hotel ? (
      <Link className="link" href={`/hotels/${hotel.slug}`}>
        Hotel page
      </Link>
    ) : null,
  ].filter(Boolean)
  const stayed = monthYear(review.stayDate)
  const published = shortDate(review.publishedDate)
  // shown when the review was checked again after it was published
  const verified = review.lastVerifiedDate && (!review.publishedDate || review.lastVerifiedDate.slice(0, 10) > review.publishedDate.slice(0, 10)) ? shortDate(review.lastVerifiedDate) : null
  const byline = [
    <>
      By <b>{SITE.author}</b>
    </>,
    stayed ? `Stayed ${stayed}` : null,
    published ? `Published ${published}` : null,
    verified ? `Last verified ${verified}` : null,
    review.readTime ? `${review.readTime} min read` : null,
  ].filter(Boolean)

  const toc = [
    ...sections.map((s) => ({ href: `#s-${s.id}`, label: s.title })),
    ...(elite.length > 0 ? [{ href: '#elite', label: 'Elite recognition' }] : []),
    { href: '#s-verdict', label: 'The verdict' },
    { href: '#comments', label: 'Comments' },
  ]

  return (
    <>
      <section className="band page-band">
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/reviews">Reviews</Link>
            {program && (
              <>
                <span className="sep">/</span>
                <Link href={`/programs/${program.slug}`}>{program.name}</Link>
              </>
            )}
            {destination && (
              <>
                <span className="sep">/</span>
                <Link href={`/destinations/${destination.slug}`}>{destination.name}</Link>
              </>
            )}
            <span className="sep">/</span>
            <span aria-current="page">{review.title}</span>
          </nav>
          <div className={`pb-row ${styles.hero}`}>
            <div className="pb-title">
              <h1>{review.title}</h1>
              {review.shortVerdict && <p className={styles.verdict}>{review.shortVerdict}</p>}
              {what.length > 0 && <p className={`pb-meta ${styles.what}`}>{dotted(what)}</p>}
              <p className="pb-meta">{dotted(byline)}</p>
            </div>
            <div className={styles.scores}>
              <div className={styles.total} role="group" aria-label={`Loyalist Travel score ${overall} out of 100`}>
                <p className="fig-n">
                  {overall}
                  <small>/100</small>
                </p>
                {band && <p className="fig-l">{band}</p>}
                <p className="fig-s">{version?.name ?? 'Rubric v16'}</p>
              </div>
              <ul className={styles.cats} aria-label="Category scores">
                {REVIEW_SECTIONS.map((s) => {
                  const t = sectionTotal(review, categories, s.keys)
                  return (
                    <li key={s.id}>
                      <a href={`#s-${s.id}`}>
                        <span>{s.title}</span>
                        <b>
                          {score(t.got)}
                          <small>/{t.max}</small>
                        </b>
                      </a>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <ReadingProgress target="main" />
      <main className="wrap main">
        <div className={`grid-side ${styles.layout}`}>
          <article className={styles.article}>
            {facts.length > 0 && (
              <section className={`mod ${styles.stay}`} aria-labelledby="h-stay">
                <div className="mod-head">
                  <h2 id="h-stay">The stay</h2>
                </div>
                <dl className={`kv ${styles.kv}`}>
                  {facts.map((f) => (
                    <div key={f.label}>
                      <dt>{f.label}</dt>
                      <dd>{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            <section className="mod" aria-labelledby="h-card">
              <div className="mod-head">
                <h2 id="h-card">Scorecard</h2>
              </div>
              <div className={styles.scGrid}>
                {REVIEW_SECTIONS.map((s) => (
                  <div className={styles.sc} key={s.id}>
                    <h3>
                      <a href={`#s-${s.id}`}>{s.title}</a>
                    </h3>
                    <ul className="bars">
                      {s.keys.map((k) => {
                        const c = cat(k)
                        const v = review.scores?.[k]
                        const max = c?.max ?? 5
                        return (
                          <li key={k}>
                            <span>{c?.label ?? k}</span>
                            <span className="bar">
                              <i style={{ width: `${v != null ? Math.max(0, Math.min(100, (v / max) * 100)) : 0}%` }} />
                            </span>
                            <span className="v">
                              {score(v)}
                              <small>/{max}</small>
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="mod-note">Six categories, every sub-score out of 5, 100 points in all. Value is reported with the verdict and never scored.</p>
            </section>

            {image && (
              <div className={`img-box ${styles.photo}`}>
                <img src={image} alt={hotel?.name ?? review.title} />
              </div>
            )}

            {review.openingThoughts && <RichText data={review.openingThoughts} className={`${styles.open} ${styles.indent}`} />}

            {sections.map((s) => (
              <section key={s.id} className={styles.sec} id={`s-${s.id}`} aria-labelledby={`h-${s.id}`}>
                <div className="mod-head">
                  <h2 id={`h-${s.id}`}>{s.title}</h2>
                  <span className={styles.secscore}>
                    {score(s.total.got)}
                    <small>/{s.total.max}</small>
                  </span>
                </div>
                {s.written.map((k) => {
                  const c = cat(k)
                  const v = review.scores?.[k]
                  return (
                    <div className={styles.item} key={k}>
                      <h3 className={styles.sub}>
                        <span>{c?.label ?? k}</span>
                        {v != null && (
                          <span className={styles.subS}>
                            {score(v)}
                            <small>/{c?.max ?? 5}</small>
                          </span>
                        )}
                      </h3>
                      <RichText data={review.narrative?.[k]} />
                    </div>
                  )
                })}
                {s.silent.length > 0 && (
                  <p className={`${styles.silent} ${styles.indent}`}>
                    Scored without a note:{' '}
                    {s.silent.map((k, i) => (
                      <Fragment key={k}>
                        {i > 0 && ', '}
                        <span className={styles.mi}>{`${cat(k)?.label ?? k} ${score(review.scores?.[k])}/${cat(k)?.max ?? 5}`}</span>
                      </Fragment>
                    ))}
                    .
                  </p>
                )}
                {s.id === 'service' && elite.length > 0 && (
                  <div className={`${styles.elite} ${styles.indent}`} id="elite">
                    <div className="mod-head thin">
                      <h3>Elite recognition{statusHeld ? `, stayed as ${statusHeld.shortName ?? statusHeld.name}` : ''}</h3>
                    </div>
                    <dl className="kv">
                      {elite.map((e) => (
                        <div key={e.key}>
                          <dt>{e.label}</dt>
                          <dd>
                            {e.value?.outcome ? e.outcomes[e.value.outcome] : null}
                            {e.value?.outcome && e.value?.note ? '. ' : ''}
                            {e.value?.note}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <p className="note">Reported as it happened. Not scored.</p>
                  </div>
                )}
              </section>
            ))}

            <section className={styles.sec} id="s-verdict" aria-labelledby="h-verdict">
              <div className="mod-head">
                <h2 id="h-verdict">The verdict</h2>
              </div>
              {review.finalVerdict && <RichText data={review.finalVerdict} className={styles.indent} />}
              {(pros.length > 0 || cons.length > 0) && (
                <div className={`${styles.pc} ${styles.indent}`}>
                  {pros.length > 0 && (
                    <div>
                      <h3>What worked</h3>
                      <ul className="bullets">
                        {pros.map((p) => (
                          <li key={p.id ?? p.text}>{p.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {cons.length > 0 && (
                    <div>
                      <h3>What fell short</h3>
                      <ul className="bullets">
                        {cons.map((c) => (
                          <li key={c.id ?? c.text}>{c.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {(value.length > 0 || review.valueNotes || ifs.length > 0) && (
                <div className={`box ${styles.final}`}>
                  {value.length > 0 && (
                    <dl className={styles.value}>
                      {value.map((v) => (
                        <div key={v.label}>
                          <dt>{v.label}</dt>
                          <dd>{v.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {review.valueNotes && <p className={styles.valueNote}>{review.valueNotes}</p>}
                  {ifs.length > 0 && (
                    <div className={`${styles.ifs}${ifs.length === 1 ? ` ${styles.one}` : ''}`}>
                      {ifs.map((x) => (
                        <div key={x.title}>
                          <h3>{x.title}</h3>
                          <RichText data={x.data} className={styles.ifsText} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            <PlainComments kind="reviews" id={review.id} className={styles.sec} />
          </article>

          <aside className={styles.side}>
            {hotel && (
              <section className={`box ${styles.hotel}`} aria-labelledby="h-hotel">
                <h2 id="h-hotel">{hotel.name}</h2>
                {(hotel.streetAddress || hotel.checkInTime || hotel.checkOutTime) && (
                  <dl className="kv">
                    {hotel.streetAddress && (
                      <div>
                        <dt>Address</dt>
                        <dd>{hotel.streetAddress}</dd>
                      </div>
                    )}
                    {hotel.checkInTime && (
                      <div>
                        <dt>Check-in</dt>
                        <dd>{hotel.checkInTime}</dd>
                      </div>
                    )}
                    {hotel.checkOutTime && (
                      <div>
                        <dt>Checkout</dt>
                        <dd>{hotel.checkOutTime}</dd>
                      </div>
                    )}
                  </dl>
                )}
                <p className={`text-actions ${styles.hotelAct}`}>
                  <Link className="btn" href={`/hotels/${hotel.slug}`}>
                    Go to the hotel
                  </Link>
                  {hotel.bookingLink && booking && (
                    <a className="link" href={hotel.bookingLink} rel="noopener" target="_blank">
                      Book direct at {booking}
                    </a>
                  )}
                </p>
              </section>
            )}

            {related.length > 0 && (
              <section className={`mod ${styles.more}`} aria-labelledby="h-more">
                <div className="mod-head">
                  <h2 id="h-more">More reviews</h2>
                  <Link href="/reviews">All reviews</Link>
                </div>
                <ReviewRows
                  size="side"
                  rows={related.map((r) => {
                    const f = relatedFacts.get(r.id)
                    const when = shortMonthYear(r.stayDate)
                    return { id: r.id, slug: r.slug, title: r.title, score: r.totals?.overall, photo: reviewPhoto(r), meta: [f?.city, f?.program, when && `Stayed ${when}`], verdict: r.shortVerdict }
                  })}
                />
              </section>
            )}

            <nav className={`mod toc ${styles.toc}`} aria-labelledby="h-toc">
              <div className="mod-head thin">
                <h2 id="h-toc">On this page</h2>
              </div>
              <ol>
                {toc.map((t) => (
                  <li key={t.href}>
                    <a href={t.href}>{t.label}</a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>
        </div>
      </main>
    </>
  )
}
