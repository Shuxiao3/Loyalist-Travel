'use client'

import { type ReactNode, useEffect, useRef } from 'react'

import styles from './ArticleBody.module.css'

// The sideways scroller around an article table. Once mounted it marks the
// wrapper with data-left / data-right while columns are hidden on that side,
// so the stylesheet can fade that edge and shade the fixed first column; it
// also records the first column's width so the left fade starts past it, and
// is a tab stop only while columns are hidden, so the keyboard can reach them.
// The server render carries none of this, so hydration matches. wide marks a
// table that needs more room than a phone column; label names the table.
export function TableScroll({ cols, wide, label, children }: { cols: number; wide?: boolean; label: string; children: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const outer = wrap.current
    const el = scroller.current
    if (!outer || !el) return
    let raf = 0
    const update = () => {
      raf = 0
      const left = el.scrollLeft > 1
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
      el.tabIndex = el.scrollWidth > el.clientWidth + 1 ? 0 : -1
      if (left) outer.setAttribute('data-left', '')
      else outer.removeAttribute('data-left')
      if (right) outer.setAttribute('data-right', '')
      else outer.removeAttribute('data-right')
      // the left fade starts at the first column's edge, snapped to the
      // device pixel grid so the two meet without an anti-aliased seam
      const first = el.querySelector<HTMLElement>('tr > :first-child')
      const dpr = window.devicePixelRatio || 1
      const origin = outer.getBoundingClientRect().left
      const w = first ? Math.floor(first.getBoundingClientRect().right * dpr) / dpr - origin : 0
      outer.style.setProperty('--sticky-w', `${Math.max(0, w)}px`)
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    el.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    // the scroller changes width with the column; the table changes width
    // when its fonts arrive
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null
    ro?.observe(el)
    if (el.firstElementChild) ro?.observe(el.firstElementChild)
    return () => {
      el.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      ro?.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div className={styles.tableWrap} data-cols={cols} data-wide={wide ? '' : undefined} ref={wrap}>
      <div className={styles.tableScroll} role="region" aria-label={label} ref={scroller}>
        {children}
      </div>
    </div>
  )
}
