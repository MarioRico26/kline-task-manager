import { NextResponse } from 'next/server'
import { CallPriority, CallStatus, CallType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { sendCallAssignmentEmail } from '@/lib/email'
import { getSessionUser } from '@/lib/sessionUser'

function canAccessCallsInbox(sessionUser: Awaited<ReturnType<typeof getSessionUser>>) {
  return sessionUser && sessionUser.canAccessCallsInbox && sessionUser.accessScope !== 'PERMITS_ONLY'
}

function isCallsInboxTableMissing(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

function toIsoOrNull(value: Date | null) {
  return value ? value.toISOString() : null
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

    const record = await prisma.callRecord.findUnique({
      where: { id },
      include: {
        assignedToUser: {
          select: { id: true, email: true },
        },
        customer: {
          select: { id: true, fullName: true },
        },
        property: {
          select: { id: true, address: true, city: true, state: true },
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
          orderBy: { attemptedAt: 'desc' },
          include: {
            attemptedByUser: {
              select: { id: true, email: true },
            },
          },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          include: {
            createdByUser: {
              select: { id: true, email: true },
            },
          },
        },
        _count: {
          select: {
            callbackAttempts: true,
            activities: true,
          },
        },
      },
    })

    if (!record) {
      return NextResponse.json({ error: 'Call record not found' }, { status: 404 })
    }

    const nextFollowUpAt = record.callbackAttempts.find((attempt) => attempt.nextFollowUpAt)?.nextFollowUpAt || null

    return NextResponse.json({
      record: {
        ...deriveFollowUpFlags(nextFollowUpAt),
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
        assignedToUserId: record.assignedToUserId,
        assignedToUser: record.assignedToUser,
        customer: record.customer,
        property: record.property,
        relatedTask: record.relatedTask
          ? {
              id: record.relatedTask.id,
              serviceName: record.relatedTask.service?.name || null,
              statusName: record.relatedTask.status?.name || null,
              scheduledFor: toIsoOrNull(record.relatedTask.scheduledFor),
            }
          : null,
        callbackAttemptCount: record._count.callbackAttempts,
        activityCount: record._count.activities,
        requestedAction: record.requestedAction,
        detectedAddress: record.detectedAddress,
        detectedTown: record.detectedTown,
        callbackAttempts: record.callbackAttempts.map((attempt) => ({
          id: attempt.id,
          attemptedAt: attempt.attemptedAt.toISOString(),
          outcome: attempt.outcome,
          notes: attempt.notes,
          nextFollowUpAt: toIsoOrNull(attempt.nextFollowUpAt),
          attemptedByUser: attempt.attemptedByUser,
        })),
        activities: record.activities.map((activity) => ({
          id: activity.id,
          actionType: activity.actionType,
          fromValue: activity.fromValue,
          toValue: activity.toValue,
          note: activity.note,
          createdAt: activity.createdAt.toISOString(),
          createdByUser: activity.createdByUser,
        })),
      },
      currentUserId: sessionUser.id,
      moduleReady: true,
    })
  } catch (error) {
    if (isCallsInboxTableMissing(error)) {
      return NextResponse.json({
        record: null,
        currentUserId: null,
        moduleReady: false,
        message: 'Calls Inbox schema is defined in code, but the database tables have not been activated yet.',
      })
    }

    console.error('Error fetching call record detail:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await getSessionUser(prisma)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (!canAccessCallsInbox(sessionUser)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const body = (await request.json()) as {
      status?: string
      priority?: string
      callType?: string
      summary?: string
      transcriptRaw?: string
      internalNotes?: string
      assignedToUserId?: string
      requestedAction?: string
      customerId?: string
      propertyId?: string
      relatedTaskId?: string
    }

    const existing = await prisma.callRecord.findUnique({
      where: { id },
      select: {
        id: true,
        receivedAt: true,
        phoneNumber: true,
        callerNameRaw: true,
        status: true,
        priority: true,
        callType: true,
        summary: true,
        transcriptRaw: true,
        internalNotes: true,
        assignedToUserId: true,
        customerId: true,
        propertyId: true,
        relatedTaskId: true,
        assignedToUser: {
          select: { email: true },
        },
        customer: {
          select: { fullName: true },
        },
        property: {
          select: { address: true },
        },
        relatedTask: {
          select: {
            id: true,
            service: { select: { name: true } },
          },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Call record not found' }, { status: 404 })
    }

    const nextAssignedToUserId = body.assignedToUserId?.trim() || null
    let nextAssignedUserEmail: string | null = existing.assignedToUser?.email || null

    if (nextAssignedToUserId) {
      const assignedUser = await prisma.user.findUnique({
        where: { id: nextAssignedToUserId },
        select: { id: true, email: true },
      })
      if (!assignedUser) {
        return NextResponse.json({ error: 'Assigned user not found' }, { status: 400 })
      }
      nextAssignedUserEmail = assignedUser.email
    }

    const nextStatus = body.status ? (body.status as CallStatus) : existing.status
    const nextPriority = body.priority ? (body.priority as CallPriority) : existing.priority
    const nextCallType = body.callType ? (body.callType as CallType) : existing.callType
    const nextSummary = (body.summary ?? existing.summary).trim()
    const nextTranscriptRaw = (body.transcriptRaw ?? existing.transcriptRaw ?? '').trim() || null
    const nextInternalNotes = (body.internalNotes ?? existing.internalNotes ?? '').trim() || null
    const nextRequestedAction = (body.requestedAction ?? '').trim() || null
    const requestedCustomerId = body.customerId?.trim() || null
    const requestedPropertyId = body.propertyId?.trim() || null
    const requestedRelatedTaskId = body.relatedTaskId?.trim() || null

    if (!nextSummary) {
      return NextResponse.json({ error: 'Summary is required' }, { status: 400 })
    }

    let nextCustomerId = requestedCustomerId
    let nextPropertyId = requestedPropertyId
    const nextRelatedTaskId = requestedRelatedTaskId

    const [selectedCustomer, selectedProperty, selectedTask] = await Promise.all([
      nextCustomerId
        ? prisma.customer.findUnique({
            where: { id: nextCustomerId },
            select: { id: true, fullName: true },
          })
        : Promise.resolve(null),
      nextPropertyId
        ? prisma.property.findUnique({
            where: { id: nextPropertyId },
            select: { id: true, customerId: true, address: true },
          })
        : Promise.resolve(null),
      nextRelatedTaskId
        ? prisma.task.findUnique({
            where: { id: nextRelatedTaskId },
            select: {
              id: true,
              customerId: true,
              propertyId: true,
              service: { select: { name: true } },
            },
          })
        : Promise.resolve(null),
    ])

    if (nextCustomerId && !selectedCustomer) {
      return NextResponse.json({ error: 'Linked customer not found' }, { status: 400 })
    }
    if (nextPropertyId && !selectedProperty) {
      return NextResponse.json({ error: 'Linked property not found' }, { status: 400 })
    }
    if (nextRelatedTaskId && !selectedTask) {
      return NextResponse.json({ error: 'Linked task not found' }, { status: 400 })
    }

    if (selectedProperty && !nextCustomerId) {
      nextCustomerId = selectedProperty.customerId
    }

    if (selectedTask) {
      if (!nextCustomerId) nextCustomerId = selectedTask.customerId
      if (!nextPropertyId) nextPropertyId = selectedTask.propertyId

      if (nextCustomerId && selectedTask.customerId !== nextCustomerId) {
        return NextResponse.json({ error: 'Linked task does not belong to the selected customer' }, { status: 400 })
      }

      if (nextPropertyId && selectedTask.propertyId !== nextPropertyId) {
        return NextResponse.json({ error: 'Linked task does not belong to the selected property' }, { status: 400 })
      }
    }

    if (selectedProperty && nextCustomerId && selectedProperty.customerId !== nextCustomerId) {
      return NextResponse.json({ error: 'Selected property does not belong to the selected customer' }, { status: 400 })
    }

    const updatedRecord = await prisma.$transaction(async (tx) => {
      const record = await tx.callRecord.update({
        where: { id },
        data: {
          status: nextStatus,
          priority: nextPriority,
          callType: nextCallType,
          summary: nextSummary,
          transcriptRaw: nextTranscriptRaw,
          internalNotes: nextInternalNotes,
          requestedAction: nextRequestedAction,
          assignedToUserId: nextAssignedToUserId,
          customerId: nextCustomerId,
          propertyId: nextPropertyId,
          relatedTaskId: nextRelatedTaskId,
          assignedByUserId: nextAssignedToUserId !== existing.assignedToUserId ? sessionUser.id : undefined,
          assignedAt: nextAssignedToUserId !== existing.assignedToUserId ? new Date() : undefined,
        },
        include: {
          assignedToUser: {
            select: { id: true, email: true },
          },
          customer: {
            select: { id: true, fullName: true },
          },
          property: {
            select: { id: true, address: true, city: true, state: true },
          },
          relatedTask: {
            select: {
              id: true,
              scheduledFor: true,
              service: { select: { name: true } },
              status: { select: { name: true } },
            },
          },
        },
      })

      const activityCreates: Prisma.CallActivityCreateManyInput[] = []

      if (existing.status !== nextStatus) {
        activityCreates.push({
          callRecordId: id,
          actionType: 'STATUS_CHANGED',
          fromValue: existing.status,
          toValue: nextStatus,
          note: 'Call status updated.',
          createdByUserId: sessionUser.id,
        })
      }

      if (existing.assignedToUserId !== nextAssignedToUserId) {
        activityCreates.push({
          callRecordId: id,
          actionType: existing.assignedToUserId ? 'REASSIGNED' : 'ASSIGNED',
          fromValue: existing.assignedToUser?.email || existing.assignedToUserId || null,
          toValue: nextAssignedUserEmail || nextAssignedToUserId,
          note: existing.assignedToUserId ? 'Call owner changed.' : 'Initial owner assigned from detail view.',
          createdByUserId: sessionUser.id,
        })
      }

      if (existing.priority !== nextPriority) {
        activityCreates.push({
          callRecordId: id,
          actionType: 'NOTE_ADDED',
          note: `Priority updated from ${existing.priority} to ${nextPriority}.`,
          createdByUserId: sessionUser.id,
        })
      }

      if (existing.summary !== nextSummary || (existing.internalNotes || null) !== nextInternalNotes) {
        activityCreates.push({
          callRecordId: id,
          actionType: 'NOTE_ADDED',
          note: 'Summary or internal notes updated.',
          createdByUserId: sessionUser.id,
        })
      }

      if ((existing.customerId || null) !== (nextCustomerId || null)) {
        activityCreates.push({
          callRecordId: id,
          actionType: 'LINKED_TO_CUSTOMER',
          fromValue: existing.customer?.fullName || null,
          toValue: selectedCustomer?.fullName || null,
          note: nextCustomerId ? 'Customer link updated.' : 'Customer link cleared.',
          createdByUserId: sessionUser.id,
        })
      }

      if ((existing.propertyId || null) !== (nextPropertyId || null)) {
        activityCreates.push({
          callRecordId: id,
          actionType: 'LINKED_TO_PROPERTY',
          fromValue: existing.property?.address || null,
          toValue: selectedProperty?.address || null,
          note: nextPropertyId ? 'Property link updated.' : 'Property link cleared.',
          createdByUserId: sessionUser.id,
        })
      }

      if ((existing.relatedTaskId || null) !== (nextRelatedTaskId || null)) {
        activityCreates.push({
          callRecordId: id,
          actionType: 'LINKED_TO_TASK',
          fromValue: existing.relatedTask?.service?.name || existing.relatedTaskId || null,
          toValue: selectedTask?.service?.name || nextRelatedTaskId,
          note: nextRelatedTaskId ? 'Task link updated.' : 'Task link cleared.',
          createdByUserId: sessionUser.id,
        })
      }

      if (activityCreates.length > 0) {
        await tx.callActivity.createMany({ data: activityCreates })
      }

      return record
    })

    if (
      existing.assignedToUserId !== nextAssignedToUserId &&
      updatedRecord.assignedToUser?.email &&
      updatedRecord.assignedToUserId !== sessionUser.id
    ) {
      await sendCallAssignmentEmail({
        to: updatedRecord.assignedToUser.email,
        assignedByEmail: sessionUser.email,
        assigneeEmail: updatedRecord.assignedToUser.email,
        callerName: existing.callerNameRaw || null,
        phoneNumber: existing.phoneNumber || null,
        summary: nextSummary,
        receivedAt: existing.receivedAt,
        callRecordId: id,
        isReassignment: existing.assignedToUserId !== null,
      })
    }

    return NextResponse.json({
      id: updatedRecord.id,
      status: updatedRecord.status,
      priority: updatedRecord.priority,
      callType: updatedRecord.callType,
      summary: updatedRecord.summary,
      transcriptRaw: updatedRecord.transcriptRaw,
      internalNotes: updatedRecord.internalNotes,
      assignedToUserId: updatedRecord.assignedToUserId,
      assignedToUser: updatedRecord.assignedToUser,
      requestedAction: updatedRecord.requestedAction,
      customer: updatedRecord.customer,
      property: updatedRecord.property,
      relatedTask: updatedRecord.relatedTask
        ? {
            id: updatedRecord.relatedTask.id,
            serviceName: updatedRecord.relatedTask.service?.name || null,
            statusName: updatedRecord.relatedTask.status?.name || null,
            scheduledFor: toIsoOrNull(updatedRecord.relatedTask.scheduledFor),
          }
        : null,
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

    console.error('Error updating call record:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
