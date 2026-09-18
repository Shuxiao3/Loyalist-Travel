import type { Metadata } from 'next'
import Link from 'next/link'

import { ARTICLE_CATEGORIES, ARTICLE_CATEGORY_LABEL } from '@/collections/Articles'
import { ArticleCard } from '@/components/ArticleCard'
import { LandingHero } from '@/components/LandingHero'
import { Pager } from '@/components/Pager'
import { ARTICLES_PER_PAGE, articleImage, getArticleCategoryCounts, getArticles } from '@/lib/articles'
import { count, shortDate } from '@/lib/format'

import styles from './page.module.css'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Articles',
  description: 'Elite benefits, loyalty programs, points and awards, credit cards, lounges and hotels, written from stays we paid for.',
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined

export default async function ArticlesIndex({ searchParams }: Props) {
  const sp = await searchParams
  const page = Math.max(1, Number(first(sp.page)) || 1)
  const category = ARTICLE_CATEGORIES.some((c) => c.value === first(sp.category)) ? first(sp.category) : undefined
  const [result, latestRes, counts] = await Promise.all([getArticles({ page, category, featuredFirst: !category }), getArticles({ limit: 1, featuredFirst: true }), getArticleCategoryCounts()])
  const latest = latestRes.docs[0]
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const href = (p: number) => {
    const q = new URLSearchParams()
    if (category) q.set('category', category)
    if (p > 1) q.set('page', String(p))
    const s = q.toString()
    return s ? `/articles?${s}` : '/articles'
  }

  return (
    <>
      <LandingHero
        eyebrow="Articles"
        title="How the programs actually work"
        text="Elite benefits, points and awards, credit cards, lounges and the hotels themselves. Written from stays we paid for, and updated when the rules change."
        photo={latest ? articleImage(latest) : null}
        card={
          latest
            ? {
                eyebrow: latest.featured ? 'Featured' : 'Latest',
                image: articleImage(latest),
                meta: [ARTICLE_CATEGORY_LABEL[latest.category] ?? latest.category, shortDate(latest.publishedDate)].filter((m): m is string => Boolean(m)),
                title: latest.title,
                cta: 'Read it',
                href: `/articles/${latest.slug}`,
              }
            : null
        }
      />

      <nav className={`section ${styles.cats}`} aria-label="Article categories">
        <div className={`wrap ${styles.catRow}`}>
          <Link className={`${styles.cat} ${!category ? styles.catOn : ''}`} href="/articles">
            All <span className={styles.catN}>{count(total)}</span>
          </Link>
          {ARTICLE_CATEGORIES.map((c) => (
            <Link className={`${styles.cat} ${category === c.value ? styles.catOn : ''}`} href={`/articles?category=${c.value}`} key={c.value}>
              {c.label} <span className={styles.catN}>{count(counts[c.value] ?? 0)}</span>
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
