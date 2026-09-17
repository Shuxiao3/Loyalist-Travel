import type { CollectionConfig } from 'payload'

import { slugField } from './fields/slug'
import { webflowIdField } from './fields/webflowId'

export const Regions: CollectionConfig = {
  slug: 'regions',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'displayOrder'], group: 'Reference' },
  access: { read: () => true },
  defaultSort: 'displayOrder',
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField,
    { name: 'displayOrder', type: 'number' },
    webflowIdField,
  ],
}
