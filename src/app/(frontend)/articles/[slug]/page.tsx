import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ARTICLE_CATEGORY_LABEL } from '@/collections/Articles'
import { Comments } from '@/components/Comments'
import { ReadingProgress } from '@/components/ReadingProgress'
import { ArticleBody } from '@/components/ArticleBody'
import { MobileToc } from '@/components/MobileToc'
import { articleImage, getArticle, getArticles } from '@/lib/articles'
import { rel, shortDate } from '@/lib/format'
import { outlineOf } from '@/lib/outline'
import { SITE } from '@/lib/site'
import type { Article, Destination, Hotel, Lounge, Program } from '@/payload-types'

import { getSeo, metaText, pageMeta } from '@/lib/seo'

import styles from './page.module.css'

export const revalidate = 300

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getArticle((await params).slug)
  if (!article) return {}
  const text = metaText((await getSeo())?.article, { Title: article.title, Dek: article.dek, Category: ARTICLE_CATEGORY_LABEL[article.category] }, { title: article.title, description: article.dek })
  if (article.seo?.title?.trim()) text.title = article.seo.title.trim()
  if (article.seo?.description?.trim()) text.description = article.seo.description.trim()
  return pageMeta({ ...text, path: `/articles/${article.slug}`, image: articleImage(article), type: 'article' })
}

export default async function ArticlePage({ params }: Props) {
  const article = await getArticle((await params).slug)
  if (!article) notFound()
  const image = articleImage(article)
  const category = ARTICLE_CATEGORY_LABEL[article.category] ?? article.category
  const hotels = (article.related?.hotels ?? []).map((h) => rel<Hotel>(h)).filter((h): h is Hotel => Boolean(h))
  const programs = (article.related?.programs ?? []).map((p) => rel<Program>(p)).filter((p): p is Program => Boolean(p))
  const lounges = (article.related?.lounges ?? []).map((l) => rel<Lounge>(l)).filter((l): l is Lounge => Boolean(l))
  const picked = (article.related?.articles ?? []).map((a) => rel<Article>(a)).filter((a): a is Article => Boolean(a))
  const more = picked.length > 0 ? picked : (await getArticles({ limit: 3, category: article.category, excludeId: article.id })).docs
  const fallback = more.length > 0 ? more : (await getArticles({ limit: 3, excludeId: article.id })).docs
  const outline = outlineOf(article.body)
  const toc = outline.length >= 2 ? outline.map((h) => ({ href: `#${h.id}`, label: h.text })) : []

  return (
    <>
      <header className={`hero ${styles.hero}`}>
        <div className="wrap">
          <ol className="crumbs" aria-label="Breadcrumb">
            <li>
              <Link href="/articles">Articles</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href={`/articles?category=${article.category}`}>{category}</Link>
            </li>
          </ol>
          <span className="eyebrow">{category}</span>
          <h1 className={styles.h1}>{article.title}</h1>
          {article.dek && <p className={`sub ${styles.sub}`}>{article.dek}</p>}
          <div className={`byline ${styles.byline}`}>
            <span className="grp">
              <span className="author">{SITE.author}</span>
              <span className="dot">·</span>
              <span>{shortDate(article.publishedDate)}</span>
            </span>
            {article.updatedAt && article.updatedAt.slice(0, 10) > (article.publishedDate ?? '').slice(0, 10) && (
              <span className="grp">
                <span>Updated {shortDate(article.updatedAt)}</span>
              </span>
            )}
          </div>
        </div>
      </header>

      {image && <div className="hero-img" role="img" aria-label={article.title} style={{ backgroundImage: `url(${image}), var(--img-a)` }} />}

      <ReadingProgress />
      <main className={styles.body}>
        <div className={`wrap ${styles.bodyWrap}`}>
          <article className={styles.main}>
            {toc.length > 0 && <MobileToc items={toc} />}
            <ArticleBody data={article.body} />
          </article>

          <aside className={styles.side}>
            {toc.length > 0 && (
              <div className={`${styles.sideCard} ${styles.tocCard}`}>
                <span className="eyebrow on-light">On this page</span>
                <ul className={styles.toc}>
                  {toc.map((i) => (
                    <li key={i.href}>
                      <a href={i.href}>{i.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(hotels.length > 0 || programs.length > 0 || lounges.length > 0) && (
              <div className={styles.related}>
                <span className="eyebrow on-light">Mentioned here</span>
                <ul>
                  {programs.map((p) => (
                    <li key={`p${p.id}`}>
                      <span className="label">Program</span>
                      <Link href={`/programs/${p.slug}`}>{p.name}</Link>
                    </li>
                  ))}
                  {hotels.map((h) => {
                    const d = rel<Destination>(h.destination)
                    return (
                      <li key={`h${h.id}`}>
                        <span className="label">{d?.name ?? 'Hotel'}</span>
                        <Link href={`/hotels/${h.slug}`}>{h.name}</Link>
                      </li>
                    )
                  })}
                  {lounges.map((l) => (
                    <li key={`l${l.id}`}>
                      <span className="label">Lounge</span>
                      <Link href={`/lounges/${l.slug}`}>{l.name}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className={styles.sideCta}>
              <h3>Stayed on status?</h3>
              <p>Two minutes of dropdowns. Your upgrade, breakfast and lounge outcome joins the odds for that hotel.</p>
              <Link className="btn" href="/submit-a-stay">
                Add a stay
              </Link>
            </div>

            {fallback.length > 0 && (
              <div className={styles.related}>
                <span className="eyebrow on-light">More to read</span>
                <ul>
                  {fallback.map((a) => (
                    <li key={a.id}>
                      <span className="label">
                        {ARTICLE_CATEGORY_LABEL[a.category] ?? a.category} · {shortDate(a.publishedDate)}
                      </span>
                      <Link href={`/articles/${a.slug}`}>{a.title}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </main>

      <Comments kind="articles" id={article.id} />
    </>
  )
}
