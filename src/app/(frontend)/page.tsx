import Link from 'next/link'

import { Arrow, Band } from '@/components/Band'
import { HomeHero, type HeroSlide } from '@/components/HomeHero'
import { ReviewCard } from '@/components/ReviewCard'
import { count, rel, score } from '@/lib/format'
import { getFeaturedHotel, getPrograms, getReviews, getSiteCounts } from '@/lib/queries'
import type { Brand, Destination, Hotel, Program } from '@/payload-types'

import styles from './page.module.css'

export const revalidate = 300

// Homepage, from docs/loyalist-travel-homepage.html. The hero panel rotates
// through the latest review, the featured hotel and a program spotlight; the
// latest article joins when Guides arrive with Milestone 3. The reader-data
// band, lounges, guides and the contribute panel are also Milestone 3.
export default async function HomePage() {
  const [reviews, programs, counts, featured] = await Promise.all([getReviews({ limit: 4 }), getPrograms(), getSiteCounts(), getFeaturedHotel()])
  const latest = reviews.docs[0]
  const cards = reviews.docs.slice(latest ? 1 : 0, 4)

  const slides: HeroSlide[] = []

  if (latest) {
    const hotel = rel<Hotel>(latest.hotel)
    const program = hotel ? rel<Program>(hotel.program) : null
    const destination = hotel ? rel<Destination>(hotel.destination) : null
    slides.push({
      kind: 'review',
      eyebrow: 'Latest scored stay',
      image: latest.externalImageUrl ?? hotel?.externalImageUrl,
      meta: [program?.name, destination?.name].filter((m): m is string => Boolean(m)),
      title: latest.title,
      text: latest.shortVerdict,
      figure: { value: score(latest.totals?.overall), label: 'of 100' },
      cta: 'Read the review',
      href: `/reviews/${latest.slug}`,
    })
  }

  if (featured) {
    const brand = rel<Brand>(featured.hotel.brand)
    const destination = rel<Destination>(featured.hotel.destination)
    slides.push({
      kind: 'hotel',
      eyebrow: 'Featured hotel',
      image: featured.hotel.externalImageUrl,
      meta: [brand?.name, destination?.locationLabel ?? destination?.name].filter((m): m is string => Boolean(m)),
      title: featured.hotel.name,
      text: featured.hotel.heroSummary ?? featured.review?.shortVerdict,
      figure: featured.review ? { value: score(featured.review.totals?.overall), label: 'of 100' } : null,
      cta: 'The hotel',
      href: `/hotels/${featured.hotel.slug}`,
    })
  }

  const spotlight = [...programs].sort((a, b) => b.scored - a.scored || b.hotels - a.hotels)[0]
  if (spotlight && spotlight.hotels > 0) {
    slides.push({
      kind: 'program',
      eyebrow: 'Program spotlight',
      image:
        spotlight.program.images?.heroImageUrl ??
        reviews.docs.find((r) => {
          const p = rel<Hotel>(r.hotel)?.program
          return (typeof p === 'object' ? p?.id : p) === spotlight.program.id
        })?.externalImageUrl,
      meta: [`${count(spotlight.hotels)} hotels`, `${count(spotlight.scored)} scored ${spotlight.scored === 1 ? 'stay' : 'stays'}`],
      title: spotlight.program.name,
      text: spotlight.program.shortDescription,
      figure: spotlight.program.topTierName ? { value: spotlight.program.topTierName, label: 'top tier' } : null,
      cta: 'The program',
      href: `/programs/${spotlight.program.slug}`,
    })
  }

  const stats = [
    { n: count(counts.hotels), l: `Hotels indexed across ${['', 'one', 'two', 'three', 'four'][counts.programs] ?? counts.programs} programs` },
    { n: '16', l: 'Categories behind every score' },
    { n: count(counts.reviews), l: 'Scored stays' },
    { n: '100', l: 'Points on every rubric' },
  ]

  return (
    <main>
      <HomeHero
        slides={slides}
        stats={
          <div className={styles.stats} aria-label="Site at a glance">
            {stats.map((stat) => (
              <div className={styles.stat} key={stat.l}>
                <div className={styles.statN}>{stat.n}</div>
                <div className={styles.statL}>{stat.l}</div>
              </div>
            ))}
          </div>
        }
      >
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
      </HomeHero>

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
            <Link className="more" href="/programs">
              All programs
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
