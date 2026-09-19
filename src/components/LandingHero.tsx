import Link from 'next/link'

import styles from './LandingHero.module.css'

export type HeroCard = {
  eyebrow: string
  image?: string | null
  meta: string[]
  title: string
  figure?: { value: string; label: string } | null
  cta: string
  href: string
}

// The hero on a category landing page: eyebrow, headline and a sentence on
// the left, one compact landscape card on the right. `photo`, when given,
// sits behind the navy on the card side; with no card it fades across the
// whole hero instead.

// A hotel photograph for landing heroes that have nothing of their own.
export const HERO_FALLBACK_PHOTO = '/images/hotels/hyatt-centric-downtown-denver.jpg'
export function LandingHero({ eyebrow, title, text, card, aside, photo, children }: { eyebrow: string; title: React.ReactNode; text: string; card?: HeroCard | null; aside?: React.ReactNode; photo?: string | null; children?: React.ReactNode }) {
  return (
    <header className={`hero ${styles.hero} ${!card && !aside && photo ? styles.photoWide : ''}`} style={photo ? ({ '--hero-photo': `url(${photo})` } as React.CSSProperties) : undefined}>
      <div className={`wrap ${styles.wrap}`}>
        <div className={`${styles.grid} ${card || aside ? '' : styles.noCard}`}>
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h1 className={styles.h1}>{title}</h1>
            <p className="sub">{text}</p>
            {children}
          </div>
          {aside}
          {card && (
            <Link className={`${styles.card} ${card.image === null ? styles.noImg : ''}`} href={card.href}>
              {card.image !== null && <span className={styles.img} role="img" aria-label={card.title} style={card.image ? { backgroundImage: `url(${card.image}), var(--img-a)` } : undefined} />}
              <span className={styles.body}>
                <span className="eyebrow">{card.eyebrow}</span>
                <span className={styles.title}>{card.title}</span>
                {card.meta.length > 0 && <span className={styles.meta}>{card.meta.join(' · ')}</span>}
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
              </span>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
