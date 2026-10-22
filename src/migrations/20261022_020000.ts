import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Hilton Honors for 2026 (Hilton's help center, FAQ and November 2025 release):
// - Diamond Reserve, the new top tier: 80 nights or 40 stays, plus $18,000
//   eligible spend in the same year (both parts needed). It takes the top-tier
//   mark from Diamond; no card grants it, so Diamond keeps the Aspire card.
// - Silver: 10 nights, 4 stays or $2,500 spend (base points no longer count),
//   and no more rollover nights, which ended on January 1, 2026. Only that one
//   benefit line goes, so anything else edited in the admin stays.
// data/webflow/status-levels.json carries the same, under the webflow id
// below, so a later status-levels import updates this row, not a second one.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  UPDATE "status_levels" SET "is_top_tier" = false WHERE "slug" = 'hilton-diamond';
  INSERT INTO "status_levels" ("name", "slug", "program_id", "short_name", "rank", "is_top_tier", "nights", "short_description", "benefits",
    "eligibility_breakfast", "eligibility_lounge", "eligibility_suite_upgrade", "eligibility_late_checkout", "credit_card_grants_status", "webflow_id")
    SELECT 'Hilton Honors Diamond Reserve', 'hilton-diamond-reserve', p."id", 'Diamond Reserve', 5, true, '80 nights or 40 stays, plus $18,000 spend',
      '80 nights or 40 stays, plus $18,000 spend; confirmable upgrade reward, guaranteed 4pm checkout, Premium Club access.',
      '{"root":{"type":"root","children":[{"type":"list","listType":"bullet","tag":"ul","start":1,"children":[{"type":"listitem","children":[{"type":"text","text":"Confirmable upgrade reward, up to a one-bedroom suite","format":0,"detail":0,"mode":"normal","style":"","version":1}],"value":1,"direction":"ltr","format":"","indent":0,"version":1},{"type":"listitem","children":[{"type":"text","text":"Guaranteed 4pm late checkout","format":0,"detail":0,"mode":"normal","style":"","version":1}],"value":2,"direction":"ltr","format":"","indent":0,"version":1},{"type":"listitem","children":[{"type":"text","text":"Executive lounge and Premium Club access","format":0,"detail":0,"mode":"normal","style":"","version":1}],"value":3,"direction":"ltr","format":"","indent":0,"version":1},{"type":"listitem","children":[{"type":"text","text":"Daily free breakfast or credit","format":0,"detail":0,"mode":"normal","style":"","version":1}],"value":4,"direction":"ltr","format":"","indent":0,"version":1},{"type":"listitem","children":[{"type":"text","text":"120% bonus points","format":0,"detail":0,"mode":"normal","style":"","version":1}],"value":5,"direction":"ltr","format":"","indent":0,"version":1},{"type":"listitem","children":[{"type":"text","text":"Highest priority for space-available upgrades","format":0,"detail":0,"mode":"normal","style":"","version":1}],"value":6,"direction":"ltr","format":"","indent":0,"version":1}],"direction":"ltr","format":"","indent":0,"version":1}],"direction":"ltr","format":"","indent":0,"version":1}}'::jsonb,
      true, true, true, true, false, 'loyalist-hilton-diamond-reserve'
    FROM "programs" p
    WHERE p."slug" = 'hilton-honors' AND NOT EXISTS (SELECT 1 FROM "status_levels" WHERE "slug" = 'hilton-diamond-reserve');
  UPDATE "status_levels" SET "nights" = '10 nights, 4 stays or $2,500 spend',
    "short_description" = '10 nights, 4 stays or $2,500 spend; fifth night free on award stays, bonus points.'
    WHERE "slug" = 'hilton-silver';
  UPDATE "status_levels" SET "benefits" = jsonb_set("benefits", '{root,children,0,children}',
      (SELECT COALESCE(jsonb_agg(li ORDER BY n), '[]'::jsonb) FROM jsonb_array_elements("benefits" #> '{root,children,0,children}') WITH ORDINALITY AS t(li, n)
        WHERE li::text NOT ILIKE '%rollover%'))
    WHERE "slug" = 'hilton-silver' AND jsonb_typeof("benefits" #> '{root,children,0,children}') = 'array' AND "benefits"::text ILIKE '%rollover%';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DELETE FROM "status_levels" WHERE "slug" = 'hilton-diamond-reserve';
  UPDATE "status_levels" SET "is_top_tier" = true WHERE "slug" = 'hilton-diamond';
  UPDATE "status_levels" SET "nights" = '4 stays / 10 nights', "short_description" = '4+ stays; fifth night free on award stays, bonus points.'
    WHERE "slug" = 'hilton-silver';`)
}
