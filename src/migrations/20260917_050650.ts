import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_hotels_segment" AS ENUM('ultra-luxury', 'luxury', 'upscale', 'midscale', 'budget', 'extended-stay');
  CREATE TYPE "public"."enum_hotels_property_type" AS ENUM('city', 'resort');
  CREATE TYPE "public"."enum_hotels_review_status" AS ENUM('not-reviewed', 'reviewed', 'coming-soon', 'data-only');
  CREATE TYPE "public"."enum_hotels_enrichment_status" AS ENUM('none', 'queued', 'enriched');
  CREATE TYPE "public"."enum_hotels_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__hotels_v_version_segment" AS ENUM('ultra-luxury', 'luxury', 'upscale', 'midscale', 'budget', 'extended-stay');
  CREATE TYPE "public"."enum__hotels_v_version_property_type" AS ENUM('city', 'resort');
  CREATE TYPE "public"."enum__hotels_v_version_review_status" AS ENUM('not-reviewed', 'reviewed', 'coming-soon', 'data-only');
  CREATE TYPE "public"."enum__hotels_v_version_enrichment_status" AS ENUM('none', 'queued', 'enriched');
  CREATE TYPE "public"."enum__hotels_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_reviews_property_type" AS ENUM('city', 'resort');
  CREATE TYPE "public"."enum_reviews_rate_basis" AS ENUM('cash', 'points', 'certificate', 'credit-card-portal', 'third-party', 'corporate-rate', 'guest-of-honor', 'other');
  CREATE TYPE "public"."enum_reviews_upgrade_outcome" AS ENUM('none', 'room-category', 'suite', 'used-award');
  CREATE TYPE "public"."enum_reviews_breakfast_outcome" AS ENUM('full', 'capped', 'restaurant-credit', 'none');
  CREATE TYPE "public"."enum_reviews_late_checkout_outcome" AS ENUM('4pm-confirmed', 'on-request', 'refused', 'not-needed');
  CREATE TYPE "public"."enum_reviews_welcome_amenity_outcome" AS ENUM('points', 'gift', 'food-and-drink', 'none');
  CREATE TYPE "public"."enum_reviews_club_lounge_outcome" AS ENUM('none-at-property', 'access', 'access-with-restrictions');
  CREATE TYPE "public"."enum_reviews_guest_of_honor_outcome" AS ENUM('not-tested', 'honoured', 'refused');
  CREATE TYPE "public"."enum_reviews_would_stay_again" AS ENUM('yes', 'maybe', 'no');
  CREATE TYPE "public"."enum_reviews_value_for_cash" AS ENUM('best', 'great', 'good', 'fair', 'poor');
  CREATE TYPE "public"."enum_reviews_value_for_points" AS ENUM('best', 'great', 'good', 'fair', 'poor');
  CREATE TYPE "public"."enum_reviews_feature_slot" AS ENUM('none', 'lead', 'secondary');
  CREATE TYPE "public"."enum_reviews_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__reviews_v_version_property_type" AS ENUM('city', 'resort');
  CREATE TYPE "public"."enum__reviews_v_version_rate_basis" AS ENUM('cash', 'points', 'certificate', 'credit-card-portal', 'third-party', 'corporate-rate', 'guest-of-honor', 'other');
  CREATE TYPE "public"."enum__reviews_v_version_upgrade_outcome" AS ENUM('none', 'room-category', 'suite', 'used-award');
  CREATE TYPE "public"."enum__reviews_v_version_breakfast_outcome" AS ENUM('full', 'capped', 'restaurant-credit', 'none');
  CREATE TYPE "public"."enum__reviews_v_version_late_checkout_outcome" AS ENUM('4pm-confirmed', 'on-request', 'refused', 'not-needed');
  CREATE TYPE "public"."enum__reviews_v_version_welcome_amenity_outcome" AS ENUM('points', 'gift', 'food-and-drink', 'none');
  CREATE TYPE "public"."enum__reviews_v_version_club_lounge_outcome" AS ENUM('none-at-property', 'access', 'access-with-restrictions');
  CREATE TYPE "public"."enum__reviews_v_version_guest_of_honor_outcome" AS ENUM('not-tested', 'honoured', 'refused');
  CREATE TYPE "public"."enum__reviews_v_version_would_stay_again" AS ENUM('yes', 'maybe', 'no');
  CREATE TYPE "public"."enum__reviews_v_version_value_for_cash" AS ENUM('best', 'great', 'good', 'fair', 'poor');
  CREATE TYPE "public"."enum__reviews_v_version_value_for_points" AS ENUM('best', 'great', 'good', 'fair', 'poor');
  CREATE TYPE "public"."enum__reviews_v_version_feature_slot" AS ENUM('none', 'lead', 'secondary');
  CREATE TYPE "public"."enum__reviews_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_rubric_versions_categories_group" AS ENUM('hard', 'soft');
  CREATE TYPE "public"."enum_brands_segment" AS ENUM('ultra-luxury', 'luxury', 'upscale', 'midscale', 'budget', 'extended-stay');
  CREATE TYPE "public"."enum_destinations_type" AS ENUM('city', 'beach', 'island', 'ski', 'resort', 'jungle', 'airport', 'business', 'luxury');
  CREATE TYPE "public"."enum_destinations_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__destinations_v_version_type" AS ENUM('city', 'beach', 'island', 'ski', 'resort', 'jungle', 'airport', 'business', 'luxury');
  CREATE TYPE "public"."enum__destinations_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "hotels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"slug" varchar,
  	"full_name" varchar,
  	"short_name" varchar,
  	"brand_id" integer,
  	"program_id" integer,
  	"destination_id" integer,
  	"neighborhood" varchar,
  	"segment" "enum_hotels_segment",
  	"property_type" "enum_hotels_property_type",
  	"review_status" "enum_hotels_review_status" DEFAULT 'not-reviewed',
  	"hero_summary" varchar,
  	"opening_year" numeric,
  	"renovation_year" numeric,
  	"number_of_rooms" numeric,
  	"check_in_time" varchar,
  	"check_out_time" varchar,
  	"resort_fee" varchar,
  	"pet_fee" varchar,
  	"points_eligible" boolean DEFAULT true,
  	"street_address" varchar,
  	"phone" varchar,
  	"booking_link" varchar,
  	"hero_image_id" integer,
  	"external_image_url" varchar,
  	"enrichment_status" "enum_hotels_enrichment_status" DEFAULT 'none',
  	"webflow_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_hotels_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "hotels_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"amenities_id" integer
  );
  
  CREATE TABLE "_hotels_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_name" varchar,
  	"version_slug" varchar,
  	"version_full_name" varchar,
  	"version_short_name" varchar,
  	"version_brand_id" integer,
  	"version_program_id" integer,
  	"version_destination_id" integer,
  	"version_neighborhood" varchar,
  	"version_segment" "enum__hotels_v_version_segment",
  	"version_property_type" "enum__hotels_v_version_property_type",
  	"version_review_status" "enum__hotels_v_version_review_status" DEFAULT 'not-reviewed',
  	"version_hero_summary" varchar,
  	"version_opening_year" numeric,
  	"version_renovation_year" numeric,
  	"version_number_of_rooms" numeric,
  	"version_check_in_time" varchar,
  	"version_check_out_time" varchar,
  	"version_resort_fee" varchar,
  	"version_pet_fee" varchar,
  	"version_points_eligible" boolean DEFAULT true,
  	"version_street_address" varchar,
  	"version_phone" varchar,
  	"version_booking_link" varchar,
  	"version_hero_image_id" integer,
  	"version_external_image_url" varchar,
  	"version_enrichment_status" "enum__hotels_v_version_enrichment_status" DEFAULT 'none',
  	"version_webflow_id" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__hotels_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_hotels_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"amenities_id" integer
  );
  
  CREATE TABLE "reviews_pros" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "reviews_cons" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "reviews" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"hotel_id" integer,
  	"rubric_version_id" integer,
  	"property_type" "enum_reviews_property_type",
  	"short_verdict" varchar,
  	"totals_hard" numeric,
  	"totals_soft" numeric,
  	"totals_overall" numeric,
  	"stay_date" timestamp(3) with time zone,
  	"nights" numeric,
  	"status_held_id" integer,
  	"room_booked" varchar,
  	"room_received" varchar,
  	"rate_basis" "enum_reviews_rate_basis",
  	"award_note" varchar,
  	"scores_room_layout" numeric,
  	"scores_bathroom" numeric,
  	"scores_bed_and_sleep" numeric,
  	"scores_tech" numeric,
  	"scores_amenities" numeric,
  	"scores_atmosphere" numeric,
  	"scores_maintenance" numeric,
  	"scores_location" numeric,
  	"scores_check_in" numeric,
  	"scores_service_baseline" numeric,
  	"scores_service_peak" numeric,
  	"scores_operations" numeric,
  	"scores_housekeeping" numeric,
  	"scores_breakfast_and_dining" numeric,
  	"scores_density" numeric,
  	"scores_departure" numeric,
  	"opening_thoughts" jsonb,
  	"narrative_room_layout" jsonb,
  	"narrative_bathroom" jsonb,
  	"narrative_bed_and_sleep" jsonb,
  	"narrative_tech" jsonb,
  	"narrative_amenities" jsonb,
  	"narrative_atmosphere" jsonb,
  	"narrative_maintenance" jsonb,
  	"narrative_location" jsonb,
  	"narrative_check_in" jsonb,
  	"narrative_service_baseline" jsonb,
  	"narrative_service_peak" jsonb,
  	"narrative_operations" jsonb,
  	"narrative_housekeeping" jsonb,
  	"narrative_breakfast_and_dining" jsonb,
  	"narrative_density" jsonb,
  	"narrative_departure" jsonb,
  	"final_verdict" jsonb,
  	"upgrade_outcome" "enum_reviews_upgrade_outcome",
  	"upgrade_note" varchar,
  	"breakfast_outcome" "enum_reviews_breakfast_outcome",
  	"breakfast_note" varchar,
  	"late_checkout_outcome" "enum_reviews_late_checkout_outcome",
  	"late_checkout_note" varchar,
  	"welcome_amenity_outcome" "enum_reviews_welcome_amenity_outcome",
  	"welcome_amenity_note" varchar,
  	"club_lounge_outcome" "enum_reviews_club_lounge_outcome",
  	"club_lounge_note" varchar,
  	"guest_of_honor_outcome" "enum_reviews_guest_of_honor_outcome",
  	"guest_of_honor_note" varchar,
  	"book_it_if" jsonb,
  	"skip_it_if" jsonb,
  	"would_stay_again" "enum_reviews_would_stay_again",
  	"value_for_cash" "enum_reviews_value_for_cash",
  	"value_for_points" "enum_reviews_value_for_points",
  	"value_notes" varchar,
  	"published_date" timestamp(3) with time zone,
  	"last_verified_date" timestamp(3) with time zone,
  	"read_time" numeric,
  	"feature_slot" "enum_reviews_feature_slot",
  	"hero_image_id" integer,
  	"external_image_url" varchar,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"webflow_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_reviews_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_reviews_v_version_pros" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_reviews_v_version_cons" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_reviews_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_hotel_id" integer,
  	"version_rubric_version_id" integer,
  	"version_property_type" "enum__reviews_v_version_property_type",
  	"version_short_verdict" varchar,
  	"version_totals_hard" numeric,
  	"version_totals_soft" numeric,
  	"version_totals_overall" numeric,
  	"version_stay_date" timestamp(3) with time zone,
  	"version_nights" numeric,
  	"version_status_held_id" integer,
  	"version_room_booked" varchar,
  	"version_room_received" varchar,
  	"version_rate_basis" "enum__reviews_v_version_rate_basis",
  	"version_award_note" varchar,
  	"version_scores_room_layout" numeric,
  	"version_scores_bathroom" numeric,
  	"version_scores_bed_and_sleep" numeric,
  	"version_scores_tech" numeric,
  	"version_scores_amenities" numeric,
  	"version_scores_atmosphere" numeric,
  	"version_scores_maintenance" numeric,
  	"version_scores_location" numeric,
  	"version_scores_check_in" numeric,
  	"version_scores_service_baseline" numeric,
  	"version_scores_service_peak" numeric,
  	"version_scores_operations" numeric,
  	"version_scores_housekeeping" numeric,
  	"version_scores_breakfast_and_dining" numeric,
  	"version_scores_density" numeric,
  	"version_scores_departure" numeric,
  	"version_opening_thoughts" jsonb,
  	"version_narrative_room_layout" jsonb,
  	"version_narrative_bathroom" jsonb,
  	"version_narrative_bed_and_sleep" jsonb,
  	"version_narrative_tech" jsonb,
  	"version_narrative_amenities" jsonb,
  	"version_narrative_atmosphere" jsonb,
  	"version_narrative_maintenance" jsonb,
  	"version_narrative_location" jsonb,
  	"version_narrative_check_in" jsonb,
  	"version_narrative_service_baseline" jsonb,
  	"version_narrative_service_peak" jsonb,
  	"version_narrative_operations" jsonb,
  	"version_narrative_housekeeping" jsonb,
  	"version_narrative_breakfast_and_dining" jsonb,
  	"version_narrative_density" jsonb,
  	"version_narrative_departure" jsonb,
  	"version_final_verdict" jsonb,
  	"version_upgrade_outcome" "enum__reviews_v_version_upgrade_outcome",
  	"version_upgrade_note" varchar,
  	"version_breakfast_outcome" "enum__reviews_v_version_breakfast_outcome",
  	"version_breakfast_note" varchar,
  	"version_late_checkout_outcome" "enum__reviews_v_version_late_checkout_outcome",
  	"version_late_checkout_note" varchar,
  	"version_welcome_amenity_outcome" "enum__reviews_v_version_welcome_amenity_outcome",
  	"version_welcome_amenity_note" varchar,
  	"version_club_lounge_outcome" "enum__reviews_v_version_club_lounge_outcome",
  	"version_club_lounge_note" varchar,
  	"version_guest_of_honor_outcome" "enum__reviews_v_version_guest_of_honor_outcome",
  	"version_guest_of_honor_note" varchar,
  	"version_book_it_if" jsonb,
  	"version_skip_it_if" jsonb,
  	"version_would_stay_again" "enum__reviews_v_version_would_stay_again",
  	"version_value_for_cash" "enum__reviews_v_version_value_for_cash",
  	"version_value_for_points" "enum__reviews_v_version_value_for_points",
  	"version_value_notes" varchar,
  	"version_published_date" timestamp(3) with time zone,
  	"version_last_verified_date" timestamp(3) with time zone,
  	"version_read_time" numeric,
  	"version_feature_slot" "enum__reviews_v_version_feature_slot",
  	"version_hero_image_id" integer,
  	"version_external_image_url" varchar,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_webflow_id" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__reviews_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "rubric_versions_categories" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"group" "enum_rubric_versions_categories_group" NOT NULL,
  	"max_city" numeric,
  	"max_resort" numeric
  );
  
  CREATE TABLE "rubric_versions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"locked" boolean DEFAULT false,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "programs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"short_description" varchar,
  	"overview" jsonb,
  	"elite_tiers_description" varchar,
  	"top_tier_name" varchar,
  	"second_tier_name" varchar,
  	"images_logo_url" varchar,
  	"images_hero_image_url" varchar,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"webflow_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "brands" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"program_id" integer,
  	"segment" "enum_brands_segment",
  	"short_description" varchar,
  	"overview" jsonb,
  	"logo_url" varchar,
  	"webflow_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "status_levels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"program_id" integer NOT NULL,
  	"short_name" varchar,
  	"rank" numeric,
  	"is_top_tier" boolean DEFAULT false,
  	"nights" varchar,
  	"short_description" varchar,
  	"benefits" jsonb,
  	"eligibility_breakfast" boolean DEFAULT false,
  	"eligibility_lounge" boolean DEFAULT false,
  	"eligibility_suite_upgrade" boolean DEFAULT false,
  	"eligibility_late_checkout" boolean DEFAULT false,
  	"credit_card_grants_status" boolean DEFAULT false,
  	"credit_card_source" varchar,
  	"webflow_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "destinations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"slug" varchar,
  	"city" varchar,
  	"state_or_region" varchar,
  	"country" varchar,
  	"location_label" varchar,
  	"region_id" integer,
  	"type" "enum_destinations_type",
  	"short_description" varchar,
  	"overview" jsonb,
  	"image_url" varchar,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"webflow_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_destinations_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_destinations_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_name" varchar,
  	"version_slug" varchar,
  	"version_city" varchar,
  	"version_state_or_region" varchar,
  	"version_country" varchar,
  	"version_location_label" varchar,
  	"version_region_id" integer,
  	"version_type" "enum__destinations_v_version_type",
  	"version_short_description" varchar,
  	"version_overview" jsonb,
  	"version_image_url" varchar,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_webflow_id" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__destinations_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "regions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"display_order" numeric,
  	"webflow_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "amenities" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"icon_url" varchar,
  	"webflow_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "hotels_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "reviews_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "rubric_versions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "programs_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "brands_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "status_levels_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "destinations_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "regions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "amenities_id" integer;
  ALTER TABLE "hotels" ADD CONSTRAINT "hotels_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "hotels" ADD CONSTRAINT "hotels_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "hotels" ADD CONSTRAINT "hotels_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "hotels" ADD CONSTRAINT "hotels_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "hotels_rels" ADD CONSTRAINT "hotels_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."hotels"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "hotels_rels" ADD CONSTRAINT "hotels_rels_amenities_fk" FOREIGN KEY ("amenities_id") REFERENCES "public"."amenities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_hotels_v" ADD CONSTRAINT "_hotels_v_parent_id_hotels_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."hotels"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_hotels_v" ADD CONSTRAINT "_hotels_v_version_brand_id_brands_id_fk" FOREIGN KEY ("version_brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_hotels_v" ADD CONSTRAINT "_hotels_v_version_program_id_programs_id_fk" FOREIGN KEY ("version_program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_hotels_v" ADD CONSTRAINT "_hotels_v_version_destination_id_destinations_id_fk" FOREIGN KEY ("version_destination_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_hotels_v" ADD CONSTRAINT "_hotels_v_version_hero_image_id_media_id_fk" FOREIGN KEY ("version_hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_hotels_v_rels" ADD CONSTRAINT "_hotels_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_hotels_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_hotels_v_rels" ADD CONSTRAINT "_hotels_v_rels_amenities_fk" FOREIGN KEY ("amenities_id") REFERENCES "public"."amenities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reviews_pros" ADD CONSTRAINT "reviews_pros_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reviews_cons" ADD CONSTRAINT "reviews_cons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_hotel_id_hotels_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rubric_version_id_rubric_versions_id_fk" FOREIGN KEY ("rubric_version_id") REFERENCES "public"."rubric_versions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_status_held_id_status_levels_id_fk" FOREIGN KEY ("status_held_id") REFERENCES "public"."status_levels"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_reviews_v_version_pros" ADD CONSTRAINT "_reviews_v_version_pros_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_reviews_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_reviews_v_version_cons" ADD CONSTRAINT "_reviews_v_version_cons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_reviews_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_reviews_v" ADD CONSTRAINT "_reviews_v_parent_id_reviews_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."reviews"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_reviews_v" ADD CONSTRAINT "_reviews_v_version_hotel_id_hotels_id_fk" FOREIGN KEY ("version_hotel_id") REFERENCES "public"."hotels"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_reviews_v" ADD CONSTRAINT "_reviews_v_version_rubric_version_id_rubric_versions_id_fk" FOREIGN KEY ("version_rubric_version_id") REFERENCES "public"."rubric_versions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_reviews_v" ADD CONSTRAINT "_reviews_v_version_status_held_id_status_levels_id_fk" FOREIGN KEY ("version_status_held_id") REFERENCES "public"."status_levels"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_reviews_v" ADD CONSTRAINT "_reviews_v_version_hero_image_id_media_id_fk" FOREIGN KEY ("version_hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rubric_versions_categories" ADD CONSTRAINT "rubric_versions_categories_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."rubric_versions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "brands" ADD CONSTRAINT "brands_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "status_levels" ADD CONSTRAINT "status_levels_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "destinations" ADD CONSTRAINT "destinations_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_destinations_v" ADD CONSTRAINT "_destinations_v_parent_id_destinations_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_destinations_v" ADD CONSTRAINT "_destinations_v_version_region_id_regions_id_fk" FOREIGN KEY ("version_region_id") REFERENCES "public"."regions"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "hotels_slug_idx" ON "hotels" USING btree ("slug");
  CREATE INDEX "hotels_brand_idx" ON "hotels" USING btree ("brand_id");
  CREATE INDEX "hotels_program_idx" ON "hotels" USING btree ("program_id");
  CREATE INDEX "hotels_destination_idx" ON "hotels" USING btree ("destination_id");
  CREATE INDEX "hotels_segment_idx" ON "hotels" USING btree ("segment");
  CREATE INDEX "hotels_property_type_idx" ON "hotels" USING btree ("property_type");
  CREATE INDEX "hotels_review_status_idx" ON "hotels" USING btree ("review_status");
  CREATE INDEX "hotels_hero_image_idx" ON "hotels" USING btree ("hero_image_id");
  CREATE INDEX "hotels_webflow_id_idx" ON "hotels" USING btree ("webflow_id");
  CREATE INDEX "hotels_updated_at_idx" ON "hotels" USING btree ("updated_at");
  CREATE INDEX "hotels_created_at_idx" ON "hotels" USING btree ("created_at");
  CREATE INDEX "hotels__status_idx" ON "hotels" USING btree ("_status");
  CREATE INDEX "hotels_rels_order_idx" ON "hotels_rels" USING btree ("order");
  CREATE INDEX "hotels_rels_parent_idx" ON "hotels_rels" USING btree ("parent_id");
  CREATE INDEX "hotels_rels_path_idx" ON "hotels_rels" USING btree ("path");
  CREATE INDEX "hotels_rels_amenities_id_idx" ON "hotels_rels" USING btree ("amenities_id");
  CREATE INDEX "_hotels_v_parent_idx" ON "_hotels_v" USING btree ("parent_id");
  CREATE INDEX "_hotels_v_version_version_slug_idx" ON "_hotels_v" USING btree ("version_slug");
  CREATE INDEX "_hotels_v_version_version_brand_idx" ON "_hotels_v" USING btree ("version_brand_id");
  CREATE INDEX "_hotels_v_version_version_program_idx" ON "_hotels_v" USING btree ("version_program_id");
  CREATE INDEX "_hotels_v_version_version_destination_idx" ON "_hotels_v" USING btree ("version_destination_id");
  CREATE INDEX "_hotels_v_version_version_segment_idx" ON "_hotels_v" USING btree ("version_segment");
  CREATE INDEX "_hotels_v_version_version_property_type_idx" ON "_hotels_v" USING btree ("version_property_type");
  CREATE INDEX "_hotels_v_version_version_review_status_idx" ON "_hotels_v" USING btree ("version_review_status");
  CREATE INDEX "_hotels_v_version_version_hero_image_idx" ON "_hotels_v" USING btree ("version_hero_image_id");
  CREATE INDEX "_hotels_v_version_version_webflow_id_idx" ON "_hotels_v" USING btree ("version_webflow_id");
  CREATE INDEX "_hotels_v_version_version_updated_at_idx" ON "_hotels_v" USING btree ("version_updated_at");
  CREATE INDEX "_hotels_v_version_version_created_at_idx" ON "_hotels_v" USING btree ("version_created_at");
  CREATE INDEX "_hotels_v_version_version__status_idx" ON "_hotels_v" USING btree ("version__status");
  CREATE INDEX "_hotels_v_created_at_idx" ON "_hotels_v" USING btree ("created_at");
  CREATE INDEX "_hotels_v_updated_at_idx" ON "_hotels_v" USING btree ("updated_at");
  CREATE INDEX "_hotels_v_latest_idx" ON "_hotels_v" USING btree ("latest");
  CREATE INDEX "_hotels_v_rels_order_idx" ON "_hotels_v_rels" USING btree ("order");
  CREATE INDEX "_hotels_v_rels_parent_idx" ON "_hotels_v_rels" USING btree ("parent_id");
  CREATE INDEX "_hotels_v_rels_path_idx" ON "_hotels_v_rels" USING btree ("path");
  CREATE INDEX "_hotels_v_rels_amenities_id_idx" ON "_hotels_v_rels" USING btree ("amenities_id");
  CREATE INDEX "reviews_pros_order_idx" ON "reviews_pros" USING btree ("_order");
  CREATE INDEX "reviews_pros_parent_id_idx" ON "reviews_pros" USING btree ("_parent_id");
  CREATE INDEX "reviews_cons_order_idx" ON "reviews_cons" USING btree ("_order");
  CREATE INDEX "reviews_cons_parent_id_idx" ON "reviews_cons" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "reviews_slug_idx" ON "reviews" USING btree ("slug");
  CREATE INDEX "reviews_hotel_idx" ON "reviews" USING btree ("hotel_id");
  CREATE INDEX "reviews_rubric_version_idx" ON "reviews" USING btree ("rubric_version_id");
  CREATE INDEX "reviews_totals_totals_overall_idx" ON "reviews" USING btree ("totals_overall");
  CREATE INDEX "reviews_status_held_idx" ON "reviews" USING btree ("status_held_id");
  CREATE INDEX "reviews_hero_image_idx" ON "reviews" USING btree ("hero_image_id");
  CREATE INDEX "reviews_webflow_id_idx" ON "reviews" USING btree ("webflow_id");
  CREATE INDEX "reviews_updated_at_idx" ON "reviews" USING btree ("updated_at");
  CREATE INDEX "reviews_created_at_idx" ON "reviews" USING btree ("created_at");
  CREATE INDEX "reviews__status_idx" ON "reviews" USING btree ("_status");
  CREATE INDEX "_reviews_v_version_pros_order_idx" ON "_reviews_v_version_pros" USING btree ("_order");
  CREATE INDEX "_reviews_v_version_pros_parent_id_idx" ON "_reviews_v_version_pros" USING btree ("_parent_id");
  CREATE INDEX "_reviews_v_version_cons_order_idx" ON "_reviews_v_version_cons" USING btree ("_order");
  CREATE INDEX "_reviews_v_version_cons_parent_id_idx" ON "_reviews_v_version_cons" USING btree ("_parent_id");
  CREATE INDEX "_reviews_v_parent_idx" ON "_reviews_v" USING btree ("parent_id");
  CREATE INDEX "_reviews_v_version_version_slug_idx" ON "_reviews_v" USING btree ("version_slug");
  CREATE INDEX "_reviews_v_version_version_hotel_idx" ON "_reviews_v" USING btree ("version_hotel_id");
  CREATE INDEX "_reviews_v_version_version_rubric_version_idx" ON "_reviews_v" USING btree ("version_rubric_version_id");
  CREATE INDEX "_reviews_v_version_totals_version_totals_overall_idx" ON "_reviews_v" USING btree ("version_totals_overall");
  CREATE INDEX "_reviews_v_version_version_status_held_idx" ON "_reviews_v" USING btree ("version_status_held_id");
  CREATE INDEX "_reviews_v_version_version_hero_image_idx" ON "_reviews_v" USING btree ("version_hero_image_id");
  CREATE INDEX "_reviews_v_version_version_webflow_id_idx" ON "_reviews_v" USING btree ("version_webflow_id");
  CREATE INDEX "_reviews_v_version_version_updated_at_idx" ON "_reviews_v" USING btree ("version_updated_at");
  CREATE INDEX "_reviews_v_version_version_created_at_idx" ON "_reviews_v" USING btree ("version_created_at");
  CREATE INDEX "_reviews_v_version_version__status_idx" ON "_reviews_v" USING btree ("version__status");
  CREATE INDEX "_reviews_v_created_at_idx" ON "_reviews_v" USING btree ("created_at");
  CREATE INDEX "_reviews_v_updated_at_idx" ON "_reviews_v" USING btree ("updated_at");
  CREATE INDEX "_reviews_v_latest_idx" ON "_reviews_v" USING btree ("latest");
  CREATE INDEX "rubric_versions_categories_order_idx" ON "rubric_versions_categories" USING btree ("_order");
  CREATE INDEX "rubric_versions_categories_parent_id_idx" ON "rubric_versions_categories" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "rubric_versions_slug_idx" ON "rubric_versions" USING btree ("slug");
  CREATE INDEX "rubric_versions_updated_at_idx" ON "rubric_versions" USING btree ("updated_at");
  CREATE INDEX "rubric_versions_created_at_idx" ON "rubric_versions" USING btree ("created_at");
  CREATE UNIQUE INDEX "programs_slug_idx" ON "programs" USING btree ("slug");
  CREATE INDEX "programs_webflow_id_idx" ON "programs" USING btree ("webflow_id");
  CREATE INDEX "programs_updated_at_idx" ON "programs" USING btree ("updated_at");
  CREATE INDEX "programs_created_at_idx" ON "programs" USING btree ("created_at");
  CREATE UNIQUE INDEX "brands_slug_idx" ON "brands" USING btree ("slug");
  CREATE INDEX "brands_program_idx" ON "brands" USING btree ("program_id");
  CREATE INDEX "brands_webflow_id_idx" ON "brands" USING btree ("webflow_id");
  CREATE INDEX "brands_updated_at_idx" ON "brands" USING btree ("updated_at");
  CREATE INDEX "brands_created_at_idx" ON "brands" USING btree ("created_at");
  CREATE UNIQUE INDEX "status_levels_slug_idx" ON "status_levels" USING btree ("slug");
  CREATE INDEX "status_levels_program_idx" ON "status_levels" USING btree ("program_id");
  CREATE INDEX "status_levels_webflow_id_idx" ON "status_levels" USING btree ("webflow_id");
  CREATE INDEX "status_levels_updated_at_idx" ON "status_levels" USING btree ("updated_at");
  CREATE INDEX "status_levels_created_at_idx" ON "status_levels" USING btree ("created_at");
  CREATE UNIQUE INDEX "destinations_slug_idx" ON "destinations" USING btree ("slug");
  CREATE INDEX "destinations_country_idx" ON "destinations" USING btree ("country");
  CREATE INDEX "destinations_region_idx" ON "destinations" USING btree ("region_id");
  CREATE INDEX "destinations_webflow_id_idx" ON "destinations" USING btree ("webflow_id");
  CREATE INDEX "destinations_updated_at_idx" ON "destinations" USING btree ("updated_at");
  CREATE INDEX "destinations_created_at_idx" ON "destinations" USING btree ("created_at");
  CREATE INDEX "destinations__status_idx" ON "destinations" USING btree ("_status");
  CREATE INDEX "_destinations_v_parent_idx" ON "_destinations_v" USING btree ("parent_id");
  CREATE INDEX "_destinations_v_version_version_slug_idx" ON "_destinations_v" USING btree ("version_slug");
  CREATE INDEX "_destinations_v_version_version_country_idx" ON "_destinations_v" USING btree ("version_country");
  CREATE INDEX "_destinations_v_version_version_region_idx" ON "_destinations_v" USING btree ("version_region_id");
  CREATE INDEX "_destinations_v_version_version_webflow_id_idx" ON "_destinations_v" USING btree ("version_webflow_id");
  CREATE INDEX "_destinations_v_version_version_updated_at_idx" ON "_destinations_v" USING btree ("version_updated_at");
  CREATE INDEX "_destinations_v_version_version_created_at_idx" ON "_destinations_v" USING btree ("version_created_at");
  CREATE INDEX "_destinations_v_version_version__status_idx" ON "_destinations_v" USING btree ("version__status");
  CREATE INDEX "_destinations_v_created_at_idx" ON "_destinations_v" USING btree ("created_at");
  CREATE INDEX "_destinations_v_updated_at_idx" ON "_destinations_v" USING btree ("updated_at");
  CREATE INDEX "_destinations_v_latest_idx" ON "_destinations_v" USING btree ("latest");
  CREATE UNIQUE INDEX "regions_slug_idx" ON "regions" USING btree ("slug");
  CREATE INDEX "regions_webflow_id_idx" ON "regions" USING btree ("webflow_id");
  CREATE INDEX "regions_updated_at_idx" ON "regions" USING btree ("updated_at");
  CREATE INDEX "regions_created_at_idx" ON "regions" USING btree ("created_at");
  CREATE UNIQUE INDEX "amenities_slug_idx" ON "amenities" USING btree ("slug");
  CREATE INDEX "amenities_webflow_id_idx" ON "amenities" USING btree ("webflow_id");
  CREATE INDEX "amenities_updated_at_idx" ON "amenities" USING btree ("updated_at");
  CREATE INDEX "amenities_created_at_idx" ON "amenities" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_hotels_fk" FOREIGN KEY ("hotels_id") REFERENCES "public"."hotels"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reviews_fk" FOREIGN KEY ("reviews_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_rubric_versions_fk" FOREIGN KEY ("rubric_versions_id") REFERENCES "public"."rubric_versions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_programs_fk" FOREIGN KEY ("programs_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_brands_fk" FOREIGN KEY ("brands_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_status_levels_fk" FOREIGN KEY ("status_levels_id") REFERENCES "public"."status_levels"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_destinations_fk" FOREIGN KEY ("destinations_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_regions_fk" FOREIGN KEY ("regions_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_amenities_fk" FOREIGN KEY ("amenities_id") REFERENCES "public"."amenities"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_hotels_id_idx" ON "payload_locked_documents_rels" USING btree ("hotels_id");
  CREATE INDEX "payload_locked_documents_rels_reviews_id_idx" ON "payload_locked_documents_rels" USING btree ("reviews_id");
  CREATE INDEX "payload_locked_documents_rels_rubric_versions_id_idx" ON "payload_locked_documents_rels" USING btree ("rubric_versions_id");
  CREATE INDEX "payload_locked_documents_rels_programs_id_idx" ON "payload_locked_documents_rels" USING btree ("programs_id");
  CREATE INDEX "payload_locked_documents_rels_brands_id_idx" ON "payload_locked_documents_rels" USING btree ("brands_id");
  CREATE INDEX "payload_locked_documents_rels_status_levels_id_idx" ON "payload_locked_documents_rels" USING btree ("status_levels_id");
  CREATE INDEX "payload_locked_documents_rels_destinations_id_idx" ON "payload_locked_documents_rels" USING btree ("destinations_id");
  CREATE INDEX "payload_locked_documents_rels_regions_id_idx" ON "payload_locked_documents_rels" USING btree ("regions_id");
  CREATE INDEX "payload_locked_documents_rels_amenities_id_idx" ON "payload_locked_documents_rels" USING btree ("amenities_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "hotels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "hotels_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_hotels_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_hotels_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "reviews_pros" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "reviews_cons" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "reviews" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_reviews_v_version_pros" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_reviews_v_version_cons" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_reviews_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "rubric_versions_categories" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "rubric_versions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "programs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "brands" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "status_levels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "destinations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_destinations_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "regions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "amenities" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "hotels" CASCADE;
  DROP TABLE "hotels_rels" CASCADE;
  DROP TABLE "_hotels_v" CASCADE;
  DROP TABLE "_hotels_v_rels" CASCADE;
  DROP TABLE "reviews_pros" CASCADE;
  DROP TABLE "reviews_cons" CASCADE;
  DROP TABLE "reviews" CASCADE;
  DROP TABLE "_reviews_v_version_pros" CASCADE;
  DROP TABLE "_reviews_v_version_cons" CASCADE;
  DROP TABLE "_reviews_v" CASCADE;
  DROP TABLE "rubric_versions_categories" CASCADE;
  DROP TABLE "rubric_versions" CASCADE;
  DROP TABLE "programs" CASCADE;
  DROP TABLE "brands" CASCADE;
  DROP TABLE "status_levels" CASCADE;
  DROP TABLE "destinations" CASCADE;
  DROP TABLE "_destinations_v" CASCADE;
  DROP TABLE "regions" CASCADE;
  DROP TABLE "amenities" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_hotels_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_reviews_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_rubric_versions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_programs_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_brands_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_status_levels_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_destinations_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_regions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_amenities_fk";
  
  DROP INDEX "payload_locked_documents_rels_hotels_id_idx";
  DROP INDEX "payload_locked_documents_rels_reviews_id_idx";
  DROP INDEX "payload_locked_documents_rels_rubric_versions_id_idx";
  DROP INDEX "payload_locked_documents_rels_programs_id_idx";
  DROP INDEX "payload_locked_documents_rels_brands_id_idx";
  DROP INDEX "payload_locked_documents_rels_status_levels_id_idx";
  DROP INDEX "payload_locked_documents_rels_destinations_id_idx";
  DROP INDEX "payload_locked_documents_rels_regions_id_idx";
  DROP INDEX "payload_locked_documents_rels_amenities_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "hotels_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "reviews_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "rubric_versions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "programs_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "brands_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "status_levels_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "destinations_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "regions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "amenities_id";
  DROP TYPE "public"."enum_hotels_segment";
  DROP TYPE "public"."enum_hotels_property_type";
  DROP TYPE "public"."enum_hotels_review_status";
  DROP TYPE "public"."enum_hotels_enrichment_status";
  DROP TYPE "public"."enum_hotels_status";
  DROP TYPE "public"."enum__hotels_v_version_segment";
  DROP TYPE "public"."enum__hotels_v_version_property_type";
  DROP TYPE "public"."enum__hotels_v_version_review_status";
  DROP TYPE "public"."enum__hotels_v_version_enrichment_status";
  DROP TYPE "public"."enum__hotels_v_version_status";
  DROP TYPE "public"."enum_reviews_property_type";
  DROP TYPE "public"."enum_reviews_rate_basis";
  DROP TYPE "public"."enum_reviews_upgrade_outcome";
  DROP TYPE "public"."enum_reviews_breakfast_outcome";
  DROP TYPE "public"."enum_reviews_late_checkout_outcome";
  DROP TYPE "public"."enum_reviews_welcome_amenity_outcome";
  DROP TYPE "public"."enum_reviews_club_lounge_outcome";
  DROP TYPE "public"."enum_reviews_guest_of_honor_outcome";
  DROP TYPE "public"."enum_reviews_would_stay_again";
  DROP TYPE "public"."enum_reviews_value_for_cash";
  DROP TYPE "public"."enum_reviews_value_for_points";
  DROP TYPE "public"."enum_reviews_feature_slot";
  DROP TYPE "public"."enum_reviews_status";
  DROP TYPE "public"."enum__reviews_v_version_property_type";
  DROP TYPE "public"."enum__reviews_v_version_rate_basis";
  DROP TYPE "public"."enum__reviews_v_version_upgrade_outcome";
  DROP TYPE "public"."enum__reviews_v_version_breakfast_outcome";
  DROP TYPE "public"."enum__reviews_v_version_late_checkout_outcome";
  DROP TYPE "public"."enum__reviews_v_version_welcome_amenity_outcome";
  DROP TYPE "public"."enum__reviews_v_version_club_lounge_outcome";
  DROP TYPE "public"."enum__reviews_v_version_guest_of_honor_outcome";
  DROP TYPE "public"."enum__reviews_v_version_would_stay_again";
  DROP TYPE "public"."enum__reviews_v_version_value_for_cash";
  DROP TYPE "public"."enum__reviews_v_version_value_for_points";
  DROP TYPE "public"."enum__reviews_v_version_feature_slot";
  DROP TYPE "public"."enum__reviews_v_version_status";
  DROP TYPE "public"."enum_rubric_versions_categories_group";
  DROP TYPE "public"."enum_brands_segment";
  DROP TYPE "public"."enum_destinations_type";
  DROP TYPE "public"."enum_destinations_status";
  DROP TYPE "public"."enum__destinations_v_version_type";
  DROP TYPE "public"."enum__destinations_v_version_status";`)
}
