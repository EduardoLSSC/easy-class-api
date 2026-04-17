import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from 'drizzle-orm/pg-core'
import { rooms } from './rooms.ts'

export const audioChunks = pgTable('audio_chunks', {
  id: uuid().primaryKey().defaultRandom(),
  roomId: uuid('room_id')
    .notNull()
    .references(() => rooms.id, { onDelete: 'cascade' }),
  transcription: text().notNull(),
  embeddings: vector({ dimensions: 768 }).notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  source: text(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
