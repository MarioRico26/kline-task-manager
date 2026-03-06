import { Prisma, PrismaClient } from '@prisma/client'

export type UserAccessScope = 'ALL' | 'PERMITS_ONLY'

const VALID_SCOPES: UserAccessScope[] = ['ALL', 'PERMITS_ONLY']

function parseScope(raw: unknown): UserAccessScope {
  return raw === 'PERMITS_ONLY' ? 'PERMITS_ONLY' : 'ALL'
}

function scopeFromJson(details: Prisma.JsonValue | null): UserAccessScope | null {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null
  const scope = (details as Record<string, unknown>).scope
  return VALID_SCOPES.includes(scope as UserAccessScope) ? (scope as UserAccessScope) : null
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
