import { z } from 'zod'

const envSchema = z.object({
    PORT: z.coerce.number().default(3333),
    DATABASE_URL: z.string().url().startsWith('postgresql://'),
    GEMINI_API_KEY: z.string(),
    GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
    GEMINI_MODEL_FALLBACK: z.string().default('gemini-2.0-flash-lite'),
    JWT_SECRET: z.string().min(16),
    DEFAULT_USER_ID: z.string().uuid().optional(),
    LOG_LEVEL: z
        .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
        .default('debug'),
})

export const env = envSchema.parse(process.env)