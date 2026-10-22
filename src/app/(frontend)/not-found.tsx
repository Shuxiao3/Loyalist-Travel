import type { Metadata } from 'next'
import Form from 'next/form'
import Link from 'next/link'

import styles from './not-found.module.css'

// The tab title for every 404, whichever route called notFound() (an unknown address, a hotel or
// article slug with no record).
export const metadata: Metadata = { title: 'Page not found', robots: { index: false, follow: true } }

const ELSEWHERE = [
  { href: '/reviews', label: 'Reviews', text: 'Hotels stayed in and scored on one rubric.' },
  { href: '/hotels', label: 'Hotels', text: 'Hotels by program, brand and place.' },
  { href: '/lounges', label: 'Lounges', text: 'Club lounges and who gets in.' },
  { href: '/news', label: 'News', text: 'Changes to the programs, as they happen.' },
  { href: '/guides', label: 'Guides', text: 'How to get more from the programs.' },
]

// Any address with no page (the 404), in the sign-in page's layout (mockup: login.html): the
// band, a hotel search on a card, and the sections of the site beside it.
export default function NotFound() {
  return (
    <>
      <section className="band page-band">
        <div className="wrap">
          <div className="pb-row">
            <div className="pb-title">
              <h1>Page not found</h1>
              <p className="pb-dek">Nothing lives at this address. The page may have moved, or the link may be mistyped.</p>
            </div>
          </div>
        </div>
      </section>

      <main className={`wrap main ${styles.main}`}>
        <div className={`grid-side ${styles.grid}`}>
          <section className={styles.card}>
            <h2 className="h2">Find a hotel</h2>
            <p className={styles.lede}>Search by the hotel&rsquo;s name.</p>
            <Form className={`inline-form ${styles.search}`} action="/hotels" role="search">
              <input className="input" type="search" name="q" placeholder="Hotel name" aria-label="Search hotels" />
              <button className="btn" type="submit">
                Search
              </button>
            </Form>
            <p className="help">
              Or start from the{' '}
              <Link className="link" href="/">
                homepage
              </Link>
              .
            </p>
          </section>

          <aside>
            <div className="mod-head">
              <h2>Elsewhere on the site</h2>
            </div>
            <dl className={styles.list}>
              {ELSEWHERE.map((s) => (
                <div key={s.href}>
                  <dt>
                    <Link href={s.href}>{s.label}</Link>
                  </dt>
                  <dd>{s.text}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </main>
    </>
  )
}
