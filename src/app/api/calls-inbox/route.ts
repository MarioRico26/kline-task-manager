import { NextResponse } from 'next/server'
import { CallPriority, CallSourceType, CallStatus, CallType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { sendCallAssignmentEmail } from '@/lib/email'
import { getSessionUser } from '@/lib/sessionUser'
import { getDefaultCallsInboxOwner } from '@/lib/userScope'

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

const openRecordStatuses = new Set<CallStatus>(['NEW', 'TRIAGE_REQUIRED', 'ASSIGNED', 'CALLBACK_PENDING'])

function deriveAging(receivedAt: Date) {
  const ageMs = Date.now() - receivedAt.getTime()
  const ageInHours = Math.max(0, Math.floor(ageMs / (1000 * 60 * 60)))

  if (ageInHours < 4) {
    return {
      ageInHours,
      ageLabel: '< 4h',
      ageBucket: 'UNDER_4_HOURS' as const,
      isSlaWarning: false,
      isSlaBreached: false,
    }
  }

  if (ageInHours < 24) {
    return {
      ageInHours,
      ageLabel: `${ageInHours}h`,
      ageBucket: 'FOUR_TO_TWENTY_FOUR_HOURS' as const,
      isSlaWarning: true,
      isSlaBreached: false,
    }
  }

  if (ageInHours < 48) {
    return {
      ageInHours,
      ageLabel: `${Math.floor(ageInHours / 24)}d ${ageInHours % 24}h`,
      ageBucket: 'ONE_TO_TWO_DAYS' as const,
      isSlaWarning: true,
      isSlaBreached: true,
    }
  }

  return {
    ageInHours,
    ageLabel: `${Math.floor(ageInHours / 24)}d ${ageInHours % 24}h`,
    ageBucket: 'OVER_TWO_DAYS' as const,
    isSlaWarning: true,
    isSlaBreached: true,
  }
}

async function resolveDefaultCallsInboxOwnerId(actorUserId: string) {
  const configuredOwner = await getDefaultCallsInboxOwner(prisma)
  if (configuredOwner.userId) {
    const configuredUser = await prisma.user.findUnique({
      where: { id: configuredOwner.userId },
      select: { id: true },
    })

    if (configuredUser) return configuredUser.id
  }

  const configuredOwnerEmail = process.env.CALLS_INBOX_DEFAULT_OWNER_EMAIL?.trim().toLowerCase()

  if (configuredOwnerEmail) {
    const configuredUser = await prisma.user.findUnique({
      where: { email: configuredOwnerEmail },
      select: { id: true, email: true },
    })

    if (configuredUser) return configuredUser.id
  }

  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { id: true },
  })

  if (actor) return actor.id

  const fallbackAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  return fallbackAdmin?.id || null
}

export async function GET(request: Request) {
  try {
    const sessionUser = await getSessionUser(prisma)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (!canAccessCallsInbox(sessionUser)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const rawPage = Number(searchParams.get('page') || '1')
    const rawPageSize = Number(searchParams.get('pageSize') || '100')
    const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1
    const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0 ? Math.min(Math.floor(rawPageSize), 100) : 100
    const skip = (page - 1) * pageSize

    const [records, statsRecords, totalRecords] = await Promise.all([
      prisma.callRecord.findMany({
        orderBy: { receivedAt: 'desc' },
        skip,
        take: pageSize,
        include: {
        assignedToUser: {
          select: {
            id: true,
            email: true,
          },
        },
        customer: {
          select: {
            id: true,
            fullName: true,
          },
        },
        property: {
          select: {
            id: true,
            address: true,
            city: true,
            state: true,
          },
        },
        relatedTask: {
          select: {
            id: true,
            scheduledFor: true,
            service: { select: { name: true } },
            status: { select: { name: true } },
          },
        },
        callbackAttempts: {
          where: { nextFollowUpAt: { not: null } },
          orderBy: { nextFollowUpAt: 'asc' },
          take: 1,
          select: {
            nextFollowUpAt: true,
          },
        },
        _count: {
          select: {
            callbackAttempts: true,
            activities: true,
          },
        },
        },
      }),
      prisma.callRecord.findMany({
        select: {
          status: true,
          assignedToUserId: true,
          receivedAt: true,
          callbackAttempts: {
            where: { nextFollowUpAt: { not: null } },
            orderBy: { nextFollowUpAt: 'asc' },
            take: 1,
            select: {
              nextFollowUpAt: true,
            },
          },
        },
      }),
      prisma.callRecord.count(),
    ])

    const stats = statsRecords.reduce(
      (acc, record) => {
        const isOpen = openRecordStatuses.has(record.status)
        const aging = deriveAging(record.receivedAt)
        const followUpFlags = deriveFollowUpFlags(record.callbackAttempts[0]?.nextFollowUpAt || null)

        if (isOpen) {
          acc.openRecords += 1
          if (!record.assignedToUserId) acc.unassignedOpen += 1
          if (aging.isSlaBreached) acc.aging24h += 1
          if (aging.ageBucket === 'UNDER_4_HOURS') acc.agingBuckets.under4Hours += 1
          if (aging.ageBucket === 'FOUR_TO_TWENTY_FOUR_HOURS') acc.agingBuckets.fourToTwentyFourHours += 1
          if (aging.ageBucket === 'ONE_TO_TWO_DAYS') acc.agingBuckets.oneToTwoDays += 1
          if (aging.ageBucket === 'OVER_TWO_DAYS') acc.agingBuckets.overTwoDays += 1
        }

        if (record.status === 'CALLBACK_ATTEMPTED') acc.callbackAttempted += 1
        if (followUpFlags.isFollowUpOverdue) acc.overdueFollowUps += 1
        if (record.status === 'RESOLVED' || record.status === 'CLOSED') acc.resolvedClosed += 1

        return acc
      },
      {
        openRecords: 0,
        unassignedOpen: 0,
        callbackAttempted: 0,
        overdueFollowUps: 0,
        aging24h: 0,
        resolvedClosed: 0,
        agingBuckets: {
          under4Hours: 0,
          fourToTwentyFourHours: 0,
          oneToTwoDays: 0,
          overTwoDays: 0,
        },
      }
    )

    return NextResponse.json({
      records: records.map((record) => ({
        ...deriveFollowUpFlags(record.callbackAttempts[0]?.nextFollowUpAt || null),
        ...deriveAging(record.receivedAt),
        id: record.id,
        sourceType: record.sourceType,
        status: record.status,
        priority: record.priority,
        callType: record.callType,
        receivedAt: record.receivedAt.toISOString(),
        phoneNumber: record.phoneNumber,
        callerNameRaw: record.callerNameRaw,
        summary: record.summary,
        transcriptRaw: record.transcriptRaw,
        internalNotes: record.internalNotes,
        detectedAddress: record.detectedAddress,
        detectedTown: record.detectedTown,
        detectedServiceCategory: record.detectedServiceCategory,
        assignedToUserId: record.assignedToUserId,
        assignedToUser: record.assignedToUser,
        customer: record.customer,
        property: record.property,
        relatedTask: record.relatedTask
          ? {
              id: record.relatedTask.id,
              serviceName: record.relatedTask.service?.name || null,
              statusName: record.relatedTask.status?.name || null,
              scheduledFor: record.relatedTask.scheduledFor?.toISOString() || null,
            }
          : null,
        callbackAttemptCount: record._count.callbackAttempts,
        activityCount: record._count.activities,
      })),
      currentUserId: sessionUser.id,
      moduleReady: true,
      totalRecords,
      loadedRecords: records.length,
      page,
      pageSize,
      stats,
    })
  } catch (error) {
    if (isCallsInboxTableMissing(error)) {
      return NextResponse.json({
        records: [],
        currentUserId: null,
        moduleReady: false,
        totalRecords: 0,
        loadedRecords: 0,
        page: 1,
        pageSize: 100,
        message: 'Calls Inbox schema is defined in code, but the database tables have not been activated yet.',
      })
    }

    console.error('Error fetching calls inbox records:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const sessionUser = await getSessionUser(prisma)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (!canAccessCallsInbox(sessionUser)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = (await request.json()) as {
      sourceType?: string
      status?: string
      priority?: string
      callType?: string
      receivedAt?: string
      phoneNumber?: string
      callerNameRaw?: string
      detectedAddress?: string
      detectedTown?: string
      summary?: string
      transcriptRaw?: string
      internalNotes?: string
      assignedToUserId?: string
    }

    const summary = (body.summary || '').trim()
    const transcriptRaw = (body.transcriptRaw || '').trim()
    const requestedAssignedToUserId = (body.assignedToUserId || '').trim()

    if (!body.sourceType || !body.status || !body.priority || !body.callType || !body.receivedAt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!summary && !transcriptRaw) {
      return NextResponse.json({ error: 'A summary or transcript is required' }, { status: 400 })
    }

    const assignedToUserId = requestedAssignedToUserId || (await resolveDefaultCallsInboxOwnerId(sessionUser.id))

    if (!assignedToUserId) {
      return NextResponse.json({ error: 'No default office intake owner could be resolved' }, { status: 400 })
    }

    const assignedUser = await prisma.user.findUnique({
      where: { id: assignedToUserId },
      select: { id: true },
    })

    if (!assignedUser) {
      return NextResponse.json({ error: 'Assigned user not found' }, { status: 400 })
    }

    const receivedAt = new Date(body.receivedAt)
    if (Number.isNaN(receivedAt.getTime())) {
      return NextResponse.json({ error: 'Invalid received date/time' }, { status: 400 })
    }

    const createdRecord = await prisma.$transaction(async (tx) => {
      const record = await tx.callRecord.create({
        data: {
          sourceType: body.sourceType as CallSourceType,
          direction: 'INBOUND',
          receivedAt,
          phoneNumber: body.phoneNumber?.trim() || null,
          callerNameRaw: body.callerNameRaw?.trim() || null,
          callType: body.callType as CallType,
          priority: body.priority as CallPriority,
          status: body.status as CallStatus,
          assignedToUserId,
          assignedByUserId: sessionUser.id,
          assignedAt: new Date(),
          summary: summary || transcriptRaw.slice(0, 180),
          transcriptRaw: transcriptRaw || null,
          internalNotes: body.internalNotes?.trim() || null,
          detectedAddress: body.detectedAddress?.trim() || null,
          detectedTown: body.detectedTown?.trim() || null,
        },
        include: {
          assignedToUser: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      })

      await tx.callActivity.createMany({
        data: [
          {
            callRecordId: record.id,
            actionType: 'CREATED',
            note: `Record created from ${record.sourceType.toLowerCase().replace(/_/g, ' ')}.`,
            createdByUserId: sessionUser.id,
          },
          {
            callRecordId: record.id,
            actionType: 'ASSIGNED',
            toValue: record.assignedToUser?.email || assignedToUserId,
            note: 'Initial follow-up owner assigned.',
            createdByUserId: sessionUser.id,
          },
        ],
      })

      return record
    })

    if (createdRecord.assignedToUser?.email && createdRecord.assignedToUserId !== sessionUser.id) {
      await sendCallAssignmentEmail({
        to: createdRecord.assignedToUser.email,
        assignedByEmail: sessionUser.email,
        assigneeEmail: createdRecord.assignedToUser.email,
        callerName: createdRecord.callerNameRaw,
        phoneNumber: createdRecord.phoneNumber,
        summary: createdRecord.summary,
        receivedAt: createdRecord.receivedAt,
        callRecordId: createdRecord.id,
        isReassignment: false,
      })
    }

    return NextResponse.json({
      id: createdRecord.id,
      sourceType: createdRecord.sourceType,
      status: createdRecord.status,
      priority: createdRecord.priority,
      callType: createdRecord.callType,
      receivedAt: createdRecord.receivedAt.toISOString(),
      phoneNumber: createdRecord.phoneNumber,
      callerNameRaw: createdRecord.callerNameRaw,
      summary: createdRecord.summary,
      transcriptRaw: createdRecord.transcriptRaw,
      internalNotes: createdRecord.internalNotes,
      assignedToUserId: createdRecord.assignedToUserId,
      assignedToUser: createdRecord.assignedToUser,
      moduleReady: true,
    })
  } catch (error) {
    if (isCallsInboxTableMissing(error)) {
      return NextResponse.json(
        {
          error: 'Calls Inbox tables are not active in the database yet. The safe code path is ready, but the schema still needs activation.',
        },
        { status: 503 }
      )
    }

    console.error('Error creating calls inbox record:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
