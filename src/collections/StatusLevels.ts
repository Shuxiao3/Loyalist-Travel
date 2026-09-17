import type { CollectionConfig } from 'payload'

import { slugField } from './fields/slug'
import { webflowIdField } from './fields/webflowId'

// Elite tiers per program. Reviews record the tier held at the stay; reader
// stays pick from the tiers of the hotel's program.
export const StatusLevels: CollectionConfig = {
  slug: 'status-levels',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'program', 'rank', 'isTopTier'],
    group: 'Reference',
  },
  access: { read: () => true },
  defaultSort: 'rank',
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField,
    {
      type: 'row',
      fields: [
        { name: 'program', type: 'relationship', relationTo: 'programs', required: true, index: true },
        { name: 'shortName', type: 'text', admin: { description: 'Tier name without the program, e.g. "Globalist".' } },
        { name: 'rank', type: 'number', admin: { description: '1 is the entry tier.' } },
      ],
    },
    { name: 'isTopTier', type: 'checkbox', defaultValue: false },
    { name: 'nights', type: 'text', admin: { description: 'Qualification, e.g. "60 nights".' } },
    { name: 'shortDescription', type: 'textarea' },
    { name: 'benefits', type: 'richText' },
    {
      name: 'eligibility',
      type: 'group',
      admin: { description: 'Which printed benefits this tier is entitled to.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'breakfast', type: 'checkbox', defaultValue: false },
            { name: 'lounge', type: 'checkbox', defaultValue: false },
            { name: 'suiteUpgrade', type: 'checkbox', defaultValue: false },
            { name: 'lateCheckout', type: 'checkbox', defaultValue: false },
          ],
        },
      ],
    },
    {
      name: 'creditCard',
      type: 'group',
      admin: { description: 'Where a credit card grants this tier outright.' },
      fields: [
        { name: 'grantsStatus', type: 'checkbox', defaultValue: false },
        { name: 'source', type: 'text' },
      ],
    },
    webflowIdField,
  ],
}
