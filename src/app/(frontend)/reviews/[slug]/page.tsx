import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Band } from '@/components/Band'
import { RichText } from '@/components/RichText'
import { monthYear, rel, score, shortDate } from '@/lib/format'
import { getReview, getReviews } from '@/lib/queries'
import { bandFor, categoriesFor, groupMax, labelFor, REVIEW_SECTIONS } from '@/lib/rubric'
import { PROPERTY_TYPE_LABEL, RATE_BASIS_LABEL, SITE } from '@/lib/site'
import type { Brand, Destination, Hotel, Program, Review, RubricVersion, StatusLevel } from '@/payload-types'

import styles from './page.module.css'

export const revalidate = 300

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const review = await getReview(slug)
  if (!review) return {}
  return {
    title: review.seo?.title ?? `${review.title} review, scored ${score(review.totals?.overall)} of 100`,
    description: review.seo?.description ?? review.shortVerdict ?? undefined,
  }
}

const ELITE: { key: 'upgrade' | 'breakfast' | 'lateCheckout' | 'welcomeAmenity' | 'clubLounge' | 'guestOfHonor'; label: string; outcomes: Record<string, string> }[] = [
  { key: 'upgrade', label: 'Suite upgrade', outcomes: { none: 'None', 'room-category': 'Room category', suite: 'Suite', 'used-award': 'Used award' } },
  { key: 'breakfast', label: 'Breakfast', outcomes: { full: 'Full', capped: 'Capped', 'restaurant-credit': 'Restaurant credit', none: 'None' } },
  { key: 'lateCheckout', label: 'Late checkout', outcomes: { '4pm-confirmed': '4pm, confirmed', 'on-request': 'On request', refused: 'Refused', 'not-needed': 'Not needed' } },
  { key: 'welcomeAmenity', label: 'Welcome amenity', outcomes: { points: 'Points', gift: 'Gift', 'food-and-drink': 'Food and drink', none: 'None' } },
  { key: 'clubLounge', label: 'Club lounge', outcomes: { 'none-at-property': 'None at this property', access: 'Access', 'access-with-restrictions': 'Access with restrictions' } },
  { key: 'guestOfHonor', label: 'Guest of Honor', outcomes: { 'not-tested': 'Not tested', honoured: 'Honoured', refused: 'Refused' } },
]

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
  const hardMax = groupMax(categories, 'hard')
  const softMax = groupMax(categories, 'soft')
  const typeLabel = PROPERTY_TYPE_LABEL[review.propertyType]
  const band = bandFor(review.totals?.overall, hardMax + softMax)
  const image = review.externalImageUrl ?? hotel?.externalImageUrl
  const related = (await getReviews({ limit: 3, excludeId: review.id })).docs

  const elite = ELITE.map((e) => ({ ...e, value: review[e.key] })).filter((e) => e.value?.outcome || e.value?.note)
  const pros = review.pros ?? []
  const cons = review.cons ?? []
  const sections = REVIEW_SECTIONS.map((s) => ({
    ...s,
    keys: s.keys.filter((k) => review.narrative?.[k] || review.scores?.[k] != null),
  })).filter((s) => s.keys.length > 0)

  const facts: { label: string; value: string | null | undefined; gold?: boolean }[] = [
    { label: 'Room booked', value: review.roomBooked },
    { label: 'Room received', value: review.roomReceived, gold: Boolean(review.roomReceived && review.roomReceived !== review.roomBooked) },
    { label: 'Status held', value: statusHeld?.name },
    { label: 'Nights', value: review.nights ? String(review.nights) : null },
    { label: 'Rate basis', value: review.rateBasis ? RATE_BASIS_LABEL[review.rateBasis] : null },
    {
      label: 'Property',
      value: [typeLabel, hotel?.numberOfRooms ? `${hotel.numberOfRooms} keys` : null, hotel?.openingYear ? `opened ${hotel.openingYear}` : null].filter(Boolean).join(', '),
    },
    { label: 'Stayed', value: monthYear(review.stayDate) },
    { label: 'Club lounge', value: review.clubLounge?.outcome ? ELITE[4].outcomes[review.clubLounge.outcome] : null },
  ].filter((f) => f.value)

  return (
    <>
      <header className={`hero ${styles.hero}`}>
        <div className="wrap">
          <ol className="crumbs" aria-label="Breadcrumb">
            <li>
              <Link href="/reviews">Reviews</Link>
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
              <span className="eyebrow">Scored stay</span>
              <h1 className={styles.h1}>{review.title}</h1>
              {review.shortVerdict && <p className={`sub ${styles.sub}`}>{review.shortVerdict}</p>}
              <div className="chips">
                <span className="chip solid">{typeLabel}</span>
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

            <div className={styles.scorePanel} aria-label={`Loyalist Travel score ${score(review.totals?.overall)} of 100`}>
              <div className={styles.scoreTop}>
                <div>
                  <span className={`label ${styles.scoreLabel}`}>
                    <span className={styles.long}>Loyalist Travel </span>Score
                  </span>
                  <div className={styles.scoreBig}>{score(review.totals?.overall)}</div>
                  {band && <div className={styles.band}>{band}</div>}
                </div>
                <div className={styles.scoreSplit}>
                  <div>
                    <span className={`label ${styles.scoreLabel}`}>Hard</span>
                    <div className={styles.scoreMid}>
                      {score(review.totals?.hard)}
                      <small>/{hardMax}</small>
                    </div>
                  </div>
                  <div>
                    <span className={`label ${styles.scoreLabel}`}>Soft</span>
                    <div className={styles.scoreMid}>
                      {score(review.totals?.soft)}
                      <small>/{softMax}</small>
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.scoreNote}>
                Out of 100. {version?.name ?? 'Rubric v15'}, {review.propertyType === 'resort' ? 'resort' : 'city hotel'} maxima.
              </div>
            </div>
          </div>

          <div className="byline">
            <span className="grp">
              <span className="author">{SITE.author}</span>
              {review.stayDate && (
                <>
                  <span className="dot">·</span>
                  <span>Stayed {monthYear(review.stayDate)}</span>
                </>
              )}
              {review.publishedDate && (
                <>
                  <span className={`dot ${styles.pub}`}>·</span>
                  <span className={styles.pub}>Published {shortDate(review.publishedDate)}</span>
                </>
              )}
            </span>
            <span className="grp">
              {review.lastVerifiedDate && <span className="verified">Last verified {shortDate(review.lastVerifiedDate)}</span>}
              {review.readTime && (
                <>
                  <span className="dot">·</span>
                  <span>{review.readTime} min read</span>
                </>
              )}
            </span>
          </div>
        </div>
      </header>

      <div className="hero-img" role="img" aria-label={review.title} style={image ? { backgroundImage: `url(${image}), var(--img-a)` } : undefined} />

      {facts.length > 0 && (
        <section className={`section ${styles.facts}`} aria-labelledby="facts-h">
          <div className="wrap">
            <span className="eyebrow on-light" id="facts-h">
              The stay
            </span>
            <div className="grid-cells">
              {facts.map((f) => (
                <div className="cell" key={f.label}>
                  <span className="label">{f.label}</span>
                  <span className={f.gold ? 'val gold' : 'val'}>{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className={`section ${styles.scorecard}`} aria-labelledby="sc-h">
        <div className="wrap">
          <span className="eyebrow on-light" id="sc-h">
            Scorecard
          </span>
          <div className={styles.scCard}>
            {(['hard', 'soft'] as const).map((group) => (
              <div className={styles.scCol} key={group}>
                <div className={styles.scHead}>
                  <h2>{group === 'hard' ? 'Hard product' : 'Soft product'}</h2>
                  <span className={styles.scSum}>
                    {score(review.totals?.[group])}
                    <small>of {group === 'hard' ? hardMax : softMax}</small>
                  </span>
                </div>
                <ul className={styles.scRows}>
                  {categories
                    .filter((c) => c.group === group)
                    .map((c) => {
                      const value = review.scores?.[c.key]
                      return (
                        <li key={c.key} style={{ '--max': c.max ?? 10, '--val': value ?? 0 } as React.CSSProperties}>
                          <span>{c.label}</span>
                          <span className={styles.bar}>
                            <i />
                          </span>
                          <span className={styles.scPts}>
                            {score(value)}
                            <small>/{c.max ?? '–'}</small>
                          </span>
                        </li>
                      )
                    })}
                </ul>
              </div>
            ))}
          </div>
          <p className={styles.scLegend}>Each bar fills to the score out of that category's maximum. Elite recognition is reported below and not scored.</p>
        </div>
      </section>

      <main className={styles.body}>
        <div className={`wrap ${styles.bodyWrap}`}>
          <article className={styles.main}>
            {review.openingThoughts && <RichText data={review.openingThoughts} />}

            {sections.map((s) => (
              <section key={s.id} className={styles.section}>
                <h2 id={`s-${s.id}`}>{s.title}</h2>
                {s.keys.map((k) => (
                  <div className={styles.cat} key={k}>
                    <span className="label">
                      {labelFor(categories, k)}
                      {review.scores?.[k] != null && (
                        <b>
                          {' '}
                          {score(review.scores[k])}/{categories.find((c) => c.key === k)?.max ?? '–'}
                        </b>
                      )}
                    </span>
                    <RichText data={review.narrative?.[k]} />
                  </div>
                ))}
                {s.id === 'service' && elite.length > 0 && (
                  <section className="panel" aria-labelledby="elite-h">
                    <span className="eyebrow" id="elite-h">
                      Elite recognition{statusHeld ? `, stayed as ${statusHeld.shortName ?? statusHeld.name}` : ''}
                    </span>
                    <div className={styles.eliteGrid}>
                      {elite.map((e) => (
                        <div key={e.key}>
                          <span className="label">{e.label}</span>
                          <span className={styles.eliteVal}>
                            {e.value?.outcome ? e.outcomes[e.value.outcome] : null}
                            {e.value?.outcome && e.value?.note ? '. ' : ''}
                            {e.value?.note}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="panel-foot">Reported as it happened. Not scored.</div>
                  </section>
                )}
              </section>
            ))}

            {(pros.length > 0 || cons.length > 0) && (
              <div className={styles.pc}>
                {pros.length > 0 && (
                  <div>
                    <h3>What worked</h3>
                    <ul>
                      {pros.map((p) => (
                        <li key={p.id ?? p.text}>{p.text}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {cons.length > 0 && (
                  <div>
                    <h3>What fell short</h3>
                    <ul>
                      {cons.map((c) => (
                        <li key={c.id ?? c.text}>{c.text}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <section className={styles.section}>
              <h2 id="s-verdict">The verdict</h2>
              {review.finalVerdict && <RichText data={review.finalVerdict} />}
              <div className={styles.verdictBand}>
                <div className={styles.bigWrap}>
                  <div className={styles.big}>{score(review.totals?.overall)}</div>
                  {band && <div className={styles.bigBand}>{band}</div>}
                </div>
                <div className={styles.rule} />
                <div>
                  {review.shortVerdict && <div className={styles.say}>{review.shortVerdict}</div>}
                  <div className={styles.small}>
                    {[
                      review.wouldStayAgain ? `Would stay again: ${{ yes: 'yes', maybe: 'maybe', no: 'no' }[review.wouldStayAgain]}` : null,
                      review.valueForCash ? `Value for cash: ${review.valueForCash}` : null,
                      review.valueForPoints ? `Value for points: ${review.valueForPoints}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    {review.valueNotes ? ` ${review.valueNotes}` : ''}
                  </div>
                </div>
              </div>
              {(review.bookItIf || review.skipItIf) && (
                <div className={`grid-cells two ${styles.bookit}`}>
                  <div className="cell">
                    <span className="label">Book it if</span>
                    <RichText data={review.bookItIf} className={styles.cellProse} />
                  </div>
                  <div className="cell">
                    <span className="label">Skip it if</span>
                    <RichText data={review.skipItIf} className={styles.cellProse} />
                  </div>
                </div>
              )}
            </section>
          </article>

          <aside className={styles.side}>
            <div className={`${styles.sideCard} ${styles.tocCard}`}>
              <span className="eyebrow on-light">On this page</span>
              <ul className={styles.toc}>
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#s-${s.id}`}>{s.title}</a>
                  </li>
                ))}
                {elite.length > 0 && (
                  <li>
                    <a href="#elite-h">Elite recognition</a>
                  </li>
                )}
                <li>
                  <a href="#s-verdict">The verdict</a>
                </li>
              </ul>
            </div>

            {hotel && (
              <div className={styles.sideCta}>
                <h3>{hotel.name}</h3>
                <p>
                  {[brand?.name, destination?.locationLabel ?? destination?.name].filter(Boolean).join(' · ')}
                  {hotel.checkInTime ? `. Check-in ${hotel.checkInTime}` : ''}
                  {hotel.checkOutTime ? `, checkout ${hotel.checkOutTime}.` : ''}
                </p>
                <Link className="btn" href={`/hotels/${hotel.slug}`}>
                  The hotel
                </Link>
              </div>
            )}

            {related.length > 0 && (
              <div className={styles.related}>
                <span className="eyebrow on-light">More scored stays</span>
                <ul>
                  {related.map((r: Review) => (
                    <li key={r.id}>
                      <span className="label">
                        {score(r.totals?.overall)} of 100 · {monthYear(r.stayDate)}
                      </span>
                      <Link href={`/reviews/${r.slug}`}>{r.title}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </main>

      <Band eyebrow="Not a review" title="The hotel index" text="Every property across four programs, with brand and place. Filter by program, brand, country, or scored stays only." cta="Browse hotels" href="/hotels" />
    </>
  )
}
