import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Articles: an article can carry several categories. Payload keeps a hasMany
// select in a table of its own, one row per value in order, so this adds
// articles_categories and _articles_v_version_categories (the tables, enums,
// keys and indexes Payload expects) and copies each article's and version's
// one category in as its first.
//
// The old category columns and their enums stay for now: while a deploy is
// in flight the old code still serves the site and reads them, and they are
// nullable, so the new code can save without them. A later migration drops
// them once this one is live (src/migrations/pending/20261026_010000.ts).
//
// The old code also keeps saving to the old columns until the deploy is
// live, so triggers copy each such save across: an article it creates gets
// that category, and one it recategorises gets the new one in place of its
// list. The new code never writes the old columns, so only the old code's
// saves fire them. The copy skips anything already copied, so it is safe
// to run twice.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_articles_categories" AS ENUM('news', 'guides', 'hotels', 'airlines', 'credit-cards');
  CREATE TYPE "public"."enum__articles_v_version_categories" AS ENUM('news', 'guides', 'hotels', 'airlines', 'credit-cards');
  CREATE TABLE "articles_categories" (
    "order" integer NOT NULL,
    "parent_id" integer NOT NULL,
    "value" "enum_articles_categories",
    "id" serial PRIMARY KEY NOT NULL
  );
  CREATE TABLE "_articles_v_version_categories" (
    "order" integer NOT NULL,
    "parent_id" integer NOT NULL,
    "value" "enum__articles_v_version_categories",
    "id" serial PRIMARY KEY NOT NULL
  );
  ALTER TABLE "articles_categories" ADD CONSTRAINT "articles_categories_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_version_categories" ADD CONSTRAINT "_articles_v_version_categories_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "articles_categories_order_idx" ON "articles_categories" USING btree ("order");
  CREATE INDEX "articles_categories_parent_idx" ON "articles_categories" USING btree ("parent_id");
  CREATE INDEX "articles_categories_value_idx" ON "articles_categories" USING btree ("value");
  CREATE INDEX "_articles_v_version_categories_order_idx" ON "_articles_v_version_categories" USING btree ("order");
  CREATE INDEX "_articles_v_version_categories_parent_idx" ON "_articles_v_version_categories" USING btree ("parent_id");
  CREATE INDEX "_articles_v_version_categories_value_idx" ON "_articles_v_version_categories" USING btree ("value");
  CREATE FUNCTION "articles_category_copy"() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    DELETE FROM "articles_categories" WHERE "parent_id" = NEW."id";
    INSERT INTO "articles_categories" ("order", "parent_id", "value") VALUES (1, NEW."id", NEW."category"::text::"enum_articles_categories");
    RETURN NULL;
  END $$;
  CREATE FUNCTION "_articles_v_version_category_copy"() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    DELETE FROM "_articles_v_version_categories" WHERE "parent_id" = NEW."id";
    INSERT INTO "_articles_v_version_categories" ("order", "parent_id", "value") VALUES (1, NEW."id", NEW."version_category"::text::"enum__articles_v_version_categories");
    RETURN NULL;
  END $$;
  CREATE TRIGGER "articles_category_copy_insert" AFTER INSERT ON "articles"
    FOR EACH ROW WHEN (NEW."category" IS NOT NULL) EXECUTE FUNCTION "articles_category_copy"();
  CREATE TRIGGER "articles_category_copy_update" AFTER UPDATE OF "category" ON "articles"
    FOR EACH ROW WHEN (NEW."category" IS NOT NULL AND NEW."category" IS DISTINCT FROM OLD."category") EXECUTE FUNCTION "articles_category_copy"();
  CREATE TRIGGER "_articles_v_version_category_copy_insert" AFTER INSERT ON "_articles_v"
    FOR EACH ROW WHEN (NEW."version_category" IS NOT NULL) EXECUTE FUNCTION "_articles_v_version_category_copy"();
  CREATE TRIGGER "_articles_v_version_category_copy_update" AFTER UPDATE OF "version_category" ON "_articles_v"
    FOR EACH ROW WHEN (NEW."version_category" IS NOT NULL AND NEW."version_category" IS DISTINCT FROM OLD."version_category") EXECUTE FUNCTION "_articles_v_version_category_copy"();
  INSERT INTO "articles_categories" ("order", "parent_id", "value")
    SELECT 1, a."id", a."category"::text::"enum_articles_categories" FROM "articles" a
    WHERE a."category" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "articles_categories" c WHERE c."parent_id" = a."id") ORDER BY a."id";
  INSERT INTO "_articles_v_version_categories" ("order", "parent_id", "value")
    SELECT 1, v."id", v."version_category"::text::"enum__articles_v_version_categories" FROM "_articles_v" v
    WHERE v."version_category" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "_articles_v_version_categories" c WHERE c."parent_id" = v."id") ORDER BY v."id";`)
}

// The old columns still hold every article's category. Each is set to the
// article's current first category before the new tables go, so an article
// added or recategorised since keeps its main one; any others are lost. The
// triggers go first, so that copy back is not copied forward again.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TRIGGER IF EXISTS "articles_category_copy_insert" ON "articles";
  DROP TRIGGER IF EXISTS "articles_category_copy_update" ON "articles";
  DROP TRIGGER IF EXISTS "_articles_v_version_category_copy_insert" ON "_articles_v";
  DROP TRIGGER IF EXISTS "_articles_v_version_category_copy_update" ON "_articles_v";
  DROP FUNCTION IF EXISTS "articles_category_copy"();
  DROP FUNCTION IF EXISTS "_articles_v_version_category_copy"();
  UPDATE "articles" SET "category" = c."value"::text::"enum_articles_category"
    FROM (SELECT DISTINCT ON ("parent_id") "parent_id", "value" FROM "articles_categories" ORDER BY "parent_id", "order", "id") c
    WHERE c."parent_id" = "articles"."id";
  UPDATE "_articles_v" SET "version_category" = c."value"::text::"enum__articles_v_version_category"
    FROM (SELECT DISTINCT ON ("parent_id") "parent_id", "value" FROM "_articles_v_version_categories" ORDER BY "parent_id", "order", "id") c
    WHERE c."parent_id" = "_articles_v"."id";
  DROP TABLE "articles_categories" CASCADE;
  DROP TABLE "_articles_v_version_categories" CASCADE;
  DROP TYPE "public"."enum_articles_categories";
  DROP TYPE "public"."enum__articles_v_version_categories";`)
}
