CREATE TABLE "audios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professor_id" uuid NOT NULL,
	"room_id" uuid,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audios" ADD CONSTRAINT "audios_professor_id_users_id_fk" FOREIGN KEY ("professor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "audios" ADD CONSTRAINT "audios_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "audio_chunks" ADD COLUMN "audio_id" uuid;
--> statement-breakpoint
ALTER TABLE "audio_chunks" ADD CONSTRAINT "audio_chunks_audio_id_audios_id_fk" FOREIGN KEY ("audio_id") REFERENCES "public"."audios"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_audios_professor_id" ON "audios" USING btree ("professor_id");
--> statement-breakpoint
CREATE INDEX "idx_audios_room_id" ON "audios" USING btree ("room_id");
--> statement-breakpoint
CREATE INDEX "idx_audio_chunks_audio_id" ON "audio_chunks" USING btree ("audio_id");
