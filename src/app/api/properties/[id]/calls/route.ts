import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getSessionUser } from '@/lib/sessionUser'

function canAccessCallsInbox(sessionUser: Awaited<ReturnType<typeof getSessionUser>>) {
  return sessionUser && sessionUser.canAccessCallsInbox && sessionUser.accessScope !== 'PERMITS_ONLY'
}

function isCallsInboxTableMissing(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

function deriveFollowUpFlags(nextFollowUpAt: Date | null) {
  if (!nextFollowUpAt) {
    return {
      latestNextFollowUpAt: null,
      isFollowUpOverdue: false,
      isFollowUpDueToday: false,
    }
  }

  const now = new Date()
  const due = nextFollowUpAt.getTime()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()

  return {
    latestNextFollowUpAt: nextFollowUpAt.toISOString(),
    isFollowUpOverdue: due < now.getTime(),
    isFollowUpDueToday: due >= startOfToday && due < startOfTomorrow,
  }
}

function deriveAging(receivedAt: Date) {
  const ageMs = Date.now() - receivedAt.getTime()
  const ageInHours = Math.max(0, Math.floor(ageMs / (1000 * 60 * 60)))
  const ageLabel =
    ageInHours < 24
      ? `${ageInHours}h`
      : `${Math.floor(ageInHours / 24)}d ${ageInHours % 24}h`

  return {
    ageInHours,
    ageLabel: ageInHours < 4 ? '< 4h' : ageLabel,
    isSlaWarning: ageInHours >= 4,
    isSlaBreached: ageInHours >= 24,
  }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await getSessionUser(prisma)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (!canAccessCallsInbox(sessionUser)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params

    const records = await prisma.callRecord.findMany({
      where: { propertyId: id },
      orderBy: { receivedAt: 'desc' },
      take: 12,
      include: {
        assignedToUser: {
          select: { id: true, email: true },
        },
        customer: {
          select: { id: true, fullName: true },
        },
        relatedTask: {
          select: {
            id: true,
            service: { select: { name: true } },
            status: { select: { name: true } },
          },
        },
        callbackAttempts: {
          where: { nextFollowUpAt: { not: null } },
          orderBy: { nextFollowUpAt: 'asc' },
          take: 1,
          select: { nextFollowUpAt: true },
        },
      },
    })

    return NextResponse.json({
      records: records.map((record) => ({
        id: record.id,
        sourceType: record.sourceType,
        status: record.status,
        priority: record.priority,
        receivedAt: record.receivedAt.toISOString(),
        callerNameRaw: record.callerNameRaw,
        phoneNumber: record.phoneNumber,
        summary: record.summary,
        customer: record.customer,
        relatedTask: record.relatedTask
          ? {
              id: record.relatedTask.id,
              serviceName: record.relatedTask.service?.name || null,
              statusName: record.relatedTask.status?.name || null,
            }
          : null,
        assignedToUser: record.assignedToUser,
        ...deriveFollowUpFlags(record.callbackAttempts[0]?.nextFollowUpAt || null),
        ...deriveAging(record.receivedAt),
      })),
    })
  } catch (error) {
    if (isCallsInboxTableMissing(error)) {
      return NextResponse.json({ records: [], moduleReady: false })
    }

    console.error('Error fetching property call history:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
