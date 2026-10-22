import Link from 'next/link'
import { Fragment } from 'react'

// The kit's pagination: plain page numbers with Previous and Next, the current page filled
// navy. No count of the list (only the Hotels list shows one, through its own `count` line).
// Nothing renders for a single page.
export function PageNumbers({ page, totalPages, href, count }: { page: number; totalPages: number; href: (page: number) => string; count?: string }) {
  if (totalPages <= 1) return null
  const shown = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages))
  const pages = [...shown].sort((a, b) => a - b)
  return (
    <nav className="pager" aria-label="Pages">
      {count && <p className="pager-count">{count}</p>}
      <div className="pager-pages">
        {page > 1 ? <Link href={href(page - 1)}>Previous</Link> : <span className="is-disabled">Previous</span>}
        {pages.map((p, i) => (
          <Fragment key={p}>
            {i > 0 && p - pages[i - 1] > 1 && <span className="gap">&hellip;</span>}
            {p === page ? (
              <a className="on" href={href(p)} aria-current="page">
                {p}
              </a>
            ) : (
              <Link href={href(p)}>{p}</Link>
            )}
          </Fragment>
        ))}
        {page < totalPages ? <Link href={href(page + 1)}>Next</Link> : <span className="is-disabled">Next</span>}
      </div>
    </nav>
  )
}
