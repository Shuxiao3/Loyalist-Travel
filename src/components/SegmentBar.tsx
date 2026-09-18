'use client'

import { useState } from 'react'

import styles from './SegmentBar.module.css'

// A 1-to-5 score picker: five segments that fill from the left up to the
// one clicked. Behaves as a radio group for keyboards and screen readers.
// The value travels with the form through a hidden input.
export function SegmentBar({ name, label, value, onChange }: { name: string; label: string; value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      onChange(Math.min(5, (value || 0) + 1))
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      onChange(Math.max(1, (value || 1) - 1))
    } else if (e.key >= '1' && e.key <= '5') {
      onChange(Number(e.key))
    }
  }

  return (
    <div className={styles.field}>
      <div className={styles.head}>
        <span className="label" id={`${name}-l`}>
          {label}
        </span>
        <span className={styles.value} aria-hidden="true">
          {value ? `${value} / 5` : '–'}
        </span>
      </div>
      <input type="hidden" name={name} value={value || ''} />
      <div className={styles.bar} role="radiogroup" aria-labelledby={`${name}-l`} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} of 5`}
            tabIndex={value === n || (!value && n === 1) ? 0 : -1}
            className={`${styles.seg} ${n <= shown ? styles.on : ''} ${hover && n <= hover && n > value ? styles.preview : ''}`}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onKeyDown={onKey}
          />
        ))}
      </div>
    </div>
  )
}
