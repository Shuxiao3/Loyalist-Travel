'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import styles from './StickyReview.module.css'

// The hotel's review, pinned to the corner once the hero (where the score
// lives) scrolls out of view. Disappears again at the top of the page.
export function StickyReview({ heroId, href, score, band, title }: { heroId: string; href: string; score: string; band?: string | null; title: string }) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const hero = document.getElementById(heroId)
    if (!hero || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setShown(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 })
    io.observe(hero)
    return () => io.disconnect()
  }, [heroId])
  return (
    <Link className={`${styles.pill} ${shown ? styles.shown : ''}`} href={href} aria-hidden={!shown} tabIndex={shown ? 0 : -1}>
      <span className={styles.score}>{score}</span>
      <span className={styles.text}>
        <span className={styles.label}>Loyalist Travel score{band ? ` · ${band}` : ''}</span>
        <span className={styles.cta}>Read the review of {title}</span>
      </span>
    </Link>
  )
}
