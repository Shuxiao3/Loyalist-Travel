import Link from 'next/link'

import { navLinks } from './SiteHeader'
import styles from './SiteFooter.module.css'

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`wrap ${styles.inner}`}>
        <div>
          <span className={styles.brand}>Loyalist Travel</span>
          <p className={styles.tag}>
            Luxury hotel reviews scored on a 100-point rubric, written for people who care what
            their status actually gets them.
          </p>
        </div>
        <ul className={styles.links}>
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link href={link.href}>{link.label}</Link>
            </li>
          ))}
        </ul>
      </div>
      <div className={`wrap ${styles.fine}`}>
        Scores follow the Loyalist Travel rubric, v15. No paid placements, no sponsored stays.
      </div>
    </footer>
  )
}
