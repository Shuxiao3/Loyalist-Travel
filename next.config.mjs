import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // /guides is the Guides list now; the old guide addresses still lead to the articles
      { source: '/guides/:slug', destination: '/articles/:slug', permanent: true },
      // no programs landing page; the header menu lists the four
      { source: '/programs', destination: '/#prog-h', permanent: false },
    ]
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
