import path from 'path'
import { fileURLToPath } from 'url'

import { postgresAdapter } from '@payloadcms/db-postgres'
import { EXPERIMENTAL_TableFeature, lexicalEditor, UploadFeature } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'
import sharp from 'sharp'

import { Amenities } from './collections/Amenities'
import { Seo } from './globals/Seo'
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
import { SourcedReports } from './collections/SourcedReports'
import { Regions } from './collections/Regions'
import { Reviews } from './collections/Reviews'
import { RubricVersions } from './collections/RubricVersions'
import { StatusLevels } from './collections/StatusLevels'
import { Users } from './collections/Users'
import { blobCheck } from './endpoints/blobCheck'
import { blobStorage } from './lib/blobStorage'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const serverURL =
  process.env.NEXT_PUBLIC_SERVER_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000')

// Every address the admin can be opened at. Payload only honours the login
// cookie on a save when the browser's origin is in this list, so the custom
// domain, the www variant and Vercel's own URLs all need to be here.
const origins = Array.from(
  new Set(
    [
      serverURL,
      'https://loyalisttravel.com',
      'https://www.loyalisttravel.com',
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
      process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : '',
      process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ].filter(Boolean),
  ),
)

export default buildConfig({
  serverURL,
  csrf: origins,
  cors: origins,
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
    SourcedReports,
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
  globals: [Seo],
  // The default feature set, with two changes for long-form articles: an
  // inline photo carries its own caption (the credit comes from the media
  // item), and tables are available for the comparison grids.
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => [
      ...defaultFeatures.filter((feature) => feature.key !== 'upload'),
      UploadFeature({
        collections: {
          media: {
            fields: [
              {
                name: 'caption',
                type: 'text',
                admin: { description: 'Shown under the photo. The credit comes from the media item.' },
              },
            ],
          },
        },
      }),
      EXPERIMENTAL_TableFeature(),
    ],
  }),
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
  // Uploads live in Vercel Blob wherever the deployment has Blob credentials
  // (on Vercel: BLOB_STORE_ID, or a BLOB_READ_WRITE_TOKEN); on a local
  // machine or a GitHub runner without them, the media folder on disk.
  plugins: [blobStorage({ collections: ['media'] })],
  // POST /api/blob-check, the "Check Blob storage" workflow's round trip
  endpoints: [blobCheck],
})
