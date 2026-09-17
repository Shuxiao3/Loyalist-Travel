import type { CollectionConfig } from 'payload'

import { webflowIdField } from './fields/webflowId'

// World of Hyatt, Marriott Bonvoy, IHG One Rewards, Hilton Honors. Hub pages
// hold program-level content.
export const Programs: CollectionConfig = {
  slug: 'programs',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'topTierName'],
    group: 'Reference',
  },
  access: { read: () => true },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'shortDescription', type: 'textarea' },
    { name: 'overview', type: 'richText' },
    { name: 'eliteTiersDescription', type: 'textarea' },
    {
      type: 'row',
      fields: [
        { name: 'topTierName', type: 'text' },
        { name: 'secondTierName', type: 'text' },
      ],
    },
    { name: 'tiers', type: 'join', collection: 'status-levels', on: 'program' },
    {
      name: 'images',
      type: 'group',
      admin: { description: 'Webflow-hosted URLs until owned media is uploaded.' },
      fields: [
        { name: 'logoUrl', type: 'text' },
        { name: 'heroImageUrl', type: 'text' },
      ],
    },
    {
      name: 'seo',
      type: 'group',
      fields: [
        { name: 'title', type: 'text' },
        { name: 'description', type: 'textarea' },
      ],
    },
    webflowIdField,
  ],
}
