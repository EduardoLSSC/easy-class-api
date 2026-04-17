import { audioChunks } from './audio-chunks.ts'
import { chatMessages } from './chat-messages.ts'
import { questionContext } from './question-context.ts'
import { questions } from './questions.ts'
import { roomMembers } from './room-members.ts'
import { rooms } from './rooms.ts'
import { roles } from './roles.ts'
import { userRoles } from './user-roles.ts'
import { users } from './users.ts'

export const schema = {
  users,
  roles,
  userRoles,
  rooms,
  roomMembers,
  audioChunks,
  questions,
  questionContext,
  chatMessages,
}

export {
  audioChunks,
  chatMessages,
  questionContext,
  questions,
  roomMembers,
  rooms,
  roles,
  userRoles,
  users,
}
