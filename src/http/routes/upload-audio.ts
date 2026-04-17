import { eq, max } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../db/connection.ts'
import { schema } from '../../db/schema/index.ts'
import { authenticate, getUserId } from '../authenticate.ts'
import { userHasRoomAccess } from '../room-access.ts'
import { generateEmbeddings, transcribeAudio } from '../../services/gemini.ts'

export const uploadAudioRoute: FastifyPluginCallbackZod = (app) => {
  app.post(
    '/rooms/:roomId/audio',
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

      const audio = await request.file()

      if (!audio) {
        throw new Error('Audio is required.')
      }

      const audioBuffer = await audio.toBuffer()
      const audioAsBase64 = audioBuffer.toString('base64')

      const transcription = await transcribeAudio(audioAsBase64, audio.mimetype)
      const embeddings = await generateEmbeddings(transcription)

      const [{ m }] = await db
        .select({ m: max(schema.audioChunks.chunkIndex) })
        .from(schema.audioChunks)
        .where(eq(schema.audioChunks.roomId, roomId))

      const chunkIndex = (m ?? -1) + 1

      const result = await db
        .insert(schema.audioChunks)
        .values({
          roomId,
          transcription,
          embeddings,
          chunkIndex,
          source: 'upload',
        })
        .returning()

      const chunk = result[0]

      if (!chunk) {
        throw new Error('Erro ao salvar chunk de áudio')
      }

      return reply.status(201).send({ chunkId: chunk.id })
    }
  )
}
