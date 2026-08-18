import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionUser } from '@/lib/sessionUser'

type SmsHistoryDetails = {
  phoneNumber?: string | null
  template?: string | null
  additionalNote?: string | null
  message?: string | null
  sid?: string | null
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await getSessionUser(prisma)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { id } = await context.params

    const logs = await prisma.auditLog.findMany({
      where: {
        entity: 'CUSTOMER',
        entityId: id,
        action: 'SEND_CUSTOMER_SMS',
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 25,
    })

    const userIds = Array.from(new Set(logs.map((log) => log.userId).filter(Boolean)))
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            email: true,
          },
        })
      : []

    const userEmailMap = new Map(users.map((user) => [user.id, user.email]))

    const records = logs.map((log) => {
      const details = ((log.details || {}) as SmsHistoryDetails) ?? {}

      return {
        id: log.id,
        timestamp: log.timestamp,
        userEmail: userEmailMap.get(log.userId) || null,
        phoneNumber: details.phoneNumber || null,
        template: details.template || null,
        additionalNote: details.additionalNote || null,
        message: details.message || null,
        sid: details.sid || null,
      }
    })

    return NextResponse.json({ records })
  } catch (error) {
    console.error('Error loading customer SMS history:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
