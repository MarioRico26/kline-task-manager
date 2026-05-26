import { NextResponse } from 'next/server'
import { CallbackOutcome, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getSessionUser } from '@/lib/sessionUser'

function canAccessCallsInbox(sessionUser: Awaited<ReturnType<typeof getSessionUser>>) {
  return sessionUser && sessionUser.canAccessCallsInbox && sessionUser.accessScope !== 'PERMITS_ONLY'
}

function isCallsInboxTableMissing(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

const autoAttemptStatuses = new Set(['NEW', 'TRIAGE_REQUIRED', 'ASSIGNED', 'CALLBACK_PENDING'])

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
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
      outcome?: string
      notes?: string
      nextFollowUpAt?: string
    }

    if (!body.outcome) {
      return NextResponse.json({ error: 'Callback outcome is required' }, { status: 400 })
    }

    const existing = await prisma.callRecord.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Call record not found' }, { status: 404 })
    }

    const nextFollowUpAt = body.nextFollowUpAt ? new Date(body.nextFollowUpAt) : null
    if (body.nextFollowUpAt && (!nextFollowUpAt || Number.isNaN(nextFollowUpAt.getTime()))) {
      return NextResponse.json({ error: 'Invalid next follow-up date/time' }, { status: 400 })
    }

    const outcome = body.outcome as CallbackOutcome
    const noteText = (body.notes || '').trim() || null
    const nextStatus = autoAttemptStatuses.has(existing.status) ? 'CALLBACK_ATTEMPTED' : existing.status

    const result = await prisma.$transaction(async (tx) => {
      const attempt = await tx.callbackAttempt.create({
        data: {
          callRecordId: id,
          attemptedByUserId: sessionUser.id,
          attemptedAt: new Date(),
          outcome,
          notes: noteText,
          nextFollowUpAt,
        },
        include: {
          attemptedByUser: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      })

      const activities: Prisma.CallActivityCreateManyInput[] = [
        {
          callRecordId: id,
          actionType: 'CALLBACK_LOGGED',
          note: noteText || `Callback attempt logged with outcome ${outcome.toLowerCase().replace(/_/g, ' ')}.`,
          createdByUserId: sessionUser.id,
        },
      ]

      if (nextStatus !== existing.status) {
        await tx.callRecord.update({
          where: { id },
          data: {
            status: 'CALLBACK_ATTEMPTED',
          },
        })

        activities.push({
          callRecordId: id,
          actionType: 'STATUS_CHANGED',
          fromValue: existing.status,
          toValue: nextStatus,
          note: 'Status auto-updated after logging callback attempt.',
          createdByUserId: sessionUser.id,
        })
      }

      await tx.callActivity.createMany({ data: activities })

      return attempt
    })

    return NextResponse.json({
      id: result.id,
      outcome: result.outcome,
      attemptedAt: result.attemptedAt.toISOString(),
      notes: result.notes,
      nextFollowUpAt: result.nextFollowUpAt?.toISOString() || null,
      attemptedByUser: result.attemptedByUser,
      statusApplied: nextStatus,
    })
  } catch (error) {
    if (isCallsInboxTableMissing(error)) {
      return NextResponse.json(
        {
          error: 'Calls Inbox tables are not active in the database yet. The callback workflow is ready in code, but the schema still needs activation.',
        },
        { status: 503 }
      )
    }

    console.error('Error logging callback attempt:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
