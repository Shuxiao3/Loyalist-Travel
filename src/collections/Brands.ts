import type { CollectionConfig } from 'payload'

import { slugField } from './fields/slug'
import { webflowIdField } from './fields/webflowId'

export const SEGMENT_OPTIONS = [
  { label: 'Ultra Luxury', value: 'ultra-luxury' },
  { label: 'Luxury', value: 'luxury' },
  { label: 'Upscale', value: 'upscale' },
  { label: 'Midscale', value: 'midscale' },
  { label: 'Budget', value: 'budget' },
  { label: 'Extended Stay', value: 'extended-stay' },
]

export const Brands: CollectionConfig = {
  slug: 'brands',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'program'],
    group: 'Reference',
  },
  access: { read: () => true },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField,
    { name: 'program', type: 'relationship', relationTo: 'programs', index: true },
    { name: 'segment', type: 'select', options: SEGMENT_OPTIONS, admin: { hidden: true } },
    { name: 'rank', type: 'number', min: 1, admin: { description: 'Perceived hierarchy within the program: 1 sits at the top of the brand list, higher numbers further down. Blank sorts last.' } },
    { name: 'shortDescription', type: 'textarea' },
    { name: 'overview', type: 'richText' },
    { name: 'logoUrl', type: 'text', admin: { description: 'Webflow-hosted URL until owned media is uploaded.' } },
    webflowIdField,
  ],
}
