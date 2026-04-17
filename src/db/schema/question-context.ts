import { pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core'
import { audioChunks } from './audio-chunks.ts'
import { questions } from './questions.ts'

export const questionContext = pgTable(
  'question_context',
  {
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    chunkId: uuid('chunk_id')
      .notNull()
      .references(() => audioChunks.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.questionId, t.chunkId] }),
  })
)
