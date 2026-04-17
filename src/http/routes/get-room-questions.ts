import { desc, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../db/connection.ts'
import { schema } from '../../db/schema/index.ts'
import { authenticate, getUserId } from '../authenticate.ts'
import { userHasRoomAccess } from '../room-access.ts'

export const getRoomQuestionsRoute: FastifyPluginCallbackZod = (app) => {
  app.get(
    '/rooms/:roomId/questions',
    {
      onRequest: [authenticate],
      schema: {
        params: z.object({
          roomId: z.string(),
        }),
      },
    },
    async (request, reply) => {
      const { roomId } = request.params
      const userId = getUserId(request)

      const canAccess = await userHasRoomAccess(userId, roomId)
      if (!canAccess) {
        return reply.status(403).send({ error: 'Sem acesso a esta sala.' })
      }

      const result = await db
        .select({
          id: schema.questions.id,
          question: schema.questions.question,
          answer: schema.questions.answer,
          createdAt: schema.questions.createdAt,
        })
        .from(schema.questions)
        .where(eq(schema.questions.roomId, roomId))
        .orderBy(desc(schema.questions.createdAt))

      return result
    }
  )
}
