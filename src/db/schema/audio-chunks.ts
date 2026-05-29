import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from 'drizzle-orm/pg-core'
import { audios } from './audios.ts'
import { rooms } from './rooms.ts'

export const audioChunks = pgTable('audio_chunks', {
  id: uuid().primaryKey().defaultRandom(),
  audioId: uuid('audio_id').references(() => audios.id, {
    onDelete: 'cascade',
  }),
  roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'cascade' }),
  transcription: text().notNull(),
  embeddings: vector({ dimensions: 768 }).notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  source: text(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
