/** Erro da integração Gemini com status HTTP para a API. */
export class GeminiServiceError extends Error {
  readonly statusCode: number
  readonly retryable: boolean

  constructor(message: string, statusCode: number, retryable = false) {
    super(message)
    this.name = 'GeminiServiceError'
    this.statusCode = statusCode
    this.retryable = retryable
  }
}

export function isGeminiServiceError(err: unknown): err is GeminiServiceError {
  return err instanceof GeminiServiceError
}

export function geminiErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: string }).message)
  }
  return String(err)
}

function parseGeminiPayload(raw: string): {
  code?: number
  message?: string
  status?: string
} | null {
  try {
    const parsed = JSON.parse(raw) as {
      error?: { code?: number; message?: string; status?: string }
    }
    if (parsed?.error) {
      return parsed.error
    }
  } catch {
    /* não é JSON */
  }
  return null
}

export function friendlyGeminiError(err: unknown): {
  message: string
  statusCode: number
  retryable: boolean
} {
  const raw = geminiErrorMessage(err)
  const payload = parseGeminiPayload(raw)
  const code = payload?.code
  const apiMessage = payload?.message ?? raw
  const lower = `${raw} ${apiMessage}`.toLowerCase()

  if (
    code === 503 ||
    payload?.status === 'UNAVAILABLE' ||
    lower.includes('high demand') ||
    lower.includes('unavailable') ||
    lower.includes('"code":503')
  ) {
    return {
      message:
        'O serviço de IA está temporariamente indisponível neste modelo (alta demanda no Google). O sistema tenta outros modelos automaticamente; aguarde e tente de novo.',
      statusCode: 503,
      retryable: true,
    }
  }

  if (
    code === 429 ||
    lower.includes('quota') ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit') ||
    lower.includes('429') ||
    lower.includes('billing') ||
    lower.includes('exceeded')
  ) {
    return {
      message:
        'Limite de uso da API atingido. Verifique cota e billing no Google AI Studio.',
      statusCode: 429,
      retryable: true,
    }
  }

  if (
    code === 401 ||
    lower.includes('api key') ||
    lower.includes('api_key')
  ) {
    return {
      message:
        'Chave da API Gemini inválida ou ausente. Confira GEMINI_API_KEY no .env.',
      statusCode: 502,
      retryable: false,
    }
  }

  if (code === 403 || lower.includes('permission')) {
    return {
      message: 'Sem permissão para usar a API Gemini com esta chave.',
      statusCode: 403,
      retryable: false,
    }
  }

  return {
    message: apiMessage.length > 200 ? `${apiMessage.slice(0, 200)}…` : apiMessage,
    statusCode: 502,
    retryable: false,
  }
}

export function toGeminiServiceError(err: unknown): GeminiServiceError {
  const { message, statusCode, retryable } = friendlyGeminiError(err)
  return new GeminiServiceError(message, statusCode, retryable)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function withGeminiRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let lastErr: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const { retryable } = friendlyGeminiError(err)

      if (!retryable || attempt === maxAttempts) {
        throw toGeminiServiceError(err)
      }

      const delayMs = 1000 * 2 ** (attempt - 1)
      await sleep(delayMs)
    }
  }

  throw toGeminiServiceError(lastErr)
}
