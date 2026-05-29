import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { checkGeminiHealth } from '../../services/gemini.ts'
import { requireAdmin } from '../require-admin.ts'

export const adminGeminiHealthRoute: FastifyPluginCallbackZod = (app) => {
  app.get(
    '/admin/gemini-health',
    { onRequest: [requireAdmin] },
    async () => {
      const geminiHealth = await checkGeminiHealth()

      return {
        ok: geminiHealth.ok,
        indicator: {
          id: 'gemini',
          label: 'IA (Gemini)',
          status: geminiHealth.ok
            ? ('healthy' as const)
            : ('critical' as const),
          value: geminiHealth.value,
          detail: geminiHealth.detail,
        },
      }
    }
  )
}
