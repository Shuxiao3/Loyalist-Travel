import { CONFIDENCE_NOTE, type Recency, RECENCY_LABEL } from '@/lib/recency'

import styles from './ConfidenceDot.module.css'

// A coloured dot with its word: green high, yellow medium, red low. With
// `tip`, a tooltip opens on hover or focus explaining what moves it.
export function ConfidenceDot({ level, label, note, tip, className }: { level: Recency; label?: string; note?: string; tip?: string; className?: string }) {
  if (tip) {
    return (
      <span className={`${styles.dot} ${styles[level]} ${styles.hasTip} ${className ?? ''}`} tabIndex={0}>
        <i aria-hidden="true" />
        {label ?? RECENCY_LABEL[level]}
        <span className={styles.tip} role="tooltip">
          {tip}
        </span>
      </span>
    )
  }
  return (
    <span className={`${styles.dot} ${styles[level]} ${className ?? ''}`} title={note ?? CONFIDENCE_NOTE[level]}>
      <i aria-hidden="true" />
      {label ?? RECENCY_LABEL[level]}
    </span>
  )
}
