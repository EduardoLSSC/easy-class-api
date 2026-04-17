DROP TABLE IF EXISTS "question_context" CASCADE;
DROP TABLE IF EXISTS "chat_messages" CASCADE;
DROP TABLE IF EXISTS "questions" CASCADE;
DROP TABLE IF EXISTS "audio_chunks" CASCADE;
DROP TABLE IF EXISTS "room_members" CASCADE;
DROP TABLE IF EXISTS "rooms" CASCADE;
DROP TABLE IF EXISTS "user_roles" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
DROP TABLE IF EXISTS "roles" CASCADE;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);

CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);

CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "room_members" (
	"user_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "room_members_user_id_room_id_pk" PRIMARY KEY("user_id","room_id")
);

CREATE TABLE "audio_chunks" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"room_id" uuid NOT NULL,
	"transcription" text NOT NULL,
	"embeddings" vector(768) NOT NULL,
	"chunk_index" integer NOT NULL,
	"source" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "question_context" (
	"question_id" uuid NOT NULL,
	"chunk_id" uuid NOT NULL,
	CONSTRAINT "question_context_question_id_chunk_id_pk" PRIMARY KEY("question_id","chunk_id")
);

CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "audio_chunks" ADD CONSTRAINT "audio_chunks_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "questions" ADD CONSTRAINT "questions_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "questions" ADD CONSTRAINT "questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "question_context" ADD CONSTRAINT "question_context_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "question_context" ADD CONSTRAINT "question_context_chunk_id_audio_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."audio_chunks"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "idx_audio_chunks_room_id" ON "audio_chunks" USING btree ("room_id");
CREATE INDEX "idx_audio_chunks_chunk_index" ON "audio_chunks" USING btree ("chunk_index");
CREATE INDEX "idx_questions_room_id" ON "questions" USING btree ("room_id");
CREATE INDEX "idx_chat_messages_room_id" ON "chat_messages" USING btree ("room_id");
CREATE INDEX "idx_audio_chunks_embeddings" ON "audio_chunks" USING ivfflat ("embeddings" vector_cosine_ops) WITH (lists = 100);
