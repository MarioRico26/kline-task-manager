import { NextResponse } from 'next/server'
import {
  SeasonalIssueCategory,
  SeasonalIssuePriority,
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

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function parseDate(value: unknown) {
  const raw = clean(value)
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

function valuesFrom(value: unknown, allowed: readonly string[]) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(clean).filter((item) => allowed.includes(item))))
}

function addWeeks(date: Date, weeks: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + weeks * 7)
  return result
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

async function ensureMaintenanceWorkCatalog() {
  const config = getSeasonalProgramConfig('maintenance')
  if (!config) throw new Error('Maintenance is not configured.')

  const program = await prisma.seasonalProgram.upsert({
    where: { code: SeasonalProgramCode.MAINTENANCE },
    update: { isActive: true, name: config.title, description: config.subtitle },
    create: { code: SeasonalProgramCode.MAINTENANCE, name: config.title, description: config.subtitle, isActive: true },
  })

  await Promise.all(
    config.operationalServices.map((service, index) =>
      prisma.seasonalWorkType.upsert({
        where: { programId_code: { programId: program.id, code: service.value } },
        // Do not overwrite isActive: once the team changes it, their choice wins.
        update: { label: service.label, description: service.description || null, sortOrder: index },
        create: {
          programId: program.id,
          code: service.value,
          label: service.label,
          description: service.description || null,
          isActive: service.isActive !== false,
          sortOrder: index,
        },
      })
    )
  )

  return prisma.seasonalWorkType.findMany({
    where: { programId: program.id },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
  })
}

function weeklyDatesToCreate(
  anchor: Date,
  occurrences: Array<{ scheduledFor: Date | null; status: SeasonalOccurrenceStatus }>,
  desiredFutureVisits = 12
) {
  const now = new Date()
  const occupiedDates = new Set(occurrences.flatMap((occurrence) => (occurrence.scheduledFor ? [dateKey(occurrence.scheduledFor)] : [])))
  const activeFutureDates = new Set(
    occurrences.flatMap((occurrence) =>
      occurrence.scheduledFor && occurrence.scheduledFor >= now &&
      (occurrence.status === SeasonalOccurrenceStatus.SCHEDULED || occurrence.status === SeasonalOccurrenceStatus.IN_PROGRESS)
        ? [dateKey(occurrence.scheduledFor)]
        : []
    )
  )

  let candidate = new Date(anchor)
  while (candidate < now) candidate = addWeeks(candidate, 1)

  const dates: Date[] = []
  // A cancelled visit stays cancelled. Extend the schedule later instead of recreating it.
  while (activeFutureDates.size + dates.length < desiredFutureVisits) {
    const key = dateKey(candidate)
    if (!occupiedDates.has(key)) {
      dates.push(new Date(candidate))
      occupiedDates.add(key)
    }
    candidate = addWeeks(candidate, 1)
  }

  return dates
}

async function getOrCreateActiveSeason(programKey: string) {
  const config = getSeasonalProgramConfig(programKey)
  if (!config) throw new Error('Program not found.')

  const year = new Date().getFullYear()
  const program = await prisma.seasonalProgram.upsert({
    where: { code: config.code as SeasonalProgramCode },
    update: { isActive: true },
    create: {
      code: config.code as SeasonalProgramCode,
      name: config.title,
      description: config.subtitle,
      isActive: true,
    },
  })

  const season = await prisma.seasonalProgramSeason.upsert({
    where: { programId_year: { programId: program.id, year } },
    update: { status: SeasonalSeasonStatus.ACTIVE },
    create: { programId: program.id, label: config.seasonLabel, year, status: SeasonalSeasonStatus.ACTIVE },
  })

  await prisma.seasonalProgramSeason.updateMany({
    where: {
      programId: program.id,
      id: { not: season.id },
      status: SeasonalSeasonStatus.ACTIVE,
    },
    data: { status: SeasonalSeasonStatus.CLOSED },
  })

  return season
}

export async function GET(_request: Request, context: { params: Promise<{ program: string }> }) {
  const sessionUser = await getSessionUser(prisma)
  if (!sessionUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!canAccessSeasonalPrograms(sessionUser)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { program } = await context.params
  const config = getSeasonalProgramConfig(program)
  if (!config) return NextResponse.json({ error: 'Program not found.' }, { status: 404 })

  const workTypes = program === 'maintenance' ? await ensureMaintenanceWorkCatalog() : []

  const customers = await prisma.customer.findMany({
    orderBy: { fullName: 'asc' },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      properties: {
        orderBy: [{ address: 'asc' }],
        select: { id: true, address: true, city: true, state: true, zip: true },
      },
    },
  })

  return NextResponse.json({ customers, workTypes })
}

export async function POST(request: Request, context: { params: Promise<{ program: string }> }) {
  try {
    const sessionUser = await getSessionUser(prisma)
    if (!sessionUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!canAccessSeasonalPrograms(sessionUser)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { program } = await context.params
    const config = getSeasonalProgramConfig(program)
    if (!config) {
      return NextResponse.json({ error: 'Program not found.' }, { status: 404 })
    }

    const body = await request.json()
    const action = clean(body.action)

    if (action === 'update_work_catalog') {
      if (program !== 'maintenance') return NextResponse.json({ error: 'This catalog is only available for Maintenance.' }, { status: 400 })
      const code = clean(body.code)
      const isActive = body.isActive === true
      const workTypes = await ensureMaintenanceWorkCatalog()
      const workType = workTypes.find((item) => item.code === code)
      if (!workType) return NextResponse.json({ error: 'Work type not found.' }, { status: 404 })

      const updated = await prisma.seasonalWorkType.update({ where: { id: workType.id }, data: { isActive } })
      return NextResponse.json({ workType: updated })
    }

    if (action === 'create_pool_job' || action === 'create_job') {
      const customerId = clean(body.customerId)
      const propertyId = clean(body.propertyId)
      const serviceType = clean(body.serviceType)
      const scheduledFor = parseDate(body.scheduledFor)
      const supportedServiceTypes = program === 'maintenance'
        ? (await ensureMaintenanceWorkCatalog()).filter((service) => service.isActive).map((service) => service.code)
        : config.operationalServices.filter((service) => service.isActive !== false).map((service) => service.value)
      if (!customerId || !propertyId || !supportedServiceTypes.includes(serviceType) || !scheduledFor) {
        return NextResponse.json({ error: 'Choose the customer, property, work type, and scheduled date.' }, { status: 400 })
      }

      const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { id: true, customerId: true, city: true } })
      if (!property || property.customerId !== customerId) {
        return NextResponse.json({ error: 'The selected property does not belong to this customer.' }, { status: 400 })
      }

      const season = await getOrCreateActiveSeason(program)
      let enrollment = await prisma.seasonalEnrollment.findFirst({
        where: { seasonId: season.id, propertyId },
        include: { services: true },
      })

      if (!enrollment) {
        enrollment = await prisma.seasonalEnrollment.create({
          data: {
            seasonId: season.id,
            customerId,
            propertyId,
            town: property.city,
            accessCode: clean(body.accessCode) || null,
            serviceNotes: clean(body.serviceNotes) || null,
            operationalNotes: clean(body.notes) || null,
            services: {
              create: {
                serviceType,
                cadenceLabel: serviceType === 'WEEKLY' ? 'Weekly pool service' : null,
                targetDate: scheduledFor,
                status: SeasonalServiceStatus.SCHEDULED,
              },
            },
          },
          include: { services: true },
        })
      } else {
        if (clean(body.accessCode) || clean(body.serviceNotes)) {
          enrollment = await prisma.seasonalEnrollment.update({
            where: { id: enrollment.id },
            data: {
              accessCode: clean(body.accessCode) || enrollment.accessCode,
              serviceNotes: clean(body.serviceNotes) || enrollment.serviceNotes,
            },
            include: { services: true },
          })
        }
      }

      let enrollmentService = enrollment.services.find((service) => service.serviceType === serviceType)
      if (!enrollmentService) {
        enrollmentService = await prisma.seasonalEnrollmentService.create({
          data: {
            enrollmentId: enrollment.id,
            serviceType,
            cadenceLabel: serviceType === 'WEEKLY' ? 'Weekly pool service' : null,
            targetDate: scheduledFor,
            status: SeasonalServiceStatus.SCHEDULED,
          },
        })
      } else if (enrollmentService.status === SeasonalServiceStatus.NOT_STARTED) {
        enrollmentService = await prisma.seasonalEnrollmentService.update({
          where: { id: enrollmentService.id },
          data: { status: SeasonalServiceStatus.SCHEDULED, targetDate: enrollmentService.targetDate || scheduledFor },
        })
      }

      const weeklyOccurrences = serviceType === 'WEEKLY'
        ? await prisma.seasonalOccurrence.findMany({
            where: { enrollmentServiceId: enrollmentService.id, scheduledFor: { not: null } },
            select: { scheduledFor: true, status: true },
          })
        : []
      const occurrenceDates = serviceType === 'WEEKLY'
        ? weeklyDatesToCreate(scheduledFor, weeklyOccurrences)
        : [scheduledFor]
      const occurrences = await prisma.$transaction(
        occurrenceDates.map((occurrenceDate) =>
          prisma.seasonalOccurrence.create({
            data: {
              enrollmentId: enrollment.id,
              enrollmentServiceId: enrollmentService.id,
              scheduledFor: occurrenceDate,
              assignedTo: clean(body.assignedTo) || null,
              notes: clean(body.notes) || null,
              status: SeasonalOccurrenceStatus.SCHEDULED,
              createdByUserId: sessionUser.id,
              updatedByUserId: sessionUser.id,
            },
          })
        )
      )
      return NextResponse.json({ enrollmentId: enrollment.id, occurrences }, { status: 201 })
    }

    if (action === 'create_enrollment') {
      const customerId = clean(body.customerId)
      const propertyId = clean(body.propertyId)
      const serviceTypes = valuesFrom(body.serviceTypes, ['OPEN', 'WEEKLY', 'CLOSE', 'ADDITIONAL'])
      if (!customerId || !propertyId || serviceTypes.length === 0) {
        return NextResponse.json({ error: 'Choose a customer, one of their properties, and at least one pool service.' }, { status: 400 })
      }

      const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { id: true, customerId: true, city: true } })
      if (!property || property.customerId !== customerId) {
        return NextResponse.json({ error: 'The selected property does not belong to this customer.' }, { status: 400 })
      }

      const season = await getOrCreateActiveSeason(program)
      const existing = await prisma.seasonalEnrollment.findFirst({
        where: { seasonId: season.id, propertyId },
        select: { id: true },
      })
      if (existing) {
        return NextResponse.json({ error: 'This property already has a Pool Services record for the active season.' }, { status: 409 })
      }

      const targetDates = body.targetDates && typeof body.targetDates === 'object' ? body.targetDates as Record<string, unknown> : {}
      const enrollment = await prisma.seasonalEnrollment.create({
        data: {
          seasonId: season.id,
          customerId,
          propertyId,
          town: clean(body.town) || property.city,
          primaryPhone: clean(body.primaryPhone) || null,
          primaryEmail: clean(body.primaryEmail) || null,
          accessCode: clean(body.accessCode) || null,
          serviceNotes: clean(body.serviceNotes) || null,
          operationalNotes: clean(body.operationalNotes) || null,
          services: {
            create: serviceTypes.map((serviceType) => ({
              serviceType,
              cadenceLabel: serviceType === 'WEEKLY' ? 'Weekly pool service' : null,
              targetDate: parseDate(targetDates[serviceType]),
              status: parseDate(targetDates[serviceType]) ? SeasonalServiceStatus.SCHEDULED : SeasonalServiceStatus.NOT_STARTED,
            })),
          },
        },
        include: { services: true },
      })

      return NextResponse.json({ enrollment }, { status: 201 })
    }

    if (action === 'create_visit') {
      const enrollmentId = clean(body.enrollmentId)
      const enrollmentServiceId = clean(body.enrollmentServiceId) || null
      const scheduledFor = parseDate(body.scheduledFor)
      if (!enrollmentId || !scheduledFor) {
        return NextResponse.json({ error: 'Choose a pool record and schedule the visit.' }, { status: 400 })
      }

      const enrollment = await prisma.seasonalEnrollment.findUnique({
        where: { id: enrollmentId },
        include: { season: { select: { program: { select: { code: true } } } }, services: { select: { id: true } } },
      })
      if (!enrollment || enrollment.season.program.code !== config.code) {
        return NextResponse.json({ error: `${config.title} record not found.` }, { status: 404 })
      }
      if (enrollmentServiceId && !enrollment.services.some((service) => service.id === enrollmentServiceId)) {
        return NextResponse.json({ error: 'That service does not belong to the selected pool record.' }, { status: 400 })
      }

      const occurrence = await prisma.seasonalOccurrence.create({
        data: {
          enrollmentId,
          enrollmentServiceId,
          scheduledFor,
          assignedTo: clean(body.assignedTo) || null,
          notes: clean(body.notes) || null,
          status: SeasonalOccurrenceStatus.SCHEDULED,
          createdByUserId: sessionUser.id,
          updatedByUserId: sessionUser.id,
        },
      })
      return NextResponse.json({ occurrence }, { status: 201 })
    }

    if (action === 'create_issue') {
      const enrollmentId = clean(body.enrollmentId)
      const description = clean(body.description)
      const category = clean(body.category) as SeasonalIssueCategory
      const priority = clean(body.priority) as SeasonalIssuePriority
      const categories = Object.values(SeasonalIssueCategory)
      const priorities = Object.values(SeasonalIssuePriority)
      if (!enrollmentId || !description || !categories.includes(category) || !priorities.includes(priority)) {
        return NextResponse.json({ error: 'Choose a pool record, category, priority, and describe the issue.' }, { status: 400 })
      }

      const issueEnrollment = await prisma.seasonalEnrollment.findUnique({
        where: { id: enrollmentId },
        select: { season: { select: { program: { select: { code: true } } } } },
      })
      if (!issueEnrollment || issueEnrollment.season.program.code !== config.code) {
        return NextResponse.json({ error: `${config.title} record not found.` }, { status: 404 })
      }

      const issue = await prisma.seasonalIssue.create({
        data: {
          enrollmentId,
          category,
          priority,
          description,
          notes: clean(body.notes) || null,
          createdByUserId: sessionUser.id,
          updatedByUserId: sessionUser.id,
        },
      })
      return NextResponse.json({ issue }, { status: 201 })
    }

    if (action === 'update_visit') {
      const occurrenceId = clean(body.occurrenceId)
      const status = clean(body.status) as SeasonalOccurrenceStatus
      if (!occurrenceId || !Object.values(SeasonalOccurrenceStatus).includes(status)) {
        return NextResponse.json({ error: 'A visit and valid status are required.' }, { status: 400 })
      }

      const existingOccurrence = await prisma.seasonalOccurrence.findUnique({
        where: { id: occurrenceId },
        include: { enrollment: { include: { season: { include: { program: { select: { code: true } } } } } } },
      })
      if (!existingOccurrence || existingOccurrence.enrollment.season.program.code !== config.code) {
        return NextResponse.json({ error: `${config.title} visit not found.` }, { status: 404 })
      }

      const hasScheduleChange = Object.prototype.hasOwnProperty.call(body, 'scheduledFor')
      const newSchedule = hasScheduleChange ? parseDate(body.scheduledFor) : undefined
      if (hasScheduleChange && !newSchedule) {
        return NextResponse.json({ error: 'Enter a valid date and time for this visit.' }, { status: 400 })
      }
      const occurrence = await prisma.seasonalOccurrence.update({
        where: { id: occurrenceId },
        data: {
          status,
          completedAt: status === SeasonalOccurrenceStatus.COMPLETED ? new Date() : null,
          ...(newSchedule ? { scheduledFor: newSchedule } : {}),
          ...(Object.prototype.hasOwnProperty.call(body, 'assignedTo') ? { assignedTo: clean(body.assignedTo) || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body, 'notes') ? { notes: clean(body.notes) || null } : {}),
          updatedByUserId: sessionUser.id,
        },
      })
      return NextResponse.json({ occurrence })
    }

    if (action === 'generate_weekly_visits') {
      const enrollmentId = clean(body.enrollmentId)
      if (!enrollmentId) return NextResponse.json({ error: 'Choose a Pool Services record first.' }, { status: 400 })

      const enrollment = await prisma.seasonalEnrollment.findUnique({
        where: { id: enrollmentId },
        include: {
          season: { include: { program: { select: { code: true } } } },
          services: { where: { serviceType: 'WEEKLY' }, select: { id: true, targetDate: true } },
          occurrences: { where: { enrollmentServiceId: { not: null }, scheduledFor: { not: null } }, select: { scheduledFor: true, status: true } },
        },
      })
      if (!enrollment || enrollment.season.program.code !== SeasonalProgramCode.POOL_SERVICES) {
        return NextResponse.json({ error: 'Pool record not found.' }, { status: 404 })
      }
      const weeklyService = enrollment.services[0]
      if (!weeklyService) return NextResponse.json({ error: 'This pool record does not include Weekly service.' }, { status: 400 })

      const anchor = weeklyService.targetDate || enrollment.occurrences[0]?.scheduledFor
      if (!anchor) return NextResponse.json({ error: 'Set the first weekly visit date before generating the calendar.' }, { status: 400 })
      const weeklyOccurrences = await prisma.seasonalOccurrence.findMany({
        where: { enrollmentServiceId: weeklyService.id, scheduledFor: { not: null } },
        select: { scheduledFor: true, status: true },
      })
      const datesToCreate = weeklyDatesToCreate(anchor, weeklyOccurrences)
      if (datesToCreate.length > 0) {
        await prisma.seasonalOccurrence.createMany({
          data: datesToCreate.map((scheduledFor) => ({
            enrollmentId,
            enrollmentServiceId: weeklyService.id,
            scheduledFor,
            status: SeasonalOccurrenceStatus.SCHEDULED,
            createdByUserId: sessionUser.id,
            updatedByUserId: sessionUser.id,
          })),
        })
      }
      return NextResponse.json({ createdCount: datesToCreate.length })
    }

    if (action === 'reschedule_weekly_route') {
      const enrollmentServiceId = clean(body.enrollmentServiceId)
      const firstScheduledFor = parseDate(body.firstScheduledFor)
      if (!enrollmentServiceId || !firstScheduledFor) {
        return NextResponse.json({ error: 'Choose the first date and time for the new weekly route.' }, { status: 400 })
      }

      const weeklyService = await prisma.seasonalEnrollmentService.findUnique({
        where: { id: enrollmentServiceId },
        include: {
          enrollment: { include: { season: { include: { program: { select: { code: true } } } } } },
        },
      })
      if (!weeklyService || weeklyService.serviceType !== 'WEEKLY' || weeklyService.enrollment.season.program.code !== SeasonalProgramCode.POOL_SERVICES) {
        return NextResponse.json({ error: 'Weekly route not found.' }, { status: 404 })
      }
      if (weeklyService.status === SeasonalServiceStatus.CANCELLED) {
        return NextResponse.json({ error: 'Turn the weekly route back on before changing its schedule.' }, { status: 400 })
      }

      const now = new Date()
      if (firstScheduledFor < now) {
        return NextResponse.json({ error: 'The first new weekly visit must be in the future.' }, { status: 400 })
      }

      const futureVisits = await prisma.seasonalOccurrence.findMany({
        where: {
          enrollmentServiceId,
          scheduledFor: { gte: now },
          status: SeasonalOccurrenceStatus.SCHEDULED,
        },
        orderBy: { scheduledFor: 'asc' },
        select: { id: true },
      })

      await prisma.$transaction([
        prisma.seasonalEnrollmentService.update({
          where: { id: enrollmentServiceId },
          data: { targetDate: firstScheduledFor, status: SeasonalServiceStatus.SCHEDULED },
        }),
        ...futureVisits.map((visit, index) =>
          prisma.seasonalOccurrence.update({
            where: { id: visit.id },
            data: { scheduledFor: addWeeks(firstScheduledFor, index), updatedByUserId: sessionUser.id },
          })
        ),
      ])

      const allWeeklyVisits = await prisma.seasonalOccurrence.findMany({
        where: { enrollmentServiceId, scheduledFor: { not: null } },
        select: { scheduledFor: true, status: true },
      })
      const datesToCreate = weeklyDatesToCreate(firstScheduledFor, allWeeklyVisits)
      if (datesToCreate.length > 0) {
        await prisma.seasonalOccurrence.createMany({
          data: datesToCreate.map((scheduledFor) => ({
            enrollmentId: weeklyService.enrollmentId,
            enrollmentServiceId,
            scheduledFor,
            status: SeasonalOccurrenceStatus.SCHEDULED,
            createdByUserId: sessionUser.id,
            updatedByUserId: sessionUser.id,
          })),
        })
      }

      return NextResponse.json({ movedCount: futureVisits.length, createdCount: datesToCreate.length })
    }

    if (action === 'stop_service') {
      const enrollmentServiceId = clean(body.enrollmentServiceId)
      if (!enrollmentServiceId) return NextResponse.json({ error: 'Choose a service to stop.' }, { status: 400 })

      const service = await prisma.seasonalEnrollmentService.findUnique({
        where: { id: enrollmentServiceId },
        include: { enrollment: { include: { season: { include: { program: { select: { code: true } } } } } } },
      })
      if (!service || service.enrollment.season.program.code !== SeasonalProgramCode.POOL_SERVICES) {
        return NextResponse.json({ error: 'Pool service not found.' }, { status: 404 })
      }

      const now = new Date()
      const [, cancelledVisits] = await prisma.$transaction([
        prisma.seasonalEnrollmentService.update({
          where: { id: enrollmentServiceId },
          data: { status: SeasonalServiceStatus.CANCELLED },
        }),
        prisma.seasonalOccurrence.updateMany({
          where: {
            enrollmentServiceId,
            scheduledFor: { gte: now },
            status: SeasonalOccurrenceStatus.SCHEDULED,
          },
          data: {
            status: SeasonalOccurrenceStatus.CANCELLED,
            updatedByUserId: sessionUser.id,
          },
        }),
      ])
      return NextResponse.json({ cancelledVisits: cancelledVisits.count })
    }

    return NextResponse.json({ error: 'Unsupported Pool Services action.' }, { status: 400 })
  } catch (error) {
    console.error('Error updating Pool Services operations:', error)
    return NextResponse.json({ error: 'Unable to update Pool Services right now.' }, { status: 500 })
  }
}
