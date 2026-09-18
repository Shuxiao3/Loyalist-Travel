import Link from 'next/link'

import styles from './LandingHero.module.css'

export type HeroStat = { n: string; l: string }

export type HeroCard = {
  eyebrow: string
  image?: string | null
  meta: string[]
  title: string
  text?: string | null
  figure?: { value: string; label: string } | null
  cta: string
  href: string
}

// The hero on a category landing page: eyebrow, headline and a sentence on
// the left, one featured card on the right, a row of live figures under
// both. `photo`, when given, sits behind the navy on the card side.
export function LandingHero({ eyebrow, title, text, stats, card, photo, children }: { eyebrow: string; title: React.ReactNode; text: string; stats: HeroStat[]; card?: HeroCard | null; photo?: string | null; children?: React.ReactNode }) {
  return (
    <header className={`hero ${styles.hero}`} style={photo ? ({ '--hero-photo': `url(${photo})` } as React.CSSProperties) : undefined}>
      <div className={`wrap ${styles.wrap}`}>
        <div className={`${styles.grid} ${card ? '' : styles.noCard}`}>
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h1 className={styles.h1}>{title}</h1>
            <p className="sub">{text}</p>
            {children}
          </div>
          {card && (
            <Link className={styles.card} href={card.href}>
              <span className="eyebrow">{card.eyebrow}</span>
              {card.image !== null && <span className={styles.img} role="img" aria-label={card.title} style={card.image ? { backgroundImage: `url(${card.image}), var(--img-a)` } : undefined} />}
              {card.meta.length > 0 && (
                <span className={styles.meta}>
                  {card.meta.map((m, j) => (
                    <span key={m}>
                      {j > 0 && <span className="dot">·</span>}
                      {m}
                    </span>
                  ))}
                </span>
              )}
              <span className={styles.title}>{card.title}</span>
              {card.text && <span className={styles.text}>{card.text}</span>}
              <span className={styles.foot}>
                {card.figure ? (
                  <span className={/^[\d.,]+%?$/.test(card.figure.value) ? styles.figure : styles.figureText}>
                    {card.figure.value}
                    <small>{card.figure.label}</small>
                  </span>
                ) : (
                  <span />
                )}
                <span className={styles.read}>{card.cta}</span>
              </span>
            </Link>
          )}
        </div>
        {stats.length > 0 && (
          <div className={styles.stats} aria-label="At a glance">
            {stats.map((s) => (
              <div className={styles.stat} key={s.l}>
                <div className={styles.statN}>{s.n}</div>
                <div className={styles.statL}>{s.l}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </header>
  )
}
