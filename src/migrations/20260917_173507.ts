import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_reader_stays_lounge_access" AS ENUM('given', 'declined', 'not-used');
  CREATE TYPE "public"."enum_reader_stays_lounge_worth_it" AS ENUM('yes', 'no');
  CREATE TYPE "public"."enum_lounges_services_service" AS ENUM('breakfast', 'afternoon-tea', 'evening', 'all-day');
  CREATE TYPE "public"."enum_lounges_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__lounges_v_version_services_service" AS ENUM('breakfast', 'afternoon-tea', 'evening', 'all-day');
  CREATE TYPE "public"."enum__lounges_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "lounges_services" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"service" "enum_lounges_services_service",
  	"from" varchar,
  	"to" varchar
  );
  
  CREATE TABLE "lounges" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"slug" varchar,
  	"hotel_id" integer,
  	"location" varchar,
  	"access_club_rooms" boolean DEFAULT true,
  	"access_paid" varchar,
  	"dress_code" varchar,
  	"note" jsonb,
  	"image_id" integer,
  	"external_image_url" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_lounges_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "lounges_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"status_levels_id" integer
  );
  
  CREATE TABLE "_lounges_v_version_services" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"service" "enum__lounges_v_version_services_service",
  	"from" varchar,
  	"to" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_lounges_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_name" varchar,
  	"version_slug" varchar,
  	"version_hotel_id" integer,
  	"version_location" varchar,
  	"version_access_club_rooms" boolean DEFAULT true,
  	"version_access_paid" varchar,
  	"version_dress_code" varchar,
  	"version_note" jsonb,
  	"version_image_id" integer,
  	"version_external_image_url" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__lounges_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_lounges_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"status_levels_id" integer
  );
  
  ALTER TABLE "reader_stays" ADD COLUMN "lounge_lounge_id" integer;
  ALTER TABLE "reader_stays" ADD COLUMN "lounge_access" "enum_reader_stays_lounge_access";
  ALTER TABLE "reader_stays" ADD COLUMN "lounge_worth_it" "enum_reader_stays_lounge_worth_it";
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "lounges_id" integer;
  ALTER TABLE "lounges_services" ADD CONSTRAINT "lounges_services_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."lounges"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "lounges" ADD CONSTRAINT "lounges_hotel_id_hotels_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lounges" ADD CONSTRAINT "lounges_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lounges_rels" ADD CONSTRAINT "lounges_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."lounges"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "lounges_rels" ADD CONSTRAINT "lounges_rels_status_levels_fk" FOREIGN KEY ("status_levels_id") REFERENCES "public"."status_levels"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_lounges_v_version_services" ADD CONSTRAINT "_lounges_v_version_services_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_lounges_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_lounges_v" ADD CONSTRAINT "_lounges_v_parent_id_lounges_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."lounges"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_lounges_v" ADD CONSTRAINT "_lounges_v_version_hotel_id_hotels_id_fk" FOREIGN KEY ("version_hotel_id") REFERENCES "public"."hotels"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_lounges_v" ADD CONSTRAINT "_lounges_v_version_image_id_media_id_fk" FOREIGN KEY ("version_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_lounges_v_rels" ADD CONSTRAINT "_lounges_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_lounges_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_lounges_v_rels" ADD CONSTRAINT "_lounges_v_rels_status_levels_fk" FOREIGN KEY ("status_levels_id") REFERENCES "public"."status_levels"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "lounges_services_order_idx" ON "lounges_services" USING btree ("_order");
  CREATE INDEX "lounges_services_parent_id_idx" ON "lounges_services" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "lounges_slug_idx" ON "lounges" USING btree ("slug");
  CREATE INDEX "lounges_hotel_idx" ON "lounges" USING btree ("hotel_id");
  CREATE INDEX "lounges_image_idx" ON "lounges" USING btree ("image_id");
  CREATE INDEX "lounges_updated_at_idx" ON "lounges" USING btree ("updated_at");
  CREATE INDEX "lounges_created_at_idx" ON "lounges" USING btree ("created_at");
  CREATE INDEX "lounges__status_idx" ON "lounges" USING btree ("_status");
  CREATE INDEX "lounges_rels_order_idx" ON "lounges_rels" USING btree ("order");
  CREATE INDEX "lounges_rels_parent_idx" ON "lounges_rels" USING btree ("parent_id");
  CREATE INDEX "lounges_rels_path_idx" ON "lounges_rels" USING btree ("path");
  CREATE INDEX "lounges_rels_status_levels_id_idx" ON "lounges_rels" USING btree ("status_levels_id");
  CREATE INDEX "_lounges_v_version_services_order_idx" ON "_lounges_v_version_services" USING btree ("_order");
  CREATE INDEX "_lounges_v_version_services_parent_id_idx" ON "_lounges_v_version_services" USING btree ("_parent_id");
  CREATE INDEX "_lounges_v_parent_idx" ON "_lounges_v" USING btree ("parent_id");
  CREATE INDEX "_lounges_v_version_version_slug_idx" ON "_lounges_v" USING btree ("version_slug");
  CREATE INDEX "_lounges_v_version_version_hotel_idx" ON "_lounges_v" USING btree ("version_hotel_id");
  CREATE INDEX "_lounges_v_version_version_image_idx" ON "_lounges_v" USING btree ("version_image_id");
  CREATE INDEX "_lounges_v_version_version_updated_at_idx" ON "_lounges_v" USING btree ("version_updated_at");
  CREATE INDEX "_lounges_v_version_version_created_at_idx" ON "_lounges_v" USING btree ("version_created_at");
  CREATE INDEX "_lounges_v_version_version__status_idx" ON "_lounges_v" USING btree ("version__status");
  CREATE INDEX "_lounges_v_created_at_idx" ON "_lounges_v" USING btree ("created_at");
  CREATE INDEX "_lounges_v_updated_at_idx" ON "_lounges_v" USING btree ("updated_at");
  CREATE INDEX "_lounges_v_latest_idx" ON "_lounges_v" USING btree ("latest");
  CREATE INDEX "_lounges_v_rels_order_idx" ON "_lounges_v_rels" USING btree ("order");
  CREATE INDEX "_lounges_v_rels_parent_idx" ON "_lounges_v_rels" USING btree ("parent_id");
  CREATE INDEX "_lounges_v_rels_path_idx" ON "_lounges_v_rels" USING btree ("path");
  CREATE INDEX "_lounges_v_rels_status_levels_id_idx" ON "_lounges_v_rels" USING btree ("status_levels_id");
  ALTER TABLE "reader_stays" ADD CONSTRAINT "reader_stays_lounge_lounge_id_lounges_id_fk" FOREIGN KEY ("lounge_lounge_id") REFERENCES "public"."lounges"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lounges_fk" FOREIGN KEY ("lounges_id") REFERENCES "public"."lounges"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "reader_stays_lounge_lounge_lounge_idx" ON "reader_stays" USING btree ("lounge_lounge_id");
  CREATE INDEX "payload_locked_documents_rels_lounges_id_idx" ON "payload_locked_documents_rels" USING btree ("lounges_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "lounges_services" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "lounges" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "lounges_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_lounges_v_version_services" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_lounges_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_lounges_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "lounges_services" CASCADE;
  DROP TABLE "lounges" CASCADE;
  DROP TABLE "lounges_rels" CASCADE;
  DROP TABLE "_lounges_v_version_services" CASCADE;
  DROP TABLE "_lounges_v" CASCADE;
  DROP TABLE "_lounges_v_rels" CASCADE;
  ALTER TABLE "reader_stays" DROP CONSTRAINT "reader_stays_lounge_lounge_id_lounges_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_lounges_fk";
  
  DROP INDEX "reader_stays_lounge_lounge_lounge_idx";
  DROP INDEX "payload_locked_documents_rels_lounges_id_idx";
  ALTER TABLE "reader_stays" DROP COLUMN "lounge_lounge_id";
  ALTER TABLE "reader_stays" DROP COLUMN "lounge_access";
  ALTER TABLE "reader_stays" DROP COLUMN "lounge_worth_it";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "lounges_id";
  DROP TYPE "public"."enum_reader_stays_lounge_access";
  DROP TYPE "public"."enum_reader_stays_lounge_worth_it";
  DROP TYPE "public"."enum_lounges_services_service";
  DROP TYPE "public"."enum_lounges_status";
  DROP TYPE "public"."enum__lounges_v_version_services_service";
  DROP TYPE "public"."enum__lounges_v_version_status";`)
}
