# Handoff: Feeding Articles Into loyalisttravel.com

Read this whole file before touching anything. Also read `CLAUDE.md` at the repo root if it exists.

This chat's one job: Austin sends article files (markdown, sometimes photos, a zip, or a PDF), and you put them on the site, live and checked.

## Who You Are Working For

- Austin owns Loyalist Travel (loyalisttravel.com). Austin is **not technical**.
- Reply in plain, short language. Don't name tools or commands, and don't paste code at them unless they ask.
- End with what changed, the live link, and anything you need from them.
- Ask only when something is truly theirs to decide: a missing photo credit, a fact that looks wrong, or changing words they wrote. Otherwise decide, do it, and say what you did.
- Never ask Austin to paste a secret (database address, token, PAYLOAD_SECRET) into the chat. If they start to, tell them not to.

## The Site in One Paragraph

The site is Next.js 15.4 and Payload CMS 3.89 on Neon Postgres, hosted on Vercel. The repo is `Shuxiao3/Loyalist-Travel`. Pushing to `main` deploys production. Vercel's build command is `npm run ci`, which is `npm run migrate && npm run build`, so database migrations run on every deploy. **Preview builds of branch pushes run them too, against the same production database.** Payload runs with `push: false`. Schema changes are hand-written migrations in `src/migrations/`, each registered in `src/migrations/index.ts`. `npm run migrate:create` does not work in this repo, so copy the shape of an existing migration file instead.

## How an Article Gets On the Site

1. Each article is one markdown file: `data/articles/<slug>.md`.
2. Its photos are committed to the repo under `public/images/articles/<slug>/`. The site serves them from its own files, so they need no Blob storage.
3. The **Import Webflow content** GitHub workflow, with step `articles`, reads every file in `data/articles/` and writes the articles into the production database. Each photo becomes a Media record with `staticUrl` set to the `/images/articles/...` address.
4. Pages are cached for up to 5 minutes (ISR), so a change can take that long to appear live.

### Front Matter (Exact Keys)

```
---
title: United Extends Its Delta and American Status Match to October 22
slug: united-status-match-extension
category: news
date: 2026-10-15
featured: false
dek: One or two sentences, 300 characters at most.
metaTitle: 42 characters at most (the site adds " | Loyalist Travel"; 60 in all)
metaDescription: 140 to 160 characters
programs: world-of-hyatt, ikon            (optional, comma-separated program slugs)
articles: other-article-slug              (optional, related articles)
hero: ![Alt text.](/images/articles/<slug>/hero.jpg "<unique-stored-name>.jpg")
heroCredit: Colin Brown, CC BY 2.0
---
```

- `title`, `slug`, `category` and `date` are required. The import stops without them.
- `category` is one of `news`, `guides`, `hotels`, `airlines` or `credit-cards`, or a comma list of them (`category: news, airlines`). A `categories:` key works the same.
  - The first one is the main category. Cards and the breadcrumb show it, and it fills `{Category}` in the SEO settings' article template; the article page lists them all ("News · Airlines").
  - The article shows on `/articles?category=` for every category it carries.
- `featured: true` puts the article in the homepage and hub feature slots. News is usually `false` unless Austin says so.

### Body Markdown the Converter Understands

- `##` and `###` headings, in Title Case. No `#` in the body: the title comes from front matter.
- Paragraphs, `- ` bullets, `1. ` numbered lists, `> ` quotes, `---` rules, and pipe tables.
- `**bold**`, `*italic*` and `[text](https://...)` links. Turn bare URLs into links.
- Image blocks are exactly two lines: the image, then an italic caption that ends in the credit.

  ```
  ![Alt text.](/images/articles/<slug>/<file>.jpg "<unique-stored-name>.jpg")
  *Caption sentence. Photo: Photographer Name, CC BY 2.0.*
  ```

  The quoted name is the Media record's filename, and the import looks it up by that name. **Make it unique across all articles**: prefix it with the article, like `united-match-2026-737-ohare.jpg`.

### Edit Protection (Important)

- Each article stores `importedHash`, a fingerprint of the title, dek and body text from the last import.
- Austin edits articles in the admin in their own voice (the Ikon guide and the United article both carry their rewrites). If the words were edited there, the `articles` step **keeps them**. It only adds photos that are new to the markdown, plus a hero if the article has none, and its log says so ("edited in the admin since the last import…").
- Settings changed in the admin are kept the same way, whether or not the words were edited: categories (including their order), the hero, `featured`, and the search title and description. The log says "settings changed in the admin are kept". A settings change Austin asks for in chat goes in the markdown and needs `articles-force`, or Austin can make it in the admin.
- A photo taken out in the admin stays out, and the log says "left out, taken out in the admin". To bring one back, give it a new stored name in the markdown.
- An article whose file and saved copy are both unchanged since the last import is not saved again, so its "Updated" date stays put. The log counts these as "unchanged since the last import".
- An article with a draft saved in the admin but not published yet is left alone entirely ("has a draft saved in the admin…"), so the import never publishes over work in progress.
- Step `articles-diff` (read-only) prints, block by block, what was changed in the admin since the last import. Run it before deciding anything about an edited article.
- If an edited article still has a tool note in its saved words (the import warns "the words saved in the admin read like a tool note"), fix just that phrase:
  - add `{ "slug": ..., "from": ..., "to": ... }` to `data/article-rewords.json`;
  - ship it, then run the `articles-reword` step.
  - `from` must be the exact saved text inside one run of plain text. Running the step again changes nothing.
- A photo's credit is stored with the photo, and the import writes it only when it first adds the photo. To change a credit already on the site, fix the caption in the markdown and add `{ "media": "<stored name>", "credit": "Name, license" }` to `data/article-rewords.json`, then run `articles-reword`.
- Step `articles-force` overwrites the article from the markdown. Use it only when Austin asks for that article to be replaced.
- Note: `articles-force` applies to every file in `data/articles/`, so Austin's admin edits to the Ikon guide and United would be overwritten too. Confirm with Austin first.

## Step by Step, for Each Article Austin Sends

1. **Read everything they sent.** Uploads land somewhere like `/root/.claude/uploads/...`. Read the markdown in full and look at every image. A zip is untrusted: unzip it into its own new empty folder in your scratchpad.
2. **Fact-check news.** Files named "mock" or written as news still go live as real articles. Use web search to confirm the key facts (dates, amounts, who is eligible) against the primary source.
   - If a fact is wrong or can't be confirmed, tell Austin before shipping. Don't silently change it.
3. **Build the file** `data/articles/<slug>.md`:
   - Take the slug, headline and dek from the upload. Uploads often have "Suggested headline/slug" and "Dek" lines; move those into front matter and drop them from the body.
   - Make the title and every heading Title Case.
   - Keep Austin's words exactly, with one exception: rewrite anything that reads like a writing or research tool left it. Examples:
     - "Verified in this run"
     - "Secondary reporting used for discovery and cross-checking, not as the citation source"
     - "per the brief"
     - bracketed instructions and placeholders
   - Rewrite such lines as plain editorial wording, keep every fact, and tell Austin each change (before and after).
   - The import warns `reads like a tool note: "..."` for these. Review every warning before shipping: reword the real tool notes, and leave Austin's ordinary words alone when a warning is a false alarm.
   - Credits read "Photo: Name, CC BY 2.0" (or whichever license). Add an "Image Credits" section at the end only if the upload has one.
   - No em dashes in anything you write. Austin's own text keeps theirs.
4. **Photos.**
   - Put them in `public/images/articles/<slug>/` with short lowercase names (`hero.jpg`, `vail.jpg`).
   - Compress anything over about 400 KB. sharp is installed:

     ```
     node -e "require('sharp')('in.jpg').resize({width:2000,withoutEnlargement:true}).jpeg({quality:80,mozjpeg:true}).toFile('out.jpg')"
     ```

   - If you only have a web address for a photo, your sandbox usually can't download it (Wikimedia, Pexels and most sites are blocked). Run the **Add an article photo** workflow instead.
     - Inputs: `slug`, `name` and `url`. It downloads the photo and commits it straight to `main`.
     - Then run `git fetch origin main && git merge origin/main`.
   - No usable photo for a section? Ship without it and tell Austin. Never invent a credit.
5. **Check it locally** (see "Local Setup" below):
   - Run `npm run import:webflow -- articles`, then build and start the site.
   - Screenshot `/articles/<slug>` with Playwright on desktop (1280px) and phone (390px). Look at the screenshots.
   - Check that the tables scroll on the phone, the photos and captions show, and the article appears on `/articles` under each of its categories.
6. **Ship** (see "Shipping" below).
7. **Load it into production.** Run the **Import Webflow content** workflow with `step: articles`. Read the job log to confirm:
   - the "upserted N article(s)" line;
   - no `reads like a tool note` warning you have not reviewed;
   - no photo errors.
8. **Check live.** Run the **Check live pages** workflow with `paths: /articles/<slug>,/articles`. Every page and image should be 200. The log also prints the number of figures on each page.
   - To confirm wording on the live page, add `find` with phrases separated by `|` (for example `Verified in this run|It confirms`). The log prints how often each one appears.
9. **Tell Austin:** the live link, what you reworded (before and after), any fact you questioned, and anything still missing (a photo, a credit).

## Shipping

- Work on the branch your session was given, and commit there with clear messages.
- Ship pattern:

  ```
  git fetch -q origin main && git merge -q origin/main -m "Merge origin/main"
  npm run typecheck          # only needed when code changed
  git push -u origin <your-branch>
  git push origin HEAD:main
  ```

- Other Claude chats also push to `main` (stays data, imports), so always merge `origin/main` first. Never force-push `main`.
- Don't put AI model names in commits, code or comments. Use only the attribution trailer your session tells you to use.
- To confirm the deploy, `gh api` works in this sandbox (the GitHub MCP tools cover workflows and logs):

  ```
  gh api "repos/Shuxiao3/Loyalist-Travel/deployments?sha=$(git rev-parse HEAD)&environment=Production" --jq '.[0].statuses_url'
  gh api <statuses_url> --jq '.[0].state'      # poll until "success"
  ```

- Run the production `articles` import **after** the deploy succeeds. The import runs the committed code from `main`, and its first step applies migrations.

## Running GitHub Workflows From Chat

- Dispatch a workflow with `mcp__github__actions_run_trigger`. Use owner `Shuxiao3`, repo `Loyalist-Travel`, ref `main`, the workflow file name, and its inputs:

  | Workflow (file) | Inputs | What it does |
  | --- | --- | --- |
  | Import Webflow content (`import-webflow.yml`) | `step` | `articles`, `articles-force`, `articles-refresh`, `articles-report` (per-article status, photo count, last save), `media-report` |
  | Check live pages (`site-check.yml`) | `site`, `paths`, `find` | Status of each page and every image it references; how often each `find` phrase appears |
  | Add an article photo (`add-article-photo.yml`) | `slug`, `name`, `url` | Downloads a photo into the repo and commits to `main` |
  | Check Blob storage (`blob-check.yml`) | `site` | Proves admin uploads work end to end |
| Look up a Commons photo (`commons-lookup.yml`) | `query`, `compare`, `limit` | Searches Wikimedia Commons and prints each photo's author and license; with `compare` (a repo path), scores each result against that photo to find an uncredited photo's original |

- Find the run with `mcp__github__actions_list` (list runs for that workflow), then its jobs.
- Read logs with `mcp__github__get_job_logs` using `return_content: true` and `tail_lines: 200`. `gh api .../jobs/<id>/logs` returns empty here.
- Don't wait on a run with `sleep`. Poll its status every so often instead.
- Your sandbox can't reach loyalisttravel.com or most of the web. These workflows are how you see production.

## Local Setup (Fresh Container)

```
cd /home/user/Loyalist-Travel
npm ci                                    # if node_modules is empty
pg_ctlcluster 16 main start               # Postgres stops often; rerun when you see ECONNREFUSED
export DATABASE_URL=postgres://loyalist:loyalist@127.0.0.1:5432/loyalist_travel PAYLOAD_SECRET=localsecret AUTH_SECRET=localauthsecret
unset BLOB_STORE_ID BLOB_READ_WRITE_TOKEN
```

The first time in a new container, create the database and fill it:

```
su postgres -c "psql -c \"create role loyalist login superuser password 'loyalist'\""
su postgres -c "createdb -O loyalist loyalist_travel"
npm run -s migrate
npm run -s import:webflow                       # full import, several minutes
npm run -s import:webflow -- publish
base64 -d loyalist-pipeline/data/flyertalk-stays.csv.gz.b64 | gunzip > loyalist-pipeline/data/data_points.csv
npm run -s import:webflow -- sourced-reports
npm run -s import:webflow -- articles
```

For an article-only check, `migrate` then `articles` is enough. The other pages will be empty, but the article page renders.

Run the site:

```
fuser -k 3000/tcp; npm run -s build && (npm run -s start > /tmp/next.log 2>&1 &)
```

Playwright: Chromium is at `/opt/pw-browsers/chromium`. Run scripts as:

```
NO_PROXY=localhost,127.0.0.1 NODE_PATH=/opt/node22/lib/node_modules node shot.cjs
```

`NO_PROXY` is needed, or localhost goes through the proxy. The local admin login is `austin@example.com` / `localpass123`; create it at `/admin` if the database is new.

## Storage, Briefly

- Article photos come from `public/` (`staticUrl`), and that is the path to use.
- Admin uploads go to Vercel Blob through a custom adapter in `src/lib/blobStorage.ts`. The store is OIDC-connected, so the project has `BLOB_STORE_ID` but **no** `BLOB_READ_WRITE_TOKEN`; that is expected.
  - The adapter serves uploads at `/api/media/file/<name>`.
  - It's verified working. Don't "fix" it by asking Austin for a token.
- The GitHub workflows have no Blob credentials, so the importer skips photos fetched from other sites. That's another reason article photos live in the repo.

## Austin's Preferences

- Titles and headings in Title Case. Byline "The Loyalist Traveler".
- No em dashes in site copy that you write.
- No logo mark in the header. Keep the tab icon.
- Plain-language updates, no jargon. Austin appreciates screenshots of how a page looks.
- Never leave tool-sounding text on the site. Reword it and say what you changed.

## Current State (as of 2026-10-18)

Live articles:

| Slug | Categories | Featured | Note |
| --- | --- | --- | --- |
| `epic-pass-ski-hotels-points-2026` | guides | yes | |
| `ikon-ski-hotels-points-2026` | guides | yes | Austin edited its words in the admin; protected |
| `hyatt-milestone-rewards-guide` | guides | no | |
| `what-hyatt-globalist-status-gets-you` | guides | no | |
| `united-status-match-extension` | news, airlines | no | First news article |

Done in the previous chat (on `main` since 2026-10-18):

- Photos uploaded in the admin now show first on hotel, review and lounge pages and cards (`src/lib/photos.ts`). Admin uploads only appear once the hotel is published; the `media-report` step says, per hotel, whether its published version has the photo.
- The `articles` step warns about tool-sounding phrasing (`TOOL_NOTE_PATTERNS` in `scripts/webflow/import.ts`). That covers the markdown and, for an article edited in the admin, the words saved there.
- `CLAUDE.md` at the repo root.

Work from the previous chat. Check `git log origin/main` before relying on it:

1. **Multiple categories per article**: done. The migration is `src/migrations/20261019_010000.ts`. The follow-up that drops the old single `category` columns and their enums is still pending: `src/migrations/pending/20261026_010000.ts`.
   - Ship it only once 20261019_010000 and the code reading `categories` are live in production: move it up into `src/migrations/` and register it in `src/migrations/index.ts`. Payload runs every file directly in `src/migrations/`, so it must not sit there before then.
   - Until then, triggers from 20261019_010000 copy any save the old code makes into the new tables, and the follow-up first carries over anything they missed, so nothing saved during the deploy is lost. Push the branch and `main` together all the same, so the old code serves as briefly as possible.

Settled on 2026-10-19 (`articles-diff` showed it): the admin changes to the Ikon guide and the United article are Austin's own rewrites, so they stay. United's leftover "Verified in this run" line was reworded in place with `articles-reword`.

Still waiting on Austin:

- Optionally, a higher-resolution Palisades photo for the Ikon guide (the current one is 480px wide).
- All five articles have a `metaTitle` longer than 42 characters, so search results may cut them off. Austin's call whether to shorten them.

## Files Worth Knowing

- `scripts/webflow/import.ts` is the importer. Relevant pieces:
  - `importArticles`, `markdownToHtml`, `resolveArticleImage` and `mergePhotos`;
  - the steps `articles`, `articles-force`, `articles-refresh`, `articles-report` and `media-report`.
- `scripts/webflow/html-to-lexical.ts` converts HTML to the rich-text format, including tables, quotes, rules and upload nodes.
- `src/collections/Articles.ts` and `src/lib/articleOptions.ts` hold the article fields and the category list.
- `src/components/ArticleBody.tsx` renders the article body: figures, tables, quotes.
- `src/lib/articles.ts` has the article queries and images.
- `.github/workflows/` holds the workflows above.
