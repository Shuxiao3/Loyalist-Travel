import type { Metadata } from 'next'

import { Pager } from '@/components/Pager'
import { ReviewCard } from '@/components/ReviewCard'
import { getReviews } from '@/lib/queries'

import styles from './page.module.css'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Reviews',
  description: 'Every scored stay, on a 100-point rubric, written from a full stay and never a site inspection.',
}

const PER_PAGE = 12

export default async function ReviewsIndex({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Number((await searchParams).page) || 1)
  const result = await getReviews({ limit: PER_PAGE, page })
  return (
    <>
      <header className={`hero ${styles.hero}`}>
        <div className="wrap">
          <span className="eyebrow">Scored stays</span>
          <h1 className={styles.h1}>Every review, scored.</h1>
          <p className="sub">Sixteen categories, one hundred points, every one of them from a stay we paid for. Elite benefits are reported alongside, never scored.</p>
        </div>
      </header>
      <section className={`section ${styles.list}`}>
        <div className="wrap">
          <div className="cards">
            {result.docs.map((r, i) => (
              <ReviewCard key={r.id} review={r} tone={(['a', 'b', 'c'] as const)[i % 3]} />
            ))}
          </div>
          <Pager page={result.page ?? 1} totalPages={result.totalPages} totalDocs={result.totalDocs} perPage={PER_PAGE} href={(p) => (p > 1 ? `/reviews?page=${p}` : '/reviews')} />
        </div>
      </section>
    </>
  )
}
