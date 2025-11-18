import { reset, seed } from 'drizzle-seed'
import { db, sql } from './connection.ts'
import { questions } from './schema/questions.ts'
import { rooms } from './schema/rooms.ts'

// Reset apenas as tabelas que vamos popular
await reset(db, { rooms, questions })

// Seed apenas rooms e questions (audio_chunks tem vector que não é suportado)
await seed(db, { rooms, questions }).refine(f => {
  return {
    rooms: {
      count: 5,
      columns: {
        name: f.companyName(),
        description: f.loremIpsum(),
      },
    },
    questions: {
      count: 20,
    }
  }
})

await sql.end()

// biome-ignore lint/suspicious/noConsole: oly used in dev
console.log('Database seeded')