import type { Access } from 'payload'

// Public readers see published records only; a logged-in admin sees drafts too.
export const publishedOrLoggedIn: Access = ({ req }) => {
  if (req.user) return true
  return { _status: { equals: 'published' } }
}
