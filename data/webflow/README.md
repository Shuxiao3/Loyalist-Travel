# Webflow export

Full export of the Hotel Loyalist Webflow CMS (site `6a0eca8a05fea31cbe844975`), taken September 17, 2026 through the Webflow Data API. Drafts included. This is the source of record for the Milestone 1 import; the import script reads these files, never Webflow directly.

| File | Records | Notes |
|---|---|---|
| `programs.json` | 4 | World of Hyatt, Marriott Bonvoy, IHG One Rewards, Hilton Honors |
| `brands.json` | 65 | |
| `status-levels.json` | 20 | Elite tiers per program |
| `regions.json` | 7 | |
| `destinations.json` | 949 | 874 drafts |
| `amenities.json` | 22 | |
| `hotels.json` | 4,167 | 4,159 drafts, 1 archived, 1 with `review-status: Reviewed` |
| `reviews.json` | 8 | All published. Scored on the pre-v15 rubric |
| `hotel-upgrade-data.json` | 4 | Hand-typed test rows for Park Hyatt New York. Not imported; replaced by Reader Stays |
| `schemas.json` | | Field list per collection, with option id → label maps and reference targets |

Two Webflow collections were empty and are not exported: Hotel Status Data and Guides.

Item shape is Webflow's: `{ id, isDraft, isArchived, lastPublished, fieldData: { slug: value } }`. Option fields hold an option id; look the label up in `schemas.json`. Reference fields hold the target item's Webflow id.
