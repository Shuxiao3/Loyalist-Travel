import type { CollectionConfig } from 'payload'

import { LOUNGE_ACCESS, LOUNGE_COMMENT_MAX, LOUNGE_FACTORS, LOUNGE_WORTH_IT } from '../lib/stayOptions'

// A reader's rating of one lounge, submitted from the lounge page. Separate
// from reader stays: a lounge can be rated without reporting a hotel stay.
// Pending until approved; aggregated in src/lib/lounges.ts.
export const LoungeRatings: CollectionConfig = {
  slug: 'lounge-ratings',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['lounge', 'reader', 'statusHeld', 'overall', 'status', 'createdAt'],
    group: 'Reader data',
    description: 'Approve or reject here. Only approved ratings count.',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'lounge', type: 'relationship', relationTo: 'lounges', required: true, index: true },
        { name: 'statusHeld', type: 'relationship', relationTo: 'status-levels', required: true },
        { name: 'stayYear', type: 'number', required: true, min: 2015, max: 2100 },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'access', type: 'select', required: true, options: LOUNGE_ACCESS },
        { name: 'worthIt', type: 'select', options: LOUNGE_WORTH_IT, label: 'Worth a club room?' },
      ],
    },
    {
      type: 'row',
      fields: LOUNGE_FACTORS.map((f) => ({ name: f.name, label: f.label, type: 'number' as const, min: 1, max: 5, admin: { description: '1 to 5.' } })),
    },
    { name: 'comment', type: 'textarea', maxLength: LOUNGE_COMMENT_MAX, admin: { description: 'Shown on the lounge page once approved. Read it first.' } },
    { name: 'reader', type: 'relationship', relationTo: 'readers', index: true, admin: { position: 'sidebar', description: 'Set when submitted while signed in; names the rating.' } },
    { name: 'submitterHash', type: 'text', index: true, admin: { position: 'sidebar', readOnly: true, description: 'Hashed network address. Never shown.' } },
  ],
}
