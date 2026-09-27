import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Tier cards link to a full breakdown and can show a member share; programs
// carry their milestone rewards and a link to the breakdown.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "status_levels" ADD COLUMN "article_id" integer;
  ALTER TABLE "status_levels" ADD COLUMN "member_share" varchar;
  ALTER TABLE "status_levels" ADD COLUMN "member_share_note" varchar;
  ALTER TABLE "programs" ADD COLUMN "milestones" jsonb;
  ALTER TABLE "programs" ADD COLUMN "milestones_article_id" integer;
  ALTER TABLE "status_levels" ADD CONSTRAINT "status_levels_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "programs" ADD CONSTRAINT "programs_milestones_article_id_articles_id_fk" FOREIGN KEY ("milestones_article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "status_levels_article_idx" ON "status_levels" USING btree ("article_id");
  CREATE INDEX "programs_milestones_article_idx" ON "programs" USING btree ("milestones_article_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "status_levels_article_idx";
  DROP INDEX "programs_milestones_article_idx";
  ALTER TABLE "status_levels" DROP CONSTRAINT "status_levels_article_id_articles_id_fk";
  ALTER TABLE "programs" DROP CONSTRAINT "programs_milestones_article_id_articles_id_fk";
  ALTER TABLE "status_levels" DROP COLUMN "article_id";
  ALTER TABLE "status_levels" DROP COLUMN "member_share";
  ALTER TABLE "status_levels" DROP COLUMN "member_share_note";
  ALTER TABLE "programs" DROP COLUMN "milestones";
  ALTER TABLE "programs" DROP COLUMN "milestones_article_id";`)
}
