'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { NAV_LINKS, type NavItem } from '@/lib/site'

import { AccountLink } from './AccountLink'

import styles from './SiteHeader.module.css'

// Navy nav with the wordmark, tracked uppercase links, and on phones a
// hamburger that opens a drawer holding search and the same links. Items
// with children open a menu on hover, focus or tap; in the drawer the
// children are listed under their heading.
export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [menu, setMenu] = useState<string | null>(null)

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

  // Close the drawer and any menu on navigation.
  useEffect(() => {
    setOpen(false)
    setMenu(null)
  }, [pathname])

  const current = (href: string) => (pathname === href || pathname.startsWith(href.split('?')[0] + '/') ? 'page' : undefined)
  // a parent is current when any child page is
  const parentCurrent = (item: NavItem) => (item.children ? (item.children.some((c) => pathname.startsWith(c.href.split('?')[0])) || pathname.startsWith(item.href) ? 'page' : undefined) : current(item.href))

  return (
    <nav className={`${styles.nav} ${hidden && !open ? styles.hidden : ''}`} aria-label="Main">
      <div className={`wrap ${styles.inner}`}>
        <Link className={styles.brand} href="/">
          Loyalist Travel
        </Link>
        <ul className={styles.links}>
          {NAV_LINKS.map((item) =>
            item.children ? (
              <li
                key={item.href}
                className={`${styles.hasMenu} ${menu === item.href ? styles.menuOpen : ''}`}
                onMouseEnter={() => setMenu(item.href)}
                onMouseLeave={() => setMenu((m) => (m === item.href ? null : m))}
              >
                {item.href === '/programs' ? (
                  <button type="button" className={styles.parent} aria-expanded={menu === item.href} aria-haspopup="true" aria-current={parentCurrent(item)} onClick={() => setMenu((m) => (m === item.href ? null : item.href))}>
                    {item.label}
                    <Caret />
                  </button>
                ) : (
                  <Link href={item.href} className={styles.parent} aria-current={parentCurrent(item)} onFocus={() => setMenu(item.href)}>
                    {item.label}
                    <Caret />
                  </Link>
                )}
                <ul className={styles.menuList} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setMenu(null) }}>
                  {item.children.map((c) => (
                    <li key={c.href}>
                      <Link href={c.href} onFocus={() => setMenu(item.href)}>
                        {c.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ) : (
              <li key={item.href}>
                <Link href={item.href} aria-current={current(item.href)}>
                  {item.label}
                </Link>
              </li>
            ),
          )}
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
            {NAV_LINKS.map((item) =>
              item.children ? (
                <li key={item.href} className={styles.drawerGroup}>
                  {item.href === '/programs' ? <span className={styles.drawerHead}>{item.label}</span> : <Link href={item.href} className={styles.drawerHead} aria-current={current(item.href)}>{item.label}</Link>}
                  <ul>
                    {item.children.map((c) => (
                      <li key={c.href}>
                        <Link href={c.href}>{c.label}</Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ) : (
                <li key={item.href}>
                  <Link href={item.href} aria-current={current(item.href)}>
                    {item.label}
                  </Link>
                </li>
              ),
            )}
            <li>
              <AccountLink />
            </li>
          </ul>
        </div>
      </div>
    </nav>
  )
}

function Caret() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="5,9 12,16 19,9" />
    </svg>
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
