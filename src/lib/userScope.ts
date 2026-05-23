import { Prisma, PrismaClient } from '@prisma/client'

export type UserAccessScope = 'ALL' | 'PERMITS_ONLY'
export type UserPlannerAccess = {
  canAccessPlanner: boolean
}
export type UserSeasonalProgramsAccess = {
  canAccessSeasonalPrograms: boolean
}
export type UserCallsInboxAccess = {
  canAccessCallsInbox: boolean
}

const VALID_SCOPES: UserAccessScope[] = ['ALL', 'PERMITS_ONLY']

function parseScope(raw: unknown): UserAccessScope {
  return raw === 'PERMITS_ONLY' ? 'PERMITS_ONLY' : 'ALL'
}

function scopeFromJson(details: Prisma.JsonValue | null): UserAccessScope | null {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null
  const scope = (details as Record<string, unknown>).scope
  return VALID_SCOPES.includes(scope as UserAccessScope) ? (scope as UserAccessScope) : null
}

function plannerAccessFromJson(details: Prisma.JsonValue | null): UserPlannerAccess | null {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null
  const raw = details as Record<string, unknown>
  return { canAccessPlanner: raw.canAccessPlanner === true }
}

function seasonalProgramsAccessFromJson(details: Prisma.JsonValue | null): UserSeasonalProgramsAccess | null {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null
  const raw = details as Record<string, unknown>
  return { canAccessSeasonalPrograms: raw.canAccessSeasonalPrograms === true }
}

function callsInboxAccessFromJson(details: Prisma.JsonValue | null): UserCallsInboxAccess | null {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null
  const raw = details as Record<string, unknown>
  return { canAccessCallsInbox: raw.canAccessCallsInbox === true }
}

export function normalizeWorkflowText(value: string | null | undefined) {
  return (value || '').trim().toLowerCase()
}

export function isPermitsServiceLike(service: { name?: string | null; workflowGroup?: string | null }) {
  const workflow = normalizeWorkflowText(service.workflowGroup)
  const name = normalizeWorkflowText(service.name)
  return workflow.includes('permit') || name.includes('permit')
}

export async function getUserAccessScopeById(prisma: PrismaClient, userId: string): Promise<UserAccessScope> {
  const latestScopeLog = await prisma.auditLog.findFirst({
    where: {
      entity: 'USER_SCOPE',
      entityId: userId,
    },
    orderBy: {
      timestamp: 'desc',
    },
    select: {
      details: true,
    },
  })

  return scopeFromJson(latestScopeLog?.details ?? null) ?? 'ALL'
}

export async function getUserPlannerAccessById(prisma: PrismaClient, userId: string): Promise<UserPlannerAccess> {
  const latestPlannerLog = await prisma.auditLog.findFirst({
    where: {
      entity: 'USER_PLANNER_ACCESS',
      entityId: userId,
    },
    orderBy: {
      timestamp: 'desc',
    },
    select: {
      details: true,
    },
  })

  return plannerAccessFromJson(latestPlannerLog?.details ?? null) ?? { canAccessPlanner: false }
}

export async function getUserSeasonalProgramsAccessById(
  prisma: PrismaClient,
  userId: string
): Promise<UserSeasonalProgramsAccess> {
  const latestSeasonalLog = await prisma.auditLog.findFirst({
    where: {
      entity: 'USER_SEASONAL_PROGRAMS_ACCESS',
      entityId: userId,
    },
    orderBy: {
      timestamp: 'desc',
    },
    select: {
      details: true,
    },
  })

  return seasonalProgramsAccessFromJson(latestSeasonalLog?.details ?? null) ?? { canAccessSeasonalPrograms: false }
}

export async function getUserCallsInboxAccessById(
  prisma: PrismaClient,
  userId: string
): Promise<UserCallsInboxAccess> {
  const latestCallsLog = await prisma.auditLog.findFirst({
    where: {
      entity: 'USER_CALLS_INBOX_ACCESS',
      entityId: userId,
    },
    orderBy: {
      timestamp: 'desc',
    },
    select: {
      details: true,
    },
  })

  return callsInboxAccessFromJson(latestCallsLog?.details ?? null) ?? { canAccessCallsInbox: false }
}

export async function getUserAccessScopeMap(prisma: PrismaClient, userIds: string[]) {
  const scopedIds = Array.from(new Set(userIds.filter(Boolean)))
  const map = new Map<string, UserAccessScope>()
  const seen = new Set<string>()
  if (scopedIds.length === 0) return map

  const logs = await prisma.auditLog.findMany({
    where: {
      entity: 'USER_SCOPE',
      entityId: { in: scopedIds },
    },
    orderBy: {
      timestamp: 'desc',
    },
    select: {
      entityId: true,
      details: true,
    },
  })

  for (const id of scopedIds) map.set(id, 'ALL')

  for (const log of logs) {
    if (seen.has(log.entityId)) continue
    seen.add(log.entityId)
    const parsed = scopeFromJson(log.details)
    map.set(log.entityId, parsed ?? 'ALL')
  }

  return map
}

export async function getUserPlannerAccessMap(prisma: PrismaClient, userIds: string[]) {
  const scopedIds = Array.from(new Set(userIds.filter(Boolean)))
  const map = new Map<string, UserPlannerAccess>()
  const seen = new Set<string>()
  if (scopedIds.length === 0) return map

  const logs = await prisma.auditLog.findMany({
    where: {
      entity: 'USER_PLANNER_ACCESS',
      entityId: { in: scopedIds },
    },
    orderBy: {
      timestamp: 'desc',
    },
    select: {
      entityId: true,
      details: true,
    },
  })

  for (const id of scopedIds) map.set(id, { canAccessPlanner: false })

  for (const log of logs) {
    if (seen.has(log.entityId)) continue
    seen.add(log.entityId)
    const parsed = plannerAccessFromJson(log.details)
    map.set(log.entityId, parsed ?? { canAccessPlanner: false })
  }

  return map
}

export async function getUserSeasonalProgramsAccessMap(prisma: PrismaClient, userIds: string[]) {
  const scopedIds = Array.from(new Set(userIds.filter(Boolean)))
  const map = new Map<string, UserSeasonalProgramsAccess>()
  const seen = new Set<string>()
  if (scopedIds.length === 0) return map

  const logs = await prisma.auditLog.findMany({
    where: {
      entity: 'USER_SEASONAL_PROGRAMS_ACCESS',
      entityId: { in: scopedIds },
    },
    orderBy: {
      timestamp: 'desc',
    },
    select: {
      entityId: true,
      details: true,
    },
  })

  for (const id of scopedIds) map.set(id, { canAccessSeasonalPrograms: false })

  for (const log of logs) {
    if (seen.has(log.entityId)) continue
    seen.add(log.entityId)
    const parsed = seasonalProgramsAccessFromJson(log.details)
    map.set(log.entityId, parsed ?? { canAccessSeasonalPrograms: false })
  }

  return map
}

export async function getUserCallsInboxAccessMap(prisma: PrismaClient, userIds: string[]) {
  const scopedIds = Array.from(new Set(userIds.filter(Boolean)))
  const map = new Map<string, UserCallsInboxAccess>()
  const seen = new Set<string>()
  if (scopedIds.length === 0) return map

  const logs = await prisma.auditLog.findMany({
    where: {
      entity: 'USER_CALLS_INBOX_ACCESS',
      entityId: { in: scopedIds },
    },
    orderBy: {
      timestamp: 'desc',
    },
    select: {
      entityId: true,
      details: true,
    },
  })

  for (const id of scopedIds) map.set(id, { canAccessCallsInbox: false })

  for (const log of logs) {
    if (seen.has(log.entityId)) continue
    seen.add(log.entityId)
    const parsed = callsInboxAccessFromJson(log.details)
    map.set(log.entityId, parsed ?? { canAccessCallsInbox: false })
  }

  return map
}

export async function setUserAccessScope(
  prisma: PrismaClient,
  targetUserId: string,
  scope: UserAccessScope,
  actorUserId?: string
) {
  const normalized = parseScope(scope)
  return prisma.auditLog.create({
    data: {
      userId: actorUserId || targetUserId,
      action: 'SET_SCOPE',
      entity: 'USER_SCOPE',
      entityId: targetUserId,
      details: { scope: normalized },
    },
  })
}

export async function setUserPlannerAccess(
  prisma: PrismaClient,
  targetUserId: string,
  canAccessPlanner: boolean,
  actorUserId?: string
) {
  return prisma.auditLog.create({
    data: {
      userId: actorUserId || targetUserId,
      action: 'SET_PLANNER_ACCESS',
      entity: 'USER_PLANNER_ACCESS',
      entityId: targetUserId,
      details: { canAccessPlanner },
    },
  })
}

export async function setUserSeasonalProgramsAccess(
  prisma: PrismaClient,
  targetUserId: string,
  canAccessSeasonalPrograms: boolean,
  actorUserId?: string
) {
  return prisma.auditLog.create({
    data: {
      userId: actorUserId || targetUserId,
      action: 'SET_SEASONAL_PROGRAMS_ACCESS',
      entity: 'USER_SEASONAL_PROGRAMS_ACCESS',
      entityId: targetUserId,
      details: { canAccessSeasonalPrograms },
    },
  })
}

export async function setUserCallsInboxAccess(
  prisma: PrismaClient,
  targetUserId: string,
  canAccessCallsInbox: boolean,
  actorUserId?: string
) {
  return prisma.auditLog.create({
    data: {
      userId: actorUserId || targetUserId,
      action: 'SET_CALLS_INBOX_ACCESS',
      entity: 'USER_CALLS_INBOX_ACCESS',
      entityId: targetUserId,
      details: { canAccessCallsInbox },
    },
  })
}
