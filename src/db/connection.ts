import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../env.ts'
import { schema } from './schema/index.ts'

export const sql = postgres(env.DATABASE_URL, {
  max: 1,
  connect_timeout: 5,
  idle_timeout: 20,
})

export const db = drizzle(sql, {
  schema,
  casing: 'snake_case'
})
