import bcrypt from 'bcryptjs'
import { and, eq, inArray, ne } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../db/connection.ts'
import { schema } from '../../db/schema/index.ts'
import { resolveUserAppRole } from '../../lib/app-role.ts'
import { requireAdmin } from '../require-admin.ts'

const bodySchema = z
  .object({
    name: z.string().min(1),
    email: z.string().email(),
    ra: z.string().min(1).optional(),
    password: z.string().min(4).optional(),
    role: z.enum(['professor', 'student']),
    isActive: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'professor' && !data.ra?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'RP é obrigatório para professor.',
        path: ['ra'],
      })
    }
  })

export const adminUpdateUserRoute: FastifyPluginCallbackZod = (app) => {
  app.patch(
    '/admin/users/:userId',
    {
      onRequest: [requireAdmin],
      schema: {
        params: z.object({
          userId: z.string().uuid(),
        }),
        body: bodySchema,
      },
    },
    async (request, reply) => {
      const { userId } = request.params
      const { name, email, ra, password, role, isActive } = request.body

      const [target] = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1)

      if (!target) {
        return reply.status(404).send({ error: 'Usuário não encontrado.' })
      }

      const currentRole = await resolveUserAppRole(userId)
      if (currentRole === 'admin') {
        return reply
          .status(403)
          .send({ error: 'Contas de administrador não podem ser editadas aqui.' })
      }

      const normalizedEmail = email.toLowerCase()

      const [emailTaken] = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(
          and(
            eq(schema.users.email, normalizedEmail),
            ne(schema.users.id, userId)
          )
        )
        .limit(1)

      if (emailTaken) {
        return reply.status(409).send({ error: 'E-mail já cadastrado.' })
      }

      const dbRoleName = role === 'professor' ? 'teacher' : 'student'

      let normalizedRa: string | undefined
      if (role === 'professor') {
        normalizedRa = ra!.trim().toUpperCase()

        const [raTaken] = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(
            and(eq(schema.users.ra, normalizedRa), ne(schema.users.id, userId))
          )
          .limit(1)

        if (raTaken) {
          return reply.status(409).send({ error: 'RP já cadastrado.' })
        }
      }

      const [newRoleRow] = await db
        .select({ id: schema.roles.id })
        .from(schema.roles)
        .where(eq(schema.roles.name, dbRoleName))
        .limit(1)

      if (!newRoleRow) {
        return reply.status(500).send({ error: 'Papel não configurado no sistema.' })
      }

      const teachStudentRoles = await db
        .select({ id: schema.roles.id })
        .from(schema.roles)
        .where(inArray(schema.roles.name, ['teacher', 'student']))

      const teachStudentRoleIds = teachStudentRoles.map((r) => r.id)

      if (teachStudentRoleIds.length > 0) {
        await db
          .delete(schema.userRoles)
          .where(
            and(
              eq(schema.userRoles.userId, userId),
              inArray(schema.userRoles.roleId, teachStudentRoleIds)
            )
          )
      }

      await db.insert(schema.userRoles).values({
        userId,
        roleId: newRoleRow.id,
      })

      const updates: {
        name: string
        email: string
        ra?: string
        isActive: boolean
        passwordHash?: string
      } = {
        name,
        email: normalizedEmail,
        isActive,
      }

      if (role === 'professor' && normalizedRa) {
        updates.ra = normalizedRa
      }

      if (password) {
        updates.passwordHash = await bcrypt.hash(password, 10)
      }

      await db.update(schema.users).set(updates).where(eq(schema.users.id, userId))

      return reply.status(200).send({ userId })
    }
  )
}
