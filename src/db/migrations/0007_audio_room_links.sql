CREATE TABLE "audio_room_links" (
	"audio_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"linked_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "audio_room_links_audio_id_room_id_pk" PRIMARY KEY("audio_id","room_id")
);
--> statement-breakpoint
ALTER TABLE "audio_room_links" ADD CONSTRAINT "audio_room_links_audio_id_audios_id_fk" FOREIGN KEY ("audio_id") REFERENCES "public"."audios"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "audio_room_links" ADD CONSTRAINT "audio_room_links_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "audio_room_links" ("audio_id", "room_id", "linked_at")
SELECT "id", "room_id", COALESCE("updated_at", "created_at")
FROM "audios"
WHERE "room_id" IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
ALTER TABLE "audio_chunks" ALTER COLUMN "room_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "audios" DROP COLUMN "room_id";
--> statement-breakpoint
CREATE INDEX "idx_audio_room_links_room_id" ON "audio_room_links" USING btree ("room_id");
