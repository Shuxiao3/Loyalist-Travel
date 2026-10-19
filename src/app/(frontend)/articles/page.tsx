import type { Metadata } from 'next'

import { getSeo, metaText, pageMeta } from '@/lib/seo'
import Link from 'next/link'
import { permanentRedirect, redirect } from 'next/navigation'

import { ARTICLE_CATEGORIES, ARTICLE_CATEGORY_LABEL } from '@/collections/Articles'
import { ArticleCard } from '@/components/ArticleCard'
import { LandingHero } from '@/components/LandingHero'
import { Pager } from '@/components/Pager'
import { ARTICLES_PER_PAGE, articleImage, getArticleCategoryCounts, getArticles } from '@/lib/articles'
import { articleCategoryLabel, isArticleCategory, LEGACY_ARTICLE_CATEGORY, mainArticleCategory } from '@/lib/articleOptions'
import { count, shortDate } from '@/lib/format'

import styles from './page.module.css'

export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeo()
  return pageMeta({ ...metaText(seo?.articles, {}, { title: 'Articles', description: 'News, guides, hotels, airlines and credit cards, written from stays we paid for.' }), path: '/articles' })
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined

export default async function ArticlesIndex({ searchParams }: Props) {
  const sp = await searchParams
  const page = Math.max(1, Number(first(sp.page)) || 1)
  const asked = first(sp.category)
  // a link to a category from before the rename lands on what it became
  if (asked && LEGACY_ARTICLE_CATEGORY[asked]) permanentRedirect(`/articles?category=${LEGACY_ARTICLE_CATEGORY[asked]}`)
  const category = isArticleCategory(asked) ? asked : undefined
  const [result, latestRes, { total, counts }] = await Promise.all([getArticles({ page, category }), getArticles({ limit: 1, featuredFirst: true }), getArticleCategoryCounts()])
  const latest = latestRes.docs[0]
  const href = (p: number) => {
    const q = new URLSearchParams()
    if (category) q.set('category', category)
    if (p > 1) q.set('page', String(p))
    const s = q.toString()
    return s ? `/articles?${s}` : '/articles'
  }
  // A page past the end (an old link, after articles moved or went) goes to
  // the last one; for a category, Payload counts 0 articles on an empty page.
  const last = Math.max(1, Math.ceil((category ? (counts[category] ?? 0) : total) / ARTICLES_PER_PAGE))
  if (page > last && result.docs.length === 0) redirect(href(last))

  return (
    <>
      <LandingHero
        eyebrow="Articles"
        title="How the programs actually work"
        text="News, guides, hotels, airlines and credit cards. Written from stays we paid for, and updated when the rules change."
        photo={latest ? articleImage(latest) : null}
        card={
          latest
            ? {
                eyebrow: latest.featured ? 'Featured' : 'Latest',
                image: articleImage(latest),
                meta: [articleCategoryLabel(mainArticleCategory(latest)), shortDate(latest.publishedDate)].filter((m): m is string => Boolean(m)),
                title: latest.title,
                cta: 'Read it',
                href: `/articles/${latest.slug}`,
              }
            : null
        }
      />

      <nav className={`section ${styles.cats}`} aria-label="Article categories">
        <div className={`wrap ${styles.catRow}`}>
          <Link className={`${styles.cat} ${!category ? styles.catOn : ''}`} href="/articles" aria-current={!category ? 'true' : undefined}>
            All <span className={styles.catN}>{count(total)}</span>
          </Link>
          {ARTICLE_CATEGORIES.map((c) => (
            <Link className={`${styles.cat} ${category === c.value ? styles.catOn : ''}`} href={`/articles?category=${c.value}`} key={c.value} aria-current={category === c.value ? 'true' : undefined}>
              {/* a category with nothing in it yet shows no count */}
              {c.label} {(counts[c.value] ?? 0) > 0 && <span className={styles.catN}>{count(counts[c.value])}</span>}
            </Link>
          ))}
        </div>
      </nav>

      <section className={`section ${styles.list}`}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow on-light">{category ? ARTICLE_CATEGORY_LABEL[category] : 'All articles'}</span>
              <h2>
                {count(result.totalDocs)} {result.totalDocs === 1 ? 'article' : 'articles'}
              </h2>
            </div>
          </div>
          {result.docs.length > 0 ? (
            <div className="cards">
              {result.docs.map((a, i) => (
                <ArticleCard key={a.id} article={a} tone={(['a', 'b', 'c'] as const)[i % 3]} />
              ))}
            </div>
          ) : (
            <p className={styles.empty}>Nothing in this category yet.</p>
          )}
          <Pager page={result.page ?? 1} totalPages={result.totalPages} totalDocs={result.totalDocs} perPage={ARTICLES_PER_PAGE} href={href} />
        </div>
      </section>
    </>
  )
}
