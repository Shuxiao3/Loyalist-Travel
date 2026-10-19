# Loyalist Travel

Next.js 15 + Payload 3 + Postgres, hosted on Vercel. See README.md for setup and scripts.

House rules: no em dashes in copy you write; no AI model names in code or comments.

## Articles from Austin

- One markdown file per article: `data/articles/<slug>.md`, front matter first:
  - `title`, `slug`, `category`, `date` (YYYY-MM-DD) are required; the import stops without them.
  - `category` is one of `news`, `guides`, `hotels`, `airlines`, `credit-cards`, or a comma list of them
    (`category: news, airlines`; a `categories:` key works the same). The first is the main category:
    cards and the breadcrumb show it, it fills `{Category}` in the SEO settings' article template,
    and the article page lists them all.
  - `featured: true|false`; `programs:` and `articles:` are comma-separated slugs (programs such as `world-of-hyatt`; related articles).
  - `dek` 300 characters at most (the field's limit); `metaTitle` 42 at most (the site adds
    " | Loyalist Travel", and the admin's search preview counts 60 with it); `metaDescription` 140 to 160.
  - `hero: ![alt](/images/articles/<slug>/<file> "<unique-stored-name>")` and `heroCredit: <credit>`.
- Body headings are `##` or `###` (the converter knows no others), in Title Case.
- Photos ship in the repo under `public/images/articles/<slug>/` and are written as
  `![alt](/images/articles/<slug>/<file> "<unique-stored-name>")`. The quoted name is the Media
  record's filename, looked up by name on every run, so make it unique across articles
  (for example `united-match-2026-hero.jpg`). The next line is an italic caption ending in the
  credit: `*Caption text. Photo: <credit>.*`
- A missing photo: run the **Add an article photo** workflow (Actions tab; inputs: slug, file
  name, image address). It downloads into `public/images/articles/<slug>/` and commits to main,
  so merge origin/main into the branch afterwards.
- Keep Austin's words exactly. The one exception: anything that reads like it came from a writing
  or research tool ("Verified in this run", "used for discovery", "citation source", bracketed
  instructions, placeholders) gets reworded into plain editorial language, keeping every fact,
  and Austin is told what changed (file, before, after).
- `npm run import:webflow -- articles` warns `articles: <file>: reads like a tool note: "..."`
  for such phrasing (the list is `TOOL_NOTE_PATTERNS` in `scripts/webflow/import.ts`). It does not
  stop the import. Review every warning before shipping: reword the real tool notes, and leave
  Austin's ordinary words alone when a warning is a false alarm.
- Never overwrite an article edited in the admin; Austin edits articles there in their own voice. The
  `articles` step keeps the words of any article changed in the admin since the last import (it only
  adds photos new to the markdown, and a hero if it has none) and says so in its output. Settings
  changed in the admin (categories, the hero, `featured`, the search title and description) are kept
  the same way, words edited or not. A photo taken out in the admin stays out (to bring one back,
  give it a new stored name). An article with an unpublished draft in the admin is left alone
  entirely. `articles-force` overwrites every article from the markdown, on purpose only, when
  Austin asks.
- `articles-diff` (read-only) prints what was changed in the admin since the last import, block by
  block. To fix one phrase in an article edited in the admin (a tool note it still carries), add
  `{ "slug", "from", "to" }` to `data/article-rewords.json` and run the `articles-reword` step; it
  changes only that phrase and leaves the rest of the admin's words alone.
- Production import: the **Import Webflow content** workflow with step `articles`. It applies
  migrations, imports, then spot-checks. It uses the repository secrets DATABASE_URL and
  PAYLOAD_SECRET; BLOB_READ_WRITE_TOKEN is optional, since photos under `public/` need no storage.
- Check the live result with the **Check live pages** workflow (site, comma-separated paths):
  it prints the status of each page and of every image it references; anything but 200 fails.

## Shipping

- Commit on the working branch, merge origin/main into it, then push the branch and main
  (`git push origin HEAD:<branch>` and `git push origin HEAD:main`).
- Vercel builds with `npm run ci`: migrations (`payload migrate`) then `next build`, preview
  builds of branch pushes included, against the one production database. A schema change ships
  with a hand-written migration in `src/migrations/`, registered in `src/migrations/index.ts`
  (copy an existing one; `npm run migrate:create` does not work in this repo). Payload runs every
  file directly in that folder, listed or not, so one that must wait sits in `src/migrations/pending/`.
- Verify a deploy through GitHub deployments, which Vercel creates per commit:
  `gh api 'repos/Shuxiao3/Loyalist-Travel/deployments?sha=<sha>'`, then
  `gh api repos/Shuxiao3/Loyalist-Travel/deployments/<id>/statuses` (Production should be `success`).
- Before pushing: `npm run typecheck`.
- Fuller notes for article work (local setup, workflows, current state): `docs/handoff-articles.md`.
- Never paste secrets (database URLs, tokens, PAYLOAD_SECRET) into code, commits, logs or chat.
