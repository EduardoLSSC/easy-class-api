import { eq } from 'drizzle-orm'
import { db } from '../db/connection.ts'
import { schema } from '../db/schema/index.ts'

export type AppRole = 'admin' | 'professor' | 'student'

const dbToApp: Record<string, AppRole> = {
  admin: 'admin',
  teacher: 'professor',
  student: 'student',
}

export async function resolveUserAppRole(userId: string): Promise<AppRole> {
  const rows = await db
    .select({ name: schema.roles.name })
    .from(schema.userRoles)
    .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
    .where(eq(schema.userRoles.userId, userId))

  let best: AppRole = 'student'
  let score = 0
  for (const r of rows) {
    const app = dbToApp[r.name]
    if (!app) {
      continue
    }
    const s = app === 'admin' ? 3 : app === 'professor' ? 2 : 1
    if (s > score) {
      score = s
      best = app
    }
  }
  return best
}
