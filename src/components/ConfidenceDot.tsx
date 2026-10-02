import { CONFIDENCE_NOTE, type Recency, RECENCY_LABEL } from '@/lib/recency'

import styles from './ConfidenceDot.module.css'

// A coloured dot with its word: green high, yellow medium, red low.
export function ConfidenceDot({ level, label, note, className }: { level: Recency; label?: string; note?: string; className?: string }) {
  return (
    <span className={`${styles.dot} ${styles[level]} ${className ?? ''}`} title={note ?? CONFIDENCE_NOTE[level]}>
      <i aria-hidden="true" />
      {label ?? RECENCY_LABEL[level]}
    </span>
  )
}
