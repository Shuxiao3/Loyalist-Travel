# Loyalist Travel: Rebuild Plan

Version 1.3. September 16, 2026. Brand renamed to Loyalist Travel; repo is `loyalist-travel`. Design tokens and content-model structure decided; see the decision log at the end.

## The decision

Move Loyalist Travel (formerly The Hotel Loyalist) off Webflow to a code-built site: Next.js for the pages, Payload as the CMS, Postgres for the data, all deployed on Vercel. Austin keeps a real admin panel for editing copy, scores and hotel records. Claude owns everything structural: templates, design, data pipeline, SEO. The current ~131 hotel records, the Reviews, Brands and Destinations collections, and the v15 rubric all migrate. Nothing is retyped.

What this buys: total visual control, no CMS item cap (the 4,500-hotel load stops being a question), one repo where a new page is a request rather than an afternoon in the Designer.

What it costs: Austin no longer edits layout himself. Copy, scores and records stay editable. Anything about how a page looks goes through Claude.

## Stack

| Layer | Choice | Why this one |
|---|---|---|
| Framework | Next.js 15, App Router | Static and incremental rendering for SEO, one codebase for pages and admin |
| CMS | Payload 3 | Runs inside the Next.js app, admin UI generated from the schema, drafts, live preview, rich text built in. No separate SaaS bill |
| Database | Postgres on Neon | Serverless Postgres, free at this scale, handles 4,500+ hotels and server-side filtering |
| Hosting | Vercel Pro | Native Next.js hosting. Pro tier because the Hobby plan does not allow commercial sites |
| Media | Cloudflare R2 or Vercel Blob | Hero and room photos, OG images. R2 is effectively free at this volume |
| Fonts | Google Fonts, self-hosted via next/font | Fraunces for display, Instrument Sans for body and UI |
| Reader submissions | Native form posting to Payload | Lounge reviews land as pending records; Austin approves in admin. Airtable becomes optional |

Rejected: Sanity (content lives in their cloud, GROQ to learn, pricing scales with documents), Astro plus flat files (4,500 hotels is a database, not a folder of markdown), Airtable as the CMS (weak rich text, rate limits, 50k record cap on paid tiers).

## What carries over from Webflow

Everything in the Webflow CMS exports cleanly through the Webflow API, drafts included.

- Hotels (~131 records, plus the enrichment already done on them)
- Reviews (60 fields, both published reviews and any drafts)
- Brands and Destinations
- Slugs, so any indexed URL keeps working
- The v15 rubric structure, encoded once in the schema rather than as 60 hand-managed fields
- The Guides and Lounges IA spec written on September 16 (single /guides hub, flat slugs, category filter, Lounges collection linked to Hotels, moderated reader reviews)

The sourcing master (4,539 rows) is not a Webflow dependency and imports directly into Postgres once the file is back in project files.

## Content model

Collections in Payload. Field lists are indicative; the migration script finalises them against the Webflow export.

**Hotels.** Name, slug, brand (relation), destination (relation), program (Marriott / Hyatt / IHG / Hilton), segment, property type (City hotel / Resort), address, check-in and check-out times, hero image, external image URL (for og:image enrichment), lounge (relation, optional), enrichment status, publish status.

**Reviews.** One hotel has many reviews; each stay is its own record. Hotel (relation), rubric version (relation to Rubric Versions), stay dates, nights, room booked and room received, rate basis (cash, points, certificate), status held at stay, property type (drives maxima), the 16 category scores stored per category and validated against that version's maxima, with hard, soft and overall totals computed on save and never typed, narrative sections (room, public space, service, food and drink), elite recognition as a fixed outcome per benefit plus a free-text note each (upgrade: none / room category / suite / used award; breakfast: full / capped / restaurant credit / none; late checkout: 4pm confirmed / on request / refused / not needed; welcome amenity; club lounge: none at property / access / access with restrictions; Guest of Honor), pros, cons, verdict, book-it-if, skip-it-if, award note, published date, last verified date, read time.

**Rubric Versions.** One record per rubric version: the category list with maxima for City and Resort, and the hard/soft split. v15 is the first record and is locked; changes become v16 and coexist with v15 reviews without a re-score.

**Reader Stays.** Reader submissions, dropdown-only, no typing. Hotel and program (prefilled and hidden when submitted from a hotel page; searchable dropdowns on the generic form), status held (tiers for that program), stay month and year, upgrade outcome, breakfast outcome, late checkout outcome, using the same outcome lists as Reviews so one stat covers both, and a lounge rating from 1 to 10 shown only when the hotel has a lounge on record. Status pending / approved / rejected; approved in admin. No comment, name or photo. Aggregates (upgrade rate and the rest) are shown publicly only once a property has five or more approved stays.

**Lounges.** Own collection, linked to a hotel; a lounge record exists only where a lounge exists, and a hotel can hold more than one for the rare twin-tower case. Lounge type (executive, club, Ritz Club), access rules by status, hours, food and drink service windows, dress code, editorial notes, and the reader lounge ratings aggregated from Reader Stays.

**Guides.** Title, slug, category (loyalty programs, lounges, credit cards, hotels), pillar or standalone, cluster (relation to a Content Cluster record), body, related hotels and guides.

**Brands, Destinations, Programs, Content Clusters.** All four are real collections with their own records and pages. Programs (World of Hyatt, Marriott Bonvoy, IHG One Rewards, Hilton Honors) get hub pages that hold program-level content. Content Clusters replaces the workbook tab so cluster tracking lives beside the content it tracks.

**Media.** Uploads with alt text and credit.

## Design system

Taken directly from the "Hotel Loyalist Articles" design artifact (made before the rename; the wordmark in every template now reads Loyalist Travel) (Articles hub, Article template, Lounge page). The pages look composed because every value comes from a short fixed list. Austin never picks a spacing value or a colour; he picks from the list.

**Color.** Navy #0d1b2a for dark surfaces (nav, hero, data panels, bands), with a deeper navy #0a1521 for panels that sit on navy. Cream #faf8f4 for the page, a warmer cream #f3eee2 for filter bars and callouts, white for cells and cards. Gold in three steps: #d0a060 on navy, #a9783c for links and labels on light, #725128 for chip borders. Pale gold #efd5a3 for chip text on navy. Dark panels take a #3f2c16 border. Hairlines are black at 10 percent on light and white at 10 percent on dark. The palette is fixed in both colour schemes; a viewer's dark setting never inverts it.

**Type.** Playfair Display for display, headlines, scores and related-link titles, weight 500 for headings and 600 for the wordmark. Lato for body, labels and interface. This replaces the Fraunces question: Playfair is the house serif.

**Type scale.** Editorial, chosen over the artboard scale and a uniformly larger one on September 16, 2026. Body stays 17px Lato at 1.75 line height in articles; headlines jump: 24 and 30 for h3 and section heads inside content, 34 for article h2, 42 for section titles, 66 for a review H1, 84 for the homepage H1. Score numerals 72, stat numerals 44, band numerals 80. Small text 12 to 15px. On phones the display sizes scale down by fixed ratios (homepage H1 at 68 percent, review H1 at 77 percent); body sizes do not change.

**Labels.** Tracked uppercase is the signature. Eyebrows at 11px with 0.20em tracking in gold; cell and field labels at 10px with 0.16em in grey; nav at 13px with 0.10em. Bylines join items with a middle dot and carry the Last verified date in gold.

**Structure.** Soft corners: a 3px radius on containers and interactive elements, chosen over sharp and 10px on September 16, 2026. One-pixel borders, no shadows. Fact grids are white cells separated by one-pixel gaps on a hairline background. Data panels are navy with the dark-gold border and a footer note under a hairline. Chips are bordered, not filled, except the single solid gold chip that marks the primary state. The score panel on a review follows the lounge score panel: big Playfair number in gold, secondary numbers in ivory, a note underneath.

**Spacing.** Artboard scale, chosen over tight and airy on September 16, 2026: 4, 8, 12, 16, 24, 32, 48, 64, 96. Sections 72px apart on desktop (48 on phones), 120px gutters inside a 1440 frame collapsing to 20px, 76px between the main column and the 330px sidebar, 24px between cards. Nothing else.

**Motion.** None on load. Interaction motion only: the FAQ plus rotates when a question opens.

The proof page (Park Hyatt New York review) implements this system on a review, adding the two things the artboards did not have: a scorecard laid out as fact grids with a thin gold bar per category sized to what the category is worth, and an elite recognition data panel.

## Migration plan

Milestones rather than weeks, since Austin's availability is the constraint.

**Milestone 0. Foundation.** Repo `loyalist-travel`, Vercel project, Neon database, Payload installed with an empty schema. Design tokens committed as CSS variables. Proof page signed off.

**Milestone 1. Data.** Export every Webflow collection via the API, including drafts. Write the import script: Webflow rich text to Payload's Lexical format, references resolved by slug, enrichment fields preserved. Import. Verify counts and spot-check twenty records. Import the sourcing master into a staging table once the file is recovered.

**Milestone 2. Templates.** Review, Hotel, Brand, Destination, Hotels index with server-side filters (program, brand, destination, property type, scored or not), homepage. Every template consumes the token system; nothing is styled ad hoc.

**Milestone 3. Guides and Lounges.** Build the section to the existing IA spec. Lounge submission form with pending status and an approval view in admin. Guides hub with category filter and cluster grouping.

**Milestone 4. SEO and launch.** JSON-LD for hotels and reviews (schema.org Hotel and Review with the 100-point rating), sitemap, per-review OG images generated from the score card, redirect map if a custom domain is attached, mobile QA, DNS cutover. Webflow stays live until the new site is verified, then is set to read-only for a month before cancellation.

**After launch.** Re-score the two published reviews to v15 in the new admin. Resume the enrichment queue directly against Postgres.

## Day to day after launch

- Edit a review, fix a typo, change a score, add a hotel: Austin, in /admin, publishes and the page updates within a minute.
- Approve or reject reader stays: Austin, in /admin.
- New page type, layout change, new section, design tweak, data import: Austin asks, Claude ships, Vercel deploys.
- Content Clusters tracking moves out of the Excel workbook into admin. The scoring workbook itself remains the place rubric weights are debated; the schema is updated when a version is finalised.

## Costs

- Vercel Pro: about $20 a month
- Neon Postgres: free tier now, about $19 a month if it outgrows it
- Cloudflare R2: under $5 a month at this volume
- Payload, Next.js, fonts: free
- Webflow: cancelled after the read-only month

Roughly $25 to $45 a month against the current Webflow plan.

## Risks and open questions

- If the site is still on the webflow.io subdomain there is little search equity to protect and the cutover is simple. If a custom domain is attached, the redirect map matters and we keep every slug.
- The Reviews collection has grown to 60 flat fields. Migration is the moment to restructure into score groups. The import script maps old fields to new; nothing is lost, but the mapping needs a careful review pass.
- Photos. The site has been leaning on og:image URLs. A code-built site can hotlink those but should not long term. Plan for owned imagery on scored reviews first.
- Austin gives up Designer-level layout control. Accepted in the September 16 conversation.
- Rendering 4,500 hotel pages at build time is slow. They render on first request and cache; the build stays fast.

## Next steps

1. Review the proof page and say what to change. Anything not in the token list gets added to the token list, not applied once.
2. Confirm Payload over Sanity, and Vercel Pro over alternatives.
3. Recover the sourcing master into project files.
4. Claude sets up Milestone 0.

## Decision log

All decided by Austin on September 16, 2026.

**Design tokens**
- Corners: soft, 3px, over sharp and 10px rounded.
- Spacing: the artboard scale (4, 8, 12, 16, 24, 32, 48, 64, 96), over tight and airy.
- Type: the editorial scale (17px body, headlines up to 84px), over the artboard scale and a uniformly larger one.
- Palette fixed in both colour schemes; no dark-mode inversion.

**Content model**
1. Rubric: v15 locked as is. Later changes become v16.
2. Score storage: per category, totals computed on save, no manual override.
3. Elite recognition: fixed outcome per benefit plus a free-text note each.
4. Reader submissions: dropdown-only, hotel and program prefilled from a hotel page, lounge rating shown only where a lounge exists.
5. Hotels and reviews: one hotel, many reviews, with history.
6. Lounges: own collection linked to hotels, not fields on the hotel.
7. Reference collections: Brands, Destinations, Programs and Content Clusters all as real records with pages.
8. Rubric versioning: every review records its rubric version; versions coexist.

Still open, none of it blocking Milestone 0: the 33-item list of non-structural choices (domain, nav label, homepage stats, newsletter provider, affiliate policy, and the rest).
