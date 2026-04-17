import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { db } from '../../db/connection.ts'
import { schema } from '../../db/schema/index.ts'

export const loginRoute: FastifyPluginCallbackZod = (app) => {
  app.post(
    '/auth/login',
    {
      schema: {
        body: z.object({
          email: z.string().email(),
          password: z.string().min(1),
        }),
      },
    },
    async (request, reply) => {
      const { email, password } = request.body

      const [user] = await db
        .select({
          id: schema.users.id,
          name: schema.users.name,
          email: schema.users.email,
          passwordHash: schema.users.passwordHash,
          isActive: schema.users.isActive,
        })
        .from(schema.users)
        .where(eq(schema.users.email, email.toLowerCase()))
        .limit(1)

      if (!user || !user.isActive) {
        return reply.status(401).send({ error: 'E-mail ou senha incorretos.' })
      }

      const ok = await bcrypt.compare(password, user.passwordHash)
      if (!ok) {
        return reply.status(401).send({ error: 'E-mail ou senha incorretos.' })
      }

      const token = await reply.jwtSign({ sub: user.id }, { expiresIn: '7d' })

      return {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      }
    }
  )
}
