import type { FastifyReply, FastifyRequest } from 'fastify'
import { resolveUserAppRole } from '../lib/app-role.ts'
import { getUserId } from './authenticate.ts'

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify()
  } catch {
    reply.status(401).send({ error: 'Não autorizado' })
    return
  }
  const role = await resolveUserAppRole(getUserId(request))
  if (role !== 'admin') {
    reply.status(403).send({ error: 'Acesso restrito a administradores.' })
  }
}
