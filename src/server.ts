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
import { registerErrorHandling } from './http/error-handler.ts'
import {
  createFastifyLoggerConfig,
  logAppError,
  registerProcessErrorHandlers,
} from './lib/logger.ts'
import { adminBulkCreateUsersRoute } from './http/routes/admin-bulk-create-users.ts'
import { adminCreateUserRoute } from './http/routes/admin-create-user.ts'
import { adminListUsersRoute } from './http/routes/admin-list-users.ts'
import { adminGeminiHealthRoute } from './http/routes/admin-gemini-health.ts'
import { adminPlatformHealthRoute } from './http/routes/admin-platform-health.ts'
import { adminRoomsRoute } from './http/routes/admin-rooms.ts'
import { adminUpdateUserRoute } from './http/routes/admin-update-user.ts'
import { createQuestionRoute } from './http/routes/create-question.ts'
import { createRoomRoute } from './http/routes/create-room.ts'
import { getRoomQuestionsRoute } from './http/routes/get-room-questions.ts'
import { getRoomsRoute } from './http/routes/get-rooms.ts'
import { getRoomTranscriptRoute } from './http/routes/get-room-transcript.ts'
import { loginRoute } from './http/routes/login.ts'
import { meRoute } from './http/routes/me.ts'
import { professorAudiosRoute } from './http/routes/professor-audios.ts'
import { uploadAudioRoute } from './http/routes/upload-audio.ts'

registerProcessErrorHandlers()

const app = fastify({
  logger: createFastifyLoggerConfig(),
  disableRequestLogging: false,
  requestIdLogLabel: 'reqId',
}).withTypeProvider<ZodTypeProvider>()

registerErrorHandling(app)

await app.register(fastifyJwt, {
  secret: env.JWT_SECRET,
})

await app.register(fastifyCors, {
  origin: 'http://localhost:5173',
  methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
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
await app.register(getRoomTranscriptRoute)
await app.register(createQuestionRoute)
await app.register(uploadAudioRoute)
await app.register(professorAudiosRoute)
await app.register(adminListUsersRoute)
await app.register(adminCreateUserRoute)
await app.register(adminBulkCreateUsersRoute)
await app.register(adminUpdateUserRoute)
await app.register(adminRoomsRoute)
await app.register(adminPlatformHealthRoute)
await app.register(adminGeminiHealthRoute)

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' })
  app.log.info(`Servidor em http://localhost:${env.PORT} (log level: ${env.LOG_LEVEL})`)
} catch (err) {
  logAppError('startup', err)
  process.exit(1)
}
