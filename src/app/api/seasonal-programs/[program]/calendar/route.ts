import { NextResponse } from 'next/server'
import { SeasonalOccurrenceStatus, SeasonalProgramCode, SeasonalSeasonStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getSessionUser } from '@/lib/sessionUser'
import { getSeasonalProgramConfig } from '@/lib/seasonalPrograms'

function canAccessSeasonalPrograms(sessionUser: Awaited<ReturnType<typeof getSessionUser>>) {
  return sessionUser && sessionUser.canAccessSeasonalPrograms && sessionUser.accessScope !== 'PERMITS_ONLY'
}

function parseBoundary(value: string | null, fallback: Date) {
  if (!value) return fallback
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? fallback : date
}

function titleCase(value: string | null | undefined) {
  if (!value) return 'Service visit'
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export async function GET(request: Request, context: { params: Promise<{ program: string }> }) {
  try {
    const sessionUser = await getSessionUser(prisma)
    if (!sessionUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!canAccessSeasonalPrograms(sessionUser)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { program } = await context.params
    const config = getSeasonalProgramConfig(program)
    if (!config) return NextResponse.json({ error: 'Program not found.' }, { status: 404 })

    const url = new URL(request.url)
    const now = new Date()
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const start = parseBoundary(url.searchParams.get('from'), defaultStart)
    const end = parseBoundary(url.searchParams.get('to'), defaultEnd)

    const programRecord = await prisma.seasonalProgram.findUnique({
      where: { code: config.code as SeasonalProgramCode },
      include: {
        seasons: {
          where: { status: SeasonalSeasonStatus.ACTIVE },
          orderBy: { year: 'desc' },
          take: 1,
          select: { id: true },
        },
      },
    })
    const season = programRecord?.seasons[0]
    if (!season) return NextResponse.json({ visits: [] })

    const visits = await prisma.seasonalOccurrence.findMany({
      where: {
        enrollment: { seasonId: season.id },
        scheduledFor: { gte: start, lt: end },
        status: { in: [SeasonalOccurrenceStatus.SCHEDULED, SeasonalOccurrenceStatus.IN_PROGRESS] },
      },
      orderBy: { scheduledFor: 'asc' },
      include: {
        enrollment: {
          select: {
            customer: { select: { fullName: true } },
            property: { select: { address: true, city: true } },
          },
        },
        enrollmentService: { select: { serviceType: true } },
      },
    })

    return NextResponse.json({
      visits: visits.map((visit) => ({
        id: visit.id,
        scheduledFor: visit.scheduledFor,
        status: visit.status,
        assignedTo: visit.assignedTo,
        notes: visit.notes,
        serviceLabel: titleCase(visit.enrollmentService?.serviceType),
        customerName: visit.enrollment.customer.fullName,
        propertyLabel: `${visit.enrollment.property.address}, ${visit.enrollment.property.city}`,
      })),
    })
  } catch (error) {
    console.error('Error loading seasonal program calendar:', error)
    return NextResponse.json({ error: 'Unable to load the calendar.' }, { status: 500 })
  }
}
