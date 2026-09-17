import Link from 'next/link'

import styles from './not-found.module.css'

export default function NotFound() {
  return (
    <main className={styles.main}>
      <div className="wrap">
        <span className={`eyebrow on-light ${styles.eyebrow}`}>404</span>
        <h1 className={styles.h1}>Nothing at this address.</h1>
        <p className={styles.sub}>
          This section is still being built. The homepage is the only page that exists yet.
        </p>
        <Link className="more" href="/">
          Back to the homepage
        </Link>
      </div>
    </main>
  )
}
