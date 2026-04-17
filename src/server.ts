import fastifyJwt from '@fastify/jwt'
import { fastifyCors } from '@fastify/cors'
import fastifyMultipart from '@fastify/multipart'
import { fastify } from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { env } from './env.ts'
import { createQuestionRoute } from './http/routes/create-question.ts'
import { createRoomRoute } from './http/routes/create-room.ts'
import { getRoomQuestionsRoute } from './http/routes/get-room-questions.ts'
import { getRoomsRoute } from './http/routes/get-rooms.ts'
import { loginRoute } from './http/routes/login.ts'
import { meRoute } from './http/routes/me.ts'
import { uploadAudioRoute } from './http/routes/upload-audio.ts'

const app = fastify().withTypeProvider<ZodTypeProvider>()

await app.register(fastifyJwt, {
  secret: env.JWT_SECRET,
})

await app.register(fastifyCors, {
  origin: 'http://localhost:5173',
  allowedHeaders: ['Content-Type', 'Authorization'],
})

await app.register(fastifyMultipart)

app.setSerializerCompiler(serializerCompiler)
app.setValidatorCompiler(validatorCompiler)

app.get('/health', () => {
  return 'OK'
})

await app.register(loginRoute)
await app.register(meRoute)
await app.register(getRoomsRoute)
await app.register(createRoomRoute)
await app.register(getRoomQuestionsRoute)
await app.register(createQuestionRoute)
await app.register(uploadAudioRoute)

await app.listen({ port: env.PORT, host: '0.0.0.0' })
console.log(`🚀 Server running on http://localhost:${env.PORT}`)
