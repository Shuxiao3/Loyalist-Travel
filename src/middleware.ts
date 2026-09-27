import { type NextRequest, NextResponse } from 'next/server'

// Payload only honours the login cookie on a write when the browser's Origin
// is on its CSRF allowlist, which is a fixed list of hostnames. A request
// whose Origin matches the host it was sent to is same-origin and cannot be
// a cross-site forgery, so present it to Payload as coming from the primary
// address. This keeps the admin working from any alias of the site.
const serverURL =
  process.env.NEXT_PUBLIC_SERVER_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')

export function middleware(req: NextRequest) {
  const origin = req.headers.get('origin')
  if (!origin) return NextResponse.next()
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  let originHost = ''
  try {
    originHost = new URL(origin).host
  } catch {
    return NextResponse.next()
  }
  if (!host || originHost !== host) return NextResponse.next()
  const headers = new Headers(req.headers)
  headers.set('origin', serverURL)
  return NextResponse.next({ request: { headers } })
}

export const config = { matcher: ['/api/:path*'] }
