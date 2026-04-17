import { and, eq } from 'drizzle-orm'
import { db } from '../db/connection.ts'
import { schema } from '../db/schema/index.ts'

export async function userHasRoomAccess(
  userId: string,
  roomId: string
): Promise<boolean> {
  const [owned] = await db
    .select({ id: schema.rooms.id })
    .from(schema.rooms)
    .where(
      and(eq(schema.rooms.id, roomId), eq(schema.rooms.ownerId, userId))
    )
    .limit(1)

  if (owned) {
    return true
  }

  const [member] = await db
    .select({ id: schema.roomMembers.roomId })
    .from(schema.roomMembers)
    .where(
      and(
        eq(schema.roomMembers.roomId, roomId),
        eq(schema.roomMembers.userId, userId)
      )
    )
    .limit(1)

  return Boolean(member)
}
