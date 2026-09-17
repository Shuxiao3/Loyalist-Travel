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
  ],
  upload: true,
}
