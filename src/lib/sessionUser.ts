import { PrismaClient, Role } from '@prisma/client'
import { cookies } from 'next/headers'
import { UserAccessScope, getUserAccessScopeById } from './userScope'

export type SessionUser = {
  id: string
  email: string
  role: Role
  accessScope: UserAccessScope
}

export async function getSessionUser(prisma: PrismaClient): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const userId = cookieStore.get('user-id')?.value
  if (!userId) return null

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
    },
  })

  if (!user) return null

  const accessScope = await getUserAccessScopeById(prisma, user.id)
  return {
    ...user,
    accessScope,
  }
}

