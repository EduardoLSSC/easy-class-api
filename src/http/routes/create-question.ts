import { and, eq, sql } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../db/connection.ts'
import { schema } from '../../db/schema/index.ts'
import { resolveUserAppRole } from '../../lib/app-role.ts'
import { authenticate, getUserId } from '../authenticate.ts'
import { userHasRoomAccess } from '../room-access.ts'
import { generateAnswer, generateEmbeddings } from '../../services/gemini.ts'

export const createQuestionRoute: FastifyPluginCallbackZod = (app) => {
  app.post(
    '/rooms/:roomId/questions',
    {
      onRequest: [authenticate],
      schema: {
        params: z.object({
          roomId: z.string(),
        }),
        body: z.object({
          question: z.string().min(1),
        }),
      },
    },
    async (request, reply) => {
      const { roomId } = request.params
      const { question } = request.body
      const userId = getUserId(request)

      const role = await resolveUserAppRole(userId)
      if (role !== 'student') {
        return reply
          .status(403)
          .send({ error: 'Apenas alunos podem enviar perguntas.' })
      }

      const canAccess = await userHasRoomAccess(userId, roomId)
      if (!canAccess) {
        return reply.status(403).send({ error: 'Sem acesso a esta sala.' })
      }

      const embeddings = await generateEmbeddings(question)

      const embeddingsAsString = `[${embeddings.join(',')}]`

      const chunks = await db
        .select({
          id: schema.audioChunks.id,
          transcription: schema.audioChunks.transcription,
          similarity: sql<number>`1 - (${schema.audioChunks.embeddings} <=> ${embeddingsAsString}::vector)`,
        })
        .from(schema.audioChunks)
        .where(
          and(
            eq(schema.audioChunks.roomId, roomId),
            sql`1 - (${schema.audioChunks.embeddings} <=> ${embeddingsAsString}::vector) > 0.7`
          )
        )
        .orderBy(
          sql`${schema.audioChunks.embeddings} <=> ${embeddingsAsString}::vector`
        )
        .limit(3)

      let answer: string | null = null

      if (chunks.length > 0) {
        const transcriptions = chunks.map((chunk) => chunk.transcription)

        answer = await generateAnswer(question, transcriptions)
      }

      const result = await db
        .insert(schema.questions)
        .values({
          roomId,
          userId,
          question,
          answer,
        })
        .returning()

      const insertedQuestion = result[0]

      if (!insertedQuestion) {
        throw new Error('Failed to create new room.')
      }

      if (chunks.length > 0) {
        await db.insert(schema.questionContext).values(
          chunks.map((c) => ({
            questionId: insertedQuestion.id,
            chunkId: c.id,
          }))
        )
      }

      return reply.status(201).send({
        questionId: insertedQuestion.id,
        answer,
      })
    }
  )
}
