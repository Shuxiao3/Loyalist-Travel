import Link from 'next/link'

import { Arrow, Band } from '@/components/Band'
import { ReviewCard } from '@/components/ReviewCard'
import { count, rel, score } from '@/lib/format'
import { getPrograms, getReviews, getSiteCounts } from '@/lib/queries'
import type { Destination, Hotel, Program } from '@/payload-types'

import styles from './page.module.css'

export const revalidate = 300

// Homepage, from docs/loyalist-travel-homepage.html. The reader-data band,
// lounges, guides and the contribute panel arrive with Milestone 3.
export default async function HomePage() {
  const [reviews, programs, counts] = await Promise.all([getReviews({ limit: 4 }), getPrograms(), getSiteCounts()])
  const latest = reviews.docs[0]
  const latestHotel = latest ? rel<Hotel>(latest.hotel) : null
  const latestProgram = latestHotel ? rel<Program>(latestHotel.program) : null
  const latestDestination = latestHotel ? rel<Destination>(latestHotel.destination) : null
  const latestImage = latest?.externalImageUrl ?? latestHotel?.externalImageUrl
  const cards = reviews.docs.slice(latest ? 1 : 0, 4)

  const stats = [
    { n: count(counts.hotels), l: `Hotels indexed across ${['', 'one', 'two', 'three', 'four'][counts.programs] ?? counts.programs} programs` },
    { n: '16', l: 'Categories behind every score' },
    { n: count(counts.reviews), l: 'Scored stays' },
    { n: '100', l: 'Points on every rubric' },
  ]

  return (
    <main>
      <header className={`hero ${styles.hero}`}>
        <div className={`wrap ${styles.heroWrap}`}>
          <div className={styles.heroGrid}>
            <div>
              <span className="eyebrow">Luxury hotel reviews, scored</span>
              <h1 className={styles.h1}>What your status actually gets you.</h1>
              <p className={`sub ${styles.sub}`}>
                Hotels scored on a 100-point rubric. Elite benefits reported as they happened, not as printed. Lounges rated by the people who sat in them.
              </p>
              <div className={styles.ctas}>
                <Link className="btn" href="/reviews">
                  Latest reviews
                </Link>
                <Link className="ghost" href="/hotels">
                  Browse {count(counts.hotels)} hotels
                  <Arrow />
                </Link>
              </div>
            </div>

            {latest && (
              <aside className={styles.latest} aria-label="Latest scored stay">
                <span className="eyebrow">Latest scored stay</span>
                <div className={styles.latestImg} role="img" aria-label={latest.title} style={latestImage ? { backgroundImage: `url(${latestImage}), var(--img-a)` } : undefined} />
                <div className={styles.latestMeta}>
                  <span>{latestProgram?.name ?? 'Scored stay'}</span>
                  {latestDestination && (
                    <>
                      <span className="dot">·</span>
                      <span>{latestDestination.name}</span>
                    </>
                  )}
                </div>
                <h3 className={styles.latestTitle}>{latest.title}</h3>
                {latest.shortVerdict && <p className={styles.latestSub}>{latest.shortVerdict}</p>}
                <div className={styles.latestFoot}>
                  <div className={styles.score}>
                    {score(latest.totals?.overall)}
                    <small>of 100</small>
                  </div>
                  <Link className={styles.read} href={`/reviews/${latest.slug}`}>
                    Read the review
                  </Link>
                </div>
              </aside>
            )}
          </div>

          <div className={styles.stats} aria-label="Site at a glance">
            {stats.map((stat) => (
              <div className={styles.stat} key={stat.l}>
                <div className={styles.statN}>{stat.n}</div>
                <div className={styles.statL}>{stat.l}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {cards.length > 0 && (
        <section className="section" aria-labelledby="rev-h">
          <div className="wrap">
            <div className="section-head">
              <div>
                <span className="eyebrow on-light">Scored stays</span>
                <h2 id="rev-h">Latest reviews</h2>
              </div>
              <Link className="more" href="/reviews">
                All reviews
              </Link>
            </div>
            <div className="cards">
              {cards.map((r, i) => (
                <ReviewCard key={r.id} review={r} tone={(['a', 'b', 'c'] as const)[i % 3]} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className={`section ${styles.programs}`} aria-labelledby="prog-h">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow on-light">Browse by program</span>
              <h2 id="prog-h">Where your points work</h2>
            </div>
            <Link className="more" href="/hotels">
              All hotels
            </Link>
          </div>
          <div className="grid-cells">
            {programs.map(({ program, hotels, scored }) => (
              <Link className={`cell ${styles.prog}`} href={`/programs/${program.slug}`} key={program.id}>
                <span className="label">Program</span>
                <h3>
                  {program.name}
                  <Arrow size={16} />
                </h3>
                <span className={styles.progN}>
                  {hotels > 0 ? (
                    <>
                      <b>{count(hotels)}</b> hotels indexed
                      <br />
                      <b>{count(scored)}</b> scored {scored === 1 ? 'stay' : 'stays'}
                    </>
                  ) : (
                    <>
                      Coming soon
                      <br />
                      Portfolio being indexed
                    </>
                  )}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className={styles.last} />

      <Band eyebrow="Not a review" title="The hotel index" text="Every property across four programs, with brand and place. Filter by program, brand, country, or scored stays only." cta="Browse hotels" href="/hotels" />
    </main>
  )
}
