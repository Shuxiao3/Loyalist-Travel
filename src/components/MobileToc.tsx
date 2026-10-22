'use client'

import { useEffect, useRef, useState } from 'react'

import styles from './MobileToc.module.css'

export type TocItem = { href: string; label: string }

// "On this page" where the contents rail does not fit (1180px and below): a fold at the top of
// the article (the mockups' .art-toc-m, a <details> that works without script). Once the reader
// scrolls past it, a small button near the top of the screen takes over and drops the same list
// down on tap.
export function MobileToc({ items, title = 'On this page', className }: { items: TocItem[]; title?: string; className?: string }) {
  const fold = useRef<HTMLDetailsElement>(null)
  const [passed, setPassed] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const el = fold.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    // The root reaches far below the screen, so "not intersecting" can only
    // mean the fold is above it: a jump that skips the fold in one frame
    // (End or Home, a tap on the status bar) still lands in the right state.
    // The last entry of a batch is the current one.
    const io = new IntersectionObserver((entries) => setPassed(!entries[entries.length - 1].isIntersecting), { threshold: 0, rootMargin: '0px 0px 10000px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // close the dropdown after a choice or when scrolling back to the fold
  useEffect(() => {
    if (!passed) setOpen(false)
  }, [passed])

  // Escape closes the dropdown
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const list = (onPick?: () => void) => (
    <ol className={styles.list}>
      {items.map((i) => (
        <li key={i.href}>
          <a href={i.href} onClick={onPick}>
            {i.label}
          </a>
        </li>
      ))}
    </ol>
  )

  return (
    <>
      <details className={`${styles.fold}${className ? ` ${className}` : ''}`} ref={fold}>
        <summary>
          {title}
          <span className="muted">
            {items.length} {items.length === 1 ? 'section' : 'sections'}
          </span>
          <svg className={styles.caret} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M2 4.5l4 4 4-4" />
          </svg>
        </summary>
        {list()}
      </details>
      <div className={`${styles.float} ${passed ? styles.shown : ''}`}>
        <button type="button" className={styles.button} aria-label={open ? 'Close the section list' : 'Sections on this page'} aria-expanded={open} aria-controls="toc-drop" onClick={() => setOpen((v) => !v)} tabIndex={passed ? 0 : -1}>
          {open ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M5 7h14M5 12h10M5 17h6" />
            </svg>
          )}
        </button>
        <div className={styles.drop} id="toc-drop" hidden={!open}>
          <p className={styles.dropH}>{title}</p>
          {list(() => setOpen(false))}
        </div>
      </div>
    </>
  )
}
