#!/usr/bin/env python3
"""Turns the raw FlyerTalk dumps in raw/ into one row per reported stay.

Reads ft_<threadId>.txt as written by 1_grab_flyertalk.js, sends each page of
posts to Claude, and writes data/data_points.csv. Posts that are not
first-hand stay reports are dropped. The answer vocabulary is the one the site
already uses for reader stays, in src/lib/stayOptions.ts, so reported data and
submitted data speak the same language.

    pip install anthropic
    export ANTHROPIC_API_KEY=sk-...

    python 2_extract.py --only 1801359      the pilot thread
    python 2_extract.py                     everything in raw/

Each page is cached in data/cache/, so a rerun only pays for pages it has not
seen. The CSV is rebuilt from the whole cache every run, so --only never drops
the rows another thread already produced. After editing SYSTEM below, delete
data/cache/ so the pages are extracted again.

Nothing from the post itself is stored: the summary is written fresh, and the
row holds the extracted fields plus a link to the post. No post text, no
member names.
"""

import argparse
import csv
import hashlib
import json
import os
import re
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
RAW_DIR = HERE / "raw"
DATA_DIR = HERE / "data"
CACHE_DIR = DATA_DIR / "cache"
THREADS_CSV = HERE / "park_hyatt_flyertalk_threads.csv"
OUT_CSV = DATA_DIR / "data_points.csv"

DEFAULT_MODEL = "claude-sonnet-5"
MAX_TOKENS = 16000

# The answer lists from src/lib/stayOptions.ts, plus "unknown" for the common
# case of a post that simply does not say. Keep these in step with that file.
UPGRADE = ["none", "yes", "award", "unknown"]
UPGRADE_TYPE = ["floor", "view", "category", "suite", ""]
SUITE_TYPE = ["junior", "one-bedroom", "two-bedroom", "specialty", ""]
UPGRADE_HOW = ["proactive", "asked", ""]
BREAKFAST = ["full", "buffet", "a-la-carte", "credit", "not-honoured", "not-eligible", "unknown"]
LOUNGE_ACCESS = ["given", "declined", "not-used", "unknown"]
LATE_CHECKOUT = ["honoured", "declined", "not-requested", "unknown"]
WELCOME_AMENITY = ["given", "not-given", "unknown"]
SENTIMENT = ["positive", "mixed", "negative"]
CONFIDENCE = ["high", "medium", "low"]

# Status slugs from data/webflow/status-levels.json, grouped by programme so a
# thread is only offered the tiers its programme has.
STATUS_LEVELS = {
    "World of Hyatt": ["hyatt-member", "hyatt-discoverist", "hyatt-explorist", "hyatt-globalist", "hyatt-lifetime-globalist"],
    "Marriott Bonvoy": ["bonvoy-member", "bonvoy-silver", "bonvoy-gold", "bonvoy-platinum", "bonvoy-titanium", "bonvoy-ambassador"],
    "Hilton Honors": ["hilton-member", "hilton-silver", "hilton-gold", "hilton-diamond"],
    "IHG One Rewards": ["ihg-club", "ihg-silver", "ihg-gold", "ihg-platinum", "ihg-diamond"],
}
ALL_STATUS = sorted({s for v in STATUS_LEVELS.values() for s in v}) + ["unknown"]

FIELDS = [
    "thread_id", "page", "source", "hotel", "hotel_slug", "city", "country", "program", "brand",
    "post_id", "post_url", "post_date", "stay_month", "status_held",
    "room_booked", "room_received", "upgrade", "upgrade_type", "suite_type", "upgrade_how",
    "breakfast", "lounge_access", "late_checkout", "welcome_amenity",
    "sentiment", "confidence", "summary", "model", "extracted_at",
]

SYSTEM = """You read posts from a FlyerTalk hotel thread and record the stays members report in them.

Return one record per reported stay. A post earns a record when the member is describing a stay of their own at this hotel: they were there, and they say something about how it went. Omit everything else, and omit is the default — questions about future stays, rate and award availability chatter, news, photographs without a stay, replies that only agree or argue, trip plans, and posts about a different hotel all get no record. One post occasionally reports two separate stays; that is two records. A post that reports the same stay a previous post already described is still that member's own stay: record it.

You are given one hotel, and only stays at that hotel count. This matters more on Reddit than it did on a forum thread about a single property: a trip report often names four or five hotels across a country, and comments wander to whatever hotel the commenter would rather talk about. Read every field against the stay at the hotel you were given. A post describing a suite upgrade at a different property and nothing about this one gets no record at all; a post covering both gets a record for this one only, and none of the other hotel's details belong in it.

Fill each field only from what the post says. "unknown" and "" are correct answers and are always better than an inference. In particular:

- status_held: the tier the member held on that stay, as a slug from the list you are given. Only what they state or plainly imply about themselves ("as a Globalist", "my Explorist stay"). A member complaining that Globalists get suites is not saying they are one.
- upgrade: "none" when they say they got no upgrade, "yes" when they got one, "award" when they applied a confirmed suite upgrade award, "unknown" when the post does not cover it. An upgrade the member asked for and was refused is "none".
- upgrade_type and suite_type: only when upgrade is "yes" or "award", otherwise "".
- upgrade_how: "proactive" when it arrived without asking, "asked" when they asked or the hotel responded to a request, "" when unclear or there was no upgrade.
- room_booked and room_received: the room names the post uses, a few words each, "" when not named.
- breakfast, lounge_access, late_checkout, welcome_amenity: the outcome for this stay, from the lists given.
- stay_month: "YYYY-MM" when the post states or clearly implies when the stay was, reading relative dates ("last week", "in May") against the post's own date. "" when the month cannot be pinned down. Never guess a month from the post date alone when the post gives no timing.
- sentiment: how the member found the stay overall — "positive", "mixed" or "negative".
- confidence: "high" when this is plainly a first-hand stay report and the fields you filled are stated outright; "medium" when it reads as a stay report but the details are thin or partly implied; "low" when you are unsure it is a stay report at all, or you had to read between the lines to fill anything. Low-confidence records are dropped downstream, so use it rather than leaving a doubtful record looking solid.
- summary: one or two sentences, up to 40 words, in your own words, on what happened on this stay. Write it fresh. Do not quote, echo or lightly reword the post's phrasing; describe what it reports. Facts only — what the member was given, asked for, or refused. No opinions of your own and no marketing language.

Use the exact post_id given for the post the record comes from. Return JSON only."""

# One object per stay. Every field is required and the enums are closed, so a
# row is either complete or the request failed; nothing arrives half-filled.
STAY_SCHEMA = {
    "type": "object",
    "properties": {
        "post_id": {"type": "string"},
        "stay_month": {"type": "string"},
        "status_held": {"type": "string", "enum": ALL_STATUS},
        "room_booked": {"type": "string"},
        "room_received": {"type": "string"},
        "upgrade": {"type": "string", "enum": UPGRADE},
        "upgrade_type": {"type": "string", "enum": UPGRADE_TYPE},
        "suite_type": {"type": "string", "enum": SUITE_TYPE},
        "upgrade_how": {"type": "string", "enum": UPGRADE_HOW},
        "breakfast": {"type": "string", "enum": BREAKFAST},
        "lounge_access": {"type": "string", "enum": LOUNGE_ACCESS},
        "late_checkout": {"type": "string", "enum": LATE_CHECKOUT},
        "welcome_amenity": {"type": "string", "enum": WELCOME_AMENITY},
        "sentiment": {"type": "string", "enum": SENTIMENT},
        "confidence": {"type": "string", "enum": CONFIDENCE},
        "summary": {"type": "string"},
    },
    "required": [
        "post_id", "stay_month", "status_held", "room_booked", "room_received",
        "upgrade", "upgrade_type", "suite_type", "upgrade_how",
        "breakfast", "lounge_access", "late_checkout", "welcome_amenity",
        "sentiment", "confidence", "summary",
    ],
    "additionalProperties": False,
}

OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {"stays": {"type": "array", "items": STAY_SCHEMA}},
    "required": ["stays"],
    "additionalProperties": False,
}


# --- raw files -------------------------------------------------------------

MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}


def parse_post_date(raw, grabbed_at):
    """FlyerTalk's post date to YYYY-MM-DD, or "" when it will not parse.

    The themes write "Jan 3, 26, 10:14 am", sometimes a four-digit year, and
    "Today" or "Yesterday" for the last two days — which is why the grab time
    is recorded in the file.
    """
    text = (raw or "").strip()
    if not text:
        return ""
    # Reddit writes an ISO date straight from created_utc; FlyerTalk writes prose.
    iso = re.match(r"(\d{4})-(\d{2})-(\d{2})", text)
    if iso:
        try:
            return date(int(iso.group(1)), int(iso.group(2)), int(iso.group(3))).isoformat()
        except ValueError:
            return ""

    base = grabbed_at.date() if grabbed_at else date.today()
    low = text.lower()
    if low.startswith("today"):
        return base.isoformat()
    if low.startswith("yesterday"):
        return (base - timedelta(days=1)).isoformat()

    m = re.search(r"([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{2,4})", low)
    if not m:
        m = re.search(r"(\d{1,2})\s+([a-z]{3})[a-z]*\.?,?\s+(\d{2,4})", low)
        if not m:
            return ""
        day, mon, year = m.group(1), m.group(2), m.group(3)
    else:
        mon, day, year = m.group(1), m.group(2), m.group(3)
    if mon not in MONTHS:
        return ""
    year = int(year)
    if year < 100:
        year += 2000
    try:
        return date(year, MONTHS[mon], int(day)).isoformat()
    except ValueError:
        return ""


def parse_raw(path):
    """One ft_<id>.txt into {thread_id, title, grabbed_at, pages: [...]}."""
    text = path.read_text(encoding="utf-8", errors="replace")
    head = {}
    for key in ("THREAD", "THREAD_TITLE", "THREAD_URL", "GRABBED_AT", "SOURCE",
                "HOTEL", "HOTEL_SLUG", "CITY", "COUNTRY", "PROGRAM", "BRAND"):
        m = re.search(rf"^### {key} (.*)$", text, re.M)
        if m:
            head[key] = m.group(1).strip()

    thread_id = head.get("THREAD") or re.sub(r"^(ft|reddit)_", "", path.stem)
    grabbed_at = None
    if head.get("GRABBED_AT"):
        try:
            grabbed_at = datetime.fromisoformat(head["GRABBED_AT"].replace("Z", "+00:00"))
        except ValueError:
            pass

    pages = []
    # Split on page markers, keeping each page's number with its posts.
    chunks = re.split(r"^### PAGE (\d+)\s*$", text, flags=re.M)[1:]
    for number, body in zip(chunks[0::2], chunks[1::2]):
        posts = []
        for block in re.findall(r"^--- POST (\S*)\n(.*?)^--- END POST$", body, re.M | re.S):
            post_id, fields = block
            def field(name):
                m = re.search(rf"^{name}: (.*)$", fields, re.M)
                return m.group(1).strip() if m else ""
            body_m = re.search(r"^BODY:\n(.*)$", fields, re.M | re.S)
            post_body = body_m.group(1).strip() if body_m else ""
            if not post_body:
                continue
            posts.append({
                "post_id": post_id,
                "date_raw": field("DATE"),
                "post_date": parse_post_date(field("DATE"), grabbed_at),
                "url": field("URL"),
                "text": post_body,
            })
        if posts:
            pages.append({"page": int(number), "posts": posts})

    return {
        "thread_id": thread_id,
        "title": head.get("THREAD_TITLE", ""),
        "url": head.get("THREAD_URL", ""),
        "grabbed_at": grabbed_at,
        "pages": pages,
        # What the file itself says about the hotel. A Reddit file carries it;
        # a FlyerTalk file does not, and is looked up in the threads CSV.
        "meta": {k.lower(): head[k] for k in ("HOTEL", "HOTEL_SLUG", "CITY", "COUNTRY", "PROGRAM", "BRAND")
                 if head.get(k)},
        "source": head.get("SOURCE", "FlyerTalk"),
    }


def meta_for(thread_id, threads_meta, thread):
    """The hotel a thread is about.

    A curated row in the threads CSV wins; otherwise whatever the raw file said
    about itself. Reddit files carry their own hotel, because on Reddit no
    thread id means one hotel.
    """
    meta = dict(thread.get("meta") or {})
    meta.update({k: v for k, v in (threads_meta.get(thread_id) or {}).items() if (v or "").strip()})
    return meta


def load_threads_csv(path):
    if not path.exists():
        return {}
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    return {(r.get("thread_id") or "").strip(): r for r in rows if (r.get("thread_id") or "").strip()}


# --- the model ------------------------------------------------------------

def load_anthropic():
    try:
        import anthropic
    except ImportError:
        sys.exit("pip install anthropic")
    return anthropic


def fingerprint(*parts):
    h = hashlib.sha256()
    for part in parts:
        h.update(str(part).encode("utf-8"))
        h.update(b"\x00")
    return h.hexdigest()[:12]


PROMPT_FINGERPRINT = fingerprint(SYSTEM, json.dumps(OUTPUT_SCHEMA, sort_keys=True))


def build_user_message(meta, page, thread):
    """The per-page half of the request: which hotel, then the posts."""
    program = (meta.get("program") or "").strip()
    tiers = STATUS_LEVELS.get(program, ALL_STATUS[:-1])
    lines = [
        f"Hotel: {meta.get('hotel') or thread['title'] or 'unknown'}",
        f"City: {meta.get('city') or 'unknown'}, {meta.get('country') or 'unknown'}",
        f"Loyalty programme: {program or 'unknown'}",
        f"status_held must be one of: {', '.join(tiers)}, unknown",
        "",
        f"Thread page {page['page']}, {len(page['posts'])} posts.",
        "",
    ]
    for post in page["posts"]:
        lines += [
            f"post_id: {post['post_id']}",
            f"posted: {post['date_raw'] or 'unknown'}" + (f" ({post['post_date']})" if post["post_date"] else ""),
            post["text"],
            "---",
        ]
    return "\n".join(lines)


def extract_page(client, model, system, user_text, structured=True):
    """One request, one page of posts.

    Returns (stays, usage, structured), where structured says whether the
    response schema is still in play — a model that rejects it is not asked
    again on later pages.
    """
    anthropic = load_anthropic()
    while True:
        kwargs = {
            "model": model,
            "max_tokens": MAX_TOKENS,
            # The instructions are identical on every page, so they cache and
            # the posts are the only tokens paid for in full.
            "system": [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            "messages": [{"role": "user", "content": user_text}],
        }
        if structured:
            kwargs["output_config"] = {"format": {"type": "json_schema", "schema": OUTPUT_SCHEMA}}
        try:
            response = client.messages.create(**kwargs)
            break
        except anthropic.BadRequestError as err:
            if not (structured and re.search(r"output_config|output_format|json_schema", str(err), re.I)):
                raise
            # Not every model takes a response schema. The prompt already asks
            # for JSON only, so fall back to reading it out of the text.
            print("    model rejected the response schema; reading plain JSON instead", file=sys.stderr)
            structured = False

    text = "".join(b.text for b in response.content if b.type == "text")
    return parse_stays(text), response.usage, structured


def parse_stays(text):
    """The model's JSON to a list of stay dicts, tolerant of stray prose."""
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start < 0 or end <= start:
            raise ValueError(f"no JSON in the response: {text[:200]!r}")
        data = json.loads(text[start:end + 1])
    stays = data.get("stays", data if isinstance(data, list) else [])
    return [s for s in stays if isinstance(s, dict)]


# --- rows and output ------------------------------------------------------

def page_fingerprint(page):
    """What this page holds, not where it sits."""
    return fingerprint(*[f"{p['post_id']}:{p['text']}" for p in page["posts"]])


def cache_path(thread_id, page):
    """Cache files are named after a page's contents, not its number.

    A FlyerTalk page 43 always holds the same posts, so a number was enough.
    A Reddit "page" is the nth search result, and the ranking shifts as posts
    are added — so keying on the number would hand a cached extraction to a
    different submission on the next fetch, and quietly attribute one stay's
    fields to another post. Naming the file after the content it was extracted
    from cannot do that: changed content is simply a page not yet extracted.
    """
    safe = re.sub(r"[^A-Za-z0-9_-]", "-", thread_id)[:60]
    return CACHE_DIR / f"{safe}_{page_fingerprint(page)}.json"


def rows_from_cache(threads_meta, raw_threads):
    """Every page of every raw file that has already been extracted.

    Walks what is in raw/ now and looks each page up by its contents, so a
    cache entry can only ever be joined back to the posts it came from.
    """
    rows, stale = [], 0
    for thread_id, thread in sorted(raw_threads.items()):
        meta = meta_for(thread_id, threads_meta, thread)
        for page_data in thread["pages"]:
            path = cache_path(thread_id, page_data)
            if not path.exists():
                continue
            page = page_data["page"]
            cached = json.loads(path.read_text(encoding="utf-8"))
            if cached.get("prompt_fingerprint") != PROMPT_FINGERPRINT:
                stale += 1
            posts = {p["post_id"]: p for p in page_data["posts"]}
            for stay in cached.get("stays", []):
                post = posts.get(str(stay.get("post_id", "")), {})
                rows.append({
                    "thread_id": thread_id,
                    "page": page,
                    "source": thread.get("source", ""),
                    "hotel": meta.get("hotel") or thread["title"],
                    "hotel_slug": meta.get("hotel_slug", ""),
                    "city": meta.get("city", ""),
                    "country": meta.get("country", ""),
                    "program": meta.get("program", ""),
                    "brand": meta.get("brand", ""),
                    "post_id": stay.get("post_id", ""),
                    "post_url": post.get("url", ""),
                    "post_date": post.get("post_date", ""),
                    "stay_month": stay.get("stay_month", ""),
                    "status_held": stay.get("status_held", "unknown"),
                    "room_booked": stay.get("room_booked", ""),
                    "room_received": stay.get("room_received", ""),
                    "upgrade": stay.get("upgrade", "unknown"),
                    "upgrade_type": stay.get("upgrade_type", ""),
                    "suite_type": stay.get("suite_type", ""),
                    "upgrade_how": stay.get("upgrade_how", ""),
                    "breakfast": stay.get("breakfast", "unknown"),
                    "lounge_access": stay.get("lounge_access", "unknown"),
                    "late_checkout": stay.get("late_checkout", "unknown"),
                    "welcome_amenity": stay.get("welcome_amenity", "unknown"),
                    "sentiment": stay.get("sentiment", ""),
                    "confidence": stay.get("confidence", ""),
                    "summary": " ".join((stay.get("summary") or "").split()),
                    "model": cached.get("model", ""),
                    "extracted_at": cached.get("extracted_at", ""),
                })
    rows.sort(key=lambda r: (r["thread_id"], r["page"], r["post_id"]))
    return rows, stale


def write_csv(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)


# --- main ----------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", metavar="THREAD_ID", help="extract just this thread")
    ap.add_argument("--model", default=DEFAULT_MODEL, help=f"default {DEFAULT_MODEL}")
    ap.add_argument("--threads-csv", type=Path, default=THREADS_CSV)
    ap.add_argument("--raw-dir", type=Path, default=RAW_DIR)
    ap.add_argument("--out", type=Path, default=OUT_CSV)
    ap.add_argument("--force", action="store_true", help="re-extract pages already cached")
    ap.add_argument("--dry-run", action="store_true", help="parse raw/ and report what would be sent; no API calls")
    args = ap.parse_args()

    raw_files = sorted(args.raw_dir.glob("*.txt"))
    if not raw_files:
        sys.exit(f"No .txt files in {args.raw_dir}. Run 1_fetch_reddit.py, or "
                 f"1_grab_flyertalk.js and move the downloads there.")

    threads_meta = load_threads_csv(args.threads_csv)
    raw_threads = {}
    for path in raw_files:
        thread = parse_raw(path)
        if not thread["pages"]:
            print(f"{path.name}: no posts parsed, skipping", file=sys.stderr)
            continue
        raw_threads[thread["thread_id"]] = thread

    if not raw_threads:
        sys.exit("Nothing to do: no posts parsed from any file in raw/.")

    for thread_id, thread in raw_threads.items():
        if not meta_for(thread_id, threads_meta, thread).get("hotel"):
            print(f"nothing names the hotel for {thread_id}: no row in "
                  f"{args.threads_csv.name} and no HOTEL header in the raw file; "
                  f"falling back to its title", file=sys.stderr)

    todo = raw_threads if not args.only else {k: v for k, v in raw_threads.items() if k == args.only}
    if args.only and not todo:
        sys.exit(f"Thread {args.only} is not in {args.raw_dir}.")

    pending = [
        (thread_id, page)
        for thread_id, thread in sorted(todo.items())
        for page in thread["pages"]
        if args.force or not cache_path(thread_id, page).exists()
    ]
    posts = sum(len(p["posts"]) for _, p in pending)
    print(f"{len(raw_threads)} thread(s) in raw/, {len(pending)} page(s) to extract, {posts} posts")

    if args.dry_run:
        for thread_id, thread in sorted(todo.items()):
            print(f"  {thread_id} {threads_meta.get(thread_id, {}).get('hotel') or thread['title']}: "
                  f"{len(thread['pages'])} pages, {sum(len(p['posts']) for p in thread['pages'])} posts")
        return

    if pending:
        anthropic = load_anthropic()
        if not (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")):
            print("ANTHROPIC_API_KEY is not set; relying on an `ant auth login` profile", file=sys.stderr)
        client = anthropic.Anthropic(max_retries=5)

        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        totals = {"in": 0, "out": 0, "cache_write": 0, "cache_read": 0}
        structured, failures, found = True, [], 0

        for index, (thread_id, page) in enumerate(pending, 1):
            meta = meta_for(thread_id, threads_meta, raw_threads[thread_id])
            label = f"[{index}/{len(pending)}] {thread_id} page {page['page']}"
            user_text = build_user_message(meta, page, raw_threads[thread_id])
            try:
                stays, usage, structured = extract_page(client, args.model, SYSTEM, user_text, structured)
            except Exception as err:  # noqa: BLE001 - one bad page must not end the run
                print(f"  {label}: failed — {type(err).__name__}: {err}", file=sys.stderr)
                failures.append((thread_id, page["page"], f"{type(err).__name__}: {err}"))
                time.sleep(2)
                continue

            cache_path(thread_id, page).write_text(json.dumps({
                "thread_id": thread_id,
                "page": page["page"],
                "page_fingerprint": page_fingerprint(page),
                "model": args.model,
                "prompt_fingerprint": PROMPT_FINGERPRINT,
                "extracted_at": datetime.now().astimezone().isoformat(timespec="seconds"),
                "posts": len(page["posts"]),
                "stays": stays,
            }, indent=1, ensure_ascii=False), encoding="utf-8")

            totals["in"] += usage.input_tokens
            totals["out"] += usage.output_tokens
            totals["cache_write"] += getattr(usage, "cache_creation_input_tokens", 0) or 0
            totals["cache_read"] += getattr(usage, "cache_read_input_tokens", 0) or 0
            found += len(stays)
            print(f"  {label}: {len(page['posts'])} posts, {len(stays)} stays")

        print(f"\n{found} stays from {len(pending) - len(failures)} page(s). "
              f"tokens: {totals['in']} in, {totals['out']} out, "
              f"{totals['cache_read']} cache read, {totals['cache_write']} cache write")
        if failures:
            print(f"{len(failures)} page(s) failed and were not cached. Rerun to retry — but a page "
                  f"whose earlier result is still cached keeps it, and needs --force:", file=sys.stderr)
            for thread_id, page_no, why in failures:
                print(f"  {thread_id} page {page_no}: {why}", file=sys.stderr)

    rows, stale = rows_from_cache(threads_meta, raw_threads)
    write_csv(args.out, rows)
    print(f"{len(rows)} rows → {args.out.relative_to(HERE) if args.out.is_relative_to(HERE) else args.out}")
    if stale:
        print(f"{stale} cached page(s) predate the current prompt. Delete data/cache/ and rerun "
              f"to extract them again.", file=sys.stderr)

    low = sum(1 for r in rows if r["confidence"] == "low")
    if low:
        print(f"{low} row(s) are low confidence; 3_build_webflow.py drops them unless told otherwise")


if __name__ == "__main__":
    main()
