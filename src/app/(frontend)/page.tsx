import Form from 'next/form'
import Link from 'next/link'

import { ReviewRows } from '@/components/ReviewRows'
import { mainArticleCategory } from '@/lib/articleOptions'
import { articleImage, getArticles } from '@/lib/articles'
import { shortDate, shortMonthYear } from '@/lib/format'
import { loungePrograms, programsInOrder, reviewPlaces } from '@/lib/homeData'
import { programLogo, reviewPhoto } from '@/lib/photos'
import { getReviews } from '@/lib/queries'
import { ARTICLE_SECTIONS, categoryName, PROGRAM_LINKS, SITE } from '@/lib/site'
import type { Article } from '@/payload-types'

import styles from './page.module.css'

export const revalidate = 300

// Homepage (mockup: home.html). A navy band of the latest stories, then three columns: more
// stories and the programs, Austin's latest reviews, and the tools (hotel search, club
// lounges, adding a stay). No stay reports and no counts of the site's content.

const SECONDARY = 3
const MORE = 3

const articleHref = (a: Article) => `/articles/${a.slug}`
const joinList = (names: string[]) => (names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`)

export default async function HomePage() {
  const [articles, reviews, programs, lounges] = await Promise.all([getArticles({ limit: 1 + SECONDARY + MORE, featuredFirst: true }), getReviews({ limit: 6 }), programsInOrder(), loungePrograms()])
  const places = await reviewPlaces(reviews.docs)

  const [lead, ...rest] = articles.docs
  const secondary = rest.slice(0, SECONDARY)
  const more = rest.slice(SECONDARY, SECONDARY + MORE)
  // "All news" when the further stories are news, else "All guides"
  const moreSection = more.length > 0 && mainArticleCategory(more[0]) === 'news' ? ARTICLE_SECTIONS.news : ARTICLE_SECTIONS.guides
  const leadImage = lead ? articleImage(lead) : null

  return (
    <>
      {lead && (
        <section className="band" aria-label="Top stories">
          <div className="wrap top-stories">
            <article className={`lead${leadImage ? '' : ' no-img'}`}>
              {leadImage && (
                <Link className="img-box" href={articleHref(lead)} tabIndex={-1} aria-hidden="true">
                  <img src={leadImage} alt="" />
                </Link>
              )}
              <div>
                <p className="cat">{categoryName(mainArticleCategory(lead))}</p>
                <h2>
                  <Link href={articleHref(lead)}>{lead.title}</Link>
                </h2>
                {lead.dek && <p className="dek">{lead.dek}</p>}
                <p className="byline">
                  By <b>{SITE.author}</b> &middot; {shortDate(lead.publishedDate)}
                </p>
              </div>
            </article>
            {secondary.length > 0 && (
              <ol className="secondary">
                {secondary.map((a) => {
                  const image = articleImage(a)
                  return (
                    <li key={a.id} className={image ? undefined : 'no-img'}>
                      {image && (
                        <Link className="img-box" href={articleHref(a)} tabIndex={-1} aria-hidden="true">
                          <img src={image} alt="" />
                        </Link>
                      )}
                      <div>
                        <p className="meta">
                          <span className="cat">{categoryName(mainArticleCategory(a))}</span> &middot; {shortDate(a.publishedDate)}
                        </p>
                        <h3>
                          <Link href={articleHref(a)}>{a.title}</Link>
                        </h3>
                        {a.dek && <p className="dek">{a.dek}</p>}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </section>
      )}

      <main className={`wrap main ${styles.main}`}>
        <div className="cols3">
          <div className="col">
            {more.length > 0 && (
              <section className={`mod ${styles.mMore}`} aria-labelledby="more-h">
                <div className="mod-head">
                  <h2 id="more-h">More stories</h2>
                  <Link href={moreSection.href}>{moreSection.all}</Link>
                </div>
                <ol className="stories">
                  {more.map((a) => {
                    const image = articleImage(a)
                    return (
                      <li key={a.id} className={image ? undefined : 'no-img'}>
                        {image && (
                          <Link className="img-box" href={articleHref(a)} tabIndex={-1} aria-hidden="true">
                            <img src={image} alt="" loading="lazy" />
                          </Link>
                        )}
                        <div>
                          <p className="cat">{categoryName(mainArticleCategory(a))}</p>
                          <h3>
                            <Link href={articleHref(a)}>{a.title}</Link>
                          </h3>
                          {a.dek && <p className="dek">{a.dek}</p>}
                          <p className="byline">{shortDate(a.publishedDate)}</p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </section>
            )}
            <section className={`mod ${styles.mProgs}`} aria-labelledby="prog-h">
              {/* #prog-h is where /programs leads (next.config.mjs) */}
              <div className="mod-head">
                <h2 id="prog-h">Programs</h2>
              </div>
              <ul className={styles.progLogos}>
                {programs.map((p) => {
                  const logo = programLogo(p)
                  return (
                    <li key={p.id}>
                      <Link href={`/programs/${p.slug}`}>{logo ? <img src={logo} alt={p.name} /> : <span className={styles.progName}>{p.name}</span>}</Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          </div>

          <div className="col">
            {reviews.docs.length > 0 && (
              <section className={`mod ${styles.mReviews}`} aria-labelledby="rev-h">
                <div className="mod-head">
                  <h2 id="rev-h">Latest reviews</h2>
                  <Link href="/reviews">All reviews</Link>
                </div>
                <ReviewRows
                  rows={reviews.docs.map((r) => {
                    const place = places.get(r.id)
                    const stayed = shortMonthYear(r.stayDate)
                    return { id: r.id, slug: r.slug, title: r.title, score: r.totals?.overall, photo: reviewPhoto(r), meta: [place?.city, place?.program, stayed && `Stayed ${stayed}`], verdict: r.shortVerdict }
                  })}
                />
              </section>
            )}
          </div>

          <div className="col">
            <section className={`mod ${styles.mFind}`} aria-labelledby="find-h">
              <div className="mod-head">
                <h2 id="find-h">Find a hotel</h2>
                <Link href="/hotels">Browse all hotels</Link>
              </div>
              <Form className={`inline-form ${styles.find}`} role="search" action="/hotels">
                <input className="input" type="search" name="q" placeholder="Hotel name" aria-label="Hotel name" />
                <button className="btn" type="submit">
                  Search
                </button>
              </Form>
              <p className="mod-note">Search by hotel name across {joinList(PROGRAM_LINKS.map((p) => p.label))}.</p>
            </section>
            <section className={`mod ${styles.mLounges}`} aria-labelledby="lounge-h">
              <div className="mod-head">
                <h2 id="lounge-h">Club lounges</h2>
                <Link href="/lounges">All lounges</Link>
              </div>
              <p className={styles.loungeText}>{lounges.length > 0 ? `Lounges at ${joinList(lounges)} hotels, with who gets in at each.` : 'Club lounges, with who gets in at each.'}</p>
              <p className="mod-note">Readers score each lounge on food, drink, space and ambiance, and service, and say whether it was worth booking a club room.</p>
            </section>
            <section className={`mod box ${styles.mStay}`} aria-labelledby="stay-h">
              <h2 id="stay-h">Stayed somewhere on status?</h2>
              <p>Two minutes, dropdowns only. Your upgrade outcome joins the data for that property, and the upgrade odds update for everyone. No name, no email.</p>
              <Link className="btn" href="/submit-a-stay">
                Add your stay
              </Link>
            </section>
          </div>
        </div>
      </main>
    </>
  )
}
