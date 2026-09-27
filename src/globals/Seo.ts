import type { Field, GlobalConfig } from 'payload'

// Every page's search title and description, editable in one place. Static
// pages take the text as written; template pages fill the placeholders named
// beside each field. A blank field keeps the site's built-in wording.
const pair = (name: string, label: string, placeholders?: string): Field => ({
  name,
  type: 'group',
  label,
  admin: { description: placeholders ? `Placeholders: ${placeholders}` : undefined },
  fields: [
    { name: 'title', type: 'text', admin: { description: '"| Loyalist Travel" is added after it automatically. Aim for under 60 characters.' } },
    { name: 'description', type: 'textarea', admin: { description: 'Aim for 120 to 160 characters.' } },
  ],
})

export const Seo: GlobalConfig = {
  slug: 'seo',
  label: 'Search titles & descriptions',
  admin: { group: 'Site' },
  access: { read: () => true },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Site & index pages',
          fields: [
            {
              name: 'site',
              type: 'group',
              label: 'Homepage and fallback',
              admin: { description: 'The homepage, and any page that has nothing of its own. The homepage title is used whole, with nothing added.' },
              fields: [
                { name: 'title', type: 'text' },
                { name: 'description', type: 'textarea' },
              ],
            },
            pair('reviews', 'Reviews index'),
            pair('hotels', 'Hotels index'),
            pair('lounges', 'Lounges index'),
            pair('articles', 'Articles index'),
            pair('submitAStay', 'Submit a stay'),
          ],
        },
        {
          label: 'Templates',
          fields: [
            pair('review', 'Review page', '{Title} {Hotel} {Score} {Verdict} {Destination} {Program} {Brand}'),
            pair('hotel', 'Hotel page, reviewed', '{Hotel} {Destination} {Location} {Brand} {Program} {Elites}'),
            pair('hotelUnreviewed', 'Hotel page, not yet reviewed', '{Hotel} {Destination} {Location} {Brand} {Program} {Elites}'),
            pair('lounge', 'Lounge page', '{Lounge} {Hotel} {Access} {Program}'),
            pair('program', 'Program page', '{Program} {Description}'),
            pair('brand', 'Brand page', '{Brand} {Program} {Description}'),
            pair('destination', 'Destination page', '{Destination} {Country} {Description}'),
            pair('article', 'Article page', '{Title} {Dek} {Category}'),
          ],
        },
      ],
    },
  ],
}
