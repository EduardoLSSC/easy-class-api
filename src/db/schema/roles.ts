import { pgTable, text, uuid } from 'drizzle-orm/pg-core'

export const roles = pgTable('roles', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull().unique(),
})
