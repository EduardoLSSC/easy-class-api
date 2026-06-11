import { like } from 'drizzle-orm'
import { db } from '../db/connection.ts'
import { schema } from '../db/schema/index.ts'

export function buildStudentRaPrefix(date = new Date()) {
  const year = date.getFullYear()
  const start = new Date(year, 0, 0)
  const dayOfYear = Math.floor(
    (date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  )
  return `${year}${String(dayOfYear).padStart(3, '0')}`
}

function parseSequenceFromRa(ra: string, prefix: string) {
  if (!ra.startsWith(prefix)) {
    return 0
  }
  const tail = ra.slice(prefix.length)
  if (!/^\d+$/.test(tail)) {
    return 0
  }
  return Number.parseInt(tail, 10)
}

async function maxSequenceForPrefix(prefix: string) {
  const rows = await db
    .select({ ra: schema.users.ra })
    .from(schema.users)
    .where(like(schema.users.ra, `${prefix}%`))

  let maxSeq = 0
  for (const row of rows) {
    if (!row.ra) {
      continue
    }
    const seq = parseSequenceFromRa(row.ra, prefix)
    if (seq > maxSeq) {
      maxSeq = seq
    }
  }
  return maxSeq
}

/** Reserva `count` RAs sequenciais para o dia informado. */
export async function allocateStudentRaSequences(
  count: number,
  date = new Date()
) {
  if (count <= 0) {
    return [] as string[]
  }

  const prefix = buildStudentRaPrefix(date)
  const maxSeq = await maxSequenceForPrefix(prefix)
  const result: string[] = []

  for (let i = 1; i <= count; i++) {
    const seq = maxSeq + i
    const width = Math.max(2, String(seq).length)
    result.push(`${prefix}${String(seq).padStart(width, '0')}`)
  }

  return result
}

export async function allocateNextStudentRa(date = new Date()) {
  const [ra] = await allocateStudentRaSequences(1, date)
  if (!ra) {
    throw new Error('Falha ao gerar RA.')
  }
  return ra
}
