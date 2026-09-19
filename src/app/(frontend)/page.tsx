import Link from 'next/link'

import { Arrow, Band } from '@/components/Band'
import { HomeHero, type HeroSlide } from '@/components/HomeHero'
import { ArticleCard } from '@/components/ArticleCard'
import { ReviewCard } from '@/components/ReviewCard'
import { count, mediaUrl, rel, score, shortDate } from '@/lib/format'
import { ARTICLE_CATEGORY_LABEL } from '@/collections/Articles'
import { getFeaturedHotel, getPrograms, getReviews, getSiteCounts } from '@/lib/queries'
import { articleImage, getArticles } from '@/lib/articles'
import { getLoungeDirectory } from '@/lib/lounges'
import { readerStayCount, sitewideReaderData } from '@/lib/readerData'
import { LoungeRows } from '@/components/LoungeRows'
import type { Brand, Destination, Hotel, Program } from '@/payload-types'

import styles from './page.module.css'

export const revalidate = 300

// Homepage, from docs/loyalist-travel-homepage.html. The hero panel rotates
// through the latest review, the featured hotel and a program spotlight; the
// "One in five" reads better than "20%" in a sentence.
function suiteWords(rate: number): string {
  if (rate >= 45) return 'About half'
  if (rate >= 28) return 'One in three'
  if (rate >= 17) return 'One in five'
  if (rate >= 8) return 'One in ten'
  return 'A few'
}

export default async function HomePage() {
  const [reviews, programs, counts, featured, reader, readerCount, lounges, articles] = await Promise.all([getReviews({ limit: 4 }), getPrograms(), getSiteCounts(), getFeaturedHotel(), sitewideReaderData(), readerStayCount(), getLoungeDirectory(), getArticles({ limit: 3, featuredFirst: true })])
  const latestArticle = articles.docs[0]
  const ratedLounges = lounges.filter((l) => l.data?.score != null).slice(0, 4)
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
    const d = featured.data
    slides.push({
      kind: 'hotel',
      eyebrow: 'Featured hotel',
      image: featured.hotel.externalImageUrl,
      meta: [brand?.name, destination?.locationLabel ?? destination?.name].filter((m): m is string => Boolean(m)),
      title: featured.hotel.name,
      text:
        featured.hotel.heroSummary ??
        (d.all
          ? `${d.all.stays} reader stays. ${d.all.suiteRate ?? 0}% got a suite, ${d.all.proactiveRate ?? 0}% of upgrades came unasked, ${d.all.breakfastRate ?? 0}% had breakfast as printed.`
          : null),
      figure: d.all?.upgradeRate != null ? { value: `${d.all.upgradeRate}%`, label: 'got an upgrade' } : null,
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
          const hotel = rel<Hotel>(r.hotel)
          const p = hotel?.program
          return (typeof p === 'object' ? p?.id : p) === spotlight.program.id && Boolean(r.externalImageUrl ?? hotel?.externalImageUrl)
        })?.externalImageUrl,
      meta: [`${count(spotlight.hotels)} hotels`, `${count(spotlight.scored)} scored ${spotlight.scored === 1 ? 'stay' : 'stays'}`],
      title: spotlight.program.name,
      text: spotlight.program.shortDescription,
      figure: spotlight.program.topTierName ? { value: spotlight.program.topTierName, label: 'top tier' } : null,
      cta: 'The program',
      href: `/programs/${spotlight.program.slug}`,
    })
  }
  if (latestArticle) {
    slides.push({
      kind: 'article',
      eyebrow: latestArticle.featured ? 'Featured article' : 'Latest article',
      image: articleImage(latestArticle),
      meta: [ARTICLE_CATEGORY_LABEL[latestArticle.category] ?? latestArticle.category, shortDate(latestArticle.publishedDate) ?? ''].filter(Boolean),
      title: latestArticle.title,
      text: latestArticle.dek,
      figure: null,
      cta: 'Read the article',
      href: `/articles/${latestArticle.slug}`,
    })
  }

  const stats = [
    { n: count(counts.hotels), l: `Hotels indexed across ${['', 'one', 'two', 'three', 'four'][counts.programs] ?? counts.programs} programs` },
    { n: '16', l: 'Categories behind every score' },
    { n: count(counts.reviews), l: 'Scored stays' },
    { n: count(readerCount), l: 'Reader-submitted stays' },
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
        <span className="eyebrow">Loyalty travel, reported</span>
        <h1 className={styles.h1}>Find what elite status gets you at hotels and lounges.</h1>
        <p className={`sub ${styles.sub}`}>
          Readers report what their status actually got them, so every hotel shows its real upgrade odds. Club lounges are rated by the people who sat in them. And every review is scored on the same 100-point rubric.
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
            <div className="cards rail-m">
              {cards.map((r, i) => (
                <ReviewCard key={r.id} review={r} tone={(['a', 'b', 'c'] as const)[i % 3]} />
              ))}
            </div>
          </div>
        </section>
      )}

      {reader && reader.topTierCity.stays >= 10 && reader.topTierCity.upgradeRate != null && (
        <section className="section" aria-labelledby="sb-h">
          <div className="wrap">
            <div className={styles.bandInner}>
              <div className={styles.big}>{reader.topTierCity.upgradeRate}%</div>
              <div className={styles.rule} />
              <div>
                <span className="eyebrow" id="sb-h">
                  Reader data
                </span>
                <div className={styles.say}>
                  of top-tier stays at city hotels received a room upgrade at check-in.
                  {reader.topTierCity.suiteRate != null && reader.topTierCity.suiteRate > 0 ? ` ${suiteWords(reader.topTierCity.suiteRate)} got a suite.` : ''}
                </div>
                <div className={styles.small}>
                  From {count(reader.all.stays)} reader-submitted stays. <Link href="/submit-a-stay">Add yours</Link>
                </div>
              </div>
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
          </div>
          <div className="grid-cells">
            {programs.map(({ program, hotels, scored }) => (
              <Link className={`cell ${styles.prog}`} href={`/programs/${program.slug}`} key={program.id}>
                <span className={styles.progTop}>
                  <span className="label">Program</span>
                  <Arrow size={16} />
                </span>
                <h3 className={styles.progName}>
                  {mediaUrl(program.logo) ?? program.images?.logoUrl ? (
                    <>
                      <span className={styles.logoBox}>
                        <img className={styles.logo} src={(mediaUrl(program.logo) ?? program.images?.logoUrl)!} alt={program.name} />
                      </span>
                      <span className="sr-only">{program.name}</span>
                    </>
                  ) : (
                    program.name
                  )}
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

      {articles.docs.length > 0 && (
        <section className="section" aria-labelledby="art-h">
          <div className="wrap">
            <div className="section-head">
              <div>
                <span className="eyebrow on-light">Articles</span>
                <h2 id="art-h">How the programs actually work</h2>
              </div>
              <Link className="more" href="/articles">
                All articles
              </Link>
            </div>
            <div className="cards rail-m">
              {articles.docs.map((a, i) => (
                <ArticleCard key={a.id} article={a} tone={(['b', 'c', 'a'] as const)[i % 3]} />
              ))}
            </div>
          </div>
        </section>
      )}

      {ratedLounges.length > 0 && (
        <section className={`section ${styles.lounges}`} aria-labelledby="lg-h">
          <div className={`wrap ${styles.loungesGrid}`}>
            <div>
              <span className={`eyebrow on-light ${styles.loungesEyebrow}`}>Lounges</span>
              <h2 id="lg-h" className={styles.loungesH2}>
                Is the club lounge worth the room category?
              </h2>
              <p className={styles.loungesP}>Access rules by status, hours, what actually gets served, and whether it beats the restaurant downstairs. Every lounge scored by readers who sat in it.</p>
              <Link className={`ghost ${styles.loungesGhost}`} href="/lounges">
                Browse the directory
                <Arrow />
              </Link>
            </div>
            <LoungeRows rows={ratedLounges} />
          </div>
        </section>
      )}

      <section className={`section ${styles.cta}`} aria-label="Contribute">
        <div className="wrap">
          <div className={styles.ctaPanel}>
            <div className={styles.ctaCol}>
              <span className="eyebrow">Reader data</span>
              <h3>Stayed somewhere on status?</h3>
              <p>Two minutes. Your upgrade, breakfast and late checkout outcome joins the data for that property, and the upgrade odds update for everyone.</p>
              <Link className="btn" href="/submit-a-stay">
                Submit a stay
              </Link>
            </div>
            <div className={styles.ctaCol}>
              <span className="eyebrow">How it works</span>
              <h3>Dropdowns only. Checked before it counts.</h3>
              <p>No name, no email. Every submission is reviewed, and a hotel shows its odds only once five stays are in.</p>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.last} />

      <Band eyebrow="Every hotel, one place" title="The hotel index" text="Every property across four programs, with brand and place. Filter by program, brand, country, or scored stays only." cta="Browse hotels" href="/hotels" />
    </main>
  )
}
