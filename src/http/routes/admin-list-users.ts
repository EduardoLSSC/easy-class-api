import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { db } from '../../db/connection.ts'
import { schema } from '../../db/schema/index.ts'
import { requireAdmin } from '../require-admin.ts'
import { resolveUserAppRole } from '../../lib/app-role.ts'

export const adminListUsersRoute: FastifyPluginCallbackZod = (app) => {
  app.get('/admin/users', { onRequest: [requireAdmin] }, async () => {
    const allUsers = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        ra: schema.users.ra,
        isActive: schema.users.isActive,
      })
      .from(schema.users)

    const withRoles = await Promise.all(
      allUsers.map(async (u) => ({
        ...u,
        role: await resolveUserAppRole(u.id),
      }))
    )

    return withRoles
  })
}
