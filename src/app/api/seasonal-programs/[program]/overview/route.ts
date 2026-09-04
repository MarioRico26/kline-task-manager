import { NextResponse } from 'next/server'
import {
  Prisma,
  SeasonalIssuePriority,
  SeasonalIssueStatus,
  SeasonalOccurrenceStatus,
  SeasonalProgramCode,
  SeasonalSeasonStatus,
  SeasonalServiceStatus,
} from '@prisma/client'
import { prisma } from '@/lib/db'
import { getSessionUser } from '@/lib/sessionUser'
import { getSeasonalProgramConfig } from '@/lib/seasonalPrograms'

function canAccessSeasonalPrograms(sessionUser: Awaited<ReturnType<typeof getSessionUser>>) {
  return sessionUser && sessionUser.canAccessSeasonalPrograms && sessionUser.accessScope !== 'PERMITS_ONLY'
}

function formatServiceLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatIssuePriorityRank(priority: SeasonalIssuePriority) {
  if (priority === 'URGENT') return 4
  if (priority === 'HIGH') return 3
  if (priority === 'MEDIUM') return 2
  return 1
}

function isSeasonalTableMissing(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(_request: Request, context: { params: Promise<{ program: string }> }) {
  try {
    const sessionUser = await getSessionUser(prisma)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (!canAccessSeasonalPrograms(sessionUser)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { program } = await context.params
    const config = getSeasonalProgramConfig(program)

    if (!config) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }

    // Each operational category gets one active season per year. This lets a
    // new module work immediately, without requiring a separate admin setup.
    const year = new Date().getFullYear()
    const seasonalProgram = await prisma.seasonalProgram.upsert({
        where: { code: config.code as SeasonalProgramCode },
        update: { isActive: true },
        create: {
          code: config.code as SeasonalProgramCode,
          name: config.title,
          description: config.subtitle,
          isActive: true,
        },
      })

    const activeSeason = await prisma.seasonalProgramSeason.upsert({
        where: { programId_year: { programId: seasonalProgram.id, year } },
        update: { status: SeasonalSeasonStatus.ACTIVE },
        create: { programId: seasonalProgram.id, label: config.seasonLabel, year, status: SeasonalSeasonStatus.ACTIVE },
      })

    await prisma.seasonalProgramSeason.updateMany({
        where: { programId: seasonalProgram.id, id: { not: activeSeason.id }, status: SeasonalSeasonStatus.ACTIVE },
        data: { status: SeasonalSeasonStatus.CLOSED },
      })

    const programRecord = await prisma.seasonalProgram.findUnique({
      where: { code: config.code as SeasonalProgramCode },
      include: {
        seasons: {
          orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
        },
      },
    })

    const selectedSeason =
      programRecord?.seasons.find((season) => season.status === SeasonalSeasonStatus.ACTIVE) ||
      programRecord?.seasons[0] ||
      null

    if (!programRecord || !selectedSeason) {
      return NextResponse.json({
        program: {
          code: config.code,
          title: config.title,
          subtitle: config.subtitle,
        },
        season: null,
        stats: {
          enrollments: 0,
          activeEnrollments: 0,
          openIssues: 0,
          urgentIssues: 0,
          upcomingOccurrences: 0,
          servicesInProgress: 0,
          completedServices: 0,
        },
        roster: [],
        issues: [],
        upcomingOccurrences: [],
      })
    }

    const [enrollmentCount, activeEnrollmentCount, openIssues, upcomingOccurrences, serviceRows, rosterRows, issueRows, occurrenceRows] =
      await Promise.all([
        prisma.seasonalEnrollment.count({
          where: { seasonId: selectedSeason.id },
        }),
        prisma.seasonalEnrollment.count({
          where: { seasonId: selectedSeason.id, status: 'ACTIVE' },
        }),
        prisma.seasonalIssue.findMany({
          where: {
            enrollment: { seasonId: selectedSeason.id },
            status: { in: [SeasonalIssueStatus.OPEN, SeasonalIssueStatus.IN_PROGRESS, SeasonalIssueStatus.WAITING_ON_CUSTOMER] },
          },
          orderBy: [{ priority: 'desc' }, { openedAt: 'desc' }],
          take: 8,
          include: {
            enrollment: {
              select: {
                id: true,
                customer: { select: { fullName: true } },
                property: { select: { address: true, city: true, state: true } },
              },
            },
          },
        }),
        prisma.seasonalOccurrence.count({
          where: {
            enrollment: { seasonId: selectedSeason.id },
            status: { in: [SeasonalOccurrenceStatus.SCHEDULED, SeasonalOccurrenceStatus.IN_PROGRESS] },
            scheduledFor: { gte: new Date() },
          },
        }),
        prisma.seasonalEnrollmentService.findMany({
          where: { enrollment: { seasonId: selectedSeason.id } },
          select: { status: true },
        }),
        prisma.seasonalEnrollment.findMany({
          where: { seasonId: selectedSeason.id },
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          take: 14,
          include: {
            customer: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
              },
            },
            property: {
              select: {
                id: true,
                address: true,
                city: true,
                state: true,
                zip: true,
              },
            },
            services: {
              orderBy: [{ targetDate: 'asc' }, { createdAt: 'asc' }],
              select: {
                id: true,
                serviceType: true,
                cadenceLabel: true,
                status: true,
                targetDate: true,
                completionDate: true,
              },
            },
            issues: {
              where: {
                status: { in: [SeasonalIssueStatus.OPEN, SeasonalIssueStatus.IN_PROGRESS, SeasonalIssueStatus.WAITING_ON_CUSTOMER] },
              },
              orderBy: [{ priority: 'desc' }, { openedAt: 'desc' }],
              select: {
                id: true,
                category: true,
                priority: true,
                status: true,
              },
            },
            occurrences: {
              where: {
                status: { in: [SeasonalOccurrenceStatus.SCHEDULED, SeasonalOccurrenceStatus.IN_PROGRESS] },
              },
              orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }],
              take: 1,
              select: {
                id: true,
                scheduledFor: true,
                status: true,
              },
            },
          },
        }),
        prisma.seasonalIssue.findMany({
          where: {
            enrollment: { seasonId: selectedSeason.id },
            status: { in: [SeasonalIssueStatus.OPEN, SeasonalIssueStatus.IN_PROGRESS, SeasonalIssueStatus.WAITING_ON_CUSTOMER] },
          },
          orderBy: [{ openedAt: 'desc' }],
          take: 8,
          include: {
            enrollment: {
              select: {
                customer: { select: { fullName: true } },
                property: { select: { address: true } },
              },
            },
          },
        }),
        prisma.seasonalOccurrence.findMany({
          where: {
            enrollment: { seasonId: selectedSeason.id },
            status: { in: [SeasonalOccurrenceStatus.SCHEDULED, SeasonalOccurrenceStatus.IN_PROGRESS] },
            scheduledFor: { not: null },
          },
          orderBy: [{ scheduledFor: 'asc' }],
          take: 8,
          include: {
            enrollment: {
              select: {
                customer: { select: { fullName: true } },
                property: { select: { address: true } },
              },
            },
            enrollmentService: {
              select: {
                serviceType: true,
              },
            },
          },
        }),
      ])

    const servicesInProgress = serviceRows.filter(
      (item) => item.status === SeasonalServiceStatus.SCHEDULED || item.status === SeasonalServiceStatus.IN_PROGRESS
    ).length
    const completedServices = serviceRows.filter((item) => item.status === SeasonalServiceStatus.COMPLETED).length
    const urgentIssues = openIssues.filter(
      (issue) => issue.priority === SeasonalIssuePriority.URGENT || issue.priority === SeasonalIssuePriority.HIGH
    ).length

    return NextResponse.json({
      program: {
        code: programRecord.code,
        title: programRecord.name,
        subtitle: programRecord.description || config.subtitle,
      },
      season: {
        id: selectedSeason.id,
        label: selectedSeason.label,
        year: selectedSeason.year,
        status: selectedSeason.status,
        startsAt: selectedSeason.startsAt,
        endsAt: selectedSeason.endsAt,
      },
      stats: {
        enrollments: enrollmentCount,
        activeEnrollments: activeEnrollmentCount,
        openIssues: openIssues.length,
        urgentIssues,
        upcomingOccurrences,
        servicesInProgress,
        completedServices,
      },
      roster: rosterRows.map((row) => ({
        id: row.id,
        customerId: row.customer.id,
        propertyId: row.property.id,
        customerName: row.customer.fullName,
        customerEmail: row.customer.email,
        customerPhone: row.primaryPhone || row.customer.phone || null,
        propertyLabel: `${row.property.address}, ${row.property.city}, ${row.property.state} ${row.property.zip}`,
        town: row.town,
        status: row.status,
        accessCode: row.accessCode,
        serviceNotes: row.serviceNotes,
        operationalNotes: row.operationalNotes,
        services: row.services.map((service) => ({
          id: service.id,
          label: formatServiceLabel(service.serviceType),
          cadenceLabel: service.cadenceLabel,
          status: service.status,
          targetDate: service.targetDate,
          completionDate: service.completionDate,
        })),
        openIssueCount: row.issues.length,
        highestIssuePriority:
          row.issues.sort((a, b) => formatIssuePriorityRank(b.priority) - formatIssuePriorityRank(a.priority))[0]?.priority ||
          null,
        nextOccurrence: row.occurrences[0] || null,
      })),
      issues: issueRows.map((issue) => ({
        id: issue.id,
        category: issue.category,
        priority: issue.priority,
        status: issue.status,
        description: issue.description,
        openedAt: issue.openedAt,
        customerName: issue.enrollment.customer.fullName,
        propertyAddress: issue.enrollment.property.address,
      })),
      upcomingOccurrences: occurrenceRows.map((occurrence) => ({
        id: occurrence.id,
        scheduledFor: occurrence.scheduledFor,
        status: occurrence.status,
        customerName: occurrence.enrollment.customer.fullName,
        propertyAddress: occurrence.enrollment.property.address,
        serviceLabel: occurrence.enrollmentService?.serviceType
          ? formatServiceLabel(occurrence.enrollmentService.serviceType)
          : 'Program visit',
      })),
    })
  } catch (error) {
    if (isSeasonalTableMissing(error)) {
      return NextResponse.json({ error: 'Seasonal Programs schema has not been activated yet.' }, { status: 503 })
    }

    console.error('Error loading seasonal program overview:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
