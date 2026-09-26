'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import styles from './MilestoneCarousel.module.css'

type Item = { id: string; at: string; rewards: string[] }

// The milestone rewards as a row of cards that scrolls sideways, snapping
// card by card, with arrows for pointer users. Swipe on a phone.
export function MilestoneCarousel({ items }: { items: Item[] }) {
  const rail = useRef<HTMLOListElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  const measure = useCallback(() => {
    const el = rail.current
    if (!el) return
    setAtStart(el.scrollLeft <= 2)
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2)
  }, [])

  useEffect(() => {
    measure()
    const el = rail.current
    if (!el) return
    el.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      el.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [measure])

  const step = (dir: 1 | -1) => {
    const el = rail.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('li')
    const w = card ? card.offsetWidth + parseFloat(getComputedStyle(el).columnGap || '0') : el.clientWidth * 0.8
    el.scrollBy({ left: dir * w, behavior: 'smooth' })
  }

  return (
    <div className={styles.wrap}>
      <ol className={styles.rail} ref={rail} aria-label="Milestone rewards">
        {items.map((m, i) => (
          <li className={styles.card} key={m.id}>
            <span className={styles.step}>
              {i + 1} of {items.length}
            </span>
            <h3 className={styles.at}>{m.at}</h3>
            {m.rewards.length > 0 && (
              <ul className={`prose ${styles.rewards}`}>
                {m.rewards.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      {items.length > 1 && (
        <div className={styles.arrows}>
          <button type="button" className={styles.arrow} onClick={() => step(-1)} disabled={atStart} aria-label="Previous milestone">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <button type="button" className={styles.arrow} onClick={() => step(1)} disabled={atEnd} aria-label="Next milestone">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
