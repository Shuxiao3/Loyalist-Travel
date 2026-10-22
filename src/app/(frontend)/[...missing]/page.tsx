import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

// Any address no other route matches. The app has two root layouts (the site's and the admin's)
// and so no app-wide 404 of its own: without this route an unknown address got Next's bare
// default page. Here it gets src/app/(frontend)/not-found.tsx, inside the site's header and
// footer, still with a 404 status. Routes with a fixed first segment (/admin, /api, the icons,
// robots.txt, sitemap.xml) and files in public/ always win over a catch-all.
export const metadata: Metadata = { title: 'Page not found' }

export default function Missing() {
  notFound()
}
