'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import styles from './HomeHero.module.css'

export type HeroSlide = {
  kind: 'review' | 'hotel' | 'program' | 'article'
  eyebrow: string
  image?: string | null
  meta: string[]
  title: string
  text?: string | null
  figure?: { value: string; label: string } | null
  cta: string
  href: string
}

const INTERVAL_MS = 6000

// The homepage hero. The panel on the right rotates through the slides
// with a crossfade; the photograph behind the navy follows the active
// slide. Auto-advance pauses on hover and focus and is off entirely under
// prefers-reduced-motion.
export function HomeHero({ slides, children, stats }: { slides: HeroSlide[]; children: React.ReactNode; stats: React.ReactNode }) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduced = useRef(false)

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  useEffect(() => {
    if (slides.length < 2 || paused || reduced.current) return
    const id = setInterval(() => setActive((i) => (i + 1) % slides.length), INTERVAL_MS)
    return () => clearInterval(id)
  }, [slides.length, paused, active])

  const go = useCallback((i: number) => setActive(i), [])
  const photo = slides[active]?.image

  return (
    <header className={`hero ${styles.hero}`} style={photo ? ({ '--hero-photo': `url(${photo})` } as React.CSSProperties) : undefined}>
      <div className={`wrap ${styles.wrap}`}>
        <div className={styles.grid}>
          <div>{children}</div>

          {slides.length > 0 && (
            <section
              className={styles.panel}
              aria-roledescription="carousel"
              aria-label="Highlights"
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
            >
              <div className={styles.stack}>
                {slides.map((s, i) => (
                  <article
                    key={s.kind + s.href}
                    className={`${styles.slide} ${i === active ? styles.on : ''}`}
                    aria-hidden={i !== active}
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`${i + 1} of ${slides.length}: ${s.eyebrow}`}
                  >
                    <span className="eyebrow">{s.eyebrow}</span>
                    <div className={styles.img} role="img" aria-label={s.title} style={s.image ? { backgroundImage: `url(${s.image}), var(--img-a)` } : undefined} />
                    {s.meta.length > 0 && (
                      <div className={styles.meta}>
                        {s.meta.map((m, j) => (
                          <span key={m}>
                            {j > 0 && <span className="dot">· </span>}
                            {m}
                          </span>
                        ))}
                      </div>
                    )}
                    <h3 className={styles.title}>{s.title}</h3>
                    {s.text && <p className={styles.text}>{s.text}</p>}
                    <div className={styles.foot}>
                      {s.figure ? (
                        <div className={/^[\d.,]+$/.test(s.figure.value) ? styles.figure : styles.figureText}>
                          {s.figure.value}
                          <small>{s.figure.label}</small>
                        </div>
                      ) : (
                        <span />
                      )}
                      <Link className={styles.read} href={s.href} tabIndex={i === active ? 0 : -1}>
                        {s.cta}
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
              {slides.length > 1 && (
                <div className={styles.dots} role="tablist" aria-label="Choose a highlight">
                  {slides.map((s, i) => (
                    <button
                      key={s.kind + s.href}
                      type="button"
                      role="tab"
                      aria-selected={i === active}
                      aria-label={s.eyebrow}
                      className={`${styles.dot} ${i === active ? styles.dotOn : ''}`}
                      onClick={() => go(i)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
        {stats}
      </div>
    </header>
  )
}
