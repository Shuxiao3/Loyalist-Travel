import Link from 'next/link'

import { score, shortMonthYear } from '@/lib/format'

import styles from './BrowseSide.module.css'

// The side column of the hotel browsing pages (mockups: hotels.html, destination.html,
// brand.html): small sections under a navy rule, then the "Add your stay" box. Beside the list
// on desktop; two columns at 960px and below; under the list on phones.

export function BrowseSide({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <aside className={styles.side} aria-label={label}>
      {children}
    </aside>
  )
}

function Head({ id, title, link, aside }: { id: string; title: string; link?: { href: string; label: string }; aside?: string }) {
  return (
    <div className="mod-head">
      <h2 id={id}>{title}</h2>
      {link ? <Link href={link.href}>{link.label}</Link> : aside ? <span className="aside">{aside}</span> : null}
    </div>
  )
}

// A table of places with a figure each (the Hotels list only: the one page that shows counts)
export function SideCounts({ id, title, aside, rows }: { id: string; title: string; aside: string; rows: { href: string; name: string; sub?: string | null; n: string; on?: boolean }[] }) {
  if (rows.length === 0) return null
  return (
    <section className="mod" aria-labelledby={id}>
      <Head id={id} title={title} aside={aside} />
      <table className={`table ${styles.sideTable}`}>
        <tbody>
          {rows.map((r) => (
            <tr key={r.href}>
              <th scope="row">
                <Link href={r.href} aria-current={r.on ? 'true' : undefined}>
                  {r.name}
                </Link>
                {r.sub && (
                  <>
                    {' '}
                    <span className="sub">{r.sub}</span>
                  </>
                )}
              </th>
              <td className="r">
                <span className="n">{r.n}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

// A plain list of links, each with an optional muted line under it
export function SideLinks({ id, title, link, rows }: { id: string; title: string; link?: { href: string; label: string }; rows: { href: string; name: string; meta?: string | null }[] }) {
  if (rows.length === 0) return null
  return (
    <section className="mod" aria-labelledby={id}>
      <Head id={id} title={title} link={link} />
      <ul className={styles.sideList}>
        {rows.map((r) => (
          <li key={r.href}>
            <Link className="hn" href={r.href}>
              {r.name}
            </Link>
            {r.meta && <p className={styles.slMeta}>{r.meta}</p>}
          </li>
        ))}
      </ul>
    </section>
  )
}

export type SideReview = { slug: string; title: string; score: number | null; stayDate?: string | null; verdict?: string | null; place?: string | null }

// The site's own reviews among these hotels, newest first, as the kit's review rows
export function SideReviews({ id, title, reviews }: { id: string; title: string; reviews: SideReview[] }) {
  if (reviews.length === 0) return null
  return (
    <section className="mod" aria-labelledby={id}>
      <Head id={id} title={title} link={{ href: '/reviews', label: 'All reviews' }} />
      <ol className={`rev-list ${styles.revList}`}>
        {reviews.map((r) => {
          const href = `/reviews/${r.slug}`
          const s = score(r.score)
          const stayed = shortMonthYear(r.stayDate)
          const meta = [r.place, stayed ? `Stayed ${stayed}` : null].filter(Boolean).join(' · ')
          return (
            <li key={r.slug}>
              <Link className="score" href={href} aria-label={`Score ${s} out of 100`}>
                <b>{s}</b>
                <span>of 100</span>
              </Link>
              <div>
                <h3>
                  <Link href={href}>{r.title}</Link>
                </h3>
                {meta && <p className="meta">{meta}</p>}
                {r.verdict && <p className="verdict">{r.verdict}</p>}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

// The box every browsing page ends with; its text and button are the kit's
export function StayBox({ id, title }: { id: string; title: string }) {
  return (
    <section className="box" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <p>Two minutes, dropdowns only. Your upgrade outcome joins the data for that property, and the upgrade odds update for everyone. No name, no email.</p>
      <Link className={`btn ${styles.boxBtn}`} href="/submit-a-stay">
        Add your stay
      </Link>
    </section>
  )
}
