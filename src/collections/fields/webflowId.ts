import type { TextField } from 'payload'

// The Webflow item id a record was imported from. The import script upserts on
// it, so re-running the import updates rather than duplicates.
export const webflowIdField: TextField = {
  name: 'webflowId',
  type: 'text',
  index: true,
  admin: { position: 'sidebar', readOnly: true },
}
