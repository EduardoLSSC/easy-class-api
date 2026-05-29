import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import {
  copyLibraryChunksToRoom,
  getLibraryChunks,
  insertLibraryChunkAndSyncRooms,
} from '../../lib/audio-room-sync.ts'
import { db } from '../../db/connection.ts'
import { schema } from '../../db/schema/index.ts'
import { resolveUserAppRole } from '../../lib/app-role.ts'
import { authenticate, getUserId } from '../authenticate.ts'
import { userHasRoomAccess } from '../room-access.ts'
import { generateEmbeddings, transcribeAudio } from '../../services/gemini.ts'

const createAudioBodySchema = z.object({
  name: z.string().min(1).max(200),
})

const patchAudioBodySchema = z.object({
  name: z.string().min(1).max(200),
})

async function assertProfessor(userId: string) {
  const role = await resolveUserAppRole(userId)
  return role === 'professor'
}

async function getOwnedAudio(professorId: string, audioId: string) {
  const [audio] = await db
    .select()
    .from(schema.audios)
    .where(
      and(
        eq(schema.audios.id, audioId),
        eq(schema.audios.professorId, professorId)
      )
    )
    .limit(1)

  return audio ?? null
}

async function getLinkedRoomsForAudios(audioIds: string[]) {
  if (audioIds.length === 0) {
    return new Map<string, { id: string; name: string; linkedAt: Date }[]>()
  }

  const rows = await db
    .select({
      audioId: schema.audioRoomLinks.audioId,
      roomId: schema.audioRoomLinks.roomId,
      roomName: schema.rooms.name,
      linkedAt: schema.audioRoomLinks.linkedAt,
    })
    .from(schema.audioRoomLinks)
    .innerJoin(schema.rooms, eq(schema.audioRoomLinks.roomId, schema.rooms.id))
    .where(inArray(schema.audioRoomLinks.audioId, audioIds))
    .orderBy(schema.rooms.name)

  const map = new Map<string, { id: string; name: string; linkedAt: Date }[]>()

  for (const row of rows) {
    const list = map.get(row.audioId) ?? []
    list.push({
      id: row.roomId,
      name: row.roomName,
      linkedAt: row.linkedAt,
    })
    map.set(row.audioId, list)
  }

  return map
}

export const professorAudiosRoute: FastifyPluginCallbackZod = (app) => {
  app.get(
    '/professor/audios',
    { onRequest: [authenticate] },
    async (request, reply) => {
      const userId = getUserId(request)

      if (!(await assertProfessor(userId))) {
        return reply
          .status(403)
          .send({ error: 'Apenas professores podem listar áudios.' })
      }

      const rows = await db
        .select({
          id: schema.audios.id,
          name: schema.audios.name,
          libraryChunkCount: count(schema.audioChunks.id),
          createdAt: schema.audios.createdAt,
          updatedAt: schema.audios.updatedAt,
        })
        .from(schema.audios)
        .leftJoin(
          schema.audioChunks,
          and(
            eq(schema.audioChunks.audioId, schema.audios.id),
            isNull(schema.audioChunks.roomId)
          )
        )
        .where(eq(schema.audios.professorId, userId))
        .groupBy(
          schema.audios.id,
          schema.audios.name,
          schema.audios.createdAt,
          schema.audios.updatedAt
        )
        .orderBy(desc(schema.audios.updatedAt))

      const linksByAudio = await getLinkedRoomsForAudios(rows.map((r) => r.id))

      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        libraryChunkCount: Number(r.libraryChunkCount),
        linkedRooms: linksByAudio.get(r.id) ?? [],
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }))
    }
  )

  app.get(
    '/professor/audios/:audioId',
    {
      onRequest: [authenticate],
      schema: {
        params: z.object({ audioId: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const userId = getUserId(request)
      const { audioId } = request.params

      if (!(await assertProfessor(userId))) {
        return reply.status(403).send({ error: 'Acesso negado.' })
      }

      const audio = await getOwnedAudio(userId, audioId)
      if (!audio) {
        return reply.status(404).send({ error: 'Áudio não encontrado.' })
      }

      const [{ libraryChunkCount }] = await db
        .select({ libraryChunkCount: count() })
        .from(schema.audioChunks)
        .where(
          and(
            eq(schema.audioChunks.audioId, audioId),
            isNull(schema.audioChunks.roomId)
          )
        )

      const linksByAudio = await getLinkedRoomsForAudios([audioId])

      return {
        id: audio.id,
        name: audio.name,
        libraryChunkCount: Number(libraryChunkCount),
        linkedRooms: linksByAudio.get(audioId) ?? [],
        createdAt: audio.createdAt,
        updatedAt: audio.updatedAt,
      }
    }
  )

  app.post(
    '/professor/audios',
    {
      onRequest: [authenticate],
      schema: { body: createAudioBodySchema },
    },
    async (request, reply) => {
      const userId = getUserId(request)
      const { name } = request.body

      if (!(await assertProfessor(userId))) {
        return reply
          .status(403)
          .send({ error: 'Apenas professores podem criar áudios.' })
      }

      const now = new Date()
      const [created] = await db
        .insert(schema.audios)
        .values({
          professorId: userId,
          name: name.trim(),
          createdAt: now,
          updatedAt: now,
        })
        .returning()

      if (!created) {
        throw new Error('Erro ao criar áudio.')
      }

      return reply.status(201).send({
        id: created.id,
        name: created.name,
        libraryChunkCount: 0,
        linkedRooms: [],
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      })
    }
  )

  app.patch(
    '/professor/audios/:audioId',
    {
      onRequest: [authenticate],
      schema: {
        params: z.object({ audioId: z.string().uuid() }),
        body: patchAudioBodySchema,
      },
    },
    async (request, reply) => {
      const userId = getUserId(request)
      const { audioId } = request.params
      const { name } = request.body

      if (!(await assertProfessor(userId))) {
        return reply.status(403).send({ error: 'Acesso negado.' })
      }

      const audio = await getOwnedAudio(userId, audioId)
      if (!audio) {
        return reply.status(404).send({ error: 'Áudio não encontrado.' })
      }

      const [updated] = await db
        .update(schema.audios)
        .set({ name: name.trim(), updatedAt: new Date() })
        .where(eq(schema.audios.id, audioId))
        .returning()

      if (!updated) {
        throw new Error('Erro ao atualizar áudio.')
      }

      return {
        id: updated.id,
        name: updated.name,
        updatedAt: updated.updatedAt,
      }
    }
  )

  app.post(
    '/professor/audios/:audioId/rooms/:roomId',
    {
      onRequest: [authenticate],
      schema: {
        params: z.object({
          audioId: z.string().uuid(),
          roomId: z.string().uuid(),
        }),
      },
    },
    async (request, reply) => {
      const userId = getUserId(request)
      const { audioId, roomId } = request.params

      if (!(await assertProfessor(userId))) {
        return reply.status(403).send({ error: 'Acesso negado.' })
      }

      const audio = await getOwnedAudio(userId, audioId)
      if (!audio) {
        return reply.status(404).send({ error: 'Áudio não encontrado.' })
      }

      const canAccess = await userHasRoomAccess(userId, roomId)
      if (!canAccess) {
        return reply.status(403).send({ error: 'Sem acesso a esta sala.' })
      }

      const [existingLink] = await db
        .select({ audioId: schema.audioRoomLinks.audioId })
        .from(schema.audioRoomLinks)
        .where(
          and(
            eq(schema.audioRoomLinks.audioId, audioId),
            eq(schema.audioRoomLinks.roomId, roomId)
          )
        )
        .limit(1)

      if (existingLink) {
        return reply.status(409).send({
          error: 'Este áudio já foi enviado para esta sala.',
        })
      }

      const libraryChunks = await getLibraryChunks(audioId)
      if (libraryChunks.length === 0) {
        return reply.status(400).send({
          error:
            'Grave ou envie o áudio na biblioteca antes de enviar para uma sala.',
        })
      }

      await db.insert(schema.audioRoomLinks).values({ audioId, roomId })
      await copyLibraryChunksToRoom(audioId, roomId, libraryChunks)

      await db
        .update(schema.audios)
        .set({ updatedAt: new Date() })
        .where(eq(schema.audios.id, audioId))

      const [room] = await db
        .select({ name: schema.rooms.name })
        .from(schema.rooms)
        .where(eq(schema.rooms.id, roomId))
        .limit(1)

      return reply.status(201).send({
        audioId,
        roomId,
        roomName: room?.name ?? null,
      })
    }
  )

  app.post(
    '/professor/audios/:audioId/upload',
    {
      onRequest: [authenticate],
      schema: {
        params: z.object({ audioId: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const userId = getUserId(request)
      const { audioId } = request.params

      if (!(await assertProfessor(userId))) {
        return reply
          .status(403)
          .send({ error: 'Apenas professores podem enviar áudio.' })
      }

      const audio = await getOwnedAudio(userId, audioId)
      if (!audio) {
        return reply.status(404).send({ error: 'Áudio não encontrado.' })
      }

      const file = await request.file()
      if (!file) {
        return reply.status(400).send({ error: 'Arquivo de áudio obrigatório.' })
      }

      const audioBuffer = await file.toBuffer()
      const audioAsBase64 = audioBuffer.toString('base64')

      const transcription = await transcribeAudio(audioAsBase64, file.mimetype)
      const embeddings = await generateEmbeddings(transcription)

      const chunk = await insertLibraryChunkAndSyncRooms(audioId, {
        transcription,
        embeddings,
        source: 'upload',
      })

      await db
        .update(schema.audios)
        .set({ updatedAt: new Date() })
        .where(eq(schema.audios.id, audioId))

      return reply.status(201).send({
        chunkId: chunk.id,
        audioId,
      })
    }
  )
}
