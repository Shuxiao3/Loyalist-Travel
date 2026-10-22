import Link from 'next/link'

import { NAV_LINKS, PROGRAM_LINKS, SITE } from '@/lib/site'

import { AccountLink } from './AccountLink'

// The site footer (kit: .site-foot): brand and the sections, ending "Add your stay" and the
// account link, then the four programs and the rubric line.
export function SiteFooter() {
  return (
    <footer className="site-foot">
      <div className="wrap">
        <div className="foot-row">
          <Link className="brand" href="/">
            <img src="/icon.svg" alt="" width={24} height={24} />
            Loyalist Travel
          </Link>
          <nav className="foot-nav" aria-label="Footer">
            {NAV_LINKS.filter((l) => l.menu !== 'programs').map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
            <Link href="/submit-a-stay">Add your stay</Link>
            <AccountLink place="footer" />
          </nav>
        </div>
        <div className="foot-row-2">
          <nav className="foot-progs" aria-label="Programs">
            {PROGRAM_LINKS.map((p) => (
              <Link key={p.href} href={p.href}>
                {p.label}
              </Link>
            ))}
          </nav>
          <p className="foot-small">{SITE.rubricNote}</p>
        </div>
      </div>
    </footer>
  )
}
