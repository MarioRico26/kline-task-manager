import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionUser } from '@/lib/sessionUser'
import { getSeasonalProgramConfig } from '@/lib/seasonalPrograms'
import { buildPoolWorkbookPreview } from '@/lib/poolWorkbookPreview'

export const runtime = 'nodejs'

function canAccessSeasonalPrograms(sessionUser: Awaited<ReturnType<typeof getSessionUser>>) {
  return sessionUser && sessionUser.canAccessSeasonalPrograms && sessionUser.accessScope !== 'PERMITS_ONLY'
}

export async function POST(request: Request, context: { params: Promise<{ program: string }> }) {
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

    if (config.key !== 'pool-services') {
      return NextResponse.json({ error: 'Import preview is only enabled for Pool Services right now.' }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Please attach an Excel workbook file.' }, { status: 400 })
    }

    if (!/\.xlsx$/i.test(file.name)) {
      return NextResponse.json({ error: 'Please upload a .xlsx workbook for the preview.' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    const [properties, customers] = await Promise.all([
      prisma.property.findMany({
        select: {
          id: true,
          address: true,
          city: true,
          state: true,
          zip: true,
          customer: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
            },
          },
        },
      }),
      prisma.customer.findMany({
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
        },
      }),
    ])

    const preview = buildPoolWorkbookPreview({
      fileName: file.name,
      fileBuffer: buffer,
      properties,
      customers,
    })

    return NextResponse.json(preview)
  } catch (error) {
    console.error('Pool import preview error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to build the import preview.' },
      { status: 500 }
    )
  }
}
