import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db, sql } from './connection.ts'
import {
  roles,
  rooms,
  userRoles,
  users,
} from './schema/index.ts'

export const DEV_USER_ID = '00000000-0000-4000-8000-000000000001'

const devEmail = 'dev@local.test'
const devPassword = 'dev'

const [existing] = await db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.email, devEmail))
  .limit(1)

if (!existing) {
  const passwordHash = await bcrypt.hash(devPassword, 10)

  await db.insert(users).values({
    id: DEV_USER_ID,
    name: 'Dev',
    email: devEmail,
    passwordHash,
  })

  let [teacherRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.name, 'teacher'))
    .limit(1)

  if (!teacherRole) {
    const inserted = await db.insert(roles).values({ name: 'teacher' }).returning()
    teacherRole = inserted[0]
  }

  if (teacherRole) {
    await db.insert(userRoles).values({
      userId: DEV_USER_ID,
      roleId: teacherRole.id,
    })
  }

  await db.insert(rooms).values({
    ownerId: DEV_USER_ID,
    name: 'Sala de exemplo',
    description: 'Criada pelo seed',
  })

  console.log(`Seed OK. DEFAULT_USER_ID=${DEV_USER_ID} (dev: ${devEmail} / ${devPassword})`)
} else {
  console.log('Seed: usuário dev já existe; nada alterado.')
}

await sql.end()
