import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Programs carry their milestone rewards as a list: one row per milestone,
// with its choices.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "programs_milestone_list" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"at" varchar NOT NULL,
  	"rewards" varchar
  );
  ALTER TABLE "programs_milestone_list" ADD CONSTRAINT "programs_milestone_list_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "programs_milestone_list_order_idx" ON "programs_milestone_list" USING btree ("_order");
  CREATE INDEX "programs_milestone_list_parent_id_idx" ON "programs_milestone_list" USING btree ("_parent_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "programs_milestone_list" CASCADE;`)
}
