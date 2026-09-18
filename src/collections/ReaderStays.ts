import type { CollectionConfig, PayloadRequest } from 'payload'

// Reader submissions: dropdown-only, no typing (decision log, content model
// 4). Hotel and program are prefilled from a hotel page. Aggregates from
// approved stays are computed in src/lib/readerData.ts and shown publicly
// only once a hotel has five or more approved stays.

export * from '../lib/stayOptions'
import { UPGRADE_OUTCOMES, UPGRADE_TYPES, SUITE_TYPES, UPGRADE_HOW, BREAKFAST_OUTCOMES, ALA_CARTE_CAP, LATE_CHECKOUT_OUTCOMES } from '../lib/stayOptions'

// After any change or delete, recount the hotel's approved stays. Plain SQL
// inside the request's transaction: a document update here would write a
// hotel version from within the stay's own operation, which Payload rejects.
async function recount(req: PayloadRequest, hotelId: number | null | undefined) {
  if (!hotelId) return
  const { sql } = await import('@payloadcms/db-postgres')
  const adapter = req.payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<unknown> }; sessions?: Record<string, { db: { execute: (q: unknown) => Promise<unknown> } }> }
  const db = (req.transactionID && adapter.sessions?.[String(req.transactionID)]?.db) || adapter.drizzle
  await db.execute(sql`update hotels set stay_count = (select count(*) from reader_stays where hotel_id = ${hotelId} and status = 'approved') where id = ${hotelId}`)
  await db.execute(sql`update _hotels_v set version_stay_count = (select stay_count from hotels where id = ${hotelId}) where parent_id = ${hotelId} and id = (select max(id) from _hotels_v where parent_id = ${hotelId})`)
}

const hotelIdOf = (doc: { hotel?: number | { id: number } | null } | undefined) => (doc?.hotel && typeof doc.hotel === 'object' ? doc.hotel.id : (doc?.hotel as number | null | undefined))

export const ReaderStays: CollectionConfig = {
  slug: 'reader-stays',
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        await recount(req, hotelIdOf(doc))
        if (previousDoc && hotelIdOf(previousDoc) !== hotelIdOf(doc)) await recount(req, hotelIdOf(previousDoc))
      },
    ],
    afterDelete: [async ({ doc, req }) => recount(req, hotelIdOf(doc))],
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['hotel', 'statusHeld', 'stayYear', 'upgrade', 'status', 'createdAt'],
    group: 'Reader data',
    listSearchableFields: ['hotel'],
    description: 'Approve or reject submissions here. Only approved stays count.',
  },
  access: {
    // Created through the site's form only (a server action), never the public API.
    create: ({ req }) => Boolean(req.user),
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  defaultSort: '-createdAt',
  fields: [
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      admin: { position: 'sidebar' },
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'hotel', type: 'relationship', relationTo: 'hotels', required: true, index: true },
        { name: 'program', type: 'relationship', relationTo: 'programs', required: true, index: true },
        { name: 'statusHeld', type: 'relationship', relationTo: 'status-levels', required: true, index: true },
      ],
    },
    { name: 'stayYear', type: 'number', required: true, min: 2015, max: 2100 },
    {
      type: 'row',
      fields: [
        { name: 'upgrade', type: 'select', required: true, options: UPGRADE_OUTCOMES },
        { name: 'upgradeType', type: 'select', options: UPGRADE_TYPES, admin: { condition: (data) => data?.upgrade === 'yes' } },
        { name: 'suiteType', type: 'select', options: SUITE_TYPES, admin: { condition: (data) => (data?.upgrade === 'yes' && data?.upgradeType === 'suite') || data?.upgrade === 'award' } },
        { name: 'upgradeHow', type: 'select', options: UPGRADE_HOW, admin: { condition: (data) => data?.upgrade === 'yes' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'breakfast', type: 'select', required: true, options: BREAKFAST_OUTCOMES },
        { name: 'alaCarteCap', type: 'select', options: ALA_CARTE_CAP, admin: { condition: (data) => data?.breakfast === 'full' || data?.breakfast === 'a-la-carte' } },
        { name: 'lateCheckout', type: 'select', required: true, options: LATE_CHECKOUT_OUTCOMES },
      ],
    },
    {
      name: 'reader',
      type: 'relationship',
      relationTo: 'readers',
      index: true,
      admin: { position: 'sidebar', description: 'Set when the stay was submitted while signed in. Shows the display name on the latest-stays list.' },
    },
    {
      name: 'submitterHash',
      type: 'text',
      index: true,
      admin: { position: 'sidebar', readOnly: true, description: 'Hashed network address, for spotting repeat submissions. Never shown.' },
    },
  ],
}
