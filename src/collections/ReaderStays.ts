import type { CollectionConfig, PayloadRequest } from 'payload'

// Reader submissions: dropdown-only, no typing (decision log, content model
// 4). Hotel and program are prefilled from a hotel page. Aggregates from
// approved stays are computed in src/lib/readerData.ts and shown publicly
// only once a hotel has five or more approved stays.

export const UPGRADE_OUTCOMES = [
  { label: 'No', value: 'none' },
  { label: 'Yes', value: 'yes' },
  { label: 'Used a suite upgrade award', value: 'award' },
]

export const UPGRADE_TYPES = [
  { label: 'Higher floor', value: 'floor' },
  { label: 'Better view', value: 'view' },
  { label: 'Higher room category', value: 'category' },
  { label: 'Suite', value: 'suite' },
]

export const SUITE_TYPES = [
  { label: 'Junior suite', value: 'junior' },
  { label: 'One-bedroom suite', value: 'one-bedroom' },
  { label: 'Two-bedroom suite', value: 'two-bedroom' },
  { label: 'Specialty suite', value: 'specialty' },
]

export const UPGRADE_HOW = [
  { label: 'Offered without asking', value: 'proactive' },
  { label: 'Given when I asked', value: 'asked' },
]

export const BREAKFAST_OUTCOMES = [
  { label: 'Full: buffet and à la carte', value: 'full' },
  { label: 'Buffet only', value: 'buffet' },
  { label: 'À la carte only', value: 'a-la-carte' },
  { label: 'Restaurant or F&B credit', value: 'credit' },
  { label: 'Not honoured', value: 'not-honoured' },
  { label: 'Not eligible', value: 'not-eligible' },
]

export const ALA_CARTE_CAP = [
  { label: 'Uncapped', value: 'uncapped' },
  { label: 'Capped', value: 'capped' },
]

export const LOUNGE_ACCESS = [
  { label: 'Given', value: 'given' },
  { label: 'Declined', value: 'declined' },
  { label: 'Did not use it', value: 'not-used' },
]

// The five things a reader scores about a lounge, each 1 to 5. Overall is
// its own score, not an average of the other four.
export const LOUNGE_FACTORS = [
  { name: 'food', label: 'Food' },
  { name: 'drink', label: 'Drink' },
  { name: 'space', label: 'Space and ambiance' },
  { name: 'service', label: 'Service' },
  { name: 'overall', label: 'Overall' },
] as const
export type LoungeFactor = (typeof LOUNGE_FACTORS)[number]['name']
export const LOUNGE_COMMENT_MAX = 600

export const LOUNGE_WORTH_IT = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
]

export const LATE_CHECKOUT_OUTCOMES = [
  { label: 'Honoured', value: 'honoured' },
  { label: 'Declined', value: 'declined' },
  { label: 'Not requested', value: 'not-requested' },
]

// After any change or delete, recount the hotel's approved stays.
async function recount(req: PayloadRequest, hotelId: number | null | undefined) {
  if (!hotelId) return
  // `req` carries the open transaction; without it these calls wait on it forever
  const n = await req.payload.count({ collection: 'reader-stays', where: { and: [{ hotel: { equals: hotelId } }, { status: { equals: 'approved' } }] }, overrideAccess: true, req })
  await req.payload.update({ collection: 'hotels', id: hotelId, data: { stayCount: n.totalDocs }, overrideAccess: true, depth: 0, req })
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
      name: 'lounge',
      type: 'group',
      admin: { description: 'Asked only where the hotel has a lounge on record.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'lounge', type: 'relationship', relationTo: 'lounges', index: true },
            { name: 'access', type: 'select', options: LOUNGE_ACCESS },
            { name: 'worthIt', type: 'select', options: LOUNGE_WORTH_IT, label: 'Worth a club room?' },
          ],
        },
        {
          type: 'row',
          fields: LOUNGE_FACTORS.map((f) => ({ name: f.name, label: f.label, type: 'number' as const, min: 1, max: 5, admin: { description: '1 to 5.' } })),
        },
        {
          name: 'comment',
          type: 'textarea',
          maxLength: LOUNGE_COMMENT_MAX,
          admin: { description: 'Shown on the lounge page once the stay is approved. Read it first.' },
        },
      ],
    },
    {
      name: 'submitterHash',
      type: 'text',
      index: true,
      admin: { position: 'sidebar', readOnly: true, description: 'Hashed network address, for spotting repeat submissions. Never shown.' },
    },
  ],
}
