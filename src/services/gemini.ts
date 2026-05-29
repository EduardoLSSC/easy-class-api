import {
  createPartFromBase64,
  createPartFromText,
  createUserContent,
  GoogleGenAI,
} from '@google/genai'
import { env } from '../env.ts'
import { logAppError } from '../lib/logger.ts'
import {
  friendlyGeminiError,
  geminiErrorMessage,
  withGeminiRetry,
} from '../lib/gemini-errors.ts'
import {
  fallbackGeminiModel,
  primaryGeminiModel,
  withGeminiModelFallback,
} from '../lib/gemini-model-fallback.ts'

const gemini = new GoogleGenAI({
  apiKey: env.GEMINI_API_KEY,
})

const embeddingModel = 'gemini-embedding-001'
const embeddingDimensions = 768

function normalizeAudioMimeType(raw: string | undefined) {
  const m = (raw ?? '').trim().toLowerCase()
  if (!m || m === 'application/octet-stream') {
    return 'audio/webm'
  }
  if (m === 'video/webm' || m.startsWith('video/webm;')) {
    return 'audio/webm'
  }
  return m
}

export { geminiErrorMessage, friendlyGeminiError, primaryGeminiModel, fallbackGeminiModel }

export type GeminiHealthResult = {
  ok: boolean
  value: string
  detail: string
}

export async function checkGeminiHealth(): Promise<GeminiHealthResult> {
  try {
    const { modelUsed } = await withGeminiModelFallback(async (model) => {
      const response = await gemini.models.generateContent({
        model,
        contents: createUserContent(
          createPartFromText('Responda apenas com a palavra ok.')
        ),
        config: {
          maxOutputTokens: 16,
          temperature: 0,
        },
      })

      if (response.promptFeedback?.blockReason) {
        throw new Error(
          `Requisição bloqueada: ${response.promptFeedback.blockReason}`
        )
      }

      if (!response.text?.trim()) {
        throw new Error('A API Gemini respondeu vazio no teste de saúde.')
      }

      return response
    }, 1)

    const fallbackNote =
      modelUsed !== primaryGeminiModel
        ? ` (fallback: ${modelUsed})`
        : ''

    return {
      ok: true,
      value: 'Operacional',
      detail: `Modelo ${modelUsed}${fallbackNote} respondeu corretamente ao teste.`,
    }
  } catch (err) {
    const { message } = friendlyGeminiError(err)
    return {
      ok: false,
      value: 'Erro',
      detail: message,
    }
  }
}

export async function transcribeAudio(audioAsBase64: string, mimeType: string) {
  const mime = normalizeAudioMimeType(mimeType)
  const contents = createUserContent([
    createPartFromText(
      'Transcreva o áudio para português do Brasil. Seja preciso e natural na transcrição. Mantenha a pontuação adequada e divida o texto em parágrafos quando for apropriado.'
    ),
    createPartFromBase64(audioAsBase64, mime),
  ])

  try {
    const { result: response, modelUsed } = await withGeminiModelFallback(
      (model) =>
        gemini.models.generateContent({
          model,
          contents,
        })
    )

    if (modelUsed !== primaryGeminiModel) {
      console.warn(
        `[gemini] Transcrição concluída com fallback (${modelUsed}).`
      )
    }

    if (response.promptFeedback?.blockReason) {
      throw new Error(
        `Transcrição bloqueada (${response.promptFeedback.blockReason}).`
      )
    }
    if (!response.text) {
      throw new Error('Não foi possível converter o áudio (resposta vazia).')
    }

    return response.text
  } catch (err) {
    logAppError('gemini.transcribeAudio', err, { mimeType: mime })
    throw err
  }
}

export async function generateEmbeddings(text: string) {
  try {
    const response = await withGeminiRetry(() =>
      gemini.models.embedContent({
        model: embeddingModel,
        contents: createUserContent(createPartFromText(text)),
        config: {
          taskType: 'RETRIEVAL_DOCUMENT',
          outputDimensionality: embeddingDimensions,
        },
      })
    )

    if (!response.embeddings?.[0].values) {
      throw new Error('Não foi possível gerar os embeddings.')
    }

    return response.embeddings[0].values
  } catch (err) {
    logAppError('gemini.generateEmbeddings', err)
    throw err
  }
}

export async function generateAnswer(
  question: string,
  transcriptions: string[]
) {
  const context = transcriptions.join('\n\n')

  const prompt = `
Você é um assistente educacional que responde perguntas baseadas no conteúdo de aulas transcritas.

SIGA ESTES PASSOS ANTES DE RESPONDER:
1. Leia cuidadosamente todo o contexto fornecido
2. Identifique as informações relevantes para a pergunta
3. Analise se há informações suficientes no contexto para responder
4. Se houver informações suficientes, formule uma resposta clara e precisa
5. Se não houver informações suficientes, informe isso claramente

CONTEXTO DA AULA:
${context}

PERGUNTA DO ALUNO:
${question}

INSTRUÇÕES IMPORTANTES:
- Analise o contexto completo antes de responder
- Use APENAS informações contidas no contexto fornecido
- Se a resposta não estiver no contexto, responda: "Não encontrei informações suficientes no conteúdo da aula para responder essa pergunta."
- Seja objetivo e preciso
- Mantenha um tom educativo e profissional
- Quando citar informações do contexto, use a expressão "conteúdo da aula"
- Não invente ou assuma informações que não estão no contexto
- Releia sua resposta antes de finalizar para garantir que está correta

Agora, analise o contexto e responda a pergunta do aluno:
  `.trim()

  try {
    const { result: response, modelUsed } = await withGeminiModelFallback(
      (model) =>
        gemini.models.generateContent({
          model,
          contents: [{ text: prompt }],
          config: {
            temperature: 0.3,
            topP: 0.95,
            topK: 40,
          },
        })
    )

    if (modelUsed !== primaryGeminiModel) {
      console.warn(`[gemini] Resposta gerada com fallback (${modelUsed}).`)
    }

    if (!response.text) {
      throw new Error('Falha ao gerar resposta pelo Gemini')
    }

    return response.text
  } catch (err) {
    logAppError('gemini.generateAnswer', err)
    throw err
  }
}
