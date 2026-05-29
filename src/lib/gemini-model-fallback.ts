import { env } from '../env.ts'
import {
  friendlyGeminiError,
  isGeminiServiceError,
  toGeminiServiceError,
  withGeminiRetry,
} from './gemini-errors.ts'

export const primaryGeminiModel = env.GEMINI_MODEL
export const fallbackGeminiModel = env.GEMINI_MODEL_FALLBACK

const contentModels = [
  primaryGeminiModel,
  fallbackGeminiModel,
].filter((m, i, arr) => arr.indexOf(m) === i)

export async function withGeminiModelFallback<T>(
  run: (model: string) => Promise<T>,
  maxAttemptsPerModel = 2
): Promise<{ result: T; modelUsed: string }> {
  let lastErr: unknown

  for (let i = 0; i < contentModels.length; i++) {
    const model = contentModels[i]!
    const hasNext = i < contentModels.length - 1

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
        `[gemini] Modelo ${model} indisponível; tentando fallback ${contentModels[i + 1]}.`
      )
    }
  }

  throw toGeminiServiceError(lastErr)
}
