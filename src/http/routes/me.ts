import { eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { resolveUserAppRole } from '../../lib/app-role.ts'
import { db } from '../../db/connection.ts'
import { schema } from '../../db/schema/index.ts'
import { authenticate, getUserId } from '../authenticate.ts'

export const meRoute: FastifyPluginCallbackZod = (app) => {
  app.get('/auth/me', { onRequest: [authenticate] }, async (request, reply) => {
    const userId = getUserId(request)

    const [user] = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1)

    if (!user) {
      return reply.status(404).send({ error: 'Usuário não encontrado.' })
    }

    const role = await resolveUserAppRole(userId)

    return { user: { ...user, role } }
  })
}
