import type { CollectionConfig } from 'payload'

import { publishedOrLoggedIn } from '../access/publishedOrLoggedIn'
import { slugField } from './fields/slug'

// A lounge exists as a record only where a lounge exists, linked to its
// hotel; a hotel can hold more than one (decision log, content model 6).
// Reader ratings come from reader stays and are aggregated in
// src/lib/lounges.ts.

export const LOUNGE_SERVICES = [
  { label: 'Breakfast', value: 'breakfast' },
  { label: 'Afternoon tea', value: 'afternoon-tea' },
  { label: 'Evening cocktails and canapés', value: 'evening' },
  { label: 'All-day snacks and drinks', value: 'all-day' },
]

export const Lounges: CollectionConfig = {
  slug: 'lounges',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'hotel', '_status'],
    group: 'Reader data',
  },
  access: { read: publishedOrLoggedIn },
  versions: { drafts: true },
  fields: [
    { name: 'name', type: 'text', required: true, admin: { description: 'As the hotel calls it, e.g. "Grand Club".' } },
    slugField,
    {
      type: 'row',
      fields: [
        { name: 'hotel', type: 'relationship', relationTo: 'hotels', required: true, index: true },
        { name: 'location', type: 'text', admin: { description: 'e.g. "32nd floor".' } },
      ],
    },
    {
      name: 'access',
      type: 'group',
      admin: { description: 'Who gets in, as printed.' },
      fields: [
        { name: 'tiers', type: 'relationship', relationTo: 'status-levels', hasMany: true, admin: { description: "Tiers of the hotel's program with lounge access." } },
        {
          type: 'row',
          fields: [
            { name: 'clubRooms', type: 'checkbox', defaultValue: true, label: 'Club-room guests' },
            { name: 'paid', type: 'text', label: 'Paid access', admin: { description: 'Leave blank if none, else the price, e.g. "$120 per person per day".' } },
          ],
        },
      ],
    },
    {
      name: 'services',
      type: 'array',
      admin: { description: 'What is served and when.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'service', type: 'select', required: true, options: LOUNGE_SERVICES },
            { name: 'from', type: 'text', admin: { placeholder: '6:30am' } },
            { name: 'to', type: 'text', admin: { placeholder: '10:30am' } },
          ],
        },
      ],
    },
    { name: 'dressCode', type: 'text' },
    { name: 'note', type: 'richText', admin: { description: 'The editorial take: does it beat the restaurant?' } },
    { name: 'image', type: 'upload', relationTo: 'media' },
    { name: 'externalImageUrl', type: 'text', admin: { description: 'Hosted image URL until owned media is uploaded.' } },
  ],
}
