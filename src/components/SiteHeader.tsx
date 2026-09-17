import Link from 'next/link'

import styles from './SiteHeader.module.css'

export const navLinks = [
  { href: '/reviews', label: 'Reviews' },
  { href: '/hotels', label: 'Hotels' },
  { href: '/lounges', label: 'Lounges' },
  { href: '/guides', label: 'Articles' },
  { href: '/about', label: 'About' },
]

export function SiteHeader() {
  return (
    <nav className={styles.nav} aria-label="Main">
      <div className={`wrap ${styles.inner}`}>
        <Link className={styles.brand} href="/">
          Loyalist Travel
        </Link>
        <ul className={styles.links}>
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link href={link.href}>{link.label}</Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
