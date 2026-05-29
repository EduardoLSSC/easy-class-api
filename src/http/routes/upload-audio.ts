import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { insertLibraryChunkAndSyncRooms } from '../../lib/audio-room-sync.ts'
import { resolveUserAppRole } from '../../lib/app-role.ts'
import { db } from '../../db/connection.ts'
import { schema } from '../../db/schema/index.ts'
import { authenticate, getUserId } from '../authenticate.ts'
import { userHasRoomAccess } from '../room-access.ts'
import { generateEmbeddings, transcribeAudio } from '../../services/gemini.ts'
import { copyLibraryChunksToRoom, getLibraryChunks } from '../../lib/audio-room-sync.ts'

/** Legado: cria áudio na biblioteca, grava trecho e envia para a sala (sem repetir). */
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

      const role = await resolveUserAppRole(userId)
      if (role !== 'professor') {
        return reply
          .status(403)
          .send({ error: 'Apenas professores podem enviar áudio.' })
      }

      const canAccess = await userHasRoomAccess(userId, roomId)
      if (!canAccess) {
        return reply.status(403).send({ error: 'Sem acesso a esta sala.' })
      }

      const file = await request.file()
      if (!file) {
        throw new Error('Audio is required.')
      }

      const now = new Date()
      const defaultName = `Áudio ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`

      const [audio] = await db
        .insert(schema.audios)
        .values({
          professorId: userId,
          name: defaultName,
          createdAt: now,
          updatedAt: now,
        })
        .returning()

      if (!audio) {
        throw new Error('Erro ao criar áudio.')
      }

      const audioBuffer = await file.toBuffer()
      const audioAsBase64 = audioBuffer.toString('base64')

      const transcription = await transcribeAudio(audioAsBase64, file.mimetype)
      const embeddings = await generateEmbeddings(transcription)

      const chunk = await insertLibraryChunkAndSyncRooms(audio.id, {
        transcription,
        embeddings,
        source: 'upload',
      })

      const libraryChunks = await getLibraryChunks(audio.id)
      await db.insert(schema.audioRoomLinks).values({
        audioId: audio.id,
        roomId,
      })
      await copyLibraryChunksToRoom(audio.id, roomId, libraryChunks)

      return reply.status(201).send({
        chunkId: chunk.id,
        audioId: audio.id,
      })
    }
  )
}
