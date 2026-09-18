import path from 'path'
import { fileURLToPath } from 'url'

import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import { buildConfig } from 'payload'
import sharp from 'sharp'

import { Amenities } from './collections/Amenities'
import { Articles } from './collections/Articles'
import { Brands } from './collections/Brands'
import { Comments } from './collections/Comments'
import { Destinations } from './collections/Destinations'
import { Hotels } from './collections/Hotels'
import { LoungeRatings } from './collections/LoungeRatings'
import { Lounges } from './collections/Lounges'
import { Media } from './collections/Media'
import { Programs } from './collections/Programs'
import { Readers } from './collections/Readers'
import { ReaderStays } from './collections/ReaderStays'
import { Regions } from './collections/Regions'
import { Reviews } from './collections/Reviews'
import { RubricVersions } from './collections/RubricVersions'
import { StatusLevels } from './collections/StatusLevels'
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
  collections: [
    Hotels,
    Reviews,
    Articles,
    ReaderStays,
    Readers,
    Comments,
    Lounges,
    LoungeRatings,
    RubricVersions,
    Programs,
    Brands,
    StatusLevels,
    Destinations,
    Regions,
    Amenities,
    Media,
    Users,
  ],
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
    // Schema changes ship as migrations everywhere, including dev.
    push: false,
  }),
  sharp,
  // Media lives in Vercel Blob wherever BLOB_READ_WRITE_TOKEN is set (Vercel
  // and the import workflow); on a local machine without it, the media
  // folder on disk.
  plugins: process.env.BLOB_READ_WRITE_TOKEN
    ? [vercelBlobStorage({ collections: { media: true }, token: process.env.BLOB_READ_WRITE_TOKEN })]
    : [],
})
