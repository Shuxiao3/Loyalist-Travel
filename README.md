# Loyalist Travel

Luxury hotel reviews scored on a 100-point rubric. Elite benefits reported as they happened, not as printed.

This is the code-built replacement for the Webflow site. The plan, the design system and the decision log are in [`docs/loyalist-travel-rebuild-plan.md`](docs/loyalist-travel-rebuild-plan.md); the two signed-off mockups it refers to are [`docs/loyalist-travel-homepage.html`](docs/loyalist-travel-homepage.html) and [`docs/park-hyatt-new-york-review.html`](docs/park-hyatt-new-york-review.html).

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15, App Router |
| CMS | Payload 3, running inside the Next.js app at `/admin` |
| Database | Postgres on Neon, via `@payloadcms/db-postgres` |
| Hosting | Vercel |
| Fonts | Playfair Display and Lato from Google Fonts, self-hosted via `next/font` |

## Environment variables

Set these in the Vercel project (Settings → Environment Variables) for Production and Preview. Copy `.env.example` to `.env` for local development.

| Variable | Required | What it is |
|---|---|---|
| `DATABASE_URL` | Yes | Neon Postgres connection string, pooled, with `?sslmode=require`. The [Neon integration](https://vercel.com/marketplace/neon) on Vercel sets this automatically; otherwise copy it from the Neon console. |
| `PAYLOAD_SECRET` | Yes | Random string of 32 or more characters that signs Payload sessions and encrypts API keys. Generate one with `openssl rand -hex 32`. Changing it logs every admin user out. |
| `BLOB_READ_WRITE_TOKEN` | For media | Vercel Blob token. Creating a Blob store under the project's Storage tab sets it automatically. Without it, uploads go to the local `media/` folder, which does not persist on Vercel. Also needed as a repository secret for the import workflow's `logos` step. |
| `NEXT_PUBLIC_SERVER_URL` | No | Public URL of the site with no trailing slash, for example `https://loyalisttravel.com`. Used for Payload's `serverURL`, CORS and CSRF. Leave it unset on Vercel and the app derives it from `VERCEL_PROJECT_PRODUCTION_URL`; set it once a custom domain is attached. |

## Vercel build settings

Payload does not create tables in production; migrations do. Set the Vercel build command to:

```
npm run ci
```

That runs `payload migrate` against `DATABASE_URL` and then `next build`. Every schema change ships with a migration in `src/migrations/`, generated locally with `npm run migrate:create`.

## Local development

```
cp .env.example .env      # then fill in DATABASE_URL and PAYLOAD_SECRET
npm install
npm run migrate           # apply migrations to the database
npm run dev               # http://localhost:3000, admin at /admin
```

Any Postgres 16 works locally; a Neon branch is the simplest option and mirrors production.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run ci` | `migrate` then `build`; the Vercel build command |
| `npm run migrate` | Apply pending migrations |
| `npm run migrate:create` | Generate a migration from schema changes |
| `npm run generate:types` | Regenerate `src/payload-types.ts` after a schema change |
| `npm run generate:importmap` | Regenerate the admin import map after adding custom admin components |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run import:webflow` | Import `data/webflow/` into the database. Idempotent; pass a step name to run one step |
| `npm run import:check` | Compare a random sample of imported records against the export |

## Content

`data/webflow/` is the full export of the Webflow CMS, drafts included, taken on September 17, 2026. `npm run import:webflow` loads it into Payload; see `data/webflow/README.md` for what each file holds. The import is the only path content takes from Webflow. Nothing is retyped.

To load it into production, run the **Import Webflow content** workflow from the repository's Actions tab. It needs two repository secrets, `DATABASE_URL` and `PAYLOAD_SECRET`, copied from the Vercel project's environment variables. The job applies migrations, imports, and spot-checks; it is safe to run more than once.

Collections in Payload: Hotels, Reviews, Reader Stays, Rubric Versions, Programs, Brands, Status Levels, Destinations, Regions, Amenities, Media. Lounges, Guides and Content Clusters arrive with Milestone 3.

Reader Stays come in through the form on every hotel page and `/submit-a-stay` (a server action; the public API cannot create them), land as pending, and are approved in the admin. `src/lib/readerData.ts` computes upgrade, suite, breakfast and late-checkout rates from approved stays; a hotel shows them once it has five.

Review scores are stored per category and validated against the maxima on the review's rubric version for its property type; hard, soft and overall totals are computed on save. `src/rubric/v15.ts` is the current locked rubric.

## Layout

```
data/webflow/               Webflow export, the import source
docs/                       plan, decision log, mockups
scripts/webflow/            import and spot-check scripts
src/
  app/
    (frontend)/             public site: layout, homepage, 404
    (payload)/              admin panel and REST/GraphQL routes, generated by Payload
  access/                   shared access rules
  collections/              Payload collections
  components/               site header and footer
  hooks/                    review score computation and validation
  migrations/               Postgres migrations
  rubric/                   the locked rubric definitions
  styles/
    tokens.css              every colour, font, size and spacing value on the site
    globals.css             base styles and shared primitives, all from tokens
  payload.config.ts
  payload-types.ts          generated
```

`src/styles/tokens.css` is the design system. Templates consume its variables; nothing is styled ad hoc. Anything a page needs that is not there gets added there.

## Milestones

- **0. Foundation**: repo, Next.js and Payload with an empty schema, Postgres, design tokens, placeholder homepage.
- **1. Data** (this): Webflow export committed, schema for every exported collection, import script with rubric versioning.
- **2. Templates**: review, hotel, brand, destination, hotels index with filters, full homepage.
- **3. Guides and lounges**: section built to the IA spec, lounge submission form, approval view.
- **4. SEO and launch**: JSON-LD, sitemap, OG images, redirects, DNS cutover.

## Reader sign-in

Readers sign in with Google (Auth.js). Set these in Vercel and in GitHub
Actions secrets; sign-in stays hidden until all three exist.

| Variable | What |
| --- | --- |
| `AUTH_SECRET` | Long random string that signs session cookies. |
| `AUTH_GOOGLE_ID` | OAuth client ID from Google Cloud, APIs & Services, Credentials. |
| `AUTH_GOOGLE_SECRET` | Its client secret. |

The Google client needs the site's address as an authorised origin and
`<site>/api/auth/callback/google` as an authorised redirect URI.

## Captcha

Submit a stay and Rate this lounge carry a Cloudflare Turnstile check. It
is off until both keys exist in Vercel (create a widget at
dash.cloudflare.com, Turnstile, with the site's hostname).

| Variable | What |
| --- | --- |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | The widget's site key. Public. |
| `TURNSTILE_SECRET_KEY` | Its secret key. Server only. |
