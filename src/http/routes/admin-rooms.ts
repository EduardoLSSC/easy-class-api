import { and, count, eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../db/connection.ts'
import { schema } from '../../db/schema/index.ts'
import { resolveUserAppRole, type AppRole } from '../../lib/app-role.ts'
import { requireAdmin } from '../require-admin.ts'

async function assertUserRole(
  userId: string,
  allowed: AppRole[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const role = await resolveUserAppRole(userId)
  if (!allowed.includes(role)) {
    return { ok: false, error: 'Usuário com perfil inválido para esta operação.' }
  }
  return { ok: true }
}

export const adminRoomsRoute: FastifyPluginCallbackZod = (app) => {
  app.get('/admin/rooms', { onRequest: [requireAdmin] }, async () => {
    const allRooms = await db
      .select({
        id: schema.rooms.id,
        name: schema.rooms.name,
        description: schema.rooms.description,
        createdAt: schema.rooms.createdAt,
        ownerId: schema.rooms.ownerId,
        ownerName: schema.users.name,
        ownerEmail: schema.users.email,
        ownerRa: schema.users.ra,
        memberCount: count(schema.roomMembers.userId),
      })
      .from(schema.rooms)
      .innerJoin(schema.users, eq(schema.rooms.ownerId, schema.users.id))
      .leftJoin(
        schema.roomMembers,
        eq(schema.roomMembers.roomId, schema.rooms.id)
      )
      .groupBy(
        schema.rooms.id,
        schema.users.id,
        schema.users.name,
        schema.users.email,
        schema.users.ra
      )
      .orderBy(schema.rooms.createdAt)

    return allRooms.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      createdAt: r.createdAt,
      owner: {
        id: r.ownerId,
        name: r.ownerName,
        email: r.ownerEmail,
        ra: r.ownerRa,
      },
      memberCount: Number(r.memberCount),
    }))
  })

  app.get(
    '/admin/rooms/:roomId',
    {
      onRequest: [requireAdmin],
      schema: {
        params: z.object({ roomId: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const { roomId } = request.params

      const [room] = await db
        .select({
          id: schema.rooms.id,
          name: schema.rooms.name,
          description: schema.rooms.description,
          createdAt: schema.rooms.createdAt,
          ownerId: schema.rooms.ownerId,
          ownerName: schema.users.name,
          ownerEmail: schema.users.email,
          ownerRa: schema.users.ra,
        })
        .from(schema.rooms)
        .innerJoin(schema.users, eq(schema.rooms.ownerId, schema.users.id))
        .where(eq(schema.rooms.id, roomId))
        .limit(1)

      if (!room) {
        return reply.status(404).send({ error: 'Sala não encontrada.' })
      }

      const members = await db
        .select({
          userId: schema.roomMembers.userId,
          joinedAt: schema.roomMembers.joinedAt,
          name: schema.users.name,
          email: schema.users.email,
          ra: schema.users.ra,
        })
        .from(schema.roomMembers)
        .innerJoin(schema.users, eq(schema.roomMembers.userId, schema.users.id))
        .where(eq(schema.roomMembers.roomId, roomId))

      const withRoles = await Promise.all(
        members.map(async (m) => ({
          ...m,
          role: await resolveUserAppRole(m.userId),
        }))
      )

      return {
        id: room.id,
        name: room.name,
        description: room.description,
        createdAt: room.createdAt,
        owner: {
          id: room.ownerId,
          name: room.ownerName,
          email: room.ownerEmail,
          ra: room.ownerRa,
          role: await resolveUserAppRole(room.ownerId),
        },
        members: withRoles.filter((m) => m.role === 'student'),
      }
    }
  )

  app.post(
    '/admin/rooms',
    {
      onRequest: [requireAdmin],
      schema: {
        body: z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          ownerId: z.string().uuid(),
          studentIds: z.array(z.string().uuid()).optional(),
        }),
      },
    },
    async (request, reply) => {
      const { name, description, ownerId, studentIds = [] } = request.body

      const ownerCheck = await assertUserRole(ownerId, ['professor'])
      if (!ownerCheck.ok) {
        return reply.status(400).send({ error: ownerCheck.error })
      }

      const [created] = await db
        .insert(schema.rooms)
        .values({ name, description, ownerId })
        .returning({ id: schema.rooms.id })

      if (!created) {
        return reply.status(500).send({ error: 'Falha ao criar sala.' })
      }

      const uniqueStudentIds = [...new Set(studentIds)].filter(
        (id) => id !== ownerId
      )

      if (uniqueStudentIds.length > 0) {
        for (const studentId of uniqueStudentIds) {
          const check = await assertUserRole(studentId, ['student'])
          if (!check.ok) {
            continue
          }
          await db
            .insert(schema.roomMembers)
            .values({ userId: studentId, roomId: created.id })
            .onConflictDoNothing()
        }
      }

      return reply.status(201).send({ roomId: created.id })
    }
  )

  app.patch(
    '/admin/rooms/:roomId',
    {
      onRequest: [requireAdmin],
      schema: {
        params: z.object({ roomId: z.string().uuid() }),
        body: z.object({
          name: z.string().min(1).optional(),
          description: z.string().optional(),
          ownerId: z.string().uuid().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { roomId } = request.params
      const { name, description, ownerId } = request.body

      const [existing] = await db
        .select({ id: schema.rooms.id })
        .from(schema.rooms)
        .where(eq(schema.rooms.id, roomId))
        .limit(1)

      if (!existing) {
        return reply.status(404).send({ error: 'Sala não encontrada.' })
      }

      if (ownerId) {
        const ownerCheck = await assertUserRole(ownerId, ['professor'])
        if (!ownerCheck.ok) {
          return reply.status(400).send({ error: ownerCheck.error })
        }
      }

      const updates: {
        name?: string
        description?: string | null
        ownerId?: string
      } = {}
      if (name !== undefined) {
        updates.name = name
      }
      if (description !== undefined) {
        updates.description = description || null
      }
      if (ownerId !== undefined) {
        updates.ownerId = ownerId
      }

      if (Object.keys(updates).length > 0) {
        await db
          .update(schema.rooms)
          .set(updates)
          .where(eq(schema.rooms.id, roomId))
      }

      return reply.status(200).send({ roomId })
    }
  )

  app.post(
    '/admin/rooms/:roomId/members',
    {
      onRequest: [requireAdmin],
      schema: {
        params: z.object({ roomId: z.string().uuid() }),
        body: z.object({ userId: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const { roomId } = request.params
      const { userId } = request.body

      const [room] = await db
        .select({ id: schema.rooms.id, ownerId: schema.rooms.ownerId })
        .from(schema.rooms)
        .where(eq(schema.rooms.id, roomId))
        .limit(1)

      if (!room) {
        return reply.status(404).send({ error: 'Sala não encontrada.' })
      }

      if (userId === room.ownerId) {
        return reply
          .status(400)
          .send({ error: 'O professor responsável já é dono desta sala.' })
      }

      const role = await resolveUserAppRole(userId)
      if (role !== 'student') {
        return reply.status(400).send({
          error:
            'Participantes devem ser alunos. O professor entra apenas como responsável.',
        })
      }

      await db
        .insert(schema.roomMembers)
        .values({ userId, roomId })
        .onConflictDoNothing()

      return reply.status(201).send({ ok: true })
    }
  )

  app.delete(
    '/admin/rooms/:roomId/members/:userId',
    {
      onRequest: [requireAdmin],
      schema: {
        params: z.object({
          roomId: z.string().uuid(),
          userId: z.string().uuid(),
        }),
      },
    },
    async (request, reply) => {
      const { roomId, userId } = request.params

      await db
        .delete(schema.roomMembers)
        .where(
          and(
            eq(schema.roomMembers.roomId, roomId),
            eq(schema.roomMembers.userId, userId)
          )
        )

      return reply.status(200).send({ ok: true })
    }
  )

  app.delete(
    '/admin/rooms/:roomId',
    {
      onRequest: [requireAdmin],
      schema: {
        params: z.object({ roomId: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const { roomId } = request.params

      const [existing] = await db
        .select({ id: schema.rooms.id })
        .from(schema.rooms)
        .where(eq(schema.rooms.id, roomId))
        .limit(1)

      if (!existing) {
        return reply.status(404).send({ error: 'Sala não encontrada.' })
      }

      await db.delete(schema.rooms).where(eq(schema.rooms.id, roomId))

      return reply.status(200).send({ ok: true })
    }
  )
}
