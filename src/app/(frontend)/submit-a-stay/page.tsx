import type { Metadata } from 'next'
import Link from 'next/link'

import { MIN_STAYS } from '@/lib/readerData'
import { getSeo, metaText, pageMeta } from '@/lib/seo'

import { StayPicker } from '@/components/StayPicker'

import { SignInAside } from './SignInAside'
import styles from './page.module.css'

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeo()
  return pageMeta({ ...metaText(seo?.submitAStay, {}, { title: 'Add your stay', description: 'Two minutes, no typing. Your upgrade outcome joins the data for that hotel.' }), path: '/submit-a-stay' })
}

// Add your stay (mockups: submit-a-stay.html, -search, -cert, -done): the form on the left,
// how a stay counts on the right.
export default function SubmitStayPage() {
  return (
    <>
      <section className="band page-band">
        <div className="wrap">
          <div className="pb-row">
            <div className="pb-title">
              <h1>Add your stay</h1>
              <p className="pb-dek">Two minutes, and no typing past the hotel name. Your upgrade outcome joins the data for that hotel, and the upgrade odds update for everyone.</p>
            </div>
          </div>
        </div>
      </section>

      <main className={`wrap main ${styles.main}`}>
        <div className={`grid-side ${styles.grid}`}>
          <StayPicker />

          <aside className={styles.side}>
            <section className="box">
              <h2>How a stay counts</h2>
              <ul className="bullets">
                <li>A hotel&rsquo;s page shows reader odds once it has {MIN_STAYS} checked stays.</li>
                <li>Recent stays count most: this year and last in full, older ones less.</li>
                <li>Stays are always anonymous. No name shows, signed in or not.</li>
              </ul>
            </section>
            <SignInAside className={styles.aside} />
            <section className={styles.aside}>
              <h2 className="h4">Sat in a club lounge?</h2>
              <p>Lounge ratings go on each lounge&rsquo;s page: food, drink, space and ambiance, service and overall, each from 1&nbsp;to&nbsp;5.</p>
              <p>
                <Link className="link" href="/lounges">
                  Browse lounges
                </Link>
              </p>
            </section>
          </aside>
        </div>
      </main>
    </>
  )
}
