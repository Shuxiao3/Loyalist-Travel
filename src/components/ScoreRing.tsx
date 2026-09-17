import styles from './ScoreRing.module.css'

// A ring that fills clockwise from the top by value/max. Gold on the dark
// gold border colour, for navy surfaces.
export function ScoreRing({ value, max, size = 44, stroke = 3, label }: { value: number | null | undefined; max: number; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const share = value != null && max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  return (
    <svg className={styles.ring} width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label ?? `${value ?? 0} of ${max}`}>
      <circle className={styles.track} cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
      <circle className={styles.fill} cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={c * (1 - share)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  )
}
