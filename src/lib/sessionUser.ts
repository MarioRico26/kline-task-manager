import { PrismaClient, Role } from '@prisma/client'
import { cookies } from 'next/headers'
import {
  UserAccessScope,
  getUserAccessScopeById,
  getUserPlannerAccessById,
  getUserSeasonalProgramsAccessById,
} from './userScope'

export type SessionUser = {
  id: string
  email: string
  role: Role
  accessScope: UserAccessScope
  canAccessPlanner: boolean
  canAccessSeasonalPrograms: boolean
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

  const [accessScope, plannerAccess, seasonalProgramsAccess] = await Promise.all([
    getUserAccessScopeById(prisma, user.id),
    getUserPlannerAccessById(prisma, user.id),
    getUserSeasonalProgramsAccessById(prisma, user.id),
  ])

  return {
    ...user,
    accessScope,
    canAccessPlanner: plannerAccess.canAccessPlanner,
    canAccessSeasonalPrograms: seasonalProgramsAccess.canAccessSeasonalPrograms,
  }
}
