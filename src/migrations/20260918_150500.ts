import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Lounge ratings become their own collection. Existing answers stored on
// reader stays are copied across, then those columns are dropped.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_lounge_ratings_status" AS ENUM('pending', 'approved', 'rejected');
  CREATE TYPE "public"."enum_lounge_ratings_access" AS ENUM('given', 'declined', 'not-used');
  CREATE TYPE "public"."enum_lounge_ratings_worth_it" AS ENUM('yes', 'no');
  CREATE TABLE "lounge_ratings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"status" "enum_lounge_ratings_status" DEFAULT 'pending' NOT NULL,
  	"lounge_id" integer NOT NULL,
  	"status_held_id" integer NOT NULL,
  	"stay_year" numeric NOT NULL,
  	"access" "enum_lounge_ratings_access" NOT NULL,
  	"worth_it" "enum_lounge_ratings_worth_it",
  	"food" numeric,
  	"drink" numeric,
  	"space" numeric,
  	"service" numeric,
  	"overall" numeric,
  	"comment" varchar,
  	"reader_id" integer,
  	"submitter_hash" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "lounge_ratings_id" integer;
  ALTER TABLE "lounge_ratings" ADD CONSTRAINT "lounge_ratings_lounge_id_lounges_id_fk" FOREIGN KEY ("lounge_id") REFERENCES "public"."lounges"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lounge_ratings" ADD CONSTRAINT "lounge_ratings_status_held_id_status_levels_id_fk" FOREIGN KEY ("status_held_id") REFERENCES "public"."status_levels"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lounge_ratings" ADD CONSTRAINT "lounge_ratings_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "lounge_ratings_status_idx" ON "lounge_ratings" USING btree ("status");
  CREATE INDEX "lounge_ratings_lounge_idx" ON "lounge_ratings" USING btree ("lounge_id");
  CREATE INDEX "lounge_ratings_status_held_idx" ON "lounge_ratings" USING btree ("status_held_id");
  CREATE INDEX "lounge_ratings_reader_idx" ON "lounge_ratings" USING btree ("reader_id");
  CREATE INDEX "lounge_ratings_submitter_hash_idx" ON "lounge_ratings" USING btree ("submitter_hash");
  CREATE INDEX "lounge_ratings_updated_at_idx" ON "lounge_ratings" USING btree ("updated_at");
  CREATE INDEX "lounge_ratings_created_at_idx" ON "lounge_ratings" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lounge_ratings_fk" FOREIGN KEY ("lounge_ratings_id") REFERENCES "public"."lounge_ratings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_lounge_ratings_id_idx" ON "payload_locked_documents_rels" USING btree ("lounge_ratings_id");

  INSERT INTO "lounge_ratings" ("status", "lounge_id", "status_held_id", "stay_year", "access", "worth_it", "food", "drink", "space", "service", "overall", "comment", "reader_id", "submitter_hash", "updated_at", "created_at")
  SELECT s."status"::text::"enum_lounge_ratings_status", s."lounge_lounge_id", s."status_held_id", s."stay_year", s."lounge_access"::text::"enum_lounge_ratings_access", s."lounge_worth_it"::text::"enum_lounge_ratings_worth_it", s."lounge_food", s."lounge_drink", s."lounge_space", s."lounge_service", s."lounge_overall", s."lounge_comment", s."reader_id", s."submitter_hash", s."updated_at", s."created_at"
  FROM "reader_stays" s WHERE s."lounge_lounge_id" IS NOT NULL AND s."lounge_access" IS NOT NULL;

  ALTER TABLE "reader_stays" DROP CONSTRAINT IF EXISTS "reader_stays_lounge_lounge_id_lounges_id_fk";
  DROP INDEX IF EXISTS "reader_stays_lounge_lounge_lounge_idx";
  ALTER TABLE "reader_stays" DROP COLUMN "lounge_lounge_id";
  ALTER TABLE "reader_stays" DROP COLUMN "lounge_access";
  ALTER TABLE "reader_stays" DROP COLUMN "lounge_worth_it";
  ALTER TABLE "reader_stays" DROP COLUMN "lounge_food";
  ALTER TABLE "reader_stays" DROP COLUMN "lounge_drink";
  ALTER TABLE "reader_stays" DROP COLUMN "lounge_space";
  ALTER TABLE "reader_stays" DROP COLUMN "lounge_service";
  ALTER TABLE "reader_stays" DROP COLUMN "lounge_overall";
  ALTER TABLE "reader_stays" DROP COLUMN "lounge_comment";
  DROP TYPE "public"."enum_reader_stays_lounge_access";
  DROP TYPE "public"."enum_reader_stays_lounge_worth_it";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_reader_stays_lounge_access" AS ENUM('given', 'declined', 'not-used');
  CREATE TYPE "public"."enum_reader_stays_lounge_worth_it" AS ENUM('yes', 'no');
  ALTER TABLE "reader_stays" ADD COLUMN "lounge_lounge_id" integer;
  ALTER TABLE "reader_stays" ADD COLUMN "lounge_access" "enum_reader_stays_lounge_access";
  ALTER TABLE "reader_stays" ADD COLUMN "lounge_worth_it" "enum_reader_stays_lounge_worth_it";
  ALTER TABLE "reader_stays" ADD COLUMN "lounge_food" numeric;
  ALTER TABLE "reader_stays" ADD COLUMN "lounge_drink" numeric;
  ALTER TABLE "reader_stays" ADD COLUMN "lounge_space" numeric;
  ALTER TABLE "reader_stays" ADD COLUMN "lounge_service" numeric;
  ALTER TABLE "reader_stays" ADD COLUMN "lounge_overall" numeric;
  ALTER TABLE "reader_stays" ADD COLUMN "lounge_comment" varchar;
  ALTER TABLE "reader_stays" ADD CONSTRAINT "reader_stays_lounge_lounge_id_lounges_id_fk" FOREIGN KEY ("lounge_lounge_id") REFERENCES "public"."lounges"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "reader_stays_lounge_lounge_lounge_idx" ON "reader_stays" USING btree ("lounge_lounge_id");
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_lounge_ratings_fk";
  DROP INDEX "payload_locked_documents_rels_lounge_ratings_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "lounge_ratings_id";
  DROP TABLE "lounge_ratings" CASCADE;
  DROP TYPE "public"."enum_lounge_ratings_status";
  DROP TYPE "public"."enum_lounge_ratings_access";
  DROP TYPE "public"."enum_lounge_ratings_worth_it";`)
}
