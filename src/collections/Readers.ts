import type { CollectionConfig } from 'payload'

// Site readers who signed in (Google today, email links later). Separate
// from Users, which is the admin login. Readers never reach the admin;
// their records are read and written by the site's own server code.
export const Readers: CollectionConfig = {
  slug: 'readers',
  admin: {
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'email', 'status', 'createdAt'],
    group: 'Reader data',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: 'email', type: 'email', required: true, unique: true, index: true, admin: { description: 'Never shown on the site.' } },
    { name: 'displayName', type: 'text', unique: true, index: true, admin: { description: 'Chosen by the reader on first sign-in. Shown on comments and lounge ratings.' } },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Blocked', value: 'blocked' },
      ],
      admin: { description: 'Blocked readers can still sign in but cannot post.' },
    },
    { name: 'googleSub', type: 'text', index: true, admin: { position: 'sidebar', readOnly: true, description: "Google's stable id for the account." } },
    { name: 'lastSeenAt', type: 'date', admin: { position: 'sidebar', readOnly: true } },
  ],
}
