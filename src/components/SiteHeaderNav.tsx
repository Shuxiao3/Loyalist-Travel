'use client'

import Form from 'next/form'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, useSyncExternalStore, type FocusEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react'

import type { HeaderMenus, MenuStory } from '@/lib/nav'
import { ARTICLE_SECTIONS, ARTICLE_TOPICS, NAV_LINKS, PROGRAM_LINKS, topicHref, type NavMenu, type NavSection } from '@/lib/site'

import { AccountLink } from './AccountLink'

// The section a page belongs to when its address does not say (an article sits under News or
// Guides by its main category). The page renders <CurrentSection section="news" /> and the
// header marks that section; the address decides everywhere else (sectionOf below).
let markedSection: NavSection | null = null
const listeners = new Set<() => void>()
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
const setMarkedSection = (section: NavSection | null) => {
  markedSection = section
  listeners.forEach((fn) => fn())
}

export function CurrentSection({ section }: { section: NavSection | null }) {
  useEffect(() => {
    setMarkedSection(section)
    return () => setMarkedSection(null)
  }, [section])
  return null
}

function sectionOf(pathname: string): NavSection | null {
  switch (pathname.split('/')[1]) {
    case 'reviews':
      return 'reviews'
    case 'hotels':
    case 'brands':
    case 'destinations':
      return 'hotels'
    case 'lounges':
      return 'lounges'
    case 'programs':
      return 'programs'
    case 'news':
      return 'news'
    case 'guides':
      return 'guides'
    default:
      return null
  }
}

// The site header (kit: .site-head). Desktop: brand, the six sections (Programs, News and
// Guides open a menu on hover, keyboard focus or tap), hotel search and the account link.
// At 960px and below: a row of the six sections under the brand, and a menu button that opens
// the drawer (search, the sections, and Programs, News and Guides as folds). Every part works
// without script through CSS (hover, focus-within, <details>); once hydrated the script owns
// the menus (.js on the header) so they close on Escape, on a click elsewhere and on
// navigation.
export function SiteHeaderNav({ menus }: { menus: HeaderMenus }) {
  const pathname = usePathname()
  const marked = useSyncExternalStore(
    subscribe,
    () => markedSection,
    () => null,
  )
  const current = sectionOf(pathname) ?? marked

  const [ready, setReady] = useState(false)
  const [menu, setMenu] = useState<NavMenu | null>(null)
  const [drawer, setDrawer] = useState(false)
  const [fold, setFold] = useState<NavMenu | null>(null)
  const headRef = useRef<HTMLElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const summaryRef = useRef<HTMLElement>(null)
  // the kind of pointer that last pressed a menu trigger: a mouse already opened the menu by
  // hovering, a finger opens it with the first tap
  const pressedWith = useRef('')

  useEffect(() => setReady(true), [])

  // A new page closes everything and lets go of focus held in the header.
  useEffect(() => {
    setMenu(null)
    setDrawer(false)
    setFold(null)
    const active = document.activeElement
    if (active instanceof HTMLElement && headRef.current?.contains(active)) active.blur()
  }, [pathname])

  // A click or tap outside the desktop nav closes its menu; Escape closes a menu (one opened by
  // hovering too, wherever focus is) or the drawer.
  useEffect(() => {
    if (!menu && !drawer) return
    const onDown = (e: globalThis.PointerEvent) => {
      if (menu && !navRef.current?.contains(e.target as Node)) setMenu(null)
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (drawer) {
        setDrawer(false)
        summaryRef.current?.focus()
      } else if (menu) setMenu(null)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu, drawer])

  const close = (key: NavMenu) => setMenu((m) => (m === key ? null : m))

  // handlers on each menu's <li>
  const itemProps = (key: NavMenu) => ({
    onPointerEnter: (e: PointerEvent) => {
      if (e.pointerType === 'mouse') setMenu(key)
    },
    onPointerLeave: (e: PointerEvent) => {
      if (e.pointerType === 'mouse') close(key)
    },
    // keyboard focus arriving from outside opens it; a click's focus does not (the click decides)
    onFocus: (e: FocusEvent<HTMLLIElement>) => {
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
      if ((e.target as Element).matches(':focus-visible')) setMenu(key)
    },
    onBlur: (e: FocusEvent<HTMLLIElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close(key)
    },
    onKeyDown: (e: KeyboardEvent<HTMLLIElement>) => {
      if (e.key !== 'Escape' || menu !== key) return
      e.stopPropagation()
      setMenu(null)
      e.currentTarget.querySelector<HTMLElement>('.nav-link')?.focus()
    },
  })

  const onTriggerDown = (e: PointerEvent) => {
    pressedWith.current = e.pointerType
  }

  // Programs is a button: a tap or a key toggles it; a click keeps open what hovering opened.
  const onProgramsClick = () => {
    const how = pressedWith.current
    pressedWith.current = ''
    if (how === 'mouse' && menu === 'programs') return
    setMenu((m) => (m === 'programs' ? null : 'programs'))
  }

  // News and Guides are links to their pages: a first tap opens the menu (which leads with
  // "All news"), a click or Enter follows the link.
  const onSectionClick = (key: NavMenu) => (e: MouseEvent) => {
    const how = pressedWith.current
    pressedWith.current = ''
    if ((how === 'touch' || how === 'pen') && menu !== key) {
      e.preventDefault()
      setMenu(key)
    }
  }

  // A link chosen inside a menu or the drawer closes it, even when the address stays the same.
  const closeOnLink = (after: () => void) => (e: MouseEvent) => {
    if ((e.target as Element).closest('a')) after()
  }

  const isOn = (section: NavSection) => current === section
  const here = (href: string) => (pathname === href ? 'page' : undefined)

  const menuPanel = (key: NavMenu): ReactNode => {
    if (key === 'programs')
      return (
        <div className="menu menu-programs mb-menu" id="menu-programs" onClick={closeOnLink(() => setMenu(null))}>
          <div className="menu-split">
            <ul className="mb-progs">
              {PROGRAM_LINKS.map((p) => (
                <li key={p.href}>
                  <Link href={p.href} aria-current={here(p.href)}>
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div>
              {menus.programs.length > 0 && (
                <>
                  <p className="menu-h">Program guides</p>
                  <MenuStories stories={menus.programs} />
                </>
              )}
            </div>
          </div>
        </div>
      )
    const section = ARTICLE_SECTIONS[key]
    return (
      <div className={`menu menu-${key}`} id={`menu-${key}`} onClick={closeOnLink(() => setMenu(null))}>
        <div className="menu-split">
          <div>
            <Link className="menu-all" href={section.href}>
              {section.all}
            </Link>
            <p className="menu-h">Topics</p>
            <ul className="menu-links">
              {ARTICLE_TOPICS.map((t) => (
                <li key={t.value}>
                  <Link href={topicHref(key, t.value)}>{t.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            {menus[key].length > 0 && (
              <>
                <p className="menu-h">{section.latest}</p>
                <MenuStories stories={menus[key]} />
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <header className={`site-head${ready ? ' js' : ''}`} ref={headRef}>
      <div className="wrap head-row">
        <Link className="brand" href="/">
          <img src="/icon.svg" alt="" width={30} height={30} />
          Loyalist Travel
        </Link>
        <nav className="main-nav" aria-label="Main" ref={navRef}>
          <ul className="nav-list">
            {NAV_LINKS.map((item) => {
              const on = isOn(item.section)
              if (!item.menu)
                return (
                  <li className="nav-item" key={item.href}>
                    <Link className={`nav-link${on ? ' on' : ''}`} href={item.href} aria-current={on ? 'page' : undefined}>
                      {item.label}
                    </Link>
                  </li>
                )
              const key = item.menu
              const open = menu === key
              return (
                <li className={`nav-item has-menu${open ? ' is-open' : ''}`} key={item.href} {...itemProps(key)}>
                  {key === 'programs' ? (
                    <button type="button" className={`nav-link${on ? ' on' : ''}`} aria-expanded={open} aria-controls="menu-programs" aria-current={on ? 'page' : undefined} onPointerDown={onTriggerDown} onClick={onProgramsClick}>
                      {item.label}
                      <Caret />
                    </button>
                  ) : (
                    <Link className={`nav-link${on ? ' on' : ''}`} href={item.href} aria-expanded={open} aria-controls={`menu-${key}`} aria-current={on ? 'page' : undefined} onPointerDown={onTriggerDown} onClick={onSectionClick(key)}>
                      {item.label}
                      <Caret />
                    </Link>
                  )}
                  {menuPanel(key)}
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="head-tools">
          <Form className="search" role="search" action="/hotels">
            <SearchIcon size={16} />
            <input type="search" name="q" placeholder="Search hotels" aria-label="Search hotels" />
          </Form>
          <Link className="icon-btn" href="/hotels" aria-label="Search hotels">
            <SearchIcon size={19} />
          </Link>
          <AccountLink />
          <details
            className="drawer-toggle"
            open={drawer}
            onToggle={(e) => {
              const opened = e.currentTarget.open
              setDrawer(opened)
              if (!opened) setFold(null)
            }}
          >
            <summary className="icon-btn" aria-label="Menu" ref={summaryRef}>
              <svg className="i-menu" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
              <svg className="i-close" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </summary>
            <div className="drawer" onClick={closeOnLink(() => setDrawer(false))}>
              <Form className="drawer-search" role="search" action="/hotels" onSubmit={() => setDrawer(false)}>
                <SearchIcon size={16} />
                <input type="search" name="q" placeholder="Search hotels" aria-label="Search hotels" />
              </Form>
              <ul className="drawer-list">
                {NAV_LINKS.map((item) => {
                  if (!item.menu)
                    return (
                      <li key={item.href}>
                        <Link href={item.href} aria-current={isOn(item.section) ? 'page' : undefined}>
                          {item.label}
                        </Link>
                      </li>
                    )
                  const key = item.menu
                  return (
                    <li key={item.href}>
                      <details
                        className="drawer-group"
                        open={fold === key}
                        onToggle={(e) => {
                          const opened = e.currentTarget.open
                          setFold((f) => (opened ? key : f === key ? null : f))
                        }}
                      >
                        <summary>
                          {item.label}
                          <Caret />
                        </summary>
                        {key === 'programs' ? (
                          <ul className="drawer-sub mb-drawer">
                            {PROGRAM_LINKS.map((p) => (
                              <li key={p.href}>
                                <Link href={p.href} aria-current={here(p.href)}>
                                  {p.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <ul className="drawer-sub">
                            <li>
                              <Link className="all" href={ARTICLE_SECTIONS[key].href} aria-current={isOn(key) ? 'page' : undefined}>
                                {ARTICLE_SECTIONS[key].all}
                              </Link>
                            </li>
                            {ARTICLE_TOPICS.map((t) => (
                              <li key={t.value}>
                                <Link href={topicHref(key, t.value)}>{t.label}</Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </details>
                    </li>
                  )
                })}
              </ul>
            </div>
          </details>
        </div>
      </div>
      <div className="wrap nav-row">
        <nav className="sec-nav" aria-label="Sections">
          {NAV_LINKS.map((item) => {
            const on = isOn(item.section)
            // Programs has no page: it opens the drawer with the programs unfolded (without
            // script, /programs leads to the homepage's Programs section)
            const onClick =
              item.menu === 'programs'
                ? (e: MouseEvent) => {
                    e.preventDefault()
                    setDrawer(true)
                    setFold('programs')
                  }
                : undefined
            return (
              <Link key={item.href} className={on ? 'on' : undefined} href={item.href} aria-current={on ? 'page' : undefined} onClick={onClick}>
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}

function MenuStories({ stories }: { stories: MenuStory[] }) {
  return (
    <ol className="menu-stories">
      {stories.map((s) => (
        <li key={s.href} className={s.image ? undefined : 'no-img'}>
          {s.image && (
            <Link className="img-box" href={s.href} tabIndex={-1} aria-hidden="true">
              <img src={s.image} alt="" loading="lazy" />
            </Link>
          )}
          <div>
            <h3>
              <Link href={s.href}>{s.title}</Link>
            </h3>
            <p className="byline">{[s.category, s.date].filter(Boolean).join(' · ')}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

function Caret() {
  return (
    <svg className="caret" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M2 4.5l4 4 4-4" />
    </svg>
  )
}

function SearchIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="7" cy="7" r="5" />
      <path d="M11 11l3.5 3.5" />
    </svg>
  )
}
