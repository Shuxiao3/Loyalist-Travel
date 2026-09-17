import type { CollectionConfig } from 'payload'

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

export const LOUNGE_WORTH_IT = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
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
            { name: 'rating', type: 'number', min: 1, max: 10, admin: { description: '1 to 10.' } },
            { name: 'worthIt', type: 'select', options: LOUNGE_WORTH_IT, label: 'Worth a club room?' },
          ],
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
