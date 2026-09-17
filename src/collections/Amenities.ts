import type { CollectionConfig } from 'payload'

import { slugField } from './fields/slug'
import { webflowIdField } from './fields/webflowId'

export const Amenities: CollectionConfig = {
  slug: 'amenities',
  admin: { useAsTitle: 'name', group: 'Reference' },
  access: { read: () => true },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField,
    { name: 'iconUrl', type: 'text', admin: { description: 'Webflow-hosted SVG until owned media is uploaded.' } },
    webflowIdField,
  ],
}
