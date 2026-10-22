import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Fragment } from 'react'

import { ArticleBody } from '@/components/ArticleBody'
import { MobileToc } from '@/components/MobileToc'
import { PlainComments } from '@/components/PlainComments'
import { ReadingProgress } from '@/components/ReadingProgress'
import { CurrentSection } from '@/components/SiteHeaderNav'
import { articleCategoryLabel, articleSection, mainArticleCategory } from '@/lib/articleOptions'
import { articleImage, getArticle, getArticles } from '@/lib/articles'
import { rel, shortDate } from '@/lib/format'
import { outlineOf } from '@/lib/outline'
import { programLogo } from '@/lib/photos'
import { getSeo, metaText, pageMeta } from '@/lib/seo'
import { ARTICLE_SECTIONS, ARTICLE_TOPICS, categoryName, SITE, topicHref } from '@/lib/site'
import type { Article, Destination, Hotel, Lounge, Media, Program } from '@/payload-types'

import styles from './page.module.css'

export const revalidate = 300

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getArticle((await params).slug)
  if (!article) return {}
  const text = metaText((await getSeo())?.article, { Title: article.title, Dek: article.dek, Category: articleCategoryLabel(mainArticleCategory(article)) }, { title: article.title, description: article.dek })
  if (article.seo?.title?.trim()) text.title = article.seo.title.trim()
  if (article.seo?.description?.trim()) text.description = article.seo.description.trim()
  return pageMeta({ ...text, path: `/articles/${article.slug}`, image: articleImage(article), type: 'article' })
}

// An article (mockups: article.html for a guide, article-news.html for news). The navy band
// carries the breadcrumb (its section, News or Guides), the title, the dek and the byline. Below,
// three columns on a wide screen: the contents rail, the text (hero photo, text, comments) and
// the side column (Mentioned here, More to read, Add your stay). At 1180px the rail becomes a
// fold above the text; at 960px everything runs in one column.
export default async function ArticlePage({ params }: Props) {
  const article = await getArticle((await params).slug)
  if (!article) notFound()
  const image = articleImage(article)
  const hero = article.heroImage && typeof article.heroImage === 'object' ? (article.heroImage as Media) : null
  const heroCredit = (hero?.credit ?? '').trim()
  const section = articleSection(article)
  const main = mainArticleCategory(article)
  // The breadcrumb names the section; the byline lists the article's other categories, each a
  // link to its list (a topic within the section, or the other section).
  const others = (article.categories ?? []).filter((c, i, all) => c !== section && all.indexOf(c) === i)
  const otherHref = (c: string) => (c === 'news' || c === 'guides' ? ARTICLE_SECTIONS[c].href : ARTICLE_TOPICS.some((t) => t.value === c) ? topicHref(section, c) : null)
  const updated = article.updatedAt && article.updatedAt.slice(0, 10) > (article.publishedDate ?? '').slice(0, 10) ? shortDate(article.updatedAt) : null

  const hotels = (article.related?.hotels ?? []).map((h) => rel<Hotel>(h)).filter((h): h is Hotel => Boolean(h))
  const programs = (article.related?.programs ?? []).map((p) => rel<Program>(p)).filter((p): p is Program => Boolean(p))
  const lounges = (article.related?.lounges ?? []).map((l) => rel<Lounge>(l)).filter((l): l is Lounge => Boolean(l))
  const picked = (article.related?.articles ?? []).map((a) => rel<Article>(a)).filter((a): a is Article => Boolean(a))
  const more = picked.length > 0 ? picked : (await getArticles({ limit: 3, category: main, excludeId: article.id })).docs
  const fallback = more.length > 0 ? more : (await getArticles({ limit: 3, excludeId: article.id })).docs
  const outline = outlineOf(article.body)
  const toc = outline.length >= 2 ? outline.map((h) => ({ href: `#${h.id}`, label: h.text })) : []
  const places = hotels.length + lounges.length > 0

  return (
    <>
      <CurrentSection section={section} />
      <section className={`band page-band ${styles.band}`}>
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href={ARTICLE_SECTIONS[section].href}>{ARTICLE_SECTIONS[section].label}</Link>
            <span className="sep">/</span>
            <span aria-current="page">{article.title}</span>
          </nav>
          <div className="pb-row">
            <div className={`pb-title ${styles.head}`}>
              <h1>{article.title}</h1>
              {article.dek && <p className="pb-dek">{article.dek}</p>}
              <p className="byline">
                By <b>{SITE.author}</b>
                {article.publishedDate && <> &middot; {shortDate(article.publishedDate)}</>}
                {updated && <> &middot; Updated {updated}</>}
                {others.map((c) => {
                  const href = otherHref(c)
                  return (
                    <Fragment key={c}>
                      {' '}
                      &middot;{' '}
                      {href ? (
                        <Link className={styles.topic} href={href}>
                          {categoryName(c)}
                        </Link>
                      ) : (
                        categoryName(c)
                      )}
                    </Fragment>
                  )
                })}
              </p>
            </div>
          </div>
        </div>
      </section>

      <ReadingProgress target="[data-article-text]" />
      <main className={`wrap ${styles.main} ${styles.grid}${image ? ` ${styles.hasHero}` : ''}`}>
        {toc.length > 0 ? (
          <nav className={`toc ${styles.rail}`} aria-labelledby="toc-h">
            <div className="mod-head thin">
              <h2 id="toc-h">On this page</h2>
            </div>
            <ol>
              {toc.map((i) => (
                <li key={i.href}>
                  <a href={i.href}>{i.label}</a>
                </li>
              ))}
            </ol>
          </nav>
        ) : (
          <div className={styles.rail} aria-hidden="true" />
        )}

        <article className={styles.body}>
          {image && (
            <figure className={styles.hero}>
              <img src={image} alt={hero?.alt ?? ''} width={hero?.width ?? undefined} height={hero?.height ?? undefined} fetchPriority="high" />
              {heroCredit && <figcaption className="caption">Photo: {heroCredit}.</figcaption>}
            </figure>
          )}
          {toc.length > 0 && <MobileToc items={toc} className={styles.tocM} />}
          <ArticleBody data={article.body} className={styles.prose} />
          <PlainComments kind="articles" id={article.id} className={styles.comments} />
        </article>

        <aside className={styles.side}>
          {(programs.length > 0 || places) && (
            <section className="mod" aria-labelledby="mentioned-h">
              <div className="mod-head">
                <h2 id="mentioned-h">Mentioned here</h2>
              </div>
              {programs.length > 0 && (
                <ul className={styles.progs}>
                  {programs.map((p) => {
                    const logo = programLogo(p)
                    return (
                      <li key={p.id}>
                        <Link className={styles.prog} href={`/programs/${p.slug}`}>
                          {logo ? <img src={logo} alt={p.name} /> : <span className={styles.progName}>{p.name}</span>}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
              {places && (
                <ol className="stories stories-tight">
                  {hotels.map((h) => (
                    <li className="no-img" key={`h${h.id}`}>
                      <div>
                        <h3>
                          <Link href={`/hotels/${h.slug}`}>{h.name}</Link>
                        </h3>
                        <p className="byline">{rel<Destination>(h.destination)?.name ?? 'Hotel'}</p>
                      </div>
                    </li>
                  ))}
                  {lounges.map((l) => (
                    <li className="no-img" key={`l${l.id}`}>
                      <div>
                        <h3>
                          <Link href={`/lounges/${l.slug}`}>{l.name}</Link>
                        </h3>
                        <p className="byline">Lounge</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}

          {fallback.length > 0 && (
            <section className="mod" aria-labelledby="more-h">
              <div className="mod-head">
                <h2 id="more-h">More to read</h2>
              </div>
              <ol className="stories stories-tight">
                {fallback.map((a) => {
                  const href = `/articles/${a.slug}`
                  const img = articleImage(a)
                  return (
                    <li key={a.id} className={img ? undefined : 'no-img'}>
                      {img && (
                        <Link className="img-box" href={href} tabIndex={-1} aria-hidden="true">
                          <img src={img} alt="" loading="lazy" />
                        </Link>
                      )}
                      <div>
                        <h3>
                          <Link href={href}>{a.title}</Link>
                        </h3>
                        <p className="byline">{[categoryName(mainArticleCategory(a)), shortDate(a.publishedDate)].filter(Boolean).join(' · ')}</p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>
          )}

          <section className={`box ${styles.stay}`} aria-labelledby="stay-h">
            <h2 id="stay-h">Stayed on status?</h2>
            <p>Two minutes, dropdowns only. Your upgrade, breakfast and lounge outcome joins the odds for that hotel.</p>
            <Link className="btn" href="/submit-a-stay">
              Add your stay
            </Link>
          </section>
        </aside>
      </main>
    </>
  )
}
