import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/guides', destination: '/articles', permanent: true },
      { source: '/guides/:slug', destination: '/articles/:slug', permanent: true },
      // no programs landing page; the header menu lists the four
      { source: '/programs', destination: '/#prog-h', permanent: false },
    ]
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
