import type { Metadata } from 'next'

// The site's public address. Vercel sets VERCEL_PROJECT_PRODUCTION_URL to the
// project's primary domain, so this follows loyalisttravel.com automatically
// once that domain is made primary. NEXT_PUBLIC_SITE_URL overrides it.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')

export const DEFAULT_TITLE = 'Loyalist Travel | What elite status gets you at hotels and lounges'
export const DEFAULT_DESCRIPTION = 'Real upgrade odds at every hotel, reported by elite members. Club lounges rated by the people who sat in them. Every review scored on the same 100-point rubric.'

// The generated social card, used wherever a page has no photo of its own.
export const DEFAULT_IMAGE = '/opengraph-image'

// Title, description, canonical and social preview for a page, in one call.
// `path` is the page's path from the site root; `image` replaces the generated
// social card. A page that sets openGraph replaces the layout's wholesale, so
// the default card is set here rather than inherited.
export function pageMeta({ title, description, path, image, type = 'website' }: { title: string; description?: string | null; path: string; image?: string | null; type?: 'website' | 'article' }): Metadata {
  const desc = description?.trim() || DEFAULT_DESCRIPTION
  return {
    title,
    description: desc,
    alternates: { canonical: path },
    openGraph: {
      title,
      description: desc,
      url: path,
      type,
      siteName: 'Loyalist Travel',
      locale: 'en_US',
      images: [{ url: image || DEFAULT_IMAGE }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: desc,
      images: [image || DEFAULT_IMAGE],
    },
  }
}
