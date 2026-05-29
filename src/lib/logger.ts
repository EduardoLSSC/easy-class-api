import { Writable } from 'node:stream'
import type { FastifyServerOptions } from 'fastify'
import { env } from '../env.ts'

type PinoLog = {
  level: number
  time?: number
  msg?: string
  err?: { type?: string; message?: string; stack?: string }
  req?: { method?: string; url?: string }
  res?: { statusCode?: number }
  statusCode?: number
  method?: string
  url?: string
  [key: string]: unknown
}

function levelLabel(level: number) {
  if (level >= 60) return 'FATAL'
  if (level >= 50) return 'ERROR'
  if (level >= 40) return 'WARN '
  if (level >= 30) return 'INFO '
  return 'DEBUG'
}

function formatTime(ts?: number) {
  if (!ts) return '--:--:--'
  return new Date(ts).toISOString().slice(11, 19)
}

/** Escreve uma linha JSON do Pino de forma legível no terminal. */
export function writePrettyLogLine(raw: string) {
  try {
    const log = JSON.parse(raw) as PinoLog
    const tag = levelLabel(log.level)
    const time = formatTime(log.time)
    const req =
      log.req?.method && log.req?.url
        ? ` ${log.req.method} ${log.req.url}`
        : log.method && log.url
          ? ` ${log.method} ${log.url}`
          : ''
    const status =
      log.res?.statusCode ?? log.statusCode
        ? ` → ${log.res?.statusCode ?? log.statusCode}`
        : ''
    const line = `[${time}] ${tag} ${log.msg ?? ''}${req}${status}`

    if (log.level >= 50) {
      console.error(line)
      if (log.err?.stack) {
        console.error(log.err.stack)
      } else if (log.err?.message) {
        console.error(`  ↳ ${log.err.message}`)
      }
    } else if (log.level >= 40) {
      console.warn(line)
    } else {
      console.log(line)
    }
  } catch {
    const trimmed = raw.trim()
    if (trimmed) {
      console.log(trimmed)
    }
  }
}

const prettyStream = new Writable({
  write(chunk, _encoding, callback) {
    writePrettyLogLine(chunk.toString())
    callback()
  },
})

export function createFastifyLoggerConfig(): FastifyServerOptions['logger'] {
  return {
    level: env.LOG_LEVEL,
    stream: prettyStream,
  }
}

/** Log explícito para erros fora do ciclo do Fastify (ex.: startup). */
export function logAppError(
  scope: string,
  err: unknown,
  meta?: Record<string, unknown>
) {
  const message = err instanceof Error ? err.message : String(err)
  const stack = err instanceof Error ? err.stack : undefined

  console.error(`\n[${new Date().toISOString()}] ERROR · ${scope}`)
  console.error(`  message: ${message}`)
  if (meta && Object.keys(meta).length > 0) {
    console.error('  meta:', meta)
  }
  if (stack) {
    console.error(stack)
  }
  console.error('')
}

export function registerProcessErrorHandlers() {
  process.on('unhandledRejection', (reason) => {
    logAppError('unhandledRejection', reason)
  })

  process.on('uncaughtException', (err) => {
    logAppError('uncaughtException', err)
    process.exit(1)
  })
}
