'use client'

import { useEffect, useRef } from 'react'

import styles from './ReadingProgress.module.css'

// A thin bar along the top of the viewport that fills as the reader moves
// through the page's article. Sits above the header so it stays in view
// when the header slides away.
export function ReadingProgress({ target = 'main article' }: { target?: string }) {
  const bar = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = document.querySelector<HTMLElement>(target)
    const fill = bar.current
    if (!el || !fill) return
    let raf = 0
    const update = () => {
      raf = 0
      const rect = el.getBoundingClientRect()
      const top = rect.top + window.scrollY
      const span = Math.max(1, el.offsetHeight - window.innerHeight)
      const p = Math.min(1, Math.max(0, (window.scrollY - top) / span))
      fill.style.transform = `scaleX(${p})`
      fill.parentElement?.setAttribute('aria-valuenow', String(Math.round(p * 100)))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [target])

  return (
    <div className={styles.track} role="progressbar" aria-label="Reading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}>
      <div className={styles.fill} ref={bar} />
    </div>
  )
}
