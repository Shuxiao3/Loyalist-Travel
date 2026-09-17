import type { CollectionConfig } from 'payload'

// Reader submissions: dropdown-only, no typing (decision log, content model
// 4). Hotel and program are prefilled from a hotel page. Aggregates from
// approved stays are computed in src/lib/readerData.ts and shown publicly
// only once a hotel has five or more approved stays.

export const UPGRADE_OUTCOMES = [
  { label: 'No upgrade', value: 'none' },
  { label: 'Room category upgrade', value: 'room-category' },
  { label: 'Suite upgrade', value: 'suite' },
  { label: 'Used a suite award', value: 'used-award' },
]

export const BREAKFAST_OUTCOMES = [
  { label: 'Full breakfast, as printed', value: 'full' },
  { label: 'Capped or limited', value: 'capped' },
  { label: 'Restaurant credit instead', value: 'restaurant-credit' },
  { label: 'Not honoured', value: 'none' },
  { label: 'Not eligible', value: 'not-eligible' },
]

export const LATE_CHECKOUT_OUTCOMES = [
  { label: 'Honoured', value: 'honoured' },
  { label: 'Declined', value: 'declined' },
  { label: 'Not requested', value: 'not-requested' },
]

export const ReaderStays: CollectionConfig = {
  slug: 'reader-stays',
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
        { name: 'breakfast', type: 'select', required: true, options: BREAKFAST_OUTCOMES },
        { name: 'lateCheckout', type: 'select', required: true, options: LATE_CHECKOUT_OUTCOMES },
      ],
    },
    {
      name: 'loungeRating',
      type: 'number',
      min: 1,
      max: 10,
      admin: { description: 'Asked only where the hotel has a lounge on record. Arrives with the Lounges collection.' },
    },
    {
      name: 'submitterHash',
      type: 'text',
      index: true,
      admin: { position: 'sidebar', readOnly: true, description: 'Hashed network address, for spotting repeat submissions. Never shown.' },
    },
  ],
}
