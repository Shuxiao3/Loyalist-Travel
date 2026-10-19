import type { CollectionConfig } from 'payload'

import { publishedOrLoggedIn } from '../access/publishedOrLoggedIn'
import { slugField } from './fields/slug'

// Editorial articles, one flat hub at /articles with a category filter. An
// article can carry several categories; the first is its main one.
import { ARTICLE_CATEGORIES } from '../lib/articleOptions'

export { ARTICLE_CATEGORIES, ARTICLE_CATEGORY_LABEL, type ArticleCategory } from '../lib/articleOptions'

export const Articles: CollectionConfig = {
  slug: 'articles',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'categories', 'publishedDate', '_status'],
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
        {
          name: 'categories',
          type: 'select',
          hasMany: true,
          required: true,
          options: [...ARTICLE_CATEGORIES],
          index: true,
          admin: { description: 'Pick one or more. The first is the main category, shown on cards and in the breadcrumb. Drag to change the order.' },
        },
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
    {
      name: 'seo',
      type: 'group',
      label: 'Search title & description',
      admin: { description: 'Overrides the article template on the Search titles & descriptions page.' },
      fields: [
        { name: 'title', type: 'text' },
        { name: 'description', type: 'textarea' },
        {
          name: 'preview',
          type: 'ui',
          admin: { components: { Field: { path: '@/components/admin/SeoPreview#SeoPreview', clientProps: { from: { title: 'title', description: 'dek' }, url: 'loyalisttravel.com › articles' } } } },
        },
      ],
    },
    { name: 'heroImage', type: 'upload', relationTo: 'media', admin: { position: 'sidebar' } },
    { name: 'externalImageUrl', type: 'text', admin: { position: 'sidebar', description: 'Hosted image URL until owned media is uploaded.' } },
    { name: 'featured', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar', description: 'Pin to the top of the hub and the homepage.' } },
    // Fingerprint of the words the markdown import last wrote. When the
    // stored words no longer match it, the article was edited here, and the
    // import leaves its words alone.
    { name: 'importedHash', type: 'text', admin: { hidden: true } },
  ],
}
