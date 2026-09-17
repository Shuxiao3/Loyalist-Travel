import type { CollectionConfig } from 'payload'

import { publishedOrLoggedIn } from '../access/publishedOrLoggedIn'
import { slugField } from './fields/slug'
import { webflowIdField } from './fields/webflowId'

export const DESTINATION_TYPE_OPTIONS = [
  { label: 'City', value: 'city' },
  { label: 'Beach', value: 'beach' },
  { label: 'Island', value: 'island' },
  { label: 'Ski', value: 'ski' },
  { label: 'Resort', value: 'resort' },
  { label: 'Jungle', value: 'jungle' },
  { label: 'Airport', value: 'airport' },
  { label: 'Business', value: 'business' },
  { label: 'Luxury', value: 'luxury' },
]

export const Destinations: CollectionConfig = {
  slug: 'destinations',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'country', 'region', 'type', '_status'],
    group: 'Reference',
  },
  access: { read: publishedOrLoggedIn },
  versions: { drafts: true },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField,
    {
      type: 'row',
      fields: [
        { name: 'city', type: 'text' },
        { name: 'stateOrRegion', type: 'text' },
        { name: 'country', type: 'text', index: true },
      ],
    },
    { name: 'locationLabel', type: 'text', admin: { description: 'As shown on cards, e.g. "Eugene, Oregon".' } },
    {
      type: 'row',
      fields: [
        { name: 'region', type: 'relationship', relationTo: 'regions', index: true },
        { name: 'type', type: 'select', options: DESTINATION_TYPE_OPTIONS },
      ],
    },
    { name: 'shortDescription', type: 'textarea' },
    { name: 'overview', type: 'richText' },
    { name: 'imageUrl', type: 'text', admin: { description: 'Webflow-hosted URL until owned media is uploaded.' } },
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
