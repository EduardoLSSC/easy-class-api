import { and, asc, eq, isNull, max } from 'drizzle-orm'
import { db } from '../db/connection.ts'
import { schema } from '../db/schema/index.ts'

type LibraryChunk = {
  id: string
  transcription: string
  embeddings: number[]
  chunkIndex: number
  source: string | null
}

export async function getLibraryChunks(audioId: string) {
  return db
    .select({
      id: schema.audioChunks.id,
      transcription: schema.audioChunks.transcription,
      embeddings: schema.audioChunks.embeddings,
      chunkIndex: schema.audioChunks.chunkIndex,
      source: schema.audioChunks.source,
    })
    .from(schema.audioChunks)
    .where(
      and(
        eq(schema.audioChunks.audioId, audioId),
        isNull(schema.audioChunks.roomId)
      )
    )
    .orderBy(asc(schema.audioChunks.chunkIndex))
}

export async function getLinkedRoomIds(audioId: string) {
  const rows = await db
    .select({ roomId: schema.audioRoomLinks.roomId })
    .from(schema.audioRoomLinks)
    .where(eq(schema.audioRoomLinks.audioId, audioId))

  return rows.map((r) => r.roomId)
}

async function nextRoomChunkIndex(audioId: string, roomId: string) {
  const [{ m }] = await db
    .select({ m: max(schema.audioChunks.chunkIndex) })
    .from(schema.audioChunks)
    .where(
      and(
        eq(schema.audioChunks.audioId, audioId),
        eq(schema.audioChunks.roomId, roomId)
      )
    )

  return (m ?? -1) + 1
}

async function nextLibraryChunkIndex(audioId: string) {
  const [{ m }] = await db
    .select({ m: max(schema.audioChunks.chunkIndex) })
    .from(schema.audioChunks)
    .where(
      and(
        eq(schema.audioChunks.audioId, audioId),
        isNull(schema.audioChunks.roomId)
      )
    )

  return (m ?? -1) + 1
}

/** Copia trechos da biblioteca para uma sala (após criar o vínculo). */
export async function copyLibraryChunksToRoom(
  audioId: string,
  roomId: string,
  libraryChunks: LibraryChunk[]
) {
  let index = await nextRoomChunkIndex(audioId, roomId)

  for (const chunk of libraryChunks) {
    await db.insert(schema.audioChunks).values({
      audioId,
      roomId,
      transcription: chunk.transcription,
      embeddings: chunk.embeddings,
      chunkIndex: index,
      source: chunk.source ?? 'room_link',
    })
    index += 1
  }
}

/** Novo trecho na biblioteca + réplicas nas salas já vinculadas. */
export async function insertLibraryChunkAndSyncRooms(
  audioId: string,
  data: {
    transcription: string
    embeddings: number[]
    source: string
  }
) {
  const chunkIndex = await nextLibraryChunkIndex(audioId)

  const [libraryChunk] = await db
    .insert(schema.audioChunks)
    .values({
      audioId,
      roomId: null,
      transcription: data.transcription,
      embeddings: data.embeddings,
      chunkIndex,
      source: data.source,
    })
    .returning()

  if (!libraryChunk) {
    throw new Error('Erro ao salvar trecho na biblioteca.')
  }

  const linkedRoomIds = await getLinkedRoomIds(audioId)

  for (const roomId of linkedRoomIds) {
    const roomIndex = await nextRoomChunkIndex(audioId, roomId)
    await db.insert(schema.audioChunks).values({
      audioId,
      roomId,
      transcription: data.transcription,
      embeddings: data.embeddings,
      chunkIndex: roomIndex,
      source: data.source,
    })
  }

  return libraryChunk
}
