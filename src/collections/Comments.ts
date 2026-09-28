import type { CollectionConfig } from 'payload'

import { notifyOnCreate } from '@/lib/notify'

// Reader comments on reviews, articles and lounges. Written only by the
// site's server action from a signed-in reader; shown only once approved.
export * from '../lib/commentOptions'
import { COMMENT_MAX } from '../lib/commentOptions'

export const Comments: CollectionConfig = {
  slug: 'comments',
  hooks: { afterChange: [notifyOnCreate('comments')] },
  admin: {
    useAsTitle: 'body',
    defaultColumns: ['body', 'reader', 'on', 'status', 'createdAt'],
    group: 'Reader data',
    description: 'Approve or reject here. Only approved comments show on the site.',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
    },
    {
      name: 'reader',
      type: 'relationship',
      relationTo: 'readers',
      index: true,
      admin: { description: 'Always set when a comment is posted. Cleared, not deleted, when a reader closes their account: the comment stays and shows as "Reader".' },
    },
    { name: 'on', type: 'relationship', relationTo: ['reviews', 'articles', 'lounges'], required: true, index: true, admin: { description: 'The page the comment sits under.' } },
    { name: 'body', type: 'textarea', required: true, maxLength: COMMENT_MAX },
    { name: 'submitterHash', type: 'text', index: true, admin: { position: 'sidebar', readOnly: true, description: 'Hashed network address. Never shown.' } },
  ],
}
