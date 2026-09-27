import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// One global holding every page's search title and description.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "seo" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"site_title" varchar,
  	"site_description" varchar,
  	"reviews_title" varchar,
  	"reviews_description" varchar,
  	"hotels_title" varchar,
  	"hotels_description" varchar,
  	"lounges_title" varchar,
  	"lounges_description" varchar,
  	"articles_title" varchar,
  	"articles_description" varchar,
  	"submit_a_stay_title" varchar,
  	"submit_a_stay_description" varchar,
  	"review_title" varchar,
  	"review_description" varchar,
  	"hotel_title" varchar,
  	"hotel_description" varchar,
  	"hotel_unreviewed_title" varchar,
  	"hotel_unreviewed_description" varchar,
  	"lounge_title" varchar,
  	"lounge_description" varchar,
  	"program_title" varchar,
  	"program_description" varchar,
  	"brand_title" varchar,
  	"brand_description" varchar,
  	"destination_title" varchar,
  	"destination_description" varchar,
  	"article_title" varchar,
  	"article_description" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "seo" CASCADE;`)
}
