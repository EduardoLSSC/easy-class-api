import { GoogleGenAI } from '@google/genai'
import { env } from '../env.ts'

const gemini = new GoogleGenAI({
  apiKey: env.GEMINI_API_KEY,
})

const model = 'gemini-2.5-flash'

export async function transcribeAudio(audioAsBase64: string, mimeType: string) {
  const response = await gemini.models.generateContent({
    model,
    contents: [
      {
        text: 'Transcreva o áudio para português do Brasil. Seja preciso e natural na transcrição. Mantenha a pontuação adequada e divida o texto em parágrafos quando for apropriado.',
      },
      {
        inlineData: {
          mimeType,
          data: audioAsBase64,
        },
      },
    ],
  })

  if (!response.text) {
    throw new Error('Não foi possível converter o áudio.')
  }

  return response.text
}

export async function generateEmbeddings(text: string) {
  const response = await gemini.models.embedContent({
    model: 'text-embedding-004',
    contents: [{ text }],
    config: {
      taskType: 'RETRIEVAL_DOCUMENT',
    },
  })

  if (!response.embeddings?.[0].values) {
    throw new Error('Não foi possível gerar os embeddings.')
  }

  return response.embeddings[0].values
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

  const reponse = await gemini.models.generateContent({
    model,
    contents: [
      {
        text: prompt,
      },
    ],
    config: {
      temperature: 0.3,
      topP: 0.95,
      topK: 40,
    },
  })

  if (!reponse.text) {
    throw new Error('Falha ao gerar resposta pelo Gemini')
  }

  return reponse.text
}
