import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { rooms } from './rooms.ts'
import { users } from './users.ts'

export const chatMessages = pgTable('chat_messages', {
  id: uuid().primaryKey().defaultRandom(),
  roomId: uuid('room_id')
    .notNull()
    .references(() => rooms.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  role: text().notNull(),
  content: text().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
