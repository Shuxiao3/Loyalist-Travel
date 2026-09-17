import Link from 'next/link'

// The full-width navy band with a ghost button, from the review mockup.
export function Band({ eyebrow, title, text, cta, href }: { eyebrow: string; title: string; text: string; cta: string; href: string }) {
  return (
    <section className="band" aria-labelledby="band-h">
      <div className="wrap">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2 id="band-h">{title}</h2>
          <p>{text}</p>
        </div>
        <Link className="ghost" href={href}>
          {cta}
          <Arrow />
        </Link>
      </div>
    </section>
  )
}

export function Arrow({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <line x1="4" y1="12" x2="19" y2="12" />
      <polyline points="13,6 19,12 13,18" />
    </svg>
  )
}
