import Link from 'next/link'

import styles from './page.module.css'

// Milestone 0 placeholder. The full homepage (latest reviews, reader data
// band, programs, lounges, guides, contribute) is Milestone 2 and reads from
// Payload. This page exists to prove the token system end to end.

const stats = [
  { n: '4,539', l: 'Hotels indexed across three programs' },
  { n: '16', l: 'Categories behind every score' },
  { n: '412', l: 'Reader-submitted stays' },
  { n: '38', l: 'Club lounges rated' },
]

export default function HomePage() {
  return (
    <main>
      <header className={styles.hero}>
        <div className={`wrap ${styles.heroWrap}`}>
          <div className={styles.heroGrid}>
            <div>
              <span className={`eyebrow ${styles.eyebrow}`}>Luxury hotel reviews, scored</span>
              <h1 className={styles.h1}>What your status actually gets you.</h1>
              <p className={styles.sub}>
                Hotels scored on a 100-point rubric. Elite benefits reported as they happened, not as
                printed. Lounges rated by the people who sat in them.
              </p>
              <div className={styles.ctas}>
                <Link className="btn" href="/reviews">
                  Latest reviews
                </Link>
                <Link className="ghost" href="/hotels">
                  Browse 4,500 hotels
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <line x1="4" y1="12" x2="19" y2="12" />
                    <polyline points="13,6 19,12 13,18" />
                  </svg>
                </Link>
              </div>
            </div>

            <aside className={styles.latest} aria-label="Latest scored stay">
              <span className={`eyebrow ${styles.eyebrow}`}>Latest scored stay</span>
              <div className={styles.latestImg} role="img" aria-label="Park Hyatt New York" />
              <div className={styles.latestMeta}>
                <span>World of Hyatt</span>
                <span className={styles.dot}>·</span>
                <span>New York</span>
              </div>
              <h3 className={styles.latestTitle}>Park Hyatt New York</h3>
              <p className={styles.latestSub}>
                A hard product that still leads Manhattan, carried by a service culture that is
                reliable rather than memorable.
              </p>
              <div className={styles.latestFoot}>
                <div className={styles.score}>
                  81<small>of 100</small>
                </div>
                <Link className={styles.read} href="/reviews/park-hyatt-new-york">
                  Read the review
                </Link>
              </div>
            </aside>
          </div>

          <div className={styles.stats} aria-label="Site at a glance">
            {stats.map((stat) => (
              <div className={styles.stat} key={stat.l}>
                <div className={styles.statN}>{stat.n}</div>
                <div className={styles.statL}>{stat.l}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <section className={styles.rubric} aria-labelledby="rubric-h">
        <div className="wrap">
          <div className={styles.sectionHead}>
            <div>
              <span className={`eyebrow on-light ${styles.eyebrow}`}>The rubric</span>
              <h2 id="rubric-h" className={styles.h2}>
                Sixteen categories, one hundred points.
              </h2>
            </div>
            <Link className="more" href="/about">
              How scoring works
            </Link>
          </div>
          <div className={styles.cells}>
            <div className={styles.cell}>
              <span className="label">Hard product</span>
              <span className={styles.val}>
                Room, bathroom, bed, tech, amenities, atmosphere, upkeep and location. Fifty-five
                points at a city hotel.
              </span>
            </div>
            <div className={styles.cell}>
              <span className="label">Soft product</span>
              <span className={styles.val}>
                Check-in, service baseline and peak, operations, housekeeping, dining, density and
                departure. Forty-five points.
              </span>
            </div>
            <div className={styles.cell}>
              <span className="label">Elite recognition</span>
              <span className={`${styles.val} ${styles.gold}`}>
                Reported as it happened. Never scored.
              </span>
            </div>
            <div className={styles.cell}>
              <span className="label">Rubric version</span>
              <span className={styles.val}>v15, locked. Later changes become v16.</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
