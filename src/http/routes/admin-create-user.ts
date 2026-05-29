import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../db/connection.ts'
import { schema } from '../../db/schema/index.ts'
import { requireAdmin } from '../require-admin.ts'

const bodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  ra: z.string().min(1),
  password: z.string().min(4),
  role: z.enum(['professor', 'student']),
})

export const adminCreateUserRoute: FastifyPluginCallbackZod = (app) => {
  app.post(
    '/admin/users',
    {
      onRequest: [requireAdmin],
      schema: {
        body: bodySchema,
      },
    },
    async (request, reply) => {
      const { name, email, ra, password, role } = request.body
      const normalizedRa = ra.trim().toUpperCase()

      const dbRoleName = role === 'professor' ? 'teacher' : 'student'

      const [existing] = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.email, email.toLowerCase()))
        .limit(1)

      if (existing) {
        return reply.status(409).send({ error: 'E-mail já cadastrado.' })
      }

      const [raTaken] = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.ra, normalizedRa))
        .limit(1)

      if (raTaken) {
        return reply.status(409).send({ error: 'RA já cadastrado.' })
      }

      const [roleRow] = await db
        .select({ id: schema.roles.id })
        .from(schema.roles)
        .where(eq(schema.roles.name, dbRoleName))
        .limit(1)

      if (!roleRow) {
        return reply.status(500).send({ error: 'Papel não configurado no sistema.' })
      }

      const passwordHash = await bcrypt.hash(password, 10)

      const [created] = await db
        .insert(schema.users)
        .values({
          name,
          email: email.toLowerCase(),
          ra: normalizedRa,
          passwordHash,
          isActive: true,
        })
        .returning({ id: schema.users.id })

      if (!created) {
        return reply.status(500).send({ error: 'Falha ao criar usuário.' })
      }

      await db.insert(schema.userRoles).values({
        userId: created.id,
        roleId: roleRow.id,
      })

      return reply.status(201).send({ userId: created.id })
    }
  )
}
