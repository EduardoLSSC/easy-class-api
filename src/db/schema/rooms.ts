import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users.ts'

export const rooms = pgTable('rooms', {
  id: uuid().primaryKey().defaultRandom(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  description: text(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
