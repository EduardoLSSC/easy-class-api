import type { FastifyReply, FastifyRequest } from 'fastify'

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify()
  } catch {
    return reply.status(401).send({ error: 'Não autorizado' })
  }
}

export function getUserId(request: FastifyRequest): string {
  const u = request.user as { sub: string }
  return u.sub
}
