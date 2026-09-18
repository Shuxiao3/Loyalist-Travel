import type { CollectionConfig } from 'payload'

import { publishedOrLoggedIn } from '../access/publishedOrLoggedIn'
import { slugField } from './fields/slug'

// Editorial articles, one flat hub at /articles with a category filter.
export const ARTICLE_CATEGORIES = [
  { label: 'Elite benefits', value: 'elite-benefits' },
  { label: 'Programs', value: 'programs' },
  { label: 'Points & awards', value: 'points-awards' },
  { label: 'Credit cards', value: 'credit-cards' },
  { label: 'Hotels & lounges', value: 'hotels-lounges' },
]
export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number]['value']
export const ARTICLE_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(ARTICLE_CATEGORIES.map((c) => [c.value, c.label]))

export const Articles: CollectionConfig = {
  slug: 'articles',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'publishedDate', '_status'],
    group: 'Editorial',
  },
  access: { read: publishedOrLoggedIn },
  versions: { drafts: true },
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField,
    {
      type: 'row',
      fields: [
        { name: 'category', type: 'select', required: true, options: ARTICLE_CATEGORIES, index: true },
        { name: 'publishedDate', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayOnly' } }, index: true },
      ],
    },
    { name: 'dek', type: 'textarea', maxLength: 300, admin: { description: 'One or two sentences under the title and on cards.' } },
    { name: 'body', type: 'richText', required: true },
    {
      name: 'related',
      type: 'group',
      admin: { description: 'Shown in the sidebar.' },
      fields: [
        { name: 'hotels', type: 'relationship', relationTo: 'hotels', hasMany: true },
        { name: 'programs', type: 'relationship', relationTo: 'programs', hasMany: true },
        { name: 'lounges', type: 'relationship', relationTo: 'lounges', hasMany: true },
        { name: 'articles', type: 'relationship', relationTo: 'articles', hasMany: true },
      ],
    },
    { name: 'heroImage', type: 'upload', relationTo: 'media', admin: { position: 'sidebar' } },
    { name: 'externalImageUrl', type: 'text', admin: { position: 'sidebar', description: 'Hosted image URL until owned media is uploaded.' } },
    { name: 'featured', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar', description: 'Pin to the top of the hub and the homepage.' } },
  ],
}
