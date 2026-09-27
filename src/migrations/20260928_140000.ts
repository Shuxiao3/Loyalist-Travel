import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Two things the account page needs.
//
// Comments outlive the account that wrote them: closing an account clears the
// reader from everything it submitted rather than deleting the content, and a
// comment with no reader shows as "Reader". So the link cannot be NOT NULL.
//
// And readers keep the elite tiers they hold, so the stay form stops asking
// every time. A hasMany relationship lives in its own rels table; this mirrors
// the shape Payload already generated for hotels_rels.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "comments" ALTER COLUMN "reader_id" DROP NOT NULL;

  CREATE TABLE "readers_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"status_levels_id" integer
  );
  ALTER TABLE "readers_rels" ADD CONSTRAINT "readers_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "readers_rels" ADD CONSTRAINT "readers_rels_status_levels_fk" FOREIGN KEY ("status_levels_id") REFERENCES "public"."status_levels"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "readers_rels_order_idx" ON "readers_rels" USING btree ("order");
  CREATE INDEX "readers_rels_parent_idx" ON "readers_rels" USING btree ("parent_id");
  CREATE INDEX "readers_rels_path_idx" ON "readers_rels" USING btree ("path");
  CREATE INDEX "readers_rels_status_levels_id_idx" ON "readers_rels" USING btree ("status_levels_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE "readers_rels" CASCADE;
  UPDATE "comments" SET "reader_id" = (SELECT min(id) FROM "readers") WHERE "reader_id" IS NULL;
  ALTER TABLE "comments" ALTER COLUMN "reader_id" SET NOT NULL;`)
}
