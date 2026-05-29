import { asc, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../db/connection.ts'
import { schema } from '../../db/schema/index.ts'
import { authenticate, getUserId } from '../authenticate.ts'
import { userHasRoomAccess } from '../room-access.ts'

export const getRoomTranscriptRoute: FastifyPluginCallbackZod = (app) => {
  app.get(
    '/rooms/:roomId/transcript',
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

      const chunks = await db
        .select({
          id: schema.audioChunks.id,
          text: schema.audioChunks.transcription,
          chunkIndex: schema.audioChunks.chunkIndex,
          audioName: schema.audios.name,
          createdAt: schema.audioChunks.createdAt,
        })
        .from(schema.audioChunks)
        .leftJoin(
          schema.audios,
          eq(schema.audioChunks.audioId, schema.audios.id)
        )
        .where(eq(schema.audioChunks.roomId, roomId))
        .orderBy(
          asc(schema.audioChunks.createdAt),
          asc(schema.audioChunks.chunkIndex)
        )

      return {
        segments: chunks.map((c, i) => ({
          id: c.id,
          text: c.text,
          chunkIndex: c.chunkIndex,
          audioName: c.audioName,
          labelMin: i * 3,
          labelSec: (i * 45) % 60,
        })),
      }
    }
  )
}
