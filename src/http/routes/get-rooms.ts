import { count, eq, or } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { db } from '../../db/connection.ts'
import { schema } from '../../db/schema/index.ts'
import { authenticate, getUserId } from '../authenticate.ts'

export const getRoomsRoute: FastifyPluginCallbackZod = (app) => {
  app.get('/rooms', { onRequest: [authenticate] }, async (request) => {
    const userId = getUserId(request)

    const results = await db
      .select({
        id: schema.rooms.id,
        name: schema.rooms.name,
        createdAt: schema.rooms.createdAt,
        questionCount: count(schema.questions.id),
      })
      .from(schema.rooms)
      .leftJoin(
        schema.roomMembers,
        eq(schema.roomMembers.roomId, schema.rooms.id)
      )
      .leftJoin(
        schema.questions,
        eq(schema.questions.roomId, schema.rooms.id)
      )
      .where(
        or(
          eq(schema.rooms.ownerId, userId),
          eq(schema.roomMembers.userId, userId)
        )
      )
      .groupBy(schema.rooms.id)
      .orderBy(schema.rooms.createdAt)

    return results
  })
}
