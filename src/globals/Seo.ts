import type { Field, GlobalConfig } from 'payload'

// Every page's search title and description, editable in one place. Static
// pages take the text as written; template pages fill the placeholders named
// beside each field. A blank field keeps the site's built-in wording.
type Preview = { sample?: Record<string, string>; fallback: { title: string; description: string }; url: string }

const preview = (p: Preview, suffix = true): Field => ({
  name: 'preview',
  type: 'ui',
  admin: { components: { Field: { path: '@/components/admin/SeoPreview#SeoPreview', clientProps: { ...p, suffix } } } },
})

const pair = (name: string, label: string, p: Preview, placeholders?: string): Field => ({
  name,
  type: 'group',
  label,
  admin: { description: placeholders ? `Placeholders: ${placeholders}. {Elite} is the program's top tier, e.g. Globalist. The preview below fills them with a sample page.` : undefined },
  fields: [
    { name: 'title', type: 'text', admin: { description: '"| Loyalist Travel" is added after it automatically. Aim for under 60 characters.' } },
    { name: 'description', type: 'textarea', admin: { description: 'Aim for 120 to 160 characters.' } },
    preview(p),
  ],
})

// Sample pages for the template previews.
const HOTEL = { Hotel: 'Park Hyatt Tokyo', Destination: 'Tokyo', Location: 'Tokyo, Japan', Brand: 'Park Hyatt', Program: 'World of Hyatt', Elite: 'Globalist', Elites: 'World of Hyatt elites' }
const REVIEW = { Title: 'Park Hyatt Tokyo', Hotel: 'Park Hyatt Tokyo', Score: '87', Verdict: 'Book it for the rooms and the view; the club is not the point here.', Destination: 'Tokyo', Program: 'World of Hyatt', Elite: 'Globalist', Brand: 'Park Hyatt' }
const LOUNGE = { Lounge: 'Grand Club', Hotel: 'Grand Hyatt Tokyo', Access: 'Globalists and club rooms', Program: 'World of Hyatt', Elite: 'Globalist' }
const PROGRAM = { Program: 'World of Hyatt', Elite: 'Globalist', Description: "Hyatt's loyalty program: four tiers, milestone rewards from 20 nights, and the most consistently honoured top-tier benefits in hotel loyalty." }
const BRAND = { Brand: 'Park Hyatt', Program: 'World of Hyatt', Elite: 'Globalist', Description: "Hyatt's flagship luxury brand: quiet, residential hotels with the best rooms in the portfolio." }
const DESTINATION = { Destination: 'Tokyo', Country: 'Japan', Description: 'Every indexed hotel in Tokyo across the four programs, with reader-reported upgrade odds where enough stays are in.' }
const ARTICLE = { Title: 'What Hyatt Globalist status gets you', Dek: 'Sixty nights a year buys the most consistently honoured top-tier status in hotel loyalty. Here is what it gets you, and where it falls short.', Category: 'Elite benefits' }

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
                preview({ fallback: { title: 'Loyalist Travel | What elite status gets you at hotels and lounges', description: 'Real upgrade odds at every hotel, reported by elite members. Club lounges rated by the people who sat in them. Every review scored on the same 100-point rubric.' }, url: 'loyalisttravel.com' }, false),
              ],
            },
            pair('reviews', 'Reviews index', { fallback: { title: 'Reviews', description: 'Every scored stay, on a 100-point rubric, written from a full stay and never a site inspection.' }, url: 'loyalisttravel.com › reviews' }),
            pair('hotels', 'Hotels index', { fallback: { title: 'Hotels', description: 'Every hotel indexed across World of Hyatt, Marriott Bonvoy, IHG One Rewards and Hilton Honors, filterable by program, brand and country.' }, url: 'loyalisttravel.com › hotels' }),
            pair('lounges', 'Lounges index', { fallback: { title: 'Lounges', description: 'Club and executive lounges: who gets in, hours, what is served, and whether it beats the restaurant, scored by readers who sat in them.' }, url: 'loyalisttravel.com › lounges' }),
            pair('articles', 'Articles index', { fallback: { title: 'Articles', description: 'Elite benefits, loyalty programs, points and awards, credit cards, lounges and hotels, written from stays we paid for.' }, url: 'loyalisttravel.com › articles' }),
            pair('submitAStay', 'Submit a stay', { fallback: { title: 'Submit a stay', description: 'Two minutes, no typing. Your upgrade, breakfast and late-checkout outcome joins the data for that hotel.' }, url: 'loyalisttravel.com › submit-a-stay' }),
          ],
        },
        {
          label: 'Templates',
          fields: [
            pair('review', 'Review page', { sample: REVIEW, fallback: { title: 'Park Hyatt Tokyo review, scored 87 of 100', description: REVIEW.Verdict }, url: 'loyalisttravel.com › reviews › park-hyatt-tokyo' }, '{Title} {Hotel} {Score} {Verdict} {Destination} {Program} {Elite} {Brand}'),
            pair('hotel', 'Hotel page, reviewed', { sample: HOTEL, fallback: { title: 'Park Hyatt Tokyo, Tokyo', description: 'Park Hyatt Tokyo in Tokyo, Japan: our scored review, plus reader-reported upgrade odds, breakfast and late checkout outcomes for World of Hyatt elites.' }, url: 'loyalisttravel.com › hotels › park-hyatt-tokyo' }, '{Hotel} {Destination} {Location} {Brand} {Program} {Elite} {Elites}'),
            pair('hotelUnreviewed', 'Hotel page, not yet reviewed', { sample: HOTEL, fallback: { title: 'Park Hyatt Tokyo, Tokyo', description: 'Park Hyatt Tokyo in Tokyo, Japan, Park Hyatt: reader-reported upgrade odds, breakfast and late checkout outcomes for World of Hyatt elites. Add your stay in two minutes.' }, url: 'loyalisttravel.com › hotels › park-hyatt-tokyo' }, '{Hotel} {Destination} {Location} {Brand} {Program} {Elite} {Elites}'),
            pair('lounge', 'Lounge page', { sample: LOUNGE, fallback: { title: 'Grand Club, Grand Hyatt Tokyo', description: 'Who gets in, hours, what is served, and whether it is worth a club room. Globalists and club rooms.' }, url: 'loyalisttravel.com › lounges › grand-hyatt-tokyo-grand-club' }, '{Lounge} {Hotel} {Access} {Program} {Elite}'),
            pair('program', 'Program page', { sample: PROGRAM, fallback: { title: 'World of Hyatt', description: PROGRAM.Description }, url: 'loyalisttravel.com › programs › world-of-hyatt' }, '{Program} {Elite} {Description}'),
            pair('brand', 'Brand page', { sample: BRAND, fallback: { title: 'Park Hyatt', description: BRAND.Description }, url: 'loyalisttravel.com › brands › park-hyatt' }, '{Brand} {Program} {Elite} {Description}'),
            pair('destination', 'Destination page', { sample: DESTINATION, fallback: { title: 'Hotels in Tokyo', description: DESTINATION.Description }, url: 'loyalisttravel.com › destinations › tokyo' }, '{Destination} {Country} {Description}'),
            pair('article', 'Article page', { sample: ARTICLE, fallback: { title: ARTICLE.Title, description: ARTICLE.Dek }, url: 'loyalisttravel.com › articles › what-hyatt-globalist-status-gets-you' }, '{Title} {Dek} {Category}'),
          ],
        },
      ],
    },
  ],
}
