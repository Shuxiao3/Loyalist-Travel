import type { CollectionConfig } from 'payload'

// One record per rubric version: the category list with maxima for City and
// Resort. v15 is locked; changes become v16 and coexist with v15 reviews
// without a re-score (decision log, content model 1 and 8).
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
              name: 'group',
              type: 'select',
              required: true,
              options: [
                { label: 'Hard product', value: 'hard' },
                { label: 'Soft product', value: 'soft' },
              ],
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
