import Link from 'next/link'

import styles from './ReferenceHero.module.css'

// Shared hero for brand, destination and program pages.
export function ReferenceHero({
  eyebrow,
  title,
  sub,
  crumbs,
  stats,
}: {
  eyebrow: string
  title: string
  sub?: string | null
  crumbs: { href: string; label: string }[]
  stats: { n: string; l: string }[]
}) {
  return (
    <header className={`hero ${styles.hero}`}>
      <div className="wrap">
        <ol className="crumbs" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <li key={c.href} className={styles.crumb}>
              {i > 0 && <span aria-hidden="true">/ </span>}
              <Link href={c.href}>{c.label}</Link>
            </li>
          ))}
        </ol>
        <span className="eyebrow">{eyebrow}</span>
        <h1 className={styles.h1}>{title}</h1>
        {sub && <p className={`sub ${styles.sub}`}>{sub}</p>}
        {stats.length > 0 && (
          <div className={styles.stats}>
            {stats.map((s) => (
              <div className={styles.stat} key={s.l}>
                <div className={styles.n}>{s.n}</div>
                <div className={styles.l}>{s.l}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </header>
  )
}
