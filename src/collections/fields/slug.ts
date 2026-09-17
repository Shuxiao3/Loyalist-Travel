import type { TextField } from 'payload'

// Slugs carry over from Webflow unchanged so every indexed URL keeps working.
export const slugField: TextField = {
  name: 'slug',
  type: 'text',
  required: true,
  unique: true,
  index: true,
  admin: { position: 'sidebar' },
}
