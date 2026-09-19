import Link from 'next/link'

import { NAV_LINKS, PROGRAM_LINKS } from '@/lib/site'

import styles from './SiteFooter.module.css'

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`wrap ${styles.inner}`}>
        <div>
          <span className={styles.brand}>Loyalist Travel</span>
        </div>
        <ul className={styles.links}>
          {NAV_LINKS.filter((l) => l.href !== '/programs').map((link) => (
            <li key={link.href}>
              <Link href={link.href}>{link.label}</Link>
            </li>
          ))}
          {PROGRAM_LINKS.map((link) => (
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
