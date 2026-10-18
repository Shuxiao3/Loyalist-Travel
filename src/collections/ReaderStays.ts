import type { CollectionConfig } from 'payload'

import { notifyOnCreate } from '@/lib/notify'

// Reader submissions: dropdown-only, no typing (decision log, content model
// 4). Hotel and program are prefilled from a hotel page. Aggregates from
// approved stays are computed in src/lib/readerData.ts and shown publicly
// only once a hotel has five or more approved stays.

export * from '../lib/stayOptions'
import { SUITE_AWARD, SUITE_TYPES, UPGRADE_HOW, UPGRADE_OUTCOMES, UPGRADE_TYPES } from '../lib/stayOptions'
import { recountHotelAfterChange, recountHotelAfterDelete } from './Hotels'

// After any change or delete, the hotel's stayCount and reportCount are
// recounted (recountHotel in Hotels.ts).
export const ReaderStays: CollectionConfig = {
  slug: 'reader-stays',
  hooks: {
    afterChange: [recountHotelAfterChange, notifyOnCreate('reader-stays')],
    afterDelete: [recountHotelAfterDelete],
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['hotel', 'statusHeld', 'stayYear', 'upgrade', 'status', 'createdAt'],
    group: 'Reader data',
    listSearchableFields: ['hotel'],
    description: 'Approve or reject submissions here. Only approved stays count.',
  },
  access: {
    // Created through the site's form only (a server action), never the public API.
    create: ({ req }) => Boolean(req.user),
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  defaultSort: '-createdAt',
  fields: [
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      admin: { position: 'sidebar' },
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'hotel', type: 'relationship', relationTo: 'hotels', required: true, index: true },
        { name: 'program', type: 'relationship', relationTo: 'programs', required: true, index: true },
        { name: 'statusHeld', type: 'relationship', relationTo: 'status-levels', required: true, index: true },
      ],
    },
    { name: 'stayYear', type: 'number', required: true, min: 2015, max: 2100 },
    {
      type: 'row',
      fields: [
        { name: 'upgrade', type: 'select', required: true, options: UPGRADE_OUTCOMES },
        { name: 'upgradeType', type: 'select', options: UPGRADE_TYPES, admin: { condition: (data) => data?.upgrade === 'yes' } },
        { name: 'suiteType', type: 'select', options: SUITE_TYPES, admin: { condition: (data) => (data?.upgrade === 'yes' && data?.upgradeType === 'suite') || data?.suiteAward === 'yes' } },
        { name: 'upgradeHow', type: 'select', options: UPGRADE_HOW, admin: { condition: (data) => data?.upgrade === 'yes' } },
      ],
    },
    {
      name: 'suiteAward',
      type: 'select',
      required: true,
      defaultValue: 'no',
      options: SUITE_AWARD,
      admin: { description: 'A confirmed suite upgrade certificate was applied to the stay.' },
    },
    {
      name: 'reader',
      type: 'relationship',
      relationTo: 'readers',
      index: true,
      admin: { position: 'sidebar', description: 'Set when the stay was submitted while signed in. Shows the display name on the latest-stays list.' },
    },
    {
      name: 'submitterHash',
      type: 'text',
      index: true,
      admin: { position: 'sidebar', readOnly: true, description: 'Hashed network address, for spotting repeat submissions. Never shown.' },
    },
  ],
}
