import type { FastifyError, FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import { isGeminiServiceError } from '../lib/gemini-errors.ts'

function isClientError(statusCode: number) {
  return statusCode >= 400 && statusCode < 500
}

export function registerErrorHandling(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (isGeminiServiceError(error)) {
      const level = error.statusCode >= 500 ? 'error' : 'warn'
      request.log[level](
        { err: error, method: request.method, url: request.url },
        error.message
      )
      if (reply.sent) return
      return reply.status(error.statusCode).send({ error: error.message })
    }

    const statusCode =
      error.statusCode && error.statusCode >= 400
        ? error.statusCode
        : error instanceof ZodError
          ? 400
          : 500

    const context = {
      method: request.method,
      url: request.url,
      statusCode,
    }

    if (error instanceof ZodError) {
      const details = error.flatten()
      request.log.warn(
        { ...context, validation: details },
        'Validação da requisição falhou'
      )
      return reply.status(400).send({
        error: 'Dados inválidos.',
        details,
      })
    }

    if (error.validation) {
      request.log.warn(
        { ...context, validation: error.validation },
        'Validação da requisição falhou'
      )
      return reply.status(400).send({
        error: 'Dados inválidos.',
        details: error.validation,
      })
    }

    if (statusCode >= 500) {
      request.log.error({ err: error, ...context }, error.message)
    } else {
      request.log.warn({ err: error, ...context }, error.message)
    }

    const bodyMessage = isClientError(statusCode)
      ? error.message || 'Requisição inválida.'
      : statusCode === 500 && error.message
        ? error.message
        : 'Erro interno do servidor.'

    if (reply.sent) {
      return
    }

    return reply.status(statusCode).send({ error: bodyMessage })
  })

  app.setNotFoundHandler((request, reply) => {
    request.log.warn(
      { method: request.method, url: request.url },
      'Rota não encontrada'
    )
    return reply.status(404).send({ error: 'Rota não encontrada.' })
  })

  /** Respostas 4xx/5xx enviadas manualmente nas rotas (sem throw). */
  app.addHook('onResponse', async (request, reply) => {
    if (reply.statusCode < 400) {
      return
    }

    request.log.warn(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
      },
      `HTTP ${reply.statusCode}`
    )
  })
}
