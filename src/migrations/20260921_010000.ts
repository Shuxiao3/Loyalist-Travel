import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Rubric v16: six categories, nineteen sub-scores out of 5, no weights.
// Existing scores (on the pre-v15 sheet: Bed and sleep out of 5, Tech out
// of 3) are read across (each old category scaled to 5 and
// rounded to the half point; new sub-scores take the closest old measure)
// so no review goes blank; a re-score in the admin replaces them. Narratives
// move to their new sub-score, with Departure joining Arrival.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DROP FUNCTION IF EXISTS lt_scale(numeric, numeric);
  CREATE FUNCTION lt_scale(v numeric, m numeric) RETURNS numeric AS $f$ SELECT CASE WHEN v IS NULL THEN NULL ELSE LEAST(5, round(v / m * 5 * 2) / 2) END $f$ LANGUAGE sql IMMUTABLE;
  ALTER TABLE "reviews" ADD COLUMN "scores_layout" numeric;
  ALTER TABLE "reviews" ADD COLUMN "scores_sleep" numeric;
  ALTER TABLE "reviews" ADD COLUMN "scores_public_space" numeric;
  ALTER TABLE "reviews" ADD COLUMN "scores_warmth" numeric;
  ALTER TABLE "reviews" ADD COLUMN "scores_efficiency" numeric;
  ALTER TABLE "reviews" ADD COLUMN "scores_anticipation" numeric;
  ALTER TABLE "reviews" ADD COLUMN "scores_arrival" numeric;
  ALTER TABLE "reviews" ADD COLUMN "scores_mistakes" numeric;
  ALTER TABLE "reviews" ADD COLUMN "scores_breakfast_quality" numeric;
  ALTER TABLE "reviews" ADD COLUMN "scores_breakfast_spread" numeric;
  ALTER TABLE "reviews" ADD COLUMN "scores_design" numeric;
  ALTER TABLE "reviews" ADD COLUMN "scores_finish" numeric;
  ALTER TABLE "reviews" ADD COLUMN "scores_sense_of_place" numeric;
  ALTER TABLE "reviews" ADD COLUMN "scores_crowding" numeric;
  ALTER TABLE "reviews" ADD COLUMN "totals_room" numeric;
  ALTER TABLE "reviews" ADD COLUMN "totals_property" numeric;
  ALTER TABLE "reviews" ADD COLUMN "totals_service" numeric;
  ALTER TABLE "reviews" ADD COLUMN "totals_operations" numeric;
  ALTER TABLE "reviews" ADD COLUMN "totals_breakfast" numeric;
  ALTER TABLE "reviews" ADD COLUMN "totals_atmosphere" numeric;
  UPDATE "reviews" SET "scores_layout" = lt_scale("scores_room_layout", 10), "scores_bathroom" = lt_scale("scores_bathroom", 8), "scores_sleep" = lt_scale("scores_bed_and_sleep", 5), "scores_tech" = lt_scale("scores_tech", 3), "scores_public_space" = lt_scale("scores_atmosphere", 10), "scores_amenities" = CASE WHEN "property_type" = 'resort' THEN lt_scale("scores_amenities", 10) ELSE lt_scale("scores_amenities", 7) END, "scores_location" = CASE WHEN "property_type" = 'resort' THEN lt_scale("scores_location", 4) ELSE lt_scale("scores_location", 7) END, "scores_maintenance" = lt_scale("scores_maintenance", 5), "scores_warmth" = lt_scale("scores_service_baseline", 10), "scores_efficiency" = lt_scale("scores_service_baseline", 10), "scores_anticipation" = lt_scale("scores_service_peak", 5), "scores_arrival" = CASE WHEN "scores_check_in" IS NULL THEN lt_scale("scores_departure", 3) WHEN "scores_departure" IS NULL THEN lt_scale("scores_check_in", 4) ELSE round(((lt_scale("scores_check_in", 4) + lt_scale("scores_departure", 3)) / 2) * 2) / 2 END, "scores_mistakes" = lt_scale("scores_operations", 5), "scores_housekeeping" = lt_scale("scores_housekeeping", 5), "scores_breakfast_quality" = lt_scale("scores_breakfast_and_dining", 10), "scores_breakfast_spread" = lt_scale("scores_breakfast_and_dining", 10), "scores_design" = lt_scale("scores_atmosphere", 10), "scores_finish" = lt_scale("scores_atmosphere", 10), "scores_sense_of_place" = lt_scale("scores_atmosphere", 10), "scores_crowding" = lt_scale("scores_density", 3);
  UPDATE "reviews" SET "totals_room" = COALESCE("scores_layout", 0) + COALESCE("scores_bathroom", 0) + COALESCE("scores_sleep", 0) + COALESCE("scores_tech", 0), "totals_property" = COALESCE("scores_public_space", 0) + COALESCE("scores_amenities", 0) + COALESCE("scores_location", 0) + COALESCE("scores_maintenance", 0), "totals_service" = COALESCE("scores_warmth", 0) + COALESCE("scores_efficiency", 0) + COALESCE("scores_anticipation", 0) + COALESCE("scores_arrival", 0), "totals_operations" = COALESCE("scores_mistakes", 0) + COALESCE("scores_housekeeping", 0), "totals_breakfast" = COALESCE("scores_breakfast_quality", 0) + COALESCE("scores_breakfast_spread", 0), "totals_atmosphere" = COALESCE("scores_design", 0) + COALESCE("scores_finish", 0) + COALESCE("scores_sense_of_place", 0) + COALESCE("scores_crowding", 0);
  UPDATE "reviews" SET "totals_overall" = COALESCE("totals_room", 0) + COALESCE("totals_property", 0) + COALESCE("totals_service", 0) + COALESCE("totals_operations", 0) + COALESCE("totals_breakfast", 0) + COALESCE("totals_atmosphere", 0);
  ALTER TABLE "reviews" DROP COLUMN "scores_room_layout";
  ALTER TABLE "reviews" DROP COLUMN "scores_bed_and_sleep";
  ALTER TABLE "reviews" DROP COLUMN "scores_atmosphere";
  ALTER TABLE "reviews" DROP COLUMN "scores_check_in";
  ALTER TABLE "reviews" DROP COLUMN "scores_service_baseline";
  ALTER TABLE "reviews" DROP COLUMN "scores_service_peak";
  ALTER TABLE "reviews" DROP COLUMN "scores_operations";
  ALTER TABLE "reviews" DROP COLUMN "scores_breakfast_and_dining";
  ALTER TABLE "reviews" DROP COLUMN "scores_density";
  ALTER TABLE "reviews" DROP COLUMN "scores_departure";
  ALTER TABLE "reviews" DROP COLUMN "totals_hard";
  ALTER TABLE "reviews" DROP COLUMN "totals_soft";
  ALTER TABLE "reviews" RENAME COLUMN "narrative_room_layout" TO "narrative_layout";
  ALTER TABLE "reviews" RENAME COLUMN "narrative_bed_and_sleep" TO "narrative_sleep";
  ALTER TABLE "reviews" RENAME COLUMN "narrative_atmosphere" TO "narrative_public_space";
  ALTER TABLE "reviews" RENAME COLUMN "narrative_check_in" TO "narrative_arrival";
  ALTER TABLE "reviews" RENAME COLUMN "narrative_service_baseline" TO "narrative_warmth";
  ALTER TABLE "reviews" RENAME COLUMN "narrative_service_peak" TO "narrative_anticipation";
  ALTER TABLE "reviews" RENAME COLUMN "narrative_operations" TO "narrative_mistakes";
  ALTER TABLE "reviews" RENAME COLUMN "narrative_breakfast_and_dining" TO "narrative_breakfast_quality";
  ALTER TABLE "reviews" RENAME COLUMN "narrative_density" TO "narrative_crowding";
  UPDATE "reviews" SET "narrative_arrival" = CASE WHEN "narrative_departure" IS NULL THEN "narrative_arrival" WHEN "narrative_arrival" IS NULL THEN "narrative_departure" ELSE jsonb_set("narrative_arrival", '{root,children}', ("narrative_arrival"->'root'->'children') || ("narrative_departure"->'root'->'children')) END;
  ALTER TABLE "reviews" DROP COLUMN "narrative_departure";
  ALTER TABLE "reviews" ADD COLUMN "narrative_efficiency" jsonb;
  ALTER TABLE "reviews" ADD COLUMN "narrative_breakfast_spread" jsonb;
  ALTER TABLE "reviews" ADD COLUMN "narrative_design" jsonb;
  ALTER TABLE "reviews" ADD COLUMN "narrative_finish" jsonb;
  ALTER TABLE "reviews" ADD COLUMN "narrative_sense_of_place" jsonb;
  ALTER TABLE "_reviews_v" ADD COLUMN "version_scores_layout" numeric;
  ALTER TABLE "_reviews_v" ADD COLUMN "version_scores_sleep" numeric;
  ALTER TABLE "_reviews_v" ADD COLUMN "version_scores_public_space" numeric;
  ALTER TABLE "_reviews_v" ADD COLUMN "version_scores_warmth" numeric;
  ALTER TABLE "_reviews_v" ADD COLUMN "version_scores_efficiency" numeric;
  ALTER TABLE "_reviews_v" ADD COLUMN "version_scores_anticipation" numeric;
  ALTER TABLE "_reviews_v" ADD COLUMN "version_scores_arrival" numeric;
  ALTER TABLE "_reviews_v" ADD COLUMN "version_scores_mistakes" numeric;
  ALTER TABLE "_reviews_v" ADD COLUMN "version_scores_breakfast_quality" numeric;
  ALTER TABLE "_reviews_v" ADD COLUMN "version_scores_breakfast_spread" numeric;
  ALTER TABLE "_reviews_v" ADD COLUMN "version_scores_design" numeric;
  ALTER TABLE "_reviews_v" ADD COLUMN "version_scores_finish" numeric;
  ALTER TABLE "_reviews_v" ADD COLUMN "version_scores_sense_of_place" numeric;
  ALTER TABLE "_reviews_v" ADD COLUMN "version_scores_crowding" numeric;
  ALTER TABLE "_reviews_v" ADD COLUMN "version_totals_room" numeric;
  ALTER TABLE "_reviews_v" ADD COLUMN "version_totals_property" numeric;
  ALTER TABLE "_reviews_v" ADD COLUMN "version_totals_service" numeric;
  ALTER TABLE "_reviews_v" ADD COLUMN "version_totals_operations" numeric;
  ALTER TABLE "_reviews_v" ADD COLUMN "version_totals_breakfast" numeric;
  ALTER TABLE "_reviews_v" ADD COLUMN "version_totals_atmosphere" numeric;
  UPDATE "_reviews_v" SET "version_scores_layout" = lt_scale("version_scores_room_layout", 10), "version_scores_bathroom" = lt_scale("version_scores_bathroom", 8), "version_scores_sleep" = lt_scale("version_scores_bed_and_sleep", 5), "version_scores_tech" = lt_scale("version_scores_tech", 3), "version_scores_public_space" = lt_scale("version_scores_atmosphere", 10), "version_scores_amenities" = CASE WHEN "version_property_type" = 'resort' THEN lt_scale("version_scores_amenities", 10) ELSE lt_scale("version_scores_amenities", 7) END, "version_scores_location" = CASE WHEN "version_property_type" = 'resort' THEN lt_scale("version_scores_location", 4) ELSE lt_scale("version_scores_location", 7) END, "version_scores_maintenance" = lt_scale("version_scores_maintenance", 5), "version_scores_warmth" = lt_scale("version_scores_service_baseline", 10), "version_scores_efficiency" = lt_scale("version_scores_service_baseline", 10), "version_scores_anticipation" = lt_scale("version_scores_service_peak", 5), "version_scores_arrival" = CASE WHEN "version_scores_check_in" IS NULL THEN lt_scale("version_scores_departure", 3) WHEN "version_scores_departure" IS NULL THEN lt_scale("version_scores_check_in", 4) ELSE round(((lt_scale("version_scores_check_in", 4) + lt_scale("version_scores_departure", 3)) / 2) * 2) / 2 END, "version_scores_mistakes" = lt_scale("version_scores_operations", 5), "version_scores_housekeeping" = lt_scale("version_scores_housekeeping", 5), "version_scores_breakfast_quality" = lt_scale("version_scores_breakfast_and_dining", 10), "version_scores_breakfast_spread" = lt_scale("version_scores_breakfast_and_dining", 10), "version_scores_design" = lt_scale("version_scores_atmosphere", 10), "version_scores_finish" = lt_scale("version_scores_atmosphere", 10), "version_scores_sense_of_place" = lt_scale("version_scores_atmosphere", 10), "version_scores_crowding" = lt_scale("version_scores_density", 3);
  UPDATE "_reviews_v" SET "version_totals_room" = COALESCE("version_scores_layout", 0) + COALESCE("version_scores_bathroom", 0) + COALESCE("version_scores_sleep", 0) + COALESCE("version_scores_tech", 0), "version_totals_property" = COALESCE("version_scores_public_space", 0) + COALESCE("version_scores_amenities", 0) + COALESCE("version_scores_location", 0) + COALESCE("version_scores_maintenance", 0), "version_totals_service" = COALESCE("version_scores_warmth", 0) + COALESCE("version_scores_efficiency", 0) + COALESCE("version_scores_anticipation", 0) + COALESCE("version_scores_arrival", 0), "version_totals_operations" = COALESCE("version_scores_mistakes", 0) + COALESCE("version_scores_housekeeping", 0), "version_totals_breakfast" = COALESCE("version_scores_breakfast_quality", 0) + COALESCE("version_scores_breakfast_spread", 0), "version_totals_atmosphere" = COALESCE("version_scores_design", 0) + COALESCE("version_scores_finish", 0) + COALESCE("version_scores_sense_of_place", 0) + COALESCE("version_scores_crowding", 0);
  UPDATE "_reviews_v" SET "version_totals_overall" = COALESCE("version_totals_room", 0) + COALESCE("version_totals_property", 0) + COALESCE("version_totals_service", 0) + COALESCE("version_totals_operations", 0) + COALESCE("version_totals_breakfast", 0) + COALESCE("version_totals_atmosphere", 0);
  ALTER TABLE "_reviews_v" DROP COLUMN "version_scores_room_layout";
  ALTER TABLE "_reviews_v" DROP COLUMN "version_scores_bed_and_sleep";
  ALTER TABLE "_reviews_v" DROP COLUMN "version_scores_atmosphere";
  ALTER TABLE "_reviews_v" DROP COLUMN "version_scores_check_in";
  ALTER TABLE "_reviews_v" DROP COLUMN "version_scores_service_baseline";
  ALTER TABLE "_reviews_v" DROP COLUMN "version_scores_service_peak";
  ALTER TABLE "_reviews_v" DROP COLUMN "version_scores_operations";
  ALTER TABLE "_reviews_v" DROP COLUMN "version_scores_breakfast_and_dining";
  ALTER TABLE "_reviews_v" DROP COLUMN "version_scores_density";
  ALTER TABLE "_reviews_v" DROP COLUMN "version_scores_departure";
  ALTER TABLE "_reviews_v" DROP COLUMN "version_totals_hard";
  ALTER TABLE "_reviews_v" DROP COLUMN "version_totals_soft";
  ALTER TABLE "_reviews_v" RENAME COLUMN "version_narrative_room_layout" TO "version_narrative_layout";
  ALTER TABLE "_reviews_v" RENAME COLUMN "version_narrative_bed_and_sleep" TO "version_narrative_sleep";
  ALTER TABLE "_reviews_v" RENAME COLUMN "version_narrative_atmosphere" TO "version_narrative_public_space";
  ALTER TABLE "_reviews_v" RENAME COLUMN "version_narrative_check_in" TO "version_narrative_arrival";
  ALTER TABLE "_reviews_v" RENAME COLUMN "version_narrative_service_baseline" TO "version_narrative_warmth";
  ALTER TABLE "_reviews_v" RENAME COLUMN "version_narrative_service_peak" TO "version_narrative_anticipation";
  ALTER TABLE "_reviews_v" RENAME COLUMN "version_narrative_operations" TO "version_narrative_mistakes";
  ALTER TABLE "_reviews_v" RENAME COLUMN "version_narrative_breakfast_and_dining" TO "version_narrative_breakfast_quality";
  ALTER TABLE "_reviews_v" RENAME COLUMN "version_narrative_density" TO "version_narrative_crowding";
  UPDATE "_reviews_v" SET "version_narrative_arrival" = CASE WHEN "version_narrative_departure" IS NULL THEN "version_narrative_arrival" WHEN "version_narrative_arrival" IS NULL THEN "version_narrative_departure" ELSE jsonb_set("version_narrative_arrival", '{root,children}', ("version_narrative_arrival"->'root'->'children') || ("version_narrative_departure"->'root'->'children')) END;
  ALTER TABLE "_reviews_v" DROP COLUMN "version_narrative_departure";
  ALTER TABLE "_reviews_v" ADD COLUMN "version_narrative_efficiency" jsonb;
  ALTER TABLE "_reviews_v" ADD COLUMN "version_narrative_breakfast_spread" jsonb;
  ALTER TABLE "_reviews_v" ADD COLUMN "version_narrative_design" jsonb;
  ALTER TABLE "_reviews_v" ADD COLUMN "version_narrative_finish" jsonb;
  ALTER TABLE "_reviews_v" ADD COLUMN "version_narrative_sense_of_place" jsonb;
  DROP FUNCTION lt_scale(numeric, numeric);
  CREATE TYPE "public"."enum_rubric_versions_categories_section" AS ENUM('room', 'property', 'service', 'operations', 'breakfast', 'atmosphere');
  ALTER TABLE "rubric_versions_categories" ADD COLUMN "section" "enum_rubric_versions_categories_section";
  ALTER TABLE "rubric_versions_categories" DROP COLUMN "group";
  DROP TYPE "public"."enum_rubric_versions_categories_group";
  INSERT INTO "rubric_versions" ("name", "slug", "locked", "notes") SELECT 'Rubric v16', 'v16', false, 'Six categories (Room, Property, Service, Operations, Breakfast, Atmosphere), nineteen sub-scores out of 5, 100 points. Same maxima for city hotels and resorts. Value and elite recognition are reported, not scored.' WHERE NOT EXISTS (SELECT 1 FROM "rubric_versions" WHERE "slug" = 'v16');
  INSERT INTO "rubric_versions_categories" ("_order", "_parent_id", "id", "key", "label", "section", "max_city", "max_resort") SELECT * FROM (VALUES (0, (SELECT id FROM "rubric_versions" WHERE slug = 'v16'), 'v16-layout', 'layout', 'Layout', 'room'::\"enum_rubric_versions_categories_section\", 5, 5), (1, (SELECT id FROM "rubric_versions" WHERE slug = 'v16'), 'v16-bathroom', 'bathroom', 'Bathroom', 'room'::\"enum_rubric_versions_categories_section\", 5, 5), (2, (SELECT id FROM "rubric_versions" WHERE slug = 'v16'), 'v16-sleep', 'sleep', 'Sleep', 'room'::\"enum_rubric_versions_categories_section\", 5, 5), (3, (SELECT id FROM "rubric_versions" WHERE slug = 'v16'), 'v16-tech', 'tech', 'Tech', 'room'::\"enum_rubric_versions_categories_section\", 5, 5), (4, (SELECT id FROM "rubric_versions" WHERE slug = 'v16'), 'v16-publicSpace', 'publicSpace', 'Public space', 'property'::\"enum_rubric_versions_categories_section\", 5, 5), (5, (SELECT id FROM "rubric_versions" WHERE slug = 'v16'), 'v16-amenities', 'amenities', 'Amenities', 'property'::\"enum_rubric_versions_categories_section\", 5, 5), (6, (SELECT id FROM "rubric_versions" WHERE slug = 'v16'), 'v16-location', 'location', 'Location', 'property'::\"enum_rubric_versions_categories_section\", 5, 5), (7, (SELECT id FROM "rubric_versions" WHERE slug = 'v16'), 'v16-maintenance', 'maintenance', 'Maintenance', 'property'::\"enum_rubric_versions_categories_section\", 5, 5), (8, (SELECT id FROM "rubric_versions" WHERE slug = 'v16'), 'v16-warmth', 'warmth', 'Warmth', 'service'::\"enum_rubric_versions_categories_section\", 5, 5), (9, (SELECT id FROM "rubric_versions" WHERE slug = 'v16'), 'v16-efficiency', 'efficiency', 'Efficiency', 'service'::\"enum_rubric_versions_categories_section\", 5, 5), (10, (SELECT id FROM "rubric_versions" WHERE slug = 'v16'), 'v16-anticipation', 'anticipation', 'Anticipation', 'service'::\"enum_rubric_versions_categories_section\", 5, 5), (11, (SELECT id FROM "rubric_versions" WHERE slug = 'v16'), 'v16-arrival', 'arrival', 'Arrival and departure', 'service'::\"enum_rubric_versions_categories_section\", 5, 5), (12, (SELECT id FROM "rubric_versions" WHERE slug = 'v16'), 'v16-mistakes', 'mistakes', 'Mistakes and recovery', 'operations'::\"enum_rubric_versions_categories_section\", 5, 5), (13, (SELECT id FROM "rubric_versions" WHERE slug = 'v16'), 'v16-housekeeping', 'housekeeping', 'Housekeeping', 'operations'::\"enum_rubric_versions_categories_section\", 5, 5), (14, (SELECT id FROM "rubric_versions" WHERE slug = 'v16'), 'v16-breakfastQuality', 'breakfastQuality', 'Quality', 'breakfast'::\"enum_rubric_versions_categories_section\", 5, 5), (15, (SELECT id FROM "rubric_versions" WHERE slug = 'v16'), 'v16-breakfastSpread', 'breakfastSpread', 'Spread', 'breakfast'::\"enum_rubric_versions_categories_section\", 5, 5), (16, (SELECT id FROM "rubric_versions" WHERE slug = 'v16'), 'v16-design', 'design', 'Design', 'atmosphere'::\"enum_rubric_versions_categories_section\", 5, 5), (17, (SELECT id FROM "rubric_versions" WHERE slug = 'v16'), 'v16-finish', 'finish', 'Finish', 'atmosphere'::\"enum_rubric_versions_categories_section\", 5, 5), (18, (SELECT id FROM "rubric_versions" WHERE slug = 'v16'), 'v16-senseOfPlace', 'senseOfPlace', 'Sense of place', 'atmosphere'::\"enum_rubric_versions_categories_section\", 5, 5), (19, (SELECT id FROM "rubric_versions" WHERE slug = 'v16'), 'v16-crowding', 'crowding', 'Crowds and exclusivity', 'atmosphere'::\"enum_rubric_versions_categories_section\", 5, 5)) AS v WHERE NOT EXISTS (SELECT 1 FROM "rubric_versions_categories" WHERE "id" = 'v16-layout');
  UPDATE "reviews" SET "rubric_version_id" = (SELECT id FROM "rubric_versions" WHERE slug = 'v16');
  UPDATE "_reviews_v" SET "version_rubric_version_id" = (SELECT id FROM "rubric_versions" WHERE slug = 'v16');`)
}

export async function down(): Promise<void> {
  throw new Error('v16 cannot be reversed: v15 sub-scores were replaced. Restore from a backup.')
}
