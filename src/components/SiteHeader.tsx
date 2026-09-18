'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { NAV_LINKS } from '@/lib/site'

import { AccountLink } from './AccountLink'

import styles from './SiteHeader.module.css'

// Navy nav with the wordmark, tracked uppercase links, and on phones a
// hamburger that opens a drawer holding search and the same links.
export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(false)

  // Slide away on scroll down, return on scroll up. Always shown near the
  // top and while the drawer is open.
  useEffect(() => {
    let last = window.scrollY
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        if (y < 80 || y < last - 4) setHidden(false)
        else if (y > last + 4) setHidden(true)
        last = y
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the drawer on navigation.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const current = (href: string) => (pathname === href || pathname.startsWith(href + '/') ? 'page' : undefined)

  return (
    <nav className={`${styles.nav} ${hidden && !open ? styles.hidden : ''}`} aria-label="Main">
      <div className={`wrap ${styles.inner}`}>
        <Link className={styles.brand} href="/">
          Loyalist Travel
        </Link>
        <ul className={styles.links}>
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} aria-current={current(link.href)}>
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/hotels" aria-label="Search hotels" className={styles.searchLink}>
              <SearchIcon size={18} />
            </Link>
          </li>
          <li>
            <AccountLink className={styles.account} />
          </li>
        </ul>
        <button
          className={styles.menu}
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="drawer"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <line x1="5" y1="5" x2="19" y2="19" />
              <line x1="19" y1="5" x2="5" y2="19" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          )}
        </button>
      </div>
      <div className={`${styles.drawer} ${open ? styles.open : ''}`} id="drawer">
        <div className={styles.drawerInner}>
        <form className={styles.search} role="search" action="/hotels" method="get">
          <SearchIcon size={16} />
          <input type="search" name="q" placeholder="Search hotels" aria-label="Search hotels" />
        </form>
        <ul>
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} aria-current={current(link.href)}>
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <AccountLink />
          </li>
        </ul>
        </div>
      </div>
    </nav>
  )
}

function SearchIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="16.2" y1="16.2" x2="21" y2="21" />
    </svg>
  )
}
