'use client'

import { useEffect, useRef, useState } from 'react'

import styles from './MobileToc.module.css'

export type TocItem = { href: string; label: string }

// The section list on phones and tablets. It starts as a card at the top of
// the article, like the sidebar on wide screens. Once the reader scrolls
// past it, a round button near the top of the screen takes over and drops
// the same list down on tap.
export function MobileToc({ items, eyebrow = 'On this page' }: { items: TocItem[]; eyebrow?: string }) {
  const card = useRef<HTMLDivElement>(null)
  const [passed, setPassed] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const el = card.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setPassed(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // close the dropdown after a choice or when scrolling back to the card
  useEffect(() => {
    if (!passed) setOpen(false)
  }, [passed])

  return (
    <>
      <div className={styles.card} ref={card}>
        <span className="eyebrow on-light">{eyebrow}</span>
        <ul className={styles.list}>
          {items.map((i) => (
            <li key={i.href}>
              <a href={i.href}>{i.label}</a>
            </li>
          ))}
        </ul>
      </div>
      <div className={`${styles.float} ${passed ? styles.shown : ''} ${open ? styles.open : ''}`}>
        <button type="button" className={styles.button} aria-label={open ? 'Close the section list' : 'Sections on this page'} aria-expanded={open} aria-controls="toc-drop" onClick={() => setOpen((v) => !v)} tabIndex={passed ? 0 : -1}>
          {open ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <line x1="5" y1="7" x2="19" y2="7" />
              <line x1="5" y1="12" x2="15" y2="12" />
              <line x1="5" y1="17" x2="11" y2="17" />
            </svg>
          )}
        </button>
        <div className={styles.drop} id="toc-drop" hidden={!open}>
          <span className="eyebrow on-light">{eyebrow}</span>
          <ul className={styles.list}>
            {items.map((i) => (
              <li key={i.href}>
                <a href={i.href} onClick={() => setOpen(false)}>
                  {i.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}
