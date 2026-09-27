#!/usr/bin/env python3
"""Collects Reddit posts and comments about each hotel, into raw/.

Reddit has a documented JSON API, so this runs in the terminal: no browser, no
console, no scraping of markup that can move. One file per hotel, in the same
format 2_extract.py already reads.

    python 1_fetch_reddit.py --only park-hyatt-kyoto     one hotel
    python 1_fetch_reddit.py                             every hotel with a search term

Search-driven on purpose. On FlyerTalk a thread was about one hotel, so the
hotel was known; on Reddit a post in r/hyatt could be about anything. Searching
per hotel keeps the hotel a known input, which is what 2_extract.py expects,
and aims at the hotels in reddit_hotel_searches.csv rather than at whatever the
subreddit happens to be discussing.

Authentication is optional but better. With a Reddit app's credentials in the
environment it uses the official API at 100 requests a minute:

    export REDDIT_CLIENT_ID=...        # from reddit.com/prefs/apps, "script" type
    export REDDIT_CLIENT_SECRET=...

Without them it falls back to the public .json endpoints, which Reddit throttles
hard and may refuse outright. Either way it waits DELAY between requests and
sends a descriptive user agent, because Reddit blocks clients that do neither.

Reddit's Data API Terms restrict commercial use above modest volumes. This
stays well inside the free tier, but the terms are worth reading before
reported stays become a significant part of a commercial site.
"""

import argparse
import base64
import csv
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
RAW_DIR = HERE / "raw"
SEARCHES_CSV = HERE / "reddit_hotel_searches.csv"

USER_AGENT = "python:loyalist-travel-reported-stays:0.1 (hotel elite benefit research)"
DELAY = 2.0            # seconds between requests
SUBMISSIONS_PER_HOTEL = 25
MIN_BODY_CHARS = 40    # shorter than this carries no stay detail, only tokens
SKIP_AUTHORS = {"AutoModerator", "[deleted]"}
DELETED = {"[deleted]", "[removed]", ""}


class Reddit:
    """The two calls this needs: search a subreddit, read a comment tree."""

    def __init__(self, delay=DELAY):
        self.delay = delay
        self.token = None
        self.last = 0.0
        client_id = os.environ.get("REDDIT_CLIENT_ID")
        secret = os.environ.get("REDDIT_CLIENT_SECRET")
        if client_id and secret:
            self.token = self._get_token(client_id, secret)
            print("using the official API with app credentials")
        else:
            print("no REDDIT_CLIENT_ID/REDDIT_CLIENT_SECRET; using the public .json "
                  "endpoints, which Reddit throttles hard", file=sys.stderr)

    @property
    def base(self):
        return "https://oauth.reddit.com" if self.token else "https://www.reddit.com"

    def _get_token(self, client_id, secret):
        auth = base64.b64encode(f"{client_id}:{secret}".encode()).decode()
        req = urllib.request.Request(
            "https://www.reddit.com/api/v1/access_token",
            data=urllib.parse.urlencode({"grant_type": "client_credentials"}).encode(),
            headers={"Authorization": f"Basic {auth}", "User-Agent": USER_AGENT},
        )
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.load(res)["access_token"]

    def get(self, path, **params):
        """One GET, rate-limited and retried on 429 and 5xx."""
        params.setdefault("raw_json", 1)
        url = f"{self.base}{path}?{urllib.parse.urlencode(params)}"
        headers = {"User-Agent": USER_AGENT}
        if self.token:
            headers["Authorization"] = f"bearer {self.token}"

        for attempt in range(4):
            wait = self.delay - (time.time() - self.last)
            if wait > 0:
                time.sleep(wait)
            self.last = time.time()
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=60) as res:
                    return json.load(res)
            except urllib.error.HTTPError as err:
                if err.code in (429, 500, 502, 503, 504) and attempt < 3:
                    back = float(err.headers.get("retry-after") or 0) or (self.delay * 2 ** (attempt + 1))
                    print(f"    HTTP {err.code}; waiting {back:.0f}s", file=sys.stderr)
                    time.sleep(back)
                    continue
                raise

    def search(self, subreddit, query, limit):
        """Submissions in one subreddit matching a phrase, newest-relevant first."""
        found, after = [], None
        while len(found) < limit:
            page = self.get(f"/r/{subreddit}/search", q=f'"{query}"', restrict_sr=1,
                            sort="relevance", t="all", limit=min(100, limit - len(found)),
                            **({"after": after} if after else {}))
            children = page.get("data", {}).get("children", [])
            found += [c["data"] for c in children if c.get("kind") == "t3"]
            after = page.get("data", {}).get("after")
            if not after or not children:
                break
        return found[:limit]

    def comments(self, submission_id):
        """(submission, flat list of comments) for one post."""
        parts = self.get(f"/comments/{submission_id}", limit=500, depth=10, sort="top")
        if not isinstance(parts, list) or len(parts) < 2:
            return None, []
        posts = [c["data"] for c in parts[0].get("data", {}).get("children", []) if c.get("kind") == "t3"]
        return (posts[0] if posts else None), flatten(parts[1])


def flatten(listing, depth=0, out=None):
    """A comment tree into a list. "more" stubs are not comments; skip them."""
    if out is None:
        out = []
    for child in (listing or {}).get("data", {}).get("children", []):
        if child.get("kind") != "t1":
            continue
        data = child.get("data", {})
        data["_depth"] = depth
        out.append(data)
        replies = data.get("replies")
        if isinstance(replies, dict):
            flatten(replies, depth + 1, out)
    return out


def usable(body, author):
    return (body or "").strip() not in DELETED and len(
        (body or "").strip()) >= MIN_BODY_CHARS and (author or "") not in SKIP_AUTHORS


def day(epoch):
    try:
        return datetime.fromtimestamp(float(epoch), timezone.utc).date().isoformat()
    except (TypeError, ValueError):
        return ""


def render(meta, submissions, grabbed_at):
    """The file 2_extract.py reads. One submission and its comments per PAGE.

    The hotel travels in the header, so the extraction does not have to look it
    up: on Reddit there is no thread id that means one hotel.
    """
    lines = [
        f"### THREAD {meta['hotel_slug']}",
        f"### THREAD_TITLE {meta['hotel']}",
        f"### THREAD_URL https://www.reddit.com/search/?q={urllib.parse.quote(meta['hotel'])}",
        f"### SOURCE Reddit",
        f"### HOTEL {meta['hotel']}",
        f"### HOTEL_SLUG {meta['hotel_slug']}",
        f"### CITY {meta.get('city', '')}",
        f"### COUNTRY {meta.get('country', '')}",
        f"### PROGRAM {meta.get('program', '')}",
        f"### BRAND {meta.get('brand', '')}",
        f"### GRABBED_AT {grabbed_at}",
        f"### PAGES {len(submissions)}",
        "",
    ]
    for number, (post, comments) in enumerate(submissions, 1):
        lines += [f"### PAGE {number}", ""]
        for item in ([post] if post else []) + comments:
            body = item.get("selftext") if "selftext" in item else item.get("body")
            title = item.get("title") or ""
            text = f"{title}\n\n{body}".strip() if title else (body or "").strip()
            if not usable(text, item.get("author")):
                continue
            lines += [
                f"--- POST {item.get('id', '')}",
                f"NUMBER: r/{item.get('subreddit', '')}",
                f"DATE: {day(item.get('created_utc'))}",
                f"URL: https://www.reddit.com{item.get('permalink', '')}",
                "BODY:",
                text,
                "--- END POST",
                "",
            ]
    return "\n".join(lines)


def load_searches(path):
    if not path.exists():
        sys.exit(f"{path} does not exist.")
    with open(path, newline="", encoding="utf-8") as f:
        return [r for r in csv.DictReader(f) if (r.get("search_terms") or "").strip()]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", metavar="HOTEL_SLUG", help="fetch just this hotel")
    ap.add_argument("--limit", type=int, default=SUBMISSIONS_PER_HOTEL,
                    help=f"submissions per hotel, default {SUBMISSIONS_PER_HOTEL}")
    ap.add_argument("--delay", type=float, default=DELAY, help=f"seconds between requests, default {DELAY}")
    ap.add_argument("--searches-csv", type=Path, default=SEARCHES_CSV)
    ap.add_argument("--raw-dir", type=Path, default=RAW_DIR)
    args = ap.parse_args()

    rows = load_searches(args.searches_csv)
    if args.only:
        rows = [r for r in rows if r.get("hotel_slug") == args.only]
        if not rows:
            sys.exit(f"No row with hotel_slug {args.only} in {args.searches_csv.name}.")

    args.raw_dir.mkdir(parents=True, exist_ok=True)
    reddit = Reddit(args.delay)
    grabbed_at = datetime.now(timezone.utc).isoformat(timespec="seconds")

    for row in rows:
        hotel = row["hotel"]
        query = row["search_terms"].strip()
        subs = [s.strip() for s in (row.get("subreddits") or "").split(",") if s.strip()]
        print(f"\n{hotel}  ({', '.join('r/' + s for s in subs)})")

        seen, submissions = set(), []
        for sub in subs:
            try:
                hits = reddit.search(sub, query, args.limit)
            except Exception as err:  # noqa: BLE001 - one subreddit must not end the run
                print(f"  r/{sub}: search failed — {type(err).__name__}: {err}", file=sys.stderr)
                continue
            print(f"  r/{sub}: {len(hits)} submissions")
            for hit in hits:
                if hit.get("id") in seen or len(submissions) >= args.limit:
                    continue
                seen.add(hit["id"])
                try:
                    post, comments = reddit.comments(hit["id"])
                except Exception as err:  # noqa: BLE001
                    print(f"    {hit.get('id')}: {type(err).__name__}: {err}", file=sys.stderr)
                    continue
                if post:
                    submissions.append((post, comments))
                    print(f"    {hit['id']}: {len(comments)} comments — {(post.get('title') or '')[:60]}")

        if not submissions:
            print(f"  nothing found for {hotel}", file=sys.stderr)
            continue

        text = render(row, submissions, grabbed_at)
        blocks = text.count("--- POST ")
        if not blocks:
            print(f"  every post for {hotel} was deleted or too short; no file written", file=sys.stderr)
            continue
        out = args.raw_dir / f"reddit_{row['hotel_slug']}.txt"
        out.write_text(text, encoding="utf-8")
        print(f"  → {out.name}: {len(submissions)} threads, {blocks} posts and comments")

    print("\nDone. Now: python 2_extract.py")


if __name__ == "__main__":
    main()
