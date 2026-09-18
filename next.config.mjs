import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [{ source: '/guides', destination: '/articles', permanent: true }, { source: '/guides/:slug', destination: '/articles/:slug', permanent: true }]
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
