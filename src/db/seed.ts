import bcrypt from 'bcryptjs'
import { and, eq } from 'drizzle-orm'
import { db, sql } from './connection.ts'
import { roles, roomMembers, rooms, userRoles, users } from './schema/index.ts'

export const DEV_USER_ID = '00000000-0000-4000-8000-000000000001'
export const ADMIN_USER_ID = '00000000-0000-4000-8000-000000000002'
export const STUDENT_USER_ID = '00000000-0000-4000-8000-000000000003'

async function ensureRole(name: string) {
  const [existing] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.name, name))
    .limit(1)
  if (existing) {
    return existing
  }
  const [inserted] = await db.insert(roles).values({ name }).returning({ id: roles.id })
  return inserted
}

async function ensureUserRole(userId: string, roleId: string) {
  const [existing] = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(
      and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId))
    )
    .limit(1)
  if (existing) {
    return
  }
  await db.insert(userRoles).values({ userId, roleId })
}

async function ensureUser(params: {
  id: string
  name: string
  email: string
  password: string
  roleNames: string[]
  ra?: string | null
}) {
  const passwordHash = await bcrypt.hash(params.password, 10)
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, params.email.toLowerCase()))
    .limit(1)

  let userId = existing?.id
  if (!existing) {
    await db.insert(users).values({
      id: params.id,
      name: params.name,
      email: params.email.toLowerCase(),
      ra: params.ra ?? null,
      passwordHash,
    })
    userId = params.id
  } else if (params.ra) {
    await db
      .update(users)
      .set({ ra: params.ra })
      .where(eq(users.id, existing.id))
  }

  if (!userId) {
    return
  }

  for (const roleName of params.roleNames) {
    const roleRow = await ensureRole(roleName)
    if (roleRow) {
      await ensureUserRole(userId, roleRow.id)
    }
  }
}

await ensureRole('admin')
await ensureRole('teacher')
await ensureRole('student')

await ensureUser({
  id: DEV_USER_ID,
  name: 'Dev Professor',
  email: 'dev@local.test',
  password: 'dev',
  ra: 'P00000',
  roleNames: ['teacher'],
})

await ensureUser({
  id: ADMIN_USER_ID,
  name: 'Admin',
  email: 'admin@local.test',
  password: 'admin',
  roleNames: ['admin'],
})

await ensureUser({
  id: STUDENT_USER_ID,
  name: 'Aluno Demo',
  email: 'student@local.test',
  password: 'student',
  ra: '20240000',
  roleNames: ['student'],
})

for (let i = 1; i <= 5; i++) {
  const suffix = String(i).padStart(2, '0')
  await ensureUser({
    id: `00000000-0000-4000-8000-0000000000${10 + i}`,
    name: `Professor ${suffix}`,
    email: `professor${suffix}@local.test`,
    password: 'professor',
    ra: `P${suffix}`,
    roleNames: ['teacher'],
  })
}

for (let i = 1; i <= 20; i++) {
  const suffix = String(i).padStart(2, '0')
  const idSuffix = String(20 + i).padStart(2, '0')
  await ensureUser({
    id: `00000000-0000-4000-8000-0000000000${idSuffix}`,
    name: `Aluno ${suffix}`,
    email: `aluno${suffix}@local.test`,
    password: 'aluno',
    ra: `2024${suffix}`,
    roleNames: ['student'],
  })
}

const [exampleRoom] = await db
  .select({ id: rooms.id })
  .from(rooms)
  .where(eq(rooms.ownerId, DEV_USER_ID))
  .limit(1)

if (!exampleRoom) {
  await db.insert(rooms).values({
    ownerId: DEV_USER_ID,
    name: 'Sala de exemplo',
    description: 'Criada pelo seed',
  })
}

const [roomToShare] = await db
  .select({ id: rooms.id })
  .from(rooms)
  .where(eq(rooms.ownerId, DEV_USER_ID))
  .limit(1)

const [studentRow] = await db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.email, 'student@local.test'))
  .limit(1)

if (roomToShare && studentRow) {
  const [member] = await db
    .select({ userId: roomMembers.userId })
    .from(roomMembers)
    .where(
      and(
        eq(roomMembers.userId, studentRow.id),
        eq(roomMembers.roomId, roomToShare.id)
      )
    )
    .limit(1)
  if (!member) {
    await db.insert(roomMembers).values({
      userId: studentRow.id,
      roomId: roomToShare.id,
    })
  }
}

console.log(
  'Seed OK. admin@local.test/admin, dev@local.test/dev, student@local.test/student, professor01-05@local.test/professor, aluno01-20@local.test/aluno'
)

await sql.end()
