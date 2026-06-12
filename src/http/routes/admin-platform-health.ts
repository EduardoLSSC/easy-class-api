import { count, eq, sql } from 'drizzle-orm'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { db } from '../../db/connection.ts'
import { schema } from '../../db/schema/index.ts'
import { type AppRole } from '../../lib/app-role.ts'
import { checkGeminiHealth } from '../../services/gemini.ts'
import { requireAdmin } from '../require-admin.ts'

const dbToApp: Record<string, AppRole> = {
  admin: 'admin',
  teacher: 'professor',
  student: 'student',
}

function monthKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function dayKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function buildLastMonths(countMonths: number) {
  const keys: string[] = []
  const now = new Date()
  for (let i = countMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(monthKey(d))
  }
  return keys
}

function buildLastDays(countDays: number) {
  const keys: string[] = []
  const now = new Date()
  for (let i = countDays - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    keys.push(dayKey(d))
  }
  return keys
}

function formatMonthLabel(key: string) {
  const [year, month] = key.split('-')
  const months = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ]
  return `${months[Number(month) - 1]}/${year.slice(2)}`
}

function formatDayLabel(key: string) {
  const [, , day] = key.split('-')
  return day
}

interface HealthQuery {
  checkGemini?: string;
}

export const adminPlatformHealthRoute: FastifyPluginCallbackZod = (app) => {
  app.get(
    '/admin/platform-health',
    { onRequest: [requireAdmin] },
    async (request) => {
    const query = request.query as { checkGemini?: string }
    const checkGemini =
      query.checkGemini === '1' || query.checkGemini === 'true'
    const [
      [{ totalUsers }],
      [{ activeUsers }],
      [{ totalRooms }],
      [{ totalMembers }],
      [{ totalQuestions }],
      [{ answeredQuestions }],
      [{ totalAudioChunks }],
      roleRows,
      usersCreated,
      questionsCreated,
      roomsCreated,
      topRoomsRaw,
    ] = await Promise.all([
      db.select({ totalUsers: count() }).from(schema.users),
      db
        .select({ activeUsers: count() })
        .from(schema.users)
        .where(eq(schema.users.isActive, true)),
      db.select({ totalRooms: count() }).from(schema.rooms),
      db.select({ totalMembers: count() }).from(schema.roomMembers),
      db.select({ totalQuestions: count() }).from(schema.questions),
      db
        .select({ answeredQuestions: count() })
        .from(schema.questions)
        .where(sql`${schema.questions.answer} IS NOT NULL AND trim(${schema.questions.answer}) <> ''`),
      db.select({ totalAudioChunks: count() }).from(schema.audioChunks),
      db
        .select({
          userId: schema.userRoles.userId,
          roleName: schema.roles.name,
        })
        .from(schema.userRoles)
        .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id)),
      db.select({ createdAt: schema.users.createdAt }).from(schema.users),
      db.select({ createdAt: schema.questions.createdAt }).from(schema.questions),
      db.select({ createdAt: schema.rooms.createdAt }).from(schema.rooms),
      db
        .select({
          roomId: schema.rooms.id,
          roomName: schema.rooms.name,
          memberCount: count(schema.roomMembers.userId),
        })
        .from(schema.rooms)
        .leftJoin(
          schema.roomMembers,
          eq(schema.roomMembers.roomId, schema.rooms.id)
        )
        .groupBy(schema.rooms.id, schema.rooms.name)
        .orderBy(sql`count(${schema.roomMembers.userId}) desc`)
        .limit(5),
    ])

    const userRoleBest = new Map<string, AppRole>()
    for (const row of roleRows) {
      const app = dbToApp[row.roleName] ?? 'student'
      const score = app === 'admin' ? 3 : app === 'professor' ? 2 : 1
      const prev = userRoleBest.get(row.userId)
      const prevScore =
        prev === 'admin' ? 3 : prev === 'professor' ? 2 : prev ? 1 : 0
      if (score > prevScore) {
        userRoleBest.set(row.userId, app)
      }
    }

    const usersByRole = { admin: 0, professor: 0, student: 0 }
    for (const role of userRoleBest.values()) {
      usersByRole[role] += 1
    }

    const monthKeys = buildLastMonths(6)
    const dayKeys = buildLastDays(14)

    const signupsByMonth = Object.fromEntries(monthKeys.map((k) => [k, 0]))
    for (const row of usersCreated) {
      const key = monthKey(row.createdAt)
      if (key in signupsByMonth) {
        signupsByMonth[key] += 1
      }
    }

    const questionsByDay = Object.fromEntries(dayKeys.map((k) => [k, 0]))
    for (const row of questionsCreated) {
      const key = dayKey(row.createdAt)
      if (key in questionsByDay) {
        questionsByDay[key] += 1
      }
    }

    const roomsByMonth = Object.fromEntries(monthKeys.map((k) => [k, 0]))
    for (const row of roomsCreated) {
      const key = monthKey(row.createdAt)
      if (key in roomsByMonth) {
        roomsByMonth[key] += 1
      }
    }

    const roomsWithStudents = topRoomsRaw.filter(
      (r) => Number(r.memberCount) > 0
    ).length
    const totalRoomsNum = Number(totalRooms)
    const totalQuestionsNum = Number(totalQuestions)
    const answeredNum = Number(answeredQuestions)
    const totalUsersNum = Number(totalUsers)
    const activeUsersNum = Number(activeUsers)

    const answerRate =
      totalQuestionsNum > 0
        ? Math.round((answeredNum / totalQuestionsNum) * 100)
        : 0
    const activeUserRate =
      totalUsersNum > 0
        ? Math.round((activeUsersNum / totalUsersNum) * 100)
        : 0
    const enrollmentRate =
      totalRoomsNum > 0
        ? Math.round((roomsWithStudents / totalRoomsNum) * 100)
        : 0

    const avgMembersPerRoom =
      totalRoomsNum > 0
        ? Math.round((Number(totalMembers) / totalRoomsNum) * 10) / 10
        : 0

    const geminiHealth = checkGemini ? await checkGeminiHealth() : null

    const healthScore = Math.min(
      100,
      Math.round(
        activeUserRate * 0.2 +
          enrollmentRate * 0.2 +
          answerRate * 0.2 +
          (Number(totalAudioChunks) > 0 ? 20 : 0) +
          (geminiHealth?.ok ? 20 : 0)
      )
    )

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalUsers: totalUsersNum,
        activeUsers: activeUsersNum,
        totalRooms: totalRoomsNum,
        totalMembers: Number(totalMembers),
        totalQuestions: totalQuestionsNum,
        answeredQuestions: answeredNum,
        totalAudioChunks: Number(totalAudioChunks),
        avgMembersPerRoom,
        healthScore,
      },
      usersByRole: [
        { role: 'Alunos', value: usersByRole.student, key: 'student' },
        { role: 'Professores', value: usersByRole.professor, key: 'professor' },
        { role: 'Admins', value: usersByRole.admin, key: 'admin' },
      ],
      signupsByMonth: monthKeys.map((key) => ({
        key,
        label: formatMonthLabel(key),
        users: signupsByMonth[key],
        rooms: roomsByMonth[key],
      })),
      questionsByDay: dayKeys.map((key) => ({
        key,
        label: formatDayLabel(key),
        questions: questionsByDay[key],
      })),
      topRooms: topRoomsRaw.map((r) => ({
        id: r.roomId,
        name: r.roomName,
        members: Number(r.memberCount),
      })),
      indicators: [
        {
          id: 'api',
          label: 'API',
          status: 'healthy' as const,
          value: 'Online',
          detail: 'Servidor respondendo normalmente',
        },
        {
          id: 'database',
          label: 'Banco de dados',
          status: 'healthy' as const,
          value: 'Conectado',
          detail: 'Consultas executadas com sucesso',
        },
        {
          id: 'gemini',
          label: 'IA (Gemini)',
          status: geminiHealth
            ? geminiHealth.ok
              ? ('healthy' as const)
              : ('critical' as const)
            : ('warning' as const),
          value: geminiHealth?.value ?? 'Não verificado',
          detail:
            geminiHealth?.detail ??
            'Use o botão de atualizar no card para testar a API Gemini.',
        },
        {
          id: 'users',
          label: 'Usuários ativos',
          status:
            activeUserRate >= 80
              ? ('healthy' as const)
              : activeUserRate >= 50
                ? ('warning' as const)
                : ('critical' as const),
          value: `${activeUserRate}%`,
          detail: `${activeUsersNum} de ${totalUsersNum} contas ativas`,
        },
        {
          id: 'enrollment',
          label: 'Salas com alunos',
          status:
            enrollmentRate >= 60
              ? ('healthy' as const)
              : enrollmentRate >= 30
                ? ('warning' as const)
                : ('critical' as const),
          value: `${enrollmentRate}%`,
          detail: `${roomsWithStudents} de ${totalRoomsNum} salas com matrícula`,
        },
        {
          id: 'answers',
          label: 'Perguntas respondidas',
          status:
            answerRate >= 70
              ? ('healthy' as const)
              : answerRate >= 40
                ? ('warning' as const)
                : ('critical' as const),
          value: `${answerRate}%`,
          detail: `${answeredNum} de ${totalQuestionsNum} com resposta da IA`,
        },
        {
          id: 'audio',
          label: 'Conteúdo em áudio',
          status:
            Number(totalAudioChunks) > 0
              ? ('healthy' as const)
              : ('warning' as const),
          value: String(totalAudioChunks),
          detail:
            Number(totalAudioChunks) > 0
              ? 'Trechos transcritos disponíveis'
              : 'Nenhum trecho de áudio ainda',
        },
      ],
    }
  }
  )
}
