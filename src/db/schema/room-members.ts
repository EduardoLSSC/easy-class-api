import { pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core'
import { rooms } from './rooms.ts'
import { users } from './users.ts'

export const roomMembers = pgTable(
  'room_members',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.roomId] }),
  })
)
