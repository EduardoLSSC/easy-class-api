import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { createAppUser } from '../../lib/create-app-user.ts'
import { requireAdmin } from '../require-admin.ts'

const bodySchema = z
  .object({
    name: z.string().min(1),
    email: z.string().email(),
    ra: z.string().min(1).optional(),
    password: z.string().min(4),
    role: z.enum(['professor', 'student']),
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

      const result = await createAppUser({
        name,
        email,
        password,
        role,
        ra,
      })

      if (!result.ok) {
        return reply.status(result.status).send({ error: result.error })
      }

      return reply
        .status(201)
        .send({ userId: result.userId, ra: result.ra })
    }
  )
}
