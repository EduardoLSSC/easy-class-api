import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '../db/connection.ts'
import { schema } from '../db/schema/index.ts'
import { allocateNextStudentRa } from './generate-student-ra.ts'

export type CreateAppUserInput = {
  name: string
  email: string
  password: string
  role: 'professor' | 'student'
  ra?: string
}

export type CreateAppUserResult =
  | { ok: true; userId: string; ra: string | null }
  | { ok: false; error: string; status: 409 | 500 }

export async function createAppUser(
  input: CreateAppUserInput
): Promise<CreateAppUserResult> {
  const normalizedEmail = input.email.trim().toLowerCase()
  const dbRoleName = input.role === 'professor' ? 'teacher' : 'student'

  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, normalizedEmail))
    .limit(1)

  if (existing) {
    return { ok: false, error: 'E-mail já cadastrado.', status: 409 }
  }

  let normalizedRa: string | null = null

  if (input.role === 'professor') {
    const ra = input.ra?.trim()
    if (!ra) {
      return { ok: false, error: 'RP é obrigatório para professor.', status: 409 }
    }
    normalizedRa = ra.toUpperCase()
  } else {
    normalizedRa = await allocateNextStudentRa()
  }

  const [raTaken] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.ra, normalizedRa))
    .limit(1)

  if (raTaken) {
    return {
      ok: false,
      error:
        input.role === 'professor' ? 'RP já cadastrado.' : 'RA já cadastrado.',
      status: 409,
    }
  }

  const [roleRow] = await db
    .select({ id: schema.roles.id })
    .from(schema.roles)
    .where(eq(schema.roles.name, dbRoleName))
    .limit(1)

  if (!roleRow) {
    return { ok: false, error: 'Papel não configurado no sistema.', status: 500 }
  }

  const passwordHash = await bcrypt.hash(input.password, 10)

  const [created] = await db
    .insert(schema.users)
    .values({
      name: input.name.trim(),
      email: normalizedEmail,
      ra: normalizedRa,
      passwordHash,
      isActive: true,
    })
    .returning({ id: schema.users.id })

  if (!created) {
    return { ok: false, error: 'Falha ao criar usuário.', status: 500 }
  }

  await db.insert(schema.userRoles).values({
    userId: created.id,
    roleId: roleRow.id,
  })

  return { ok: true, userId: created.id, ra: normalizedRa }
}
