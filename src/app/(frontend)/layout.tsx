import type { Metadata, Viewport } from 'next'
import { Lato, Playfair_Display } from 'next/font/google'
import React from 'react'

import '@/styles/tokens.css'
import '@/styles/globals.css'
import '@/styles/patterns.css'

import { SiteFooter } from '@/components/SiteFooter'
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, SITE_URL } from '@/lib/seo'
import { SiteHeader } from '@/components/SiteHeader'

// Google Fonts, self-hosted via next/font. The variables feed --serif and
// --sans in src/styles/tokens.css.
const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-playfair',
  display: 'swap',
})

const lato = Lato({
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  variable: '--font-lato',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: '%s | Loyalist Travel',
  },
  description: DEFAULT_DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Loyalist Travel',
    locale: 'en_US',
    url: '/',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
}

// The palette is fixed in both colour schemes; never invert for dark mode.
export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#0d1b2a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${lato.variable}`}>
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  )
}
