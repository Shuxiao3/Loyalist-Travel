import type { CollectionConfig } from 'payload'

// Uploads with alt text and credit (rebuild plan, content model).
export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    {
      name: 'credit',
      type: 'text',
    },
    {
      name: 'staticUrl',
      type: 'text',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Set by the article import for a photo the site serves from its own files. Pages show this address instead of the uploaded copy.',
      },
    },
  ],
  upload: {
    // a photo the site serves itself shows from there in the admin too
    adminThumbnail: ({ doc }) => (typeof doc.staticUrl === 'string' && doc.staticUrl) || (typeof doc.filename === 'string' ? `/api/media/file/${encodeURIComponent(doc.filename)}` : null),
  },
}
