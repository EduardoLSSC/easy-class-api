import { env } from '../env.ts'
import {
  friendlyGeminiError,
  isGeminiServiceError,
  toGeminiServiceError,
  withGeminiRetry,
} from './gemini-errors.ts'

export const primaryGeminiModel = env.GEMINI_MODEL

function parseModelList(raw: string) {
  return raw
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean)
}

/** Lista ordenada: principal + fallbacks (sem duplicatas). */
export const contentGeminiModels = [
  primaryGeminiModel,
  ...parseModelList(env.GEMINI_MODEL_FALLBACK),
].filter((model, index, list) => list.indexOf(model) === index)

/** Primeiro fallback configurado (compatibilidade). */
export const fallbackGeminiModel =
  parseModelList(env.GEMINI_MODEL_FALLBACK)[0] ?? primaryGeminiModel

export async function withGeminiModelFallback<T>(
  run: (model: string) => Promise<T>,
  maxAttemptsPerModel = 2
): Promise<{ result: T; modelUsed: string }> {
  let lastErr: unknown

  for (let i = 0; i < contentGeminiModels.length; i++) {
    const model = contentGeminiModels[i]!
    const hasNext = i < contentGeminiModels.length - 1

    try {
      const result = await withGeminiRetry(
        () => run(model),
        maxAttemptsPerModel
      )
      return { result, modelUsed: model }
    } catch (err) {
      lastErr = err
      if (isGeminiServiceError(err) && !err.retryable) {
        throw err
      }

      const { retryable } = friendlyGeminiError(err)
      if (!retryable || !hasNext) {
        throw isGeminiServiceError(err) ? err : toGeminiServiceError(err)
      }

      console.warn(
        `[gemini] Modelo ${model} indisponível; tentando fallback ${contentGeminiModels[i + 1]}.`
      )
    }
  }

  throw toGeminiServiceError(lastErr)
}
