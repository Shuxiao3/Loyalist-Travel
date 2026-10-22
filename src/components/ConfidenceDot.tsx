'use client'

import { useEffect, useId, useRef, useState } from 'react'

import { CONFIDENCE_NOTE, CONFIDENCE_TIP, type Recency, RECENCY_LABEL } from '@/lib/recency'

import styles from './ConfidenceDot.module.css'

// The small colored dot: green high, amber medium, red low. Readable on navy and on white.
// With `label`, screen readers hear it ("Confidence: medium"); without, it is decoration.
export function Dot({ level, label }: { level: Recency; label?: string }) {
  return (
    <>
      <i className={`${styles.dot} ${styles[level]}`} aria-hidden="true" title={label} />
      {label && <span className="sr-only">{label}</span>}
    </>
  )
}

// "Confidence: medium" after its dot. Hover, keyboard focus or a tap shows what the level means
// and what raises it; a second tap, Esc or a tap elsewhere hides it. `align` is the edge the
// note lines up with: "end" when the label sits at the right of its row.
export function ConfidenceDot({ level, align = 'start', className }: { level: Recency; align?: 'start' | 'end'; className?: string }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLSpanElement>(null)
  const tipId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!(e.target instanceof Node) || !box.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // inside the breakdown window, Esc closes the note first, not the window
      e.preventDefault()
      setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span ref={box} className={`${styles.conf} ${align === 'end' ? styles.end : ''} ${open ? styles.open : ''} ${className ?? ''}`}>
      <button type="button" className={styles.trigger} aria-expanded={open} aria-describedby={tipId} onClick={() => setOpen((o) => !o)}>
        <i className={`${styles.dot} ${styles[level]}`} aria-hidden="true" />
        <span>
          Confidence: <b>{RECENCY_LABEL[level].toLowerCase()}</b>
        </span>
      </button>
      <span className={styles.tip} role="tooltip" id={tipId}>
        {CONFIDENCE_NOTE[level]} {CONFIDENCE_TIP}
      </span>
    </span>
  )
}
