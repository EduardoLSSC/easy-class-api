import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { createAppUser } from '../../lib/create-app-user.ts'
import { requireAdmin } from '../require-admin.ts'

const userRowSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(4),
  ra: z.string().min(1).optional(),
})

const bodySchema = z
  .object({
    role: z.enum(['student', 'professor']),
    users: z.array(userRowSchema).min(1).max(500),
  })
  .superRefine((data, ctx) => {
    if (data.role !== 'professor') {
      return
    }
    for (let index = 0; index < data.users.length; index++) {
      if (!data.users[index]?.ra?.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'RP é obrigatório para professor.',
          path: ['users', index, 'ra'],
        })
      }
    }
  })

export const adminBulkCreateUsersRoute: FastifyPluginCallbackZod = (app) => {
  app.post(
    '/admin/users/bulk',
    {
      onRequest: [requireAdmin],
      schema: {
        body: bodySchema,
      },
    },
    async (request, reply) => {
      const { role, users } = request.body

      const seenEmails = new Set<string>()
      const created: {
        userId: string
        name: string
        email: string
        ra: string | null
      }[] = []
      const skipped: { email: string; reason: string; row?: number }[] = []

      for (let index = 0; index < users.length; index++) {
        const row = users[index]
        const normalizedEmail = row.email.trim().toLowerCase()

        if (seenEmails.has(normalizedEmail)) {
          skipped.push({
            email: row.email,
            reason: 'E-mail duplicado na planilha.',
            row: index + 1,
          })
          continue
        }
        seenEmails.add(normalizedEmail)

        const result = await createAppUser({
          name: row.name,
          email: row.email,
          password: row.password,
          role,
          ra: row.ra,
        })

        if (!result.ok) {
          skipped.push({
            email: row.email,
            reason: result.error,
            row: index + 1,
          })
          continue
        }

        created.push({
          userId: result.userId,
          name: row.name.trim(),
          email: normalizedEmail,
          ra: result.ra,
        })
      }

      return reply.status(201).send({
        createdCount: created.length,
        skippedCount: skipped.length,
        created,
        skipped,
      })
    }
  )
}
