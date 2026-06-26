import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../env.ts'
import { schema } from './schema/index.ts'

export const sql = postgres(env.DATABASE_URL, {
  max: 1,
  connect_timeout: 5,
  idle_timeout: 20,
  // O pooler do Supabase (Supavisor) em transaction mode (porta 6543) não
  // suporta prepared statements. Desligar mantém a conexão compatível tanto
  // com o pooler (IPv4) quanto com a conexão direta.
  prepare: false,
})

export const db = drizzle(sql, {
  schema,
  casing: 'snake_case'
})
