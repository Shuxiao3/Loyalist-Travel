# Reported stays pipeline

FlyerTalk threads → structured stay data points → Webflow CSVs.

Reported stays are what members say happened to them. They are not the site's
own scored reviews and they are not reader submissions; they are a third,
weaker source, and they stay labelled as one. Every row carries a link to the
post it came from and a confidence the extraction assigned itself.

```
loyalist-pipeline/
  park_hyatt_flyertalk_threads.csv   thread ids and the hotel each belongs to (input)
  1_grab_flyertalk.js                browser console grabber
  2_extract.py                       Claude API extraction
  3_build_webflow.py                 Webflow import files
  raw/                               put ft_<id>.txt files here
  data/                              outputs land here
```

## 1. Grab pages (browser)

1. Open any flyertalk.com page in Chrome.
2. Edit `CONFIG` at the top of `1_grab_flyertalk.js` (`THREAD_IDS`, `LAST_N_PAGES`).
3. Cmd+Option+J → type `allow pasting` if prompted → paste the script → Enter.
4. Chrome may ask to "allow multiple downloads" the first time. Allow it.
5. Move the downloaded `ft_<id>.txt` files into `raw/`.

It runs in the console rather than on a server so the requests carry your own
session and look like the browsing they are. One page at a time, `DELAY_MS`
apart, newest pages first.

Pilot first: the default config pulls the last 5 pages of Park Hyatt Kyoto.
Keep `DELAY_MS` at 3000 or more and pull only recent pages. It's still
automated collection, so go slow.

Each file holds the thread's title, when it was grabbed, and one block per
post: the post id, its date, a link to it, and the post's own words. Quoted
text and signatures are stripped — a quote would otherwise make one member's
stay look like the poster's.

If the console reports `no posts parsed`, or a page count of 1 for a thread you
know is longer, FlyerTalk's markup has moved from under the selectors. Nothing
is downloaded in that case. Paste `probe_markup.js` into the console on the
same page: it reports how the page is actually built — which containers hold
posts, and how the page states its page count — which is what `parsePosts` and
`totalPages` need to be pointed at.

### The threads CSV

`park_hyatt_flyertalk_threads.csv` maps a thread id to the hotel it is about,
so the extraction knows which hotel and programme it is reading and does not
have to guess from the thread title.

| Column | What |
| --- | --- |
| `thread_id` | FlyerTalk's thread id, the `t=` in the URL. Blank means not found yet |
| `hotel`, `hotel_slug` | Exactly as in `data/webflow/hotels.json`, so the import matches an existing hotel |
| `city`, `country` | From the hotel's destination |
| `program`, `brand` | `World of Hyatt`, `Park Hyatt` |

It ships with all 37 Park Hyatt properties in the Webflow export and one
thread id filled in, the Kyoto pilot. The rest are a worklist: find the
thread, paste the id, and that hotel joins the next run. Rows without a
thread id are ignored by every step.

## 2. Extract (terminal)

```bash
pip install anthropic
export ANTHROPIC_API_KEY=sk-...

python 2_extract.py --only 1801359      # pilot thread
python 2_extract.py                     # everything in raw/
```

* Output: `data/data_points.csv`, one row per reported stay.
* Results are cached per page in `data/cache/`, so reruns only process new pages.
* The CSV is rebuilt from the whole cache every run, so `--only` never drops
  the rows another thread already produced.
* Default model is `claude-sonnet-5`. `--model claude-haiku-4-5-20251001` is
  cheaper and fine once the prompt is tuned.
* Posts that aren't actual stays are dropped — questions, rate chatter, news,
  replies that only agree. Summaries are written fresh, not copied, and only
  extracted fields plus a source link are stored. No post text, no member names.

| Flag | What |
| --- | --- |
| `--only <thread_id>` | Extract one thread instead of all of them |
| `--model <id>` | Default `claude-sonnet-5` |
| `--dry-run` | Parse `raw/` and report what would be sent. No API calls |
| `--force` | Re-extract pages that are already cached |
| `--threads-csv`, `--raw-dir`, `--out` | Paths, if you keep them elsewhere |

A page that fails is reported and skipped, not retried in place; the run
carries on and a later rerun picks it up. The last line of a run says how many
tokens it used, cache reads included.

### The fields

The answer lists are the ones the site already uses for reader stays, in
`src/lib/stayOptions.ts`, so reported data and submitted data speak the same
language. `unknown` and empty are real answers, and common: most posts do not
mention most things.

| Field | Values |
| --- | --- |
| `status_held` | A status slug from `data/webflow/status-levels.json`, or `unknown` |
| `upgrade` | `none`, `yes`, `award`, `unknown` |
| `upgrade_type` | `floor`, `view`, `category`, `suite` |
| `suite_type` | `junior`, `one-bedroom`, `two-bedroom`, `specialty` |
| `upgrade_how` | `proactive`, `asked` |
| `breakfast` | `full`, `buffet`, `a-la-carte`, `credit`, `not-honoured`, `not-eligible`, `unknown` |
| `lounge_access` | `given`, `declined`, `not-used`, `unknown` |
| `late_checkout` | `honoured`, `declined`, `not-requested`, `unknown` |
| `welcome_amenity` | `given`, `not-given`, `unknown` |
| `sentiment` | `positive`, `mixed`, `negative` |
| `confidence` | `high`, `medium`, `low` |

`stay_month` is `YYYY-MM` when the post pins the stay down, read against the
post's own date, and empty otherwise. `post_date` is when the post was
written, which is not the same thing.

Pilot check: open `data/data_points.csv`, compare ~10 rows against the posts,
then adjust the `SYSTEM` prompt in `2_extract.py` if needed. Delete
`data/cache/` after prompt changes so pages get re-extracted — a run whose
cache predates the current prompt says so.

## 3. Build Webflow files

```bash
python 3_build_webflow.py              # drops low-confidence rows
python 3_build_webflow.py --since 2023 # recent stays only
```

* `data/webflow_data_points.csv` → import into a Data Points CMS collection
  (fields match the CSV headers; `Source` = Reported).
* `data/webflow_hotel_summary.csv` → per-hotel aggregates (Globalist upgrade
  rate, suite rate, breakfast honoured, sentiment split) for hotel pages.

Values are written as labels rather than slugs, because a Webflow import
matches option and reference fields on the text it sees: `Yes`, `World of
Hyatt Globalist`, `Full: buffet and à la carte`.

| Flag | What |
| --- | --- |
| `--since <year>` | Keep stays from that year on. Rows with no date at all are dropped, and the count is reported |
| `--keep-low-confidence` | Keep the rows the extraction was unsure about |
| `--tier <slug>` | Status slug for the per-tier columns. Default `hyatt-globalist` |
| `--min-stays <n>` | Omit hotels below this many reported stays. Default 1; the site's own reader data appears at 5 |

### How the rates are counted

Every rate counts only the stays that answered the question, and each has a
`Sample` column next to it saying how many that was. Twelve reported stays
where four mention breakfast give a breakfast figure out of four. Where nothing
answered, the rate is `N/A`, which is how the Webflow export writes it too.

| Rate | Numerator over denominator |
| --- | --- |
| Upgrade | `yes` or `award`, over stays that said whether they were upgraded |
| Suite | `award`, or `yes` with `upgrade_type: suite`, over the same |
| Breakfast honoured | anything but `not-honoured`, over stays that were eligible and said |
| Lounge access | `given`, over `given` plus `declined` |
| Late checkout | `honoured`, over `honoured` plus `declined` |
| Welcome amenity | `given`, over `given` plus `not-given` |

A refused upgrade counts as `none`, not as silence. `not-eligible` breakfast
and `not-used` lounges are silence: they say nothing about what the hotel does.

## What gets stored, and what doesn't

The design is deliberate. A post's own words are copyrightable expression
belonging to whoever wrote it; the facts inside it are not. So the raw pages
stay local and uncommitted, and what survives into the CSVs is the extracted
fields, a fresh summary written rather than copied, and a link back to the
post. No post text, no member names.

That is also why `1_grab_flyertalk.js` pulls recent pages only, waits between
requests, and runs in a browser rather than on a server. None of this is legal
advice, and if reported stays become a significant part of the site it is
worth having someone look at it properly.

## Keeping it separate

Reported data stays separate from the editor-scored reviews on the site, and
from reader submissions. It is a different source with a different weight, and
a hotel page should say which it is showing. Small samples are the main risk
here: a 100% upgrade rate over two posts is not a fact about a hotel, which is
what the `Sample` columns and `--min-stays` are for.

`raw/*.txt` and `data/cache/` are not committed. The built CSVs are not
ignored, so an import you actually used can be committed as a record of it.

## Adding brands later

Make a new threads CSV with the same columns for Marriott, Hilton or IHG and
point `--threads-csv` at it, or merge it into one file. `status_held` already
covers all four programmes' tiers, and `--tier` picks which one the per-tier
columns report: `bonvoy-titanium`, `hilton-diamond`, `ihg-diamond`.
