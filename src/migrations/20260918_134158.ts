import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_readers_status" AS ENUM('active', 'blocked');
  CREATE TABLE "readers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"display_name" varchar,
  	"status" "enum_readers_status" DEFAULT 'active',
  	"google_sub" varchar,
  	"last_seen_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "reader_stays" ADD COLUMN "reader_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "readers_id" integer;
  CREATE UNIQUE INDEX "readers_email_idx" ON "readers" USING btree ("email");
  CREATE UNIQUE INDEX "readers_display_name_idx" ON "readers" USING btree ("display_name");
  CREATE INDEX "readers_google_sub_idx" ON "readers" USING btree ("google_sub");
  CREATE INDEX "readers_updated_at_idx" ON "readers" USING btree ("updated_at");
  CREATE INDEX "readers_created_at_idx" ON "readers" USING btree ("created_at");
  ALTER TABLE "reader_stays" ADD CONSTRAINT "reader_stays_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_readers_fk" FOREIGN KEY ("readers_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "reader_stays_reader_idx" ON "reader_stays" USING btree ("reader_id");
  CREATE INDEX "payload_locked_documents_rels_readers_id_idx" ON "payload_locked_documents_rels" USING btree ("readers_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "readers" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "readers" CASCADE;
  ALTER TABLE "reader_stays" DROP CONSTRAINT "reader_stays_reader_id_readers_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_readers_fk";
  
  DROP INDEX "reader_stays_reader_idx";
  DROP INDEX "payload_locked_documents_rels_readers_id_idx";
  ALTER TABLE "reader_stays" DROP COLUMN "reader_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "readers_id";
  DROP TYPE "public"."enum_readers_status";`)
}
