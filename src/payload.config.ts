import path from 'path'
import { fileURLToPath } from 'url'

import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'
import sharp from 'sharp'

import { Media } from './collections/Media'
import { Users } from './collections/Users'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const serverURL =
  process.env.NEXT_PUBLIC_SERVER_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000')

export default buildConfig({
  serverURL,
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  // Milestone 0 ships an empty schema: only the auth collection and Media.
  // Hotels, Reviews, Rubric Versions and the rest arrive with Milestone 1.
  collections: [Users, Media],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  sharp,
  plugins: [],
})
