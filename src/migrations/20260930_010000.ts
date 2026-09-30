import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Reported stays: forum posts extracted by loyalist-pipeline, one row per stay.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_sourced_reports_status" AS ENUM('pending', 'approved', 'rejected');
  CREATE TYPE "public"."enum_sourced_reports_confidence" AS ENUM('high', 'medium', 'low');
  CREATE TYPE "public"."enum_sourced_reports_source" AS ENUM('reddit', 'flyertalk', 'blog');
  CREATE TYPE "public"."enum_sourced_reports_upgrade" AS ENUM('none', 'yes', 'award', 'unknown');
  CREATE TYPE "public"."enum_sourced_reports_upgrade_type" AS ENUM('floor', 'view', 'category', 'suite');
  CREATE TYPE "public"."enum_sourced_reports_suite_type" AS ENUM('junior', 'one-bedroom', 'two-bedroom', 'specialty');
  CREATE TYPE "public"."enum_sourced_reports_upgrade_how" AS ENUM('proactive', 'asked');
  CREATE TYPE "public"."enum_sourced_reports_breakfast" AS ENUM('full', 'buffet', 'a-la-carte', 'credit', 'not-honoured', 'not-eligible', 'unknown');
  CREATE TYPE "public"."enum_sourced_reports_lounge_access" AS ENUM('given', 'declined', 'not-used', 'unknown');
  CREATE TYPE "public"."enum_sourced_reports_late_checkout" AS ENUM('honoured', 'declined', 'not-requested', 'unknown');
  CREATE TYPE "public"."enum_sourced_reports_welcome_amenity" AS ENUM('given', 'not-given', 'unknown');
  CREATE TYPE "public"."enum_sourced_reports_sentiment" AS ENUM('positive', 'mixed', 'negative');
  CREATE TABLE "sourced_reports" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"status" "enum_sourced_reports_status" DEFAULT 'pending' NOT NULL,
  	"confidence" "enum_sourced_reports_confidence" NOT NULL,
  	"hotel_id" integer NOT NULL,
  	"program_id" integer,
  	"status_held_id" integer,
  	"source" "enum_sourced_reports_source" NOT NULL,
  	"post_url" varchar NOT NULL,
  	"post_date" timestamp(3) with time zone,
  	"stay_month" varchar,
  	"summary" varchar NOT NULL,
  	"upgrade" "enum_sourced_reports_upgrade" NOT NULL,
  	"upgrade_type" "enum_sourced_reports_upgrade_type",
  	"suite_type" "enum_sourced_reports_suite_type",
  	"upgrade_how" "enum_sourced_reports_upgrade_how",
  	"breakfast" "enum_sourced_reports_breakfast" NOT NULL,
  	"lounge_access" "enum_sourced_reports_lounge_access" NOT NULL,
  	"late_checkout" "enum_sourced_reports_late_checkout" NOT NULL,
  	"welcome_amenity" "enum_sourced_reports_welcome_amenity" NOT NULL,
  	"room_booked" varchar,
  	"room_received" varchar,
  	"sentiment" "enum_sourced_reports_sentiment" NOT NULL,
  	"source_key" varchar NOT NULL,
  	"model" varchar,
  	"extracted_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  ALTER TABLE "sourced_reports" ADD CONSTRAINT "sourced_reports_hotel_id_hotels_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sourced_reports" ADD CONSTRAINT "sourced_reports_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sourced_reports" ADD CONSTRAINT "sourced_reports_status_held_id_status_levels_id_fk" FOREIGN KEY ("status_held_id") REFERENCES "public"."status_levels"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "sourced_reports_status_idx" ON "sourced_reports" USING btree ("status");
  CREATE INDEX "sourced_reports_hotel_idx" ON "sourced_reports" USING btree ("hotel_id");
  CREATE INDEX "sourced_reports_program_idx" ON "sourced_reports" USING btree ("program_id");
  CREATE INDEX "sourced_reports_status_held_idx" ON "sourced_reports" USING btree ("status_held_id");
  CREATE INDEX "sourced_reports_source_idx" ON "sourced_reports" USING btree ("source");
  CREATE INDEX "sourced_reports_post_date_idx" ON "sourced_reports" USING btree ("post_date");
  CREATE UNIQUE INDEX "sourced_reports_source_key_idx" ON "sourced_reports" USING btree ("source_key");
  CREATE INDEX "sourced_reports_updated_at_idx" ON "sourced_reports" USING btree ("updated_at");
  CREATE INDEX "sourced_reports_created_at_idx" ON "sourced_reports" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "sourced_reports_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sourced_reports_fk" FOREIGN KEY ("sourced_reports_id") REFERENCES "public"."sourced_reports"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_sourced_reports_id_idx" ON "payload_locked_documents_rels" USING btree ("sourced_reports_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_sourced_reports_fk";
  DROP INDEX "payload_locked_documents_rels_sourced_reports_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "sourced_reports_id";
  DROP TABLE "sourced_reports" CASCADE;
  DROP TYPE "public"."enum_sourced_reports_status";
  DROP TYPE "public"."enum_sourced_reports_confidence";
  DROP TYPE "public"."enum_sourced_reports_source";
  DROP TYPE "public"."enum_sourced_reports_upgrade";
  DROP TYPE "public"."enum_sourced_reports_upgrade_type";
  DROP TYPE "public"."enum_sourced_reports_suite_type";
  DROP TYPE "public"."enum_sourced_reports_upgrade_how";
  DROP TYPE "public"."enum_sourced_reports_breakfast";
  DROP TYPE "public"."enum_sourced_reports_lounge_access";
  DROP TYPE "public"."enum_sourced_reports_late_checkout";
  DROP TYPE "public"."enum_sourced_reports_welcome_amenity";
  DROP TYPE "public"."enum_sourced_reports_sentiment";`)
}
