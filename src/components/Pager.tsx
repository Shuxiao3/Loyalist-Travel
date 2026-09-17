import Link from 'next/link'

// Server-rendered pagination that preserves the current filters.
export function Pager({
  page,
  totalPages,
  totalDocs,
  perPage,
  href,
}: {
  page: number
  totalPages: number
  totalDocs: number
  perPage: number
  href: (page: number) => string
}) {
  if (totalDocs === 0) return null
  const from = (page - 1) * perPage + 1
  const to = Math.min(page * perPage, totalDocs)
  return (
    <nav className="pager" aria-label="Pagination">
      <span>
        {from.toLocaleString('en-US')}–{to.toLocaleString('en-US')} of {totalDocs.toLocaleString('en-US')}
      </span>
      <span className="links">
        {page > 1 && (
          <Link className="more" href={href(page - 1)}>
            Previous
          </Link>
        )}
        {page < totalPages && (
          <Link className="more" href={href(page + 1)}>
            Next
          </Link>
        )}
      </span>
    </nav>
  )
}
