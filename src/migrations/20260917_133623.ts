import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_reader_stays_status" AS ENUM('pending', 'approved', 'rejected');
  CREATE TYPE "public"."enum_reader_stays_upgrade" AS ENUM('none', 'room-category', 'suite', 'used-award');
  CREATE TYPE "public"."enum_reader_stays_breakfast" AS ENUM('full', 'capped', 'restaurant-credit', 'none', 'not-eligible');
  CREATE TYPE "public"."enum_reader_stays_late_checkout" AS ENUM('4pm-confirmed', 'on-request', 'refused', 'not-needed');
  CREATE TABLE "reader_stays" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"status" "enum_reader_stays_status" DEFAULT 'pending' NOT NULL,
  	"hotel_id" integer NOT NULL,
  	"program_id" integer NOT NULL,
  	"status_held_id" integer NOT NULL,
  	"stay_year" numeric NOT NULL,
  	"stay_month" numeric NOT NULL,
  	"upgrade" "enum_reader_stays_upgrade" NOT NULL,
  	"breakfast" "enum_reader_stays_breakfast" NOT NULL,
  	"late_checkout" "enum_reader_stays_late_checkout" NOT NULL,
  	"lounge_rating" numeric,
  	"submitter_hash" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "reader_stays_id" integer;
  ALTER TABLE "reader_stays" ADD CONSTRAINT "reader_stays_hotel_id_hotels_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reader_stays" ADD CONSTRAINT "reader_stays_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reader_stays" ADD CONSTRAINT "reader_stays_status_held_id_status_levels_id_fk" FOREIGN KEY ("status_held_id") REFERENCES "public"."status_levels"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "reader_stays_status_idx" ON "reader_stays" USING btree ("status");
  CREATE INDEX "reader_stays_hotel_idx" ON "reader_stays" USING btree ("hotel_id");
  CREATE INDEX "reader_stays_program_idx" ON "reader_stays" USING btree ("program_id");
  CREATE INDEX "reader_stays_status_held_idx" ON "reader_stays" USING btree ("status_held_id");
  CREATE INDEX "reader_stays_submitter_hash_idx" ON "reader_stays" USING btree ("submitter_hash");
  CREATE INDEX "reader_stays_updated_at_idx" ON "reader_stays" USING btree ("updated_at");
  CREATE INDEX "reader_stays_created_at_idx" ON "reader_stays" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reader_stays_fk" FOREIGN KEY ("reader_stays_id") REFERENCES "public"."reader_stays"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_reader_stays_id_idx" ON "payload_locked_documents_rels" USING btree ("reader_stays_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "reader_stays" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "reader_stays" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_reader_stays_fk";
  
  DROP INDEX "payload_locked_documents_rels_reader_stays_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "reader_stays_id";
  DROP TYPE "public"."enum_reader_stays_status";
  DROP TYPE "public"."enum_reader_stays_upgrade";
  DROP TYPE "public"."enum_reader_stays_breakfast";
  DROP TYPE "public"."enum_reader_stays_late_checkout";`)
}
