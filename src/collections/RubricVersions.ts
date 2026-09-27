import type { CollectionConfig } from 'payload'

// One record per rubric version: the sub-score list, each in its category,
// with maxima for City and Resort. v16 uses the same maximum for both.
export const RubricVersions: CollectionConfig = {
  slug: 'rubric-versions',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'locked'],
    group: 'Scoring',
  },
  access: { read: () => true },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true, admin: { position: 'sidebar' } },
    {
      name: 'locked',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar', description: 'A locked version never changes. Start a new version instead.' },
    },
    { name: 'notes', type: 'textarea' },
    {
      name: 'categories',
      type: 'array',
      required: true,
      admin: { description: 'Order is display order. A blank maximum turns validation off for that category and property type.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'key', type: 'text', required: true, admin: { description: 'Matches a score field on Reviews.' } },
            { name: 'label', type: 'text', required: true },
            {
              name: 'section',
              type: 'select',
              options: [
                { label: 'Room', value: 'room' },
                { label: 'Property', value: 'property' },
                { label: 'Service', value: 'service' },
                { label: 'Operations', value: 'operations' },
                { label: 'Breakfast', value: 'breakfast' },
                { label: 'Atmosphere', value: 'atmosphere' },
              ],
              admin: { description: 'Which category the sub-score sits in. Blank on versions before v16.' },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'maxCity', type: 'number', min: 0 },
            { name: 'maxResort', type: 'number', min: 0 },
          ],
        },
      ],
    },
  ],
}
