import { pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core'
import { audios } from './audios.ts'
import { rooms } from './rooms.ts'

export const audioRoomLinks = pgTable(
  'audio_room_links',
  {
    audioId: uuid('audio_id')
      .notNull()
      .references(() => audios.id, { onDelete: 'cascade' }),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    linkedAt: timestamp('linked_at').defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.audioId, t.roomId] }),
  })
)
