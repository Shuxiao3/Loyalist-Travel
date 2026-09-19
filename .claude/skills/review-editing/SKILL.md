---
name: review-editing
description: Edit, line-edit or proofread a Loyalist Travel hotel review, or any part of one (opening thoughts, a rubric category narrative, short verdict, final verdict, pros and cons, book it if / skip it if, value notes). Use whenever the user pastes review copy, asks for a pass over a draft review, asks whether a score narrative matches its score, or asks for a headline, deck or short verdict for a review. Also use for lounge and guide copy, which follow the same voice.
---

# Editing Loyalist Travel review pieces

This is the house style guide. Everything below the line marked TODO is for
Austin to fill in; the facts above it come from the codebase and are true
regardless of voice.

## What a review is made of

A review is one record in the `reviews` collection, one stay per record. The
prose fields, in the order a reader meets them:

| Field | What it is |
| --- | --- |
| `title` | The review headline. |
| `shortVerdict` | One sentence, under the title and on every card. |
| `openingThoughts` | The lede. Rich text. |
| `narrative.<category>` | One passage per rubric category, sixteen in all. |
| `finalVerdict` | The close. Rich text. |
| `pros` / `cons` | "What worked" and "What fell short", one line each. |
| `bookItIf` / `skipItIf` | Who the hotel is for and who it is not. |
| `valueNotes` | Cash and points value, in prose. |
| `awardNote` | Points price, category, whether it repriced. |
| `seo.title` / `seo.description` | Search copy, not reader copy. |

## The rubric the prose has to match

Version 15, locked September 16 2026, in `src/rubric/v15.ts`. Sixteen
categories, 55 hard points and 45 soft, 100 at a city hotel.

**Hard (55).** Room layout 10, Bathroom 8, Bed and sleep 6, Tech 2, Amenities
and programming 7 city / 10 resort, Atmosphere and public space 10,
Maintenance and upkeep 5, Location and setting 7 city / 4 resort.

**Soft (45).** Check-in 4, Service baseline 10, Service peak 5, Operations 5,
Housekeeping 5, Breakfast and dining 10, Density and capacity 3, Departure 3.

Each category's narrative has to earn its score. A passage that reads as
praise under a 4-of-10 is a defect worth flagging, and so is the reverse.

## Standing rules

- The site's promise is elite benefits reported as they happened, not as
  printed. Never soften a benefit that was denied, and never describe a
  published policy as though it were the experience.
- Preserve reported fact exactly. Room numbers, dates, prices, points, names,
  times and outcomes are not editable copy. Query anything that looks wrong;
  do not fix it.
- An edit that changes what happened is out of scope. Flag it instead.

## TODO — Austin's voice rules

Replace these prompts with the real thing. Each one is a place where an editor
needs a rule and this file cannot guess it.

- **Person and tense.** First person or not, past or present.
- **Sentence length and rhythm.** What to cut, what to keep.
- **Words and constructions that are out.** Banned adjectives, travel-PR
  vocabulary, hedges, filler openers, punctuation habits.
- **Score narratives.** How long, whether they open with the verdict, whether
  they name the score.
- **Comparisons.** When another property may be named, and how.
- **Brand and program names.** Capitalisation, whether to use the shorthand.
- **Numbers, dates, times, currency.** Format of each.
- **Headlines and short verdicts.** Length ceiling, what they must contain.
- **Pros and cons.** Fragment or sentence, and how many.
- **What an edit may never do.** The lines not to cross.

## How to deliver an edit

Unless asked otherwise: return the edited copy in full, then a short list of
what changed and why, then anything queried rather than changed. Do not
explain routine line edits one by one.
