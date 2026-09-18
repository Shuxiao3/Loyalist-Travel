import styles from './ScoreBar.module.css'

// A read-only 1-to-5 bar for showing a score: five segments filled from
// the left, the last one partially for a fractional average. `tone` picks
// the palette for navy panels or the cream page.
export function ScoreBar({ label, value, tone = 'light', count }: { label: string; value: number | null | undefined; tone?: 'light' | 'dark'; count?: string }) {
  const v = value ?? 0
  return (
    <div className={`${styles.row} ${tone === 'dark' ? styles.dark : ''}`}>
      <span className={styles.label}>{label}</span>
      <span className={styles.bar} role="img" aria-label={value != null ? `${label}: ${v.toFixed(1)} of 5` : `${label}: not rated`}>
        {[1, 2, 3, 4, 5].map((n) => {
          const fill = Math.max(0, Math.min(1, v - (n - 1)))
          return (
            <span className={styles.seg} key={n}>
              {fill > 0 && <span className={styles.fill} style={{ width: `${fill * 100}%` }} />}
            </span>
          )
        })}
      </span>
      <span className={styles.n}>
        {value != null ? v.toFixed(1) : '–'}
        {count && <span className={styles.count}>{count}</span>}
      </span>
    </div>
  )
}
