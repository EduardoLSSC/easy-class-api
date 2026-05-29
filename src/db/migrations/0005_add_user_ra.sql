ALTER TABLE "users" ADD COLUMN "ra" text;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_ra_unique" UNIQUE("ra");
