#!/usr/bin/env python3
"""Turns data/data_points.csv into the two files Webflow imports.

    python 3_build_webflow.py                 drops low-confidence rows
    python 3_build_webflow.py --since 2023    recent stays only

    data/webflow_data_points.csv    one item per reported stay, Source = Reported
    data/webflow_hotel_summary.csv  one item per hotel, the rates a hotel page shows

Values are written as labels, not slugs, because a Webflow import matches
option and reference fields on the text it sees. The labels are the ones in
src/lib/stayOptions.ts and data/webflow/status-levels.json.

Every rate counts only the stays that answered the question. A hotel with
twelve reported stays where four mention breakfast has a breakfast figure out
of four, and the Sample column says so. Where nothing answered it, the rate is
"N/A" rather than a zero, which is how the Webflow export writes it too.
"""

import argparse
import csv
import sys
from collections import Counter
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA_DIR = HERE / "data"
IN_CSV = DATA_DIR / "data_points.csv"
POINTS_CSV = DATA_DIR / "webflow_data_points.csv"
SUMMARY_CSV = DATA_DIR / "webflow_hotel_summary.csv"

NOT_STATED = "Not stated"

STATUS_NAMES = {
    "hyatt-member": "World of Hyatt Member",
    "hyatt-discoverist": "World of Hyatt Discoverist",
    "hyatt-explorist": "World of Hyatt Explorist",
    "hyatt-globalist": "World of Hyatt Globalist",
    "hyatt-lifetime-globalist": "World of Hyatt Lifetime Globalist",
    "bonvoy-member": "Marriott Bonvoy Member",
    "bonvoy-silver": "Marriott Bonvoy Silver Elite",
    "bonvoy-gold": "Marriott Bonvoy Gold Elite",
    "bonvoy-platinum": "Marriott Bonvoy Platinum Elite",
    "bonvoy-titanium": "Marriott Bonvoy Titanium Elite",
    "bonvoy-ambassador": "Marriott Bonvoy Ambassador Elite",
    "hilton-member": "Hilton Honors Member",
    "hilton-silver": "Hilton Honors Silver",
    "hilton-gold": "Hilton Honors Gold",
    "hilton-diamond": "Hilton Honors Diamond",
    "ihg-club": "IHG One Rewards Club",
    "ihg-silver": "IHG One Rewards Silver Elite",
    "ihg-gold": "IHG One Rewards Gold Elite",
    "ihg-platinum": "IHG One Rewards Platinum Elite",
    "ihg-diamond": "IHG One Rewards Diamond Elite",
}

LABELS = {
    "upgrade": {"none": "No", "yes": "Yes", "award": "Used a suite upgrade award"},
    "upgrade_type": {"floor": "Higher floor", "view": "Better view", "category": "Higher room category", "suite": "Suite"},
    "suite_type": {"junior": "Junior suite", "one-bedroom": "One-bedroom suite", "two-bedroom": "Two-bedroom suite", "specialty": "Specialty suite"},
    "upgrade_how": {"proactive": "Offered without asking", "asked": "Given when I asked"},
    "breakfast": {
        "full": "Full: buffet and à la carte", "buffet": "Buffet only", "a-la-carte": "À la carte only",
        "credit": "Restaurant or F&B credit", "not-honoured": "Not honoured", "not-eligible": "Not eligible",
    },
    "lounge_access": {"given": "Given", "declined": "Declined", "not-used": "Did not use it"},
    "late_checkout": {"honoured": "Honoured", "declined": "Declined", "not-requested": "Not requested"},
    "welcome_amenity": {"given": "Given", "not-given": "Not given"},
    "sentiment": {"positive": "Positive", "mixed": "Mixed", "negative": "Negative"},
    "confidence": {"high": "High", "medium": "Medium", "low": "Low"},
}

MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
               "July", "August", "September", "October", "November", "December"]

POINT_FIELDS = [
    "Name", "Slug", "Hotel", "Program", "Status Level", "Stay Month", "Stay Year",
    "Room Booked", "Room Received", "Upgrade", "Upgrade Type", "Suite Type", "Upgrade How",
    "Breakfast", "Lounge Access", "Late Checkout", "Welcome Amenity",
    "Sentiment", "Confidence", "Summary", "Source", "Source URL", "Reported On",
    "Thread ID", "Post ID",
]


def label(field, value):
    value = (value or "").strip()
    if not value or value == "unknown":
        return NOT_STATED if field in ("upgrade", "breakfast", "lounge_access", "late_checkout", "welcome_amenity") else ""
    return LABELS.get(field, {}).get(value, value)


def stay_year(row):
    """The year of the stay: from stay_month when given, else the post's date."""
    for value in (row.get("stay_month"), row.get("post_date")):
        value = (value or "").strip()
        if len(value) >= 4 and value[:4].isdigit():
            return int(value[:4])
    return None


def when(row):
    """"March 2026" from the stay month, else the post date, else ""."""
    month = (row.get("stay_month") or "").strip()
    if len(month) >= 7 and month[:4].isdigit() and month[5:7].isdigit():
        index = int(month[5:7])
        if 1 <= index <= 12:
            return f"{MONTH_NAMES[index - 1]} {month[:4]}"
    return (row.get("post_date") or "").strip()


def rate(hits, sample):
    """A whole-percent string, or "N/A" when nothing answered the question."""
    return f"{round(100 * hits / sample)}%" if sample else "N/A"


def build_points(rows):
    out = []
    for row in rows:
        status = (row.get("status_held") or "").strip()
        tier = STATUS_NAMES.get(status, "")
        short = tier.split()[-1] if tier and status != "unknown" else "status not stated"
        moment = when(row)
        year = stay_year(row)
        out.append({
            "Name": f"{row['hotel']} — {short}"
                    + (f", {moment}" if moment else "")
                    + (f" (#{row['post_id']})" if row.get("post_id") else ""),
            "Slug": "-".join(p for p in [row.get("hotel_slug") or "hotel", row.get("thread_id", ""), row.get("post_id", "")] if p),
            "Hotel": row.get("hotel", ""),
            "Program": row.get("program", ""),
            "Status Level": tier,
            "Stay Month": (row.get("stay_month") or "").strip(),
            "Stay Year": year or "",
            "Room Booked": row.get("room_booked", ""),
            "Room Received": row.get("room_received", ""),
            "Upgrade": label("upgrade", row.get("upgrade")),
            "Upgrade Type": label("upgrade_type", row.get("upgrade_type")),
            "Suite Type": label("suite_type", row.get("suite_type")),
            "Upgrade How": label("upgrade_how", row.get("upgrade_how")),
            "Breakfast": label("breakfast", row.get("breakfast")),
            "Lounge Access": label("lounge_access", row.get("lounge_access")),
            "Late Checkout": label("late_checkout", row.get("late_checkout")),
            "Welcome Amenity": label("welcome_amenity", row.get("welcome_amenity")),
            "Sentiment": label("sentiment", row.get("sentiment")),
            "Confidence": label("confidence", row.get("confidence")),
            "Summary": row.get("summary", ""),
            "Source": "Reported",
            "Source URL": row.get("post_url", ""),
            "Reported On": row.get("post_date", ""),
            "Thread ID": row.get("thread_id", ""),
            "Post ID": row.get("post_id", ""),
        })
    return out


def upgraded(row):
    return row.get("upgrade") in ("yes", "award")


def suite(row):
    # A confirmed suite upgrade award is a suite by definition; otherwise the
    # post has to name the upgrade as one.
    return row.get("upgrade") == "award" or (row.get("upgrade") == "yes" and row.get("upgrade_type") == "suite")


def share(rows, answered, hit):
    """Rate and sample over the rows that answered the question."""
    sample = [r for r in rows if answered(r)]
    return rate(sum(1 for r in sample if hit(r)), len(sample)), len(sample)


def tier_label(slug):
    """"hyatt-globalist" to "Globalist", for the per-tier column names."""
    name = STATUS_NAMES.get(slug, slug)
    return name.split()[-1] if name else slug


def knows_upgrade(row):
    return row.get("upgrade") in ("none", "yes", "award")


def eligible_breakfast(row):
    # A stay that was never entitled to breakfast says nothing about whether
    # the hotel honours it.
    return row.get("breakfast") not in ("", "unknown", "not-eligible")


def build_summary(rows, tier_slug):
    by_hotel = {}
    for row in rows:
        by_hotel.setdefault(row.get("hotel_slug") or row.get("hotel", ""), []).append(row)

    tier_short = tier_label(tier_slug)
    out = []
    for slug, group in sorted(by_hotel.items(), key=lambda kv: kv[1][0].get("hotel", "")):
        first = group[0]
        elite = [r for r in group if r.get("status_held") == tier_slug]
        sentiment = Counter(r.get("sentiment") for r in group)
        years = sorted(y for y in (stay_year(r) for r in group) if y)

        tier_upgrade, tier_sample = share(elite, knows_upgrade, upgraded)
        tier_suite, _ = share(elite, knows_upgrade, suite)
        all_upgrade, all_sample = share(group, knows_upgrade, upgraded)
        all_suite, _ = share(group, knows_upgrade, suite)
        breakfast, breakfast_sample = share(group, eligible_breakfast, lambda r: r.get("breakfast") != "not-honoured")
        lounge, lounge_sample = share(group, lambda r: r.get("lounge_access") in ("given", "declined"),
                                     lambda r: r.get("lounge_access") == "given")
        checkout, checkout_sample = share(group, lambda r: r.get("late_checkout") in ("honoured", "declined"),
                                         lambda r: r.get("late_checkout") == "honoured")
        amenity, amenity_sample = share(group, lambda r: r.get("welcome_amenity") in ("given", "not-given"),
                                        lambda r: r.get("welcome_amenity") == "given")

        out.append({
            "Name": f"{first.get('hotel', '')} — Reported",
            "Slug": f"{slug}-reported",
            "Hotel": first.get("hotel", ""),
            "Program": first.get("program", ""),
            "Reported Stays": len(group),
            f"{tier_short} Upgrade Rate": tier_upgrade,
            f"{tier_short} Suite Rate": tier_suite,
            f"{tier_short} Sample": tier_sample,
            "Upgrade Rate": all_upgrade,
            "Suite Rate": all_suite,
            "Upgrade Sample": all_sample,
            "Breakfast Honoured": breakfast,
            "Breakfast Sample": breakfast_sample,
            "Lounge Access Rate": lounge,
            "Lounge Sample": lounge_sample,
            "Late Checkout Rate": checkout,
            "Late Checkout Sample": checkout_sample,
            "Welcome Amenity Rate": amenity,
            "Welcome Amenity Sample": amenity_sample,
            "Positive": sentiment.get("positive", 0),
            "Mixed": sentiment.get("mixed", 0),
            "Negative": sentiment.get("negative", 0),
            "Sentiment Split": f"{sentiment.get('positive', 0)} positive / "
                               f"{sentiment.get('mixed', 0)} mixed / {sentiment.get('negative', 0)} negative",
            "Earliest Stay": str(years[0]) if years else "",
            "Latest Stay": str(years[-1]) if years else "",
            "Source": "Reported",
            "Updated": date.today().isoformat(),
        })
    return out


def write_csv(path, fields, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--since", type=int, metavar="YEAR", help="keep stays from this year onwards")
    ap.add_argument("--keep-low-confidence", action="store_true", help="keep rows the extraction marked low confidence")
    ap.add_argument("--tier", default="hyatt-globalist", help="status slug for the per-tier rates, default hyatt-globalist")
    ap.add_argument("--min-stays", type=int, default=1, help="omit hotels with fewer reported stays than this; the site itself shows reader data at 5")
    ap.add_argument("--in", dest="in_csv", type=Path, default=IN_CSV)
    ap.add_argument("--points", type=Path, default=POINTS_CSV)
    ap.add_argument("--summary", type=Path, default=SUMMARY_CSV)
    args = ap.parse_args()

    if not args.in_csv.exists():
        sys.exit(f"{args.in_csv} does not exist. Run 2_extract.py first.")
    with open(args.in_csv, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        sys.exit(f"{args.in_csv} has no rows.")
    print(f"{len(rows)} extracted stays")

    if not args.keep_low_confidence:
        kept = [r for r in rows if r.get("confidence") != "low"]
        if len(kept) != len(rows):
            print(f"  dropped {len(rows) - len(kept)} low-confidence")
        rows = kept

    if args.since:
        dated = [r for r in rows if stay_year(r)]
        if len(dated) != len(rows):
            print(f"  dropped {len(rows) - len(dated)} with no date to filter on")
        kept = [r for r in dated if stay_year(r) >= args.since]
        print(f"  dropped {len(dated) - len(kept)} from before {args.since}")
        rows = kept

    if not rows:
        sys.exit("Nothing left after filtering.")

    points = build_points(rows)
    write_csv(args.points, POINT_FIELDS, points)
    print(f"{len(points)} data points → {args.points.name}")

    tier = tier_label(args.tier)
    summary = [s for s in build_summary(rows, args.tier) if s["Reported Stays"] >= args.min_stays]
    if summary:
        write_csv(args.summary, list(summary[0].keys()), summary)
        print(f"{len(summary)} hotel summaries → {args.summary.name}")
        for s in summary:
            print(f"  {s['Hotel']}: {s['Reported Stays']} stays, "
                  f"{tier} upgrades {s[f'{tier} Upgrade Rate']} of {s[f'{tier} Sample']}, "
                  f"breakfast {s['Breakfast Honoured']} of {s['Breakfast Sample']}, {s['Sentiment Split']}")
    else:
        print(f"No hotel reached --min-stays {args.min_stays}; no summary written")


if __name__ == "__main__":
    main()
