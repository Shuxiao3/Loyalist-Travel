import type { Metadata, Viewport } from 'next'
import { Newsreader, Source_Sans_3 } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import React from 'react'

// The site's one shared stylesheet; page-only rules live in CSS modules next to each page.
import '@/styles/kit.css'

import { SiteFooter } from '@/components/SiteFooter'
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, getSeo, SITE_URL } from '@/lib/seo'
import { SiteHeader } from '@/components/SiteHeader'

// Google Fonts, self-hosted via next/font. The variables feed --serif and --sans in
// src/styles/kit.css: Newsreader for headlines, Source Sans 3 for everything else.
const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-newsreader',
  display: 'swap',
})

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-source-sans',
  display: 'swap',
})

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeo()
  const title = seo?.site?.title?.trim() || DEFAULT_TITLE
  const description = seo?.site?.description?.trim() || DEFAULT_DESCRIPTION
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: title,
      template: '%s | Loyalist Travel',
    },
    description,
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      siteName: 'Loyalist Travel',
      locale: 'en_US',
      url: '/',
      title,
      description,
    },
    twitter: { card: 'summary_large_image' },
    robots: { index: true, follow: true },
  }
}

// The palette is fixed in both colour schemes; never invert for dark mode.
export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#12203a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${newsreader.variable} ${sourceSans.variable}`}>
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
        <Analytics />
      </body>
    </html>
  )
}
