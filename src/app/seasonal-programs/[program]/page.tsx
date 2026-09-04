'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSeasonalProgramConfig } from '@/lib/seasonalPrograms'

type PoolImportPreview = {
  fileName: string
  selectedSheet: string
  availableSheets: string[]
  summary: {
    totalRows: number
    matchedRows: number
    reviewRows: number
    unmatchedRows: number
    duplicateRows: number
    exactPropertyMatches: number
    addressOnlyMatches: number
    customerOnlyMatches: number
  }
  rows: Array<{
    rowNumber: number
    lastName: string
    address: string
    town: string
    phone: string
    email: string
    serviceLabels: string[]
    waterStatus: string
    swimReadyDate: string | null
    closeDate: string | null
    accessCode: string
    notes: string
    workbookDuplicate: boolean
    warnings: string[]
    matchStatus: 'matched' | 'review' | 'unmatched'
    matchedProperty: {
      id: string
      label: string
      city: string
      state: string
      zip: string
      matchReason: string
    } | null
    matchedCustomer: {
      id: string
      fullName: string
      email: string
      phone: string
      matchReason: string
    } | null
  }>
}

type ProgramOverview = {
  program: {
    code: string
    title: string
    subtitle: string
  }
  season: {
    id: string
    label: string
    year: number
    status: string
    startsAt: string | null
    endsAt: string | null
  } | null
  stats: {
    enrollments: number
    activeEnrollments: number
    openIssues: number
    urgentIssues: number
    upcomingOccurrences: number
    servicesInProgress: number
    completedServices: number
  }
  roster: Array<{
    id: string
    customerId: string
    propertyId: string
    customerName: string
    customerEmail: string
    customerPhone: string | null
    propertyLabel: string
    town: string | null
    status: string
    accessCode: string | null
    serviceNotes: string | null
    operationalNotes: string | null
    services: Array<{
      id: string
      label: string
      cadenceLabel: string | null
      status: string
      targetDate: string | null
      completionDate: string | null
    }>
    openIssueCount: number
    highestIssuePriority: string | null
    nextOccurrence: {
      id: string
      scheduledFor: string | null
      status: string
    } | null
  }>
  issues: Array<{
    id: string
    category: string
    priority: string
    status: string
    description: string
    openedAt: string
    customerName: string
    propertyAddress: string
  }>
  upcomingOccurrences: Array<{
    id: string
    scheduledFor: string | null
    status: string
    customerName: string
    propertyAddress: string
    serviceLabel: string
  }>
}

type PoolOperations = {
  customers: Array<{
    id: string
    fullName: string
    email: string
    phone: string
    properties: Array<{ id: string; address: string; city: string; state: string; zip: string }>
  }>
  workTypes: Array<{
    id: string
    code: string
    label: string
    description: string | null
    isActive: boolean
  }>
}

type PoolCalendarVisit = {
  id: string
  scheduledFor: string
  status: string
  assignedTo: string | null
  notes: string | null
  serviceLabel: string
  customerName: string
  propertyLabel: string
}

function localDateKey(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function calendarRange(month: Date) {
  const from = new Date(month.getFullYear(), month.getMonth(), 1)
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 1)
  return { from: localDateKey(from), to: localDateKey(to) }
}

function dateTimeLocalValue(value: string) {
  const date = new Date(value)
  return `${localDateKey(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function nextFutureWeeklyValue(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  while (date <= new Date()) date.setDate(date.getDate() + 7)
  return dateTimeLocalValue(date.toISOString())
}

function formatEnumLabel(value: string | null | undefined) {
  if (!value) return '—'
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function servicePlanLabel(value: string) {
  if (value === 'Open') return 'Opening visit'
  if (value === 'Weekly') return 'Weekly route'
  if (value === 'Close') return 'Closing visit'
  if (value === 'Additional') return 'Additional work'
  return value
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Not scheduled'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not scheduled'
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function SeasonalProgramDetailPage() {
  const router = useRouter()
  const params = useParams<{ program: string }>()
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [overview, setOverview] = useState<ProgramOverview | null>(null)
  const [loadingOverview, setLoadingOverview] = useState(false)
  const [overviewError, setOverviewError] = useState('')
  const [importPreview, setImportPreview] = useState<PoolImportPreview | null>(null)
  const [importPreviewError, setImportPreviewError] = useState('')
  const [importPreviewLoading, setImportPreviewLoading] = useState(false)
  const [previewFilter, setPreviewFilter] = useState<'all' | 'matched' | 'review' | 'unmatched'>('all')
  const [operations, setOperations] = useState<PoolOperations | null>(null)
  const [operationsError, setOperationsError] = useState('')
  const [operationsLoading, setOperationsLoading] = useState(false)
  const [operationsBusy, setOperationsBusy] = useState(false)
  const [operationsNotice, setOperationsNotice] = useState('')
  const [newEnrollmentCustomerId, setNewEnrollmentCustomerId] = useState('')
  const [newJobPropertyId, setNewJobPropertyId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [calendarVisits, setCalendarVisits] = useState<PoolCalendarVisit[]>([])
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [calendarError, setCalendarError] = useState('')
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => localDateKey(new Date()))
  const [visitDraftDate, setVisitDraftDate] = useState('')
  const [activeOperationPanel, setActiveOperationPanel] = useState<'job' | 'issue' | null>(null)
  const [editingVisit, setEditingVisit] = useState<PoolCalendarVisit | null>(null)
  const [managingEnrollment, setManagingEnrollment] = useState<ProgramOverview['roster'][number] | null>(null)
  const [changingWeeklyService, setChangingWeeklyService] = useState<{ id: string; targetDate: string | null } | null>(null)
  const [jobServiceType, setJobServiceType] = useState('')
  const synchronizedWeeklyEnrollments = useRef(new Set<string>())

  const config = useMemo(() => getSeasonalProgramConfig(params?.program || ''), [params])

  useEffect(() => {
    let cancelled = false

    async function checkAccess() {
      try {
        const res = await fetch('/api/auth/check', { cache: 'no-store' })
        if (!res.ok) {
          router.replace('/auth/login')
          return
        }

        const data = (await res.json()) as {
          user?: { canAccessSeasonalPrograms?: boolean; accessScope?: 'ALL' | 'PERMITS_ONLY' }
        }

        if (cancelled) return

        const canAccess = data.user?.canAccessSeasonalPrograms === true && data.user?.accessScope !== 'PERMITS_ONLY'
        setAuthorized(canAccess)

        if (!canAccess) {
          router.replace(data.user?.accessScope === 'PERMITS_ONLY' ? '/tasks' : '/dashboard')
        }
      } catch {
        if (!cancelled) {
          setAuthorized(false)
          router.replace('/dashboard')
        }
      }
    }

    checkAccess()
    return () => {
      cancelled = true
    }
  }, [router])

  useEffect(() => {
    let cancelled = false

    async function loadOverview() {
      if (!config || authorized !== true) return

      try {
        setLoadingOverview(true)
        setOverviewError('')
        const response = await fetch(`/api/seasonal-programs/${config.key}/overview`, { cache: 'no-store' })
        const data = (await response.json().catch(() => null)) as ProgramOverview | { error?: string } | null
        if (!response.ok) {
          throw new Error(data && 'error' in data ? data.error || 'Unable to load program data' : 'Unable to load program data')
        }
        if (!cancelled) {
          setOverview(data as ProgramOverview)
        }
      } catch (error) {
        if (!cancelled) {
          setOverviewError(error instanceof Error ? error.message : 'Unable to load program data')
        }
      } finally {
        if (!cancelled) setLoadingOverview(false)
      }
    }

    loadOverview()

    return () => {
      cancelled = true
    }
  }, [authorized, config, refreshKey])

  useEffect(() => {
    if (!config || config.key !== 'pool-services' || authorized !== true || !overview) return
    const programKey = config.key
    const weeklyRows = overview.roster.filter(
      (row) => row.services.some((service) => service.label === 'Weekly' && service.status !== 'CANCELLED') && !synchronizedWeeklyEnrollments.current.has(row.id)
    )
    if (weeklyRows.length === 0) return

    weeklyRows.forEach((row) => synchronizedWeeklyEnrollments.current.add(row.id))
    let cancelled = false

    async function synchronizeWeeklyWork() {
      const results = await Promise.all(
        weeklyRows.map(async (row) => {
          const response = await fetch(`/api/seasonal-programs/${programKey}/operations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'generate_weekly_visits', enrollmentId: row.id }),
          })
          if (!response.ok) return 0
          const data = (await response.json().catch(() => null)) as { createdCount?: number } | null
          return data?.createdCount || 0
        })
      )
      if (!cancelled && results.some((count) => count > 0)) setRefreshKey((value) => value + 1)
    }

    void synchronizeWeeklyWork()
    return () => {
      cancelled = true
    }
  }, [authorized, config, overview])

  useEffect(() => {
    let cancelled = false

    async function loadCalendar() {
      if (!config || authorized !== true) return
      const range = calendarRange(calendarMonth)
      try {
        setCalendarLoading(true)
        setCalendarError('')
        const response = await fetch(`/api/seasonal-programs/${config.key}/calendar?from=${range.from}&to=${range.to}`, { cache: 'no-store' })
        const data = (await response.json().catch(() => null)) as { visits?: PoolCalendarVisit[]; error?: string } | null
        if (!response.ok) throw new Error(data?.error || 'Unable to load the calendar.')
        if (!cancelled) setCalendarVisits(data?.visits || [])
      } catch (error) {
        if (!cancelled) setCalendarError(error instanceof Error ? error.message : 'Unable to load the calendar.')
      } finally {
        if (!cancelled) setCalendarLoading(false)
      }
    }

    loadCalendar()
    return () => {
      cancelled = true
    }
  }, [authorized, calendarMonth, config, refreshKey])

  useEffect(() => {
    let cancelled = false

    async function loadOperations() {
      if (!config || authorized !== true) return

      try {
        setOperationsLoading(true)
        setOperationsError('')
        const response = await fetch(`/api/seasonal-programs/${config.key}/operations`, { cache: 'no-store' })
        const data = (await response.json().catch(() => null)) as PoolOperations | { error?: string } | null
        if (!response.ok) {
          throw new Error(data && 'error' in data ? data.error || `Unable to load ${config.title} setup.` : `Unable to load ${config.title} setup.`)
        }
        if (!cancelled) setOperations(data as PoolOperations)
      } catch (error) {
        if (!cancelled) setOperationsError(error instanceof Error ? error.message : `Unable to load ${config.title} setup.`)
      } finally {
        if (!cancelled) setOperationsLoading(false)
      }
    }

    loadOperations()
    return () => {
      cancelled = true
    }
  }, [authorized, config, refreshKey])

  const previewRows = useMemo(() => {
    if (!importPreview) return []
    if (previewFilter === 'all') return importPreview.rows
    return importPreview.rows.filter((row) => row.matchStatus === previewFilter)
  }, [importPreview, previewFilter])

  const selectedEnrollmentCustomer = useMemo(
    () => operations?.customers.find((customer) => customer.id === newEnrollmentCustomerId) || null,
    [operations, newEnrollmentCustomerId]
  )

  const customerSearchResults = useMemo(() => {
    const query = customerSearch.trim().toLowerCase()
    if (!query) return []
    return (operations?.customers || [])
      .filter((customer) => {
        const searchable = [
          customer.fullName,
          customer.email,
          customer.phone,
          ...customer.properties.map((property) => `${property.address} ${property.city} ${property.state} ${property.zip}`),
        ]
          .join(' ')
          .toLowerCase()
        return searchable.includes(query)
      })
      .slice(0, 8)
  }, [customerSearch, operations])

  const availableWorkTypes = useMemo(() => {
    if (config?.key === 'maintenance' && operations?.workTypes?.length) return operations.workTypes
    return (config?.operationalServices || []).map((service) => ({
      id: service.value,
      code: service.value,
      label: service.label,
      description: service.description || null,
      isActive: service.isActive !== false,
    }))
  }, [config, operations])

  const calendarDays = useMemo(() => {
    const firstOfMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1)
    const start = new Date(firstOfMonth)
    start.setDate(firstOfMonth.getDate() - firstOfMonth.getDay())
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start)
      day.setDate(start.getDate() + index)
      return day
    })
  }, [calendarMonth])

  const visitsByDate = useMemo(() => {
    const grouped = new Map<string, PoolCalendarVisit[]>()
    for (const visit of calendarVisits) {
      const key = localDateKey(new Date(visit.scheduledFor))
      grouped.set(key, [...(grouped.get(key) || []), visit])
    }
    return grouped
  }, [calendarVisits])

  const selectedCalendarVisits = visitsByDate.get(selectedCalendarDate) || []

  async function handlePoolPreviewUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const fileInput = form.elements.namedItem('poolWorkbook') as HTMLInputElement | null
    const file = fileInput?.files?.[0]

    if (!file || !config) {
      setImportPreviewError('Choose the Pool Services workbook first.')
      return
    }

    const body = new FormData()
    body.append('file', file)

    try {
      setImportPreviewLoading(true)
      setImportPreviewError('')
      const response = await fetch(`/api/seasonal-programs/${config.key}/import-preview`, {
        method: 'POST',
        body,
      })
      const data = (await response.json().catch(() => null)) as PoolImportPreview | { error?: string } | null
      if (!response.ok) {
        throw new Error(data && 'error' in data ? data.error || 'Unable to build the import preview' : 'Unable to build the import preview')
      }
      setImportPreview(data as PoolImportPreview)
      setPreviewFilter('all')
    } catch (error) {
      setImportPreview(null)
      setImportPreviewError(error instanceof Error ? error.message : 'Unable to build the import preview')
    } finally {
      setImportPreviewLoading(false)
    }
  }

  async function submitPoolOperation(payload: Record<string, unknown>, successMessage: string) {
    if (!config) return false
    try {
      setOperationsBusy(true)
      setOperationsError('')
      setOperationsNotice('')
      const response = await fetch(`/api/seasonal-programs/${config.key}/operations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(data?.error || `${config.title} could not be updated.`)
      setOperationsNotice(successMessage)
      setRefreshKey((value) => value + 1)
      return true
    } catch (error) {
      setOperationsError(error instanceof Error ? error.message : `${config.title} could not be updated.`)
      return false
    } finally {
      setOperationsBusy(false)
    }
  }

  async function handleCreatePoolJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const created = await submitPoolOperation(
      {
        action: 'create_job',
        customerId: formData.get('customerId'),
        propertyId: formData.get('propertyId'),
        serviceType: formData.get('serviceType'),
        scheduledFor: formData.get('scheduledFor'),
        assignedTo: formData.get('assignedTo'),
        accessCode: formData.get('accessCode'),
        serviceNotes: formData.get('serviceNotes'),
        notes: formData.get('notes'),
      },
      `${config?.title || 'Seasonal'} work was created and added to the calendar.`
    )
    if (created) {
      form.reset()
      setNewEnrollmentCustomerId('')
      setNewJobPropertyId('')
      setCustomerSearch('')
      setVisitDraftDate('')
      setJobServiceType('')
      setActiveOperationPanel(null)
    }
  }

  async function handleCreateIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const created = await submitPoolOperation(
      {
        action: 'create_issue',
        enrollmentId: formData.get('enrollmentId'),
        category: formData.get('category'),
        priority: formData.get('priority'),
        description: formData.get('description'),
        notes: formData.get('notes'),
      },
      `${config?.title || 'Seasonal'} issue logged. It is now visible in the open issue queue.`
    )
    if (created) {
      form.reset()
      setActiveOperationPanel(null)
    }
  }

  async function updateVisitStatus(occurrenceId: string, status: 'IN_PROGRESS' | 'COMPLETED') {
    await submitPoolOperation(
      { action: 'update_visit', occurrenceId, status },
      status === 'COMPLETED' ? 'Visit marked complete.' : 'Visit marked in progress.'
    )
  }

  async function updateMaintenanceWorkType(code: string, isActive: boolean) {
    await submitPoolOperation(
      { action: 'update_work_catalog', code, isActive },
      `${isActive ? 'Enabled' : 'Paused'} work type. This changes what can be scheduled going forward.`
    )
  }

  async function stopPoolService(serviceId: string, serviceLabel: string) {
    if (!window.confirm(`Stop ${serviceLabel} for this property and cancel its future scheduled visits? Completed history will remain.`)) return
    const stopped = await submitPoolOperation(
      { action: 'stop_service', enrollmentServiceId: serviceId },
      `${serviceLabel} was stopped. Future scheduled visits were removed from the calendar.`
    )
    if (stopped) setManagingEnrollment(null)
  }

  async function handleWeeklyRouteChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!changingWeeklyService) return
    const formData = new FormData(event.currentTarget)
    const saved = await submitPoolOperation(
      {
        action: 'reschedule_weekly_route',
        enrollmentServiceId: changingWeeklyService.id,
        firstScheduledFor: formData.get('firstScheduledFor'),
      },
      'Weekly route updated. Future visits were moved; completed history was kept.'
    )
    if (saved) {
      setChangingWeeklyService(null)
      setManagingEnrollment(null)
    }
  }

  async function handleEditVisit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingVisit) return
    const formData = new FormData(event.currentTarget)
    const saved = await submitPoolOperation(
      {
        action: 'update_visit',
        occurrenceId: editingVisit.id,
        status: formData.get('status'),
        scheduledFor: formData.get('scheduledFor'),
        assignedTo: formData.get('assignedTo'),
        notes: formData.get('notes'),
      },
      'Weekly visit updated.'
    )
    if (saved) setEditingVisit(null)
  }

  function openScheduledVisit(visit: { scheduledFor: string | null }) {
    if (!visit.scheduledFor) return
    const date = new Date(visit.scheduledFor)
    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    setSelectedCalendarDate(localDateKey(date))
  }

  if (!config) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--kline-gray-light)' }}>
        <div className="kline-card" style={{ padding: '2rem 2.5rem', textAlign: 'center' }}>
          <h2 style={{ margin: 0, color: 'var(--kline-text)' }}>Program not found</h2>
          <p style={{ margin: '0.75rem 0 0', color: 'var(--kline-text-light)' }}>This category is not configured yet.</p>
          <button className="kline-btn-primary" style={{ marginTop: '1rem' }} onClick={() => router.push('/seasonal-programs')}>
            Back to Seasonal Programs
          </button>
        </div>
      </div>
    )
  }

  if (authorized === null) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--kline-gray-light)' }}>
        <div className="kline-card" style={{ padding: '2rem 2.5rem', textAlign: 'center' }}>
          <h2 style={{ margin: 0, color: 'var(--kline-text)' }}>Loading {config.title}…</h2>
          <p style={{ margin: '0.75rem 0 0', color: 'var(--kline-text-light)' }}>Checking access and preparing the category shell.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--kline-gray-light)' }}>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-icon">K</div>
            <div>
              <h1>
                {config.title.toUpperCase()} <span>PROGRAM</span>
              </h1>
              <p>{config.subtitle}</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="ghost-btn" onClick={() => router.push('/seasonal-programs')}>
              Seasonal Programs
            </button>
            <button className="ghost-btn" onClick={() => router.push('/dashboard')}>
              Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <section className="hero" style={{ marginBottom: '1.75rem' }}>
          <div>
            <p className="hero-overline">Operational Workspace</p>
            <h2>{config.title}</h2>
            <p className="hero-subtitle">{config.summary}</p>
          </div>
        </section>

        {config.key === 'maintenance' && (
          <section className="kline-card" style={{ padding: '1.35rem', marginBottom: '1.5rem', borderTop: `4px solid ${config.accent}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'start' }}>
              <div>
                <div style={{ color: config.accent, fontWeight: 900, fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Maintenance work catalog</div>
                <h3 style={{ margin: '0.35rem 0 0', color: 'var(--kline-text)' }}>Start with the work your team uses today</h3>
                <p style={{ margin: '0.45rem 0 0', color: 'var(--kline-text-light)', maxWidth: 720 }}>
                  Only active work types can be scheduled. The remaining types are visible here so we can turn them on deliberately when the process is ready.
                </p>
              </div>
              <Pill tone="success">{availableWorkTypes.filter((service) => service.isActive).length} active</Pill>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
              {availableWorkTypes.map((service) => {
                const active = service.isActive
                return (
                  <div key={service.code} style={{ padding: '0.85rem', border: `1px solid ${active ? 'rgba(25,135,84,.22)' : 'var(--kline-gray)'}`, borderRadius: 14, background: active ? '#f2fbf5' : '#fafbfc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'start' }}>
                      <strong style={{ color: 'var(--kline-text)' }}>{service.label}</strong>
                      <Pill tone={active ? 'success' : 'neutral'}>{active ? 'Active' : 'Later'}</Pill>
                    </div>
                    {service.description && <div style={{ marginTop: 6, fontSize: '0.84rem', lineHeight: 1.4, color: 'var(--kline-text-light)' }}>{service.description}</div>}
                    <button type="button" className={active ? 'ghost-btn' : 'kline-btn-primary'} disabled={operationsBusy || !operations} onClick={() => updateMaintenanceWorkType(service.code, !active)} style={{ marginTop: '0.8rem', width: '100%' }}>
                      {active ? 'Pause Type' : 'Activate Type'}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {(
          <>
            {loadingOverview && (
              <section className="kline-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, color: 'var(--kline-text)' }}>Loading {config.title} workspace…</h3>
                <p style={{ margin: '0.5rem 0 0', color: 'var(--kline-text-light)' }}>
                  Pulling enrollments, open issues and upcoming visits.
                </p>
              </section>
            )}

            {!loadingOverview && overviewError && (
              <section className="kline-card" style={{ padding: '1.4rem', marginBottom: '1.5rem', borderLeft: '4px solid #c81e1e' }}>
                <h3 style={{ margin: 0, color: 'var(--kline-text)' }}>{config.title} data could not load</h3>
                <p style={{ margin: '0.5rem 0 0', color: '#c81e1e' }}>{overviewError}</p>
              </section>
            )}

            {!loadingOverview && !overviewError && overview && (
              <>
                <section
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(320px, 1.3fr) repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '1rem',
                    marginBottom: '1.5rem',
                  }}
                >
                  <div
                    className="kline-card"
                    style={{
                      padding: '1.5rem',
                      background:
                        'radial-gradient(circle at top right, rgba(253, 126, 20, 0.14), transparent 28%), linear-gradient(180deg, #ffffff 0%, #fff8f2 100%)',
                      borderTop: `4px solid ${config.accent}`,
                    }}
                  >
                    <div style={{ color: 'var(--kline-text-light)', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Current Season
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--kline-text)', marginTop: 8 }}>
                      {overview.season ? `${overview.season.label} ${overview.season.year}` : 'No season'}
                    </div>
                    <div style={{ color: 'var(--kline-text-light)', marginTop: 6 }}>
                      {overview.season
                        ? `${formatEnumLabel(overview.season.status)} season loaded for ${config.title}.`
                        : 'Create or activate a season to begin operational tracking.'}
                    </div>
                  </div>

                  <StatCard label="Enrollments" value={overview.stats.enrollments} detail={`${overview.stats.activeEnrollments} active`} accent={config.accent} />
                  <StatCard label="Open Issues" value={overview.stats.openIssues} detail={`${overview.stats.urgentIssues} urgent / high`} accent="#dc3545" />
                  <StatCard label="Upcoming Visits" value={overview.stats.upcomingOccurrences} detail="Scheduled or in progress" accent="#0d6efd" />
                  <StatCard label="Services Moving" value={overview.stats.servicesInProgress} detail={`${overview.stats.completedServices} completed`} accent="#198754" />
                </section>

                <section className="kline-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', borderTop: `4px solid ${config.accent}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ margin: 0, color: 'var(--kline-text)' }}>{config.title} Actions</h3>
                      <p style={{ margin: '0.45rem 0 0', color: 'var(--kline-text-light)' }}>
                        Use these only when you need to add a property, schedule work, or report an exception.
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      {operationsLoading && <span style={{ color: 'var(--kline-text-light)', fontWeight: 700 }}>Loading…</span>}
                      <button type="button" className={activeOperationPanel === 'job' ? 'kline-btn-primary' : 'ghost-btn'} onClick={() => setActiveOperationPanel(activeOperationPanel === 'job' ? null : 'job')}>+ Schedule Work</button>
                      <button type="button" className={activeOperationPanel === 'issue' ? 'kline-btn-primary' : 'ghost-btn'} onClick={() => setActiveOperationPanel(activeOperationPanel === 'issue' ? null : 'issue')}>Report Issue</button>
                    </div>
                  </div>

                  {(operationsError || operationsNotice) && (
                    <div
                      style={{
                        marginTop: '1rem',
                        padding: '0.85rem 1rem',
                        borderRadius: 12,
                        background: operationsError ? '#fff5f5' : '#f0fbf5',
                        color: operationsError ? '#b42318' : '#087443',
                        border: `1px solid ${operationsError ? 'rgba(180,35,24,.16)' : 'rgba(8,116,67,.16)'}`,
                      }}
                    >
                      {operationsError || operationsNotice}
                    </div>
                  )}

                  {activeOperationPanel && (
                    <div className="pool-operation-grid" style={{ gridTemplateColumns: 'minmax(0, 680px)' }}>
                    {activeOperationPanel === 'job' && (
                    <form className="pool-operation-form" onSubmit={handleCreatePoolJob} style={{ padding: '1rem', borderRadius: 16, background: '#f4f8ff', border: '1px solid rgba(13,110,253,.16)' }}>
                      <div>
                        <div style={{ color: '#0d5bc4', fontWeight: 900 }}>Schedule {config.title} Work</div>
                        <div style={{ color: 'var(--kline-text-light)', fontSize: '0.86rem', marginTop: 4 }}>Select the property, what needs to happen, and when the team should go.</div>
                      </div>
                      <label style={{ display: 'grid', gap: 5 }}>
                        <span style={{ fontWeight: 800, color: 'var(--kline-text)' }}>Customer</span>
                        <div style={{ position: 'relative' }}>
                          <input name="customerId" type="hidden" value={newEnrollmentCustomerId} />
                          <input
                            value={customerSearch}
                            onChange={(event) => {
                              setCustomerSearch(event.target.value)
                              setNewEnrollmentCustomerId('')
                              setNewJobPropertyId('')
                              setCustomerPickerOpen(true)
                            }}
                            onFocus={() => setCustomerPickerOpen(true)}
                            placeholder="Search name, phone, email or address"
                            disabled={operationsBusy}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '0.72rem', borderRadius: 10, border: '1px solid var(--kline-gray)', background: '#fff' }}
                          />
                          {newEnrollmentCustomerId && (
                            <button
                              type="button"
                              onClick={() => {
                                setNewEnrollmentCustomerId('')
                                setNewJobPropertyId('')
                                setCustomerSearch('')
                                setCustomerPickerOpen(true)
                              }}
                              style={{ position: 'absolute', right: 8, top: 7, border: 0, background: '#f1f3f5', borderRadius: 8, color: 'var(--kline-text-light)', fontWeight: 800, cursor: 'pointer', padding: '0.28rem 0.45rem' }}
                              aria-label="Clear selected customer"
                            >
                              Clear
                            </button>
                          )}
                          {customerPickerOpen && customerSearch.trim() && !newEnrollmentCustomerId && (
                            <div style={{ position: 'absolute', zIndex: 20, top: 'calc(100% + 6px)', left: 0, right: 0, maxHeight: 270, overflowY: 'auto', border: '1px solid var(--kline-gray)', borderRadius: 12, background: '#fff', boxShadow: '0 14px 32px rgba(20,28,38,.16)', padding: 6 }}>
                              {customerSearchResults.length === 0 ? (
                                <div style={{ padding: '0.7rem', color: 'var(--kline-text-light)', fontSize: '0.9rem' }}>No matching customer or property found.</div>
                              ) : (
                                customerSearchResults.map((customer) => (
                                  <button
                                    key={customer.id}
                                    type="button"
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => {
                                      setNewEnrollmentCustomerId(customer.id)
                                      setNewJobPropertyId('')
                                      setCustomerSearch(`${customer.fullName} · ${customer.phone}`)
                                      setCustomerPickerOpen(false)
                                    }}
                                    style={{ width: '100%', border: 0, borderRadius: 9, background: 'transparent', cursor: 'pointer', textAlign: 'left', padding: '0.7rem', color: 'var(--kline-text)' }}
                                  >
                                    <div style={{ fontWeight: 850 }}>{customer.fullName}</div>
                                    <div style={{ color: 'var(--kline-text-light)', fontSize: '0.8rem', marginTop: 3 }}>{customer.phone} · {customer.email}</div>
                                    <div style={{ color: '#9a4a00', fontSize: '0.78rem', marginTop: 3 }}>{customer.properties.map((property) => `${property.address}, ${property.city}`).join(' · ') || 'No property on file'}</div>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      </label>
                      <label style={{ display: 'grid', gap: 5 }}>
                        <span style={{ fontWeight: 800, color: 'var(--kline-text)' }}>Property</span>
                        <select name="propertyId" required value={newJobPropertyId} onChange={(event) => setNewJobPropertyId(event.target.value)} disabled={!selectedEnrollmentCustomer || operationsBusy} style={{ padding: '0.72rem', borderRadius: 10, border: '1px solid var(--kline-gray)', background: '#fff' }}>
                          <option value="">{selectedEnrollmentCustomer ? 'Choose property' : 'Choose customer first'}</option>
                          {selectedEnrollmentCustomer?.properties.map((property) => <option key={property.id} value={property.id}>{property.address}, {property.city}</option>)}
                        </select>
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 0.7fr) minmax(220px, 1.3fr)', gap: '0.65rem' }}>
                        <label style={{ display: 'grid', gap: 5 }}><span style={{ fontWeight: 800, color: 'var(--kline-text)' }}>What work?</span><select name="serviceType" required value={jobServiceType} onChange={(event) => setJobServiceType(event.target.value)}><option value="" disabled>Choose work</option>{availableWorkTypes.filter((service) => service.isActive).map((service) => <option key={service.code} value={service.code}>{service.label}</option>)}</select></label>
                        <label style={{ display: 'grid', gap: 5 }}><span style={{ fontWeight: 800, color: 'var(--kline-text)' }}>Date and time</span><input name="scheduledFor" type="datetime-local" required value={visitDraftDate} onChange={(event) => setVisitDraftDate(event.target.value)} /></label>
                      </div>
                      <input name="assignedTo" placeholder="Assigned to (name or email)" />
                      <input name="accessCode" placeholder="Access code / gate notes" style={{ padding: '0.72rem', borderRadius: 10, border: '1px solid var(--kline-gray)' }} />
                      <textarea name="notes" rows={3} placeholder="Instructions for this work" style={{ padding: '0.72rem', borderRadius: 10, border: '1px solid var(--kline-gray)', resize: 'vertical' }} />
                      <textarea name="serviceNotes" rows={2} placeholder="Ongoing property notes (optional)" style={{ padding: '0.72rem', borderRadius: 10, border: '1px solid var(--kline-gray)', resize: 'vertical' }} />
                      {jobServiceType === 'WEEKLY' && <div style={{ padding: '0.72rem', borderRadius: 10, background: '#e8f1ff', color: '#0d5bc4', fontSize: '0.84rem', lineHeight: 1.4 }}>Weekly creates the next 12 weekly visits automatically. You can move, assign, complete, or cancel each visit individually from the calendar.</div>}
                      <button className="kline-btn-primary" type="submit" disabled={operationsBusy || !operations}>Create & Schedule Work</button>
                    </form>
                    )}

                    {activeOperationPanel === 'issue' && (
                    <form className="pool-operation-form" onSubmit={handleCreateIssue} style={{ padding: '1rem', borderRadius: 16, background: '#fff5f5', border: '1px solid rgba(220,53,69,.16)' }}>
                      <div>
                        <div style={{ color: '#b42318', fontWeight: 900 }}>3. Log an Issue</div>
                        <div style={{ color: 'var(--kline-text-light)', fontSize: '0.86rem', marginTop: 4 }}>Keep repairs, water and access problems tracked until resolution.</div>
                      </div>
                      <label style={{ display: 'grid', gap: 5 }}>
                        <span style={{ fontWeight: 800, color: 'var(--kline-text)' }}>{config.title} record</span>
                        <select name="enrollmentId" required disabled={operationsBusy || overview.roster.length === 0} style={{ padding: '0.72rem', borderRadius: 10, border: '1px solid var(--kline-gray)', background: '#fff' }}>
                          <option value="">Choose {config.title.toLowerCase()} record</option>
                          {overview.roster.map((row) => <option key={row.id} value={row.id}>{row.customerName} · {row.propertyLabel}</option>)}
                        </select>
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                        <select name="category" defaultValue="GENERAL" style={{ padding: '0.72rem', borderRadius: 10, border: '1px solid var(--kline-gray)', background: '#fff' }}>{['ACCESS', 'REPAIR', 'WATER', 'POWER', 'CUSTOMER_REQUEST', 'BILLING', 'GENERAL'].map((item) => <option key={item} value={item}>{formatEnumLabel(item)}</option>)}</select>
                        <select name="priority" defaultValue="MEDIUM" style={{ padding: '0.72rem', borderRadius: 10, border: '1px solid var(--kline-gray)', background: '#fff' }}>{['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((item) => <option key={item} value={item}>{formatEnumLabel(item)}</option>)}</select>
                      </div>
                      <textarea name="description" required rows={4} placeholder="What happened? What is needed?" style={{ padding: '0.72rem', borderRadius: 10, border: '1px solid var(--kline-gray)', resize: 'vertical' }} />
                      <input name="notes" placeholder="Optional internal note" style={{ padding: '0.72rem', borderRadius: 10, border: '1px solid var(--kline-gray)' }} />
                      <button className="kline-btn-primary" type="submit" disabled={operationsBusy || overview.roster.length === 0}>Add to Issue Queue</button>
                    </form>
                    )}
                  </div>
                  )}
                </section>

                <section className="kline-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', borderTop: '4px solid #0d6efd' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: '#0d6efd', fontSize: '0.78rem', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Dispatch calendar</div>
                      <h3 style={{ margin: '0.28rem 0 0', color: 'var(--kline-text)' }}>{config.title} Work Calendar</h3>
                      <p style={{ margin: '0.4rem 0 0', color: 'var(--kline-text-light)' }}>Click any day to prepare a visit for that date. Scheduled work stays visible until completed.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button type="button" className="ghost-btn" onClick={() => setCalendarMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))}>Previous</button>
                      <button type="button" className="ghost-btn" onClick={() => {
                        const today = new Date()
                        setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1))
                        setSelectedCalendarDate(localDateKey(today))
                      }}>Today</button>
                      <button type="button" className="ghost-btn" onClick={() => setCalendarMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))}>Next</button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(260px, 0.75fr)', gap: '1rem', marginTop: '1.1rem', alignItems: 'start' }}>
                    <div style={{ minWidth: 0, overflowX: 'auto' }}>
                      <div style={{ color: 'var(--kline-text)', fontSize: '1.1rem', fontWeight: 900, marginBottom: '0.8rem' }}>
                        {calendarMonth.toLocaleString([], { month: 'long', year: 'numeric' })}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(104px, 1fr))', gap: 6, minWidth: 760 }}>
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                          <div key={day} style={{ padding: '0.45rem 0.55rem', color: 'var(--kline-text-light)', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{day}</div>
                        ))}
                        {calendarDays.map((day) => {
                          const key = localDateKey(day)
                          const isCurrentMonth = day.getMonth() === calendarMonth.getMonth()
                          const isSelected = key === selectedCalendarDate
                          const isToday = key === localDateKey(new Date())
                          const visits = visitsByDate.get(key) || []
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                setSelectedCalendarDate(key)
                                setVisitDraftDate(`${key}T08:00`)
                                if (!isCurrentMonth) setCalendarMonth(new Date(day.getFullYear(), day.getMonth(), 1))
                              }}
                              style={{
                                minHeight: 122,
                                padding: '0.55rem',
                                textAlign: 'left',
                                cursor: 'pointer',
                                borderRadius: 12,
                                border: isSelected ? '2px solid #0d6efd' : '1px solid var(--kline-gray)',
                                background: isSelected ? '#f1f6ff' : isCurrentMonth ? '#fff' : '#f8f9fa',
                                color: isCurrentMonth ? 'var(--kline-text)' : '#9aa0a6',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center' }}>
                                <span style={{ width: 26, height: 26, display: 'grid', placeItems: 'center', borderRadius: 999, background: isToday ? '#0d6efd' : 'transparent', color: isToday ? '#fff' : 'inherit', fontWeight: 900 }}>{day.getDate()}</span>
                                {visits.length > 0 && <span style={{ color: '#0d6efd', fontSize: '0.72rem', fontWeight: 900 }}>{visits.length}</span>}
                              </div>
                              <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
                                {visits.slice(0, 2).map((visit) => (
                                  <span key={visit.id} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0.28rem 0.38rem', borderRadius: 6, background: visit.status === 'IN_PROGRESS' ? '#fff3cd' : '#e8f1ff', color: visit.status === 'IN_PROGRESS' ? '#8a5a00' : '#0d5bc4', fontSize: '0.7rem', fontWeight: 800 }}>
                                    {new Date(visit.scheduledFor).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} {visit.customerName}
                                  </span>
                                ))}
                                {visits.length > 2 && <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--kline-text-light)' }}>+{visits.length - 2} more</span>}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div style={{ padding: '1rem', borderRadius: 16, background: '#f4f8ff', border: '1px solid rgba(13,110,253,.15)' }}>
                      <div style={{ color: '#0d5bc4', fontSize: '0.76rem', fontWeight: 900, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Selected day</div>
                      <h4 style={{ margin: '0.32rem 0 0', fontSize: '1.06rem' }}>{new Date(`${selectedCalendarDate}T12:00:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</h4>
                      <button type="button" className="kline-btn-primary" style={{ width: '100%', marginTop: '0.85rem' }} onClick={() => {
                        setVisitDraftDate(`${selectedCalendarDate}T08:00`)
                        setActiveOperationPanel('job')
                      }}>Schedule work this day</button>
                      {calendarLoading ? (
                        <p style={{ margin: '1rem 0 0', color: 'var(--kline-text-light)' }}>Loading scheduled work…</p>
                      ) : calendarError ? (
                        <p style={{ margin: '1rem 0 0', color: '#b42318' }}>{calendarError}</p>
                      ) : selectedCalendarVisits.length === 0 ? (
                        <p style={{ margin: '1rem 0 0', color: 'var(--kline-text-light)', lineHeight: 1.45 }}>No {config.title.toLowerCase()} work is scheduled for this day yet.</p>
                      ) : (
                        <div style={{ display: 'grid', gap: '0.7rem', marginTop: '1rem' }}>
                          {selectedCalendarVisits.map((visit) => (
                            <div key={visit.id} style={{ padding: '0.75rem', borderRadius: 12, background: '#fff', border: '1px solid rgba(13,110,253,.14)' }}>
                              <div style={{ color: '#0d5bc4', fontWeight: 900 }}>{new Date(visit.scheduledFor).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {visit.serviceLabel}</div>
                              <div style={{ color: 'var(--kline-text)', fontWeight: 800, marginTop: 4 }}>{visit.customerName}</div>
                              <div style={{ color: 'var(--kline-text-light)', fontSize: '0.84rem', marginTop: 3 }}>{visit.propertyLabel}</div>
                              {visit.assignedTo && <div style={{ color: 'var(--kline-text-light)', fontSize: '0.82rem', marginTop: 5 }}>Assigned: {visit.assignedTo}</div>}
                              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
                                {visit.status === 'SCHEDULED' && (
                                  <button type="button" className="ghost-btn" onClick={() => updateVisitStatus(visit.id, 'IN_PROGRESS')} disabled={operationsBusy}>Start</button>
                                )}
                                {visit.status !== 'COMPLETED' && (
                                  <button type="button" className="kline-btn-primary" onClick={() => updateVisitStatus(visit.id, 'COMPLETED')} disabled={operationsBusy}>Complete</button>
                                )}
                                <button type="button" className="ghost-btn" onClick={() => setEditingVisit(visit)}>Move / details</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {editingVisit && (
                  <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'grid', placeItems: 'center', padding: '1rem', background: 'rgba(15, 23, 42, 0.45)' }}>
                    <form onSubmit={handleEditVisit} className="pool-operation-form" style={{ width: 'min(100%, 540px)', maxHeight: 'calc(100vh - 2rem)', overflowY: 'auto', padding: '1.4rem', borderRadius: 18, background: '#fff', boxShadow: '0 26px 80px rgba(15,23,42,.28)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start' }}>
                        <div>
                          <div style={{ color: '#0d6efd', fontSize: '0.78rem', fontWeight: 900, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Edit scheduled work</div>
                          <h3 style={{ margin: '0.3rem 0 0' }}>{editingVisit.customerName}</h3>
                          <p style={{ color: 'var(--kline-text-light)', margin: '0.3rem 0 0' }}>{editingVisit.propertyLabel}</p>
                        </div>
                        <button type="button" className="ghost-btn" onClick={() => setEditingVisit(null)}>Close</button>
                      </div>
                      <label style={{ display: 'grid', gap: 5 }}><span style={{ fontWeight: 800 }}>Date and time</span><input name="scheduledFor" type="datetime-local" required defaultValue={dateTimeLocalValue(editingVisit.scheduledFor)} /></label>
                      <label style={{ display: 'grid', gap: 5 }}><span style={{ fontWeight: 800 }}>Status</span><select name="status" defaultValue={editingVisit.status}>{['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((item) => <option key={item} value={item}>{formatEnumLabel(item)}</option>)}</select></label>
                      <label style={{ display: 'grid', gap: 5 }}><span style={{ fontWeight: 800 }}>Assigned to</span><input name="assignedTo" defaultValue={editingVisit.assignedTo || ''} placeholder="Name or email" /></label>
                      <label style={{ display: 'grid', gap: 5 }}><span style={{ fontWeight: 800 }}>Work instructions</span><textarea name="notes" rows={4} defaultValue={editingVisit.notes || ''} /></label>
                      <button className="kline-btn-primary" type="submit" disabled={operationsBusy}>Save Visit Changes</button>
                    </form>
                  </div>
                )}

                {managingEnrollment && (
                  <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'grid', placeItems: 'center', padding: '1rem', background: 'rgba(15, 23, 42, 0.45)' }}>
                    <div className="kline-card" style={{ width: 'min(100%, 620px)', maxHeight: 'calc(100vh - 2rem)', overflowY: 'auto', padding: '1.4rem', boxShadow: '0 26px 80px rgba(15,23,42,.28)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start' }}>
                        <div>
                          <div style={{ color: '#9a4a00', fontSize: '0.78rem', fontWeight: 900, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Service settings</div>
                          <h3 style={{ margin: '0.3rem 0 0' }}>{managingEnrollment.customerName}</h3>
                          <p style={{ color: 'var(--kline-text-light)', margin: '0.3rem 0 0' }}>{managingEnrollment.propertyLabel}</p>
                        </div>
                        <button type="button" className="ghost-btn" onClick={() => setManagingEnrollment(null)}>Close</button>
                      </div>
                      <p style={{ margin: '1rem 0', color: 'var(--kline-text-light)', lineHeight: 1.45 }}>
                        This area is only for changing the property&apos;s service plan. For daily work, moving a visit, or cancelling one visit, use the calendar instead.
                      </p>
                      <div style={{ display: 'grid', gap: '0.75rem' }}>
                        {managingEnrollment.services.map((service) => (
                          <div key={service.id} style={{ padding: '0.9rem', borderRadius: 14, border: '1px solid var(--kline-gray)', background: service.status === 'CANCELLED' ? '#f8f9fa' : '#fff' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                              <div>
                                <strong>{servicePlanLabel(service.label)}</strong>
                                <div style={{ color: 'var(--kline-text-light)', fontSize: '0.84rem', marginTop: 3 }}>
                                  {service.status === 'NOT_STARTED'
                                    ? 'Available when needed'
                                    : service.label === 'Weekly'
                                      ? 'Active recurring service; future visits stay on the calendar.'
                                      : service.targetDate
                                        ? `Scheduled visit: ${formatDateTime(service.targetDate)}`
                                        : formatEnumLabel(service.status)}
                                </div>
                              </div>
                              {service.status === 'CANCELLED' ? (
                                <Pill tone="neutral">Stopped</Pill>
                              ) : service.label === 'Weekly' ? (
                                <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
                                  <button type="button" className="ghost-btn" onClick={() => setChangingWeeklyService({ id: service.id, targetDate: service.targetDate })} disabled={operationsBusy}>Change Weekly Day</button>
                                  <button type="button" className="ghost-btn" style={{ color: '#b42318', borderColor: 'rgba(180,35,24,.28)' }} onClick={() => stopPoolService(service.id, 'weekly route')} disabled={operationsBusy}>Turn Off Weekly Route</button>
                                </div>
                              ) : (
                                <span style={{ color: 'var(--kline-text-light)', fontSize: '0.82rem', fontWeight: 700 }}>Manage this visit from the calendar</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {changingWeeklyService && (
                  <div style={{ position: 'fixed', inset: 0, zIndex: 120, display: 'grid', placeItems: 'center', padding: '1rem', background: 'rgba(15, 23, 42, 0.52)' }}>
                    <form onSubmit={handleWeeklyRouteChange} className="pool-operation-form" style={{ width: 'min(100%, 500px)', padding: '1.4rem', borderRadius: 18, background: '#fff', boxShadow: '0 26px 80px rgba(15,23,42,.28)' }}>
                      <div style={{ color: '#0d6efd', fontSize: '0.78rem', fontWeight: 900, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Weekly route</div>
                      <h3 style={{ margin: '0.35rem 0 0' }}>Change weekly day</h3>
                      <p style={{ color: 'var(--kline-text-light)', lineHeight: 1.45, margin: '0.65rem 0 1rem' }}>
                        Choose the first visit on the new day. Every future weekly visit will move from that date forward. Past and completed visits stay unchanged.
                      </p>
                      <label style={{ display: 'grid', gap: 6 }}>
                        <span style={{ fontWeight: 800 }}>First visit on the new schedule</span>
                        <input name="firstScheduledFor" type="datetime-local" required defaultValue={nextFutureWeeklyValue(changingWeeklyService.targetDate)} />
                      </label>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                        <button type="button" className="ghost-btn" onClick={() => setChangingWeeklyService(null)}>Cancel</button>
                        <button type="submit" className="kline-btn-primary" disabled={operationsBusy}>Move Future Weekly Visits</button>
                      </div>
                    </form>
                  </div>
                )}

                {config.key === 'pool-services' && (
                <section
                  className="kline-card"
                  style={{
                    padding: '1.5rem',
                    marginBottom: '1.5rem',
                    borderTop: `4px solid ${config.accent}` ,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ margin: 0, color: 'var(--kline-text)' }}>Pool Import Preview</h3>
                      <p style={{ margin: '0.45rem 0 0', color: 'var(--kline-text-light)' }}>
                        Upload the workbook first, let the system match properties and customers, and only then do the real import.
                      </p>
                    </div>
                    <div style={{ color: 'var(--kline-text-light)', fontSize: '0.84rem', fontWeight: 700 }}>
                      Safe mode: preview only, no database writes yet
                    </div>
                  </div>

                  <form onSubmit={handlePoolPreviewUpload} style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) auto',
                        gap: '0.9rem',
                        alignItems: 'end',
                      }}
                    >
                      <label style={{ display: 'grid', gap: '0.45rem' }}>
                        <span style={{ color: 'var(--kline-text)', fontWeight: 800 }}>Pool workbook (.xlsx)</span>
                        <input
                          name="poolWorkbook"
                          type="file"
                          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                          style={{
                            border: '1px solid var(--kline-gray)',
                            borderRadius: 14,
                            padding: '0.85rem 0.9rem',
                            background: '#fff',
                            color: 'var(--kline-text)',
                          }}
                        />
                      </label>

                      <button className="kline-btn-primary" type="submit" disabled={importPreviewLoading}>
                        {importPreviewLoading ? 'Building Preview…' : 'Generate Preview'}
                      </button>
                    </div>

                    {importPreviewError && (
                      <div style={{ padding: '0.9rem 1rem', borderRadius: 14, background: '#fff5f5', color: '#c81e1e', border: '1px solid rgba(220, 53, 69, 0.18)' }}>
                        {importPreviewError}
                      </div>
                    )}

                    {importPreview && (
                      <div style={{ display: 'grid', gap: '1rem' }}>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                            gap: '0.85rem',
                          }}
                        >
                          <StatCard label="Workbook Rows" value={importPreview.summary.totalRows} detail={`Sheet: ${importPreview.selectedSheet}`} accent={config.accent} />
                          <StatCard label="Matched" value={importPreview.summary.matchedRows} detail={`${importPreview.summary.exactPropertyMatches} exact property matches`} accent="#198754" />
                          <StatCard label="Review" value={importPreview.summary.reviewRows} detail={`${importPreview.summary.addressOnlyMatches} address-only matches`} accent="#fd7e14" />
                          <StatCard label="Unmatched" value={importPreview.summary.unmatchedRows} detail={`${importPreview.summary.customerOnlyMatches} customer-only matches`} accent="#dc3545" />
                          <StatCard label="Duplicates" value={importPreview.summary.duplicateRows} detail="Workbook address repeats" accent="#6f42c1" />
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '0.85rem',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                          }}
                        >
                          <div style={{ color: 'var(--kline-text-light)', fontSize: '0.9rem' }}>
                            File: <strong style={{ color: 'var(--kline-text)' }}>{importPreview.fileName}</strong>
                          </div>
                          <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
                            {(['all', 'matched', 'review', 'unmatched'] as const).map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => setPreviewFilter(option)}
                                className={previewFilter === option ? 'kline-btn-primary' : 'ghost-btn'}
                                style={previewFilter === option ? undefined : { minWidth: 110 }}
                              >
                                {option === 'all' ? 'All Rows' : formatEnumLabel(option)}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gap: '0.85rem', maxHeight: '780px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                          {previewRows.length === 0 ? (
                            <div style={{ padding: '1rem', borderRadius: 14, background: '#f8f9fa', color: 'var(--kline-text-light)' }}>
                              No rows match the current filter.
                            </div>
                          ) : (
                            previewRows.map((row) => (
                              <div key={`${row.rowNumber}-${row.address}`} style={{ border: '1px solid var(--kline-gray)', borderRadius: 16, padding: '1rem', background: '#fff' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                                  <div>
                                    <div style={{ fontWeight: 900, color: 'var(--kline-text)', fontSize: '1rem' }}>
                                      {row.lastName || 'Unknown owner'} · {row.address}
                                    </div>
                                    <div style={{ color: 'var(--kline-text-light)', marginTop: 4 }}>
                                      {row.town || 'Town missing'} · Row {row.rowNumber}
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                                    <Pill tone={row.matchStatus === 'matched' ? 'success' : row.matchStatus === 'review' ? 'warning' : 'danger'}>
                                      {row.matchStatus === 'matched' ? 'Ready match' : row.matchStatus === 'review' ? 'Needs review' : 'Unmatched'}
                                    </Pill>
                                    {row.workbookDuplicate && <Pill tone="warning">Workbook duplicate</Pill>}
                                  </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginTop: '0.9rem' }}>
                                  <div>
                                    <div style={{ color: 'var(--kline-text-light)', fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Services</div>
                                    <div style={{ marginTop: 6, color: 'var(--kline-text)' }}>{row.serviceLabels.join(' · ') || 'No service detected'}</div>
                                  </div>
                                  <div>
                                    <div style={{ color: 'var(--kline-text-light)', fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Contact</div>
                                    <div style={{ marginTop: 6, color: 'var(--kline-text)' }}>{row.phone || row.email || 'No contact in workbook'}</div>
                                  </div>
                                  <div>
                                    <div style={{ color: 'var(--kline-text-light)', fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Schedule</div>
                                    <div style={{ marginTop: 6, color: 'var(--kline-text)' }}>Swim ready: {row.swimReadyDate || '—'} · Close: {row.closeDate || '—'}</div>
                                  </div>
                                  <div>
                                    <div style={{ color: 'var(--kline-text-light)', fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Access / water</div>
                                    <div style={{ marginTop: 6, color: 'var(--kline-text)' }}>{row.accessCode || row.waterStatus || 'No access or water notes'}</div>
                                  </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', marginTop: '1rem' }}>
                                  <div style={{ padding: '0.85rem', borderRadius: 14, background: '#f8f9fa' }}>
                                    <div style={{ color: 'var(--kline-text-light)', fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Matched property</div>
                                    <div style={{ marginTop: 6, color: 'var(--kline-text)', fontWeight: 800 }}>
                                      {row.matchedProperty ? row.matchedProperty.label : 'No property match'}
                                    </div>
                                    <div style={{ marginTop: 4, color: 'var(--kline-text-light)' }}>
                                      {row.matchedProperty ? `${row.matchedProperty.city}, ${row.matchedProperty.state} · ${row.matchedProperty.matchReason}` : 'This row will need manual linking before import.'}
                                    </div>
                                  </div>

                                  <div style={{ padding: '0.85rem', borderRadius: 14, background: '#fff8f2' }}>
                                    <div style={{ color: 'var(--kline-text-light)', fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Matched customer</div>
                                    <div style={{ marginTop: 6, color: 'var(--kline-text)', fontWeight: 800 }}>
                                      {row.matchedCustomer ? row.matchedCustomer.fullName : 'No customer match'}
                                    </div>
                                    <div style={{ marginTop: 4, color: 'var(--kline-text-light)' }}>
                                      {row.matchedCustomer ? row.matchedCustomer.matchReason : 'The system could not confidently find a customer yet.'}
                                    </div>
                                  </div>
                                </div>

                                {(row.notes || row.warnings.length > 0) && (
                                  <div style={{ display: 'grid', gap: '0.6rem', marginTop: '1rem' }}>
                                    {row.notes && (
                                      <div style={{ padding: '0.8rem', borderRadius: 12, background: '#f4f8ff', color: 'var(--kline-text)' }}>
                                        <strong>Workbook notes:</strong> {row.notes}
                                      </div>
                                    )}
                                    {row.warnings.length > 0 && (
                                      <div style={{ padding: '0.8rem', borderRadius: 12, background: '#fff5f5', color: 'var(--kline-text)' }}>
                                        <strong>Review flags:</strong> {row.warnings.join(' · ')}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </form>
                </section>
                )}

                <section
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1.55fr) minmax(300px, 0.9fr)',
                    gap: '1rem',
                    marginBottom: '1.5rem',
                    alignItems: 'start',
                  }}
                >
                  <div className="kline-card" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
                      <div>
                        <h3 style={{ margin: 0, color: 'var(--kline-text)' }}>Recent Property Plans</h3>
                        <p style={{ margin: '0.4rem 0 0', color: 'var(--kline-text-light)' }}>
                          Quick reference only. Daily dispatch happens from the calendar above; use Properties to search the full customer base.
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ color: 'var(--kline-text-light)', fontSize: '0.85rem', fontWeight: 700 }}>
                          Showing {overview.roster.length} recent records
                        </div>
                        <button type="button" className="ghost-btn" onClick={() => router.push('/properties')}>Open Properties</button>
                      </div>
                    </div>

                    {overview.roster.length === 0 ? (
                      <div style={{ padding: '1.1rem', borderRadius: 12, background: '#f8f9fa', color: 'var(--kline-text-light)' }}>
                        No {config.title.toLowerCase()} records have been created for this season yet.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gap: '0.85rem' }}>
                        {overview.roster.map((row) => (
                          <div key={row.id} style={{ border: '1px solid var(--kline-gray)', borderRadius: 16, padding: '1rem', background: '#fff' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ fontWeight: 900, color: 'var(--kline-text)', fontSize: '1rem' }}>{row.customerName}</div>
                                <div style={{ color: 'var(--kline-text-light)', marginTop: 4 }}>{row.propertyLabel}</div>
                              </div>
                              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                                <Pill tone="neutral">{formatEnumLabel(row.status)}</Pill>
                                {row.openIssueCount > 0 && (
                                  <Pill tone={row.highestIssuePriority === 'URGENT' || row.highestIssuePriority === 'HIGH' ? 'danger' : 'warning'}>
                                    {row.openIssueCount} open issue{row.openIssueCount === 1 ? '' : 's'}
                                  </Pill>
                                )}
                                {row.nextOccurrence && <Pill tone="info">Next job {formatDateTime(row.nextOccurrence.scheduledFor)}</Pill>}
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginTop: '0.9rem' }}>
                              <div>
                                <div style={{ color: 'var(--kline-text-light)', fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Contact</div>
                                <div style={{ marginTop: 6, color: 'var(--kline-text)' }}>{row.customerPhone || row.customerEmail || 'No contact on file'}</div>
                              </div>
                              <div>
                                <div style={{ color: 'var(--kline-text-light)', fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Town</div>
                                <div style={{ marginTop: 6, color: 'var(--kline-text)' }}>{row.town || '—'}</div>
                              </div>
                              <div>
                                <div style={{ color: 'var(--kline-text-light)', fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Access</div>
                                <div style={{ marginTop: 6, color: 'var(--kline-text)' }}>{row.accessCode || 'No access code'}</div>
                              </div>
                            </div>

                            <div style={{ marginTop: '1rem' }}>
                              <div style={{ color: 'var(--kline-text-light)', fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                                Service plan
                              </div>
                              {row.services.length === 0 ? (
                                <div style={{ color: 'var(--kline-text-light)' }}>No services linked yet.</div>
                              ) : (
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  {row.services.map((service) => (
                                    <span
                                      key={service.id}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        padding: '0.42rem 0.72rem',
                                        borderRadius: 999,
                                        background: 'rgba(253, 126, 20, 0.08)',
                                        color: '#9a4a00',
                                        fontSize: '0.8rem',
                                        fontWeight: 800,
                                      }}
                                    >
                                      {service.label}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginTop: '0.85rem' }}>
                              {row.nextOccurrence && (
                                <button type="button" className="ghost-btn" onClick={() => row.nextOccurrence && openScheduledVisit(row.nextOccurrence)}>
                                  View next job
                                </button>
                              )}
                              {config.key === 'pool-services' && (
                                <button type="button" className="ghost-btn" onClick={() => setManagingEnrollment(row)}>
                                  Manage service plan
                                </button>
                              )}
                            </div>

                            {(row.serviceNotes || row.operationalNotes) && (
                              <div style={{ display: 'grid', gap: '0.55rem', marginTop: '1rem' }}>
                                {row.serviceNotes && (
                                  <div style={{ padding: '0.8rem', borderRadius: 12, background: '#fff8f2', color: 'var(--kline-text)' }}>
                                    <strong>Service Notes:</strong> {row.serviceNotes}
                                  </div>
                                )}
                                {row.operationalNotes && (
                                  <div style={{ padding: '0.8rem', borderRadius: 12, background: '#f8f9fa', color: 'var(--kline-text)' }}>
                                    <strong>Operational Notes:</strong> {row.operationalNotes}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gap: '1rem' }}>
                    <div className="kline-card" style={{ padding: '1.4rem', borderTop: '4px solid #dc3545' }}>
                      <h3 style={{ marginTop: 0, color: 'var(--kline-text)' }}>Open Issue Queue</h3>
                      {overview.issues.length === 0 ? (
                        <p style={{ margin: 0, color: 'var(--kline-text-light)' }}>No open {config.title.toLowerCase()} issues right now.</p>
                      ) : (
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                          {overview.issues.map((issue) => (
                            <div key={issue.id} style={{ padding: '0.9rem', borderRadius: 14, background: '#fff5f5', border: '1px solid rgba(220, 53, 69, 0.16)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <strong style={{ color: 'var(--kline-text)' }}>{issue.customerName}</strong>
                                <Pill tone={issue.priority === 'URGENT' || issue.priority === 'HIGH' ? 'danger' : 'warning'}>
                                  {formatEnumLabel(issue.priority)}
                                </Pill>
                              </div>
                              <div style={{ color: 'var(--kline-text-light)', marginTop: 4 }}>{issue.propertyAddress}</div>
                              <div style={{ color: 'var(--kline-text)', marginTop: 8, lineHeight: 1.5 }}>{issue.description}</div>
                              <div style={{ color: 'var(--kline-text-light)', fontSize: '0.82rem', marginTop: 8 }}>
                                {formatEnumLabel(issue.category)} · Opened {formatDateTime(issue.openedAt)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="kline-card" style={{ padding: '1.4rem', borderTop: '4px solid #0d6efd' }}>
                      <h3 style={{ marginTop: 0, color: 'var(--kline-text)' }}>Upcoming Visits</h3>
                      {overview.upcomingOccurrences.length === 0 ? (
                        <p style={{ margin: 0, color: 'var(--kline-text-light)' }}>No scheduled {config.title.toLowerCase()} visits yet.</p>
                      ) : (
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                          {overview.upcomingOccurrences.map((visit) => (
                            <div key={visit.id} style={{ padding: '0.9rem', borderRadius: 14, background: '#f4f8ff', border: '1px solid rgba(13, 110, 253, 0.14)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.7rem', flexWrap: 'wrap', alignItems: 'start' }}>
                                <strong style={{ color: 'var(--kline-text)' }}>{visit.customerName}</strong>
                                <Pill tone={visit.status === 'IN_PROGRESS' ? 'warning' : 'info'}>{formatEnumLabel(visit.status)}</Pill>
                              </div>
                              <div style={{ color: 'var(--kline-text-light)', marginTop: 4 }}>{visit.propertyAddress}</div>
                              <div style={{ color: 'var(--kline-text)', marginTop: 8 }}>{visit.serviceLabel}</div>
                              <div style={{ color: '#0d6efd', fontWeight: 800, marginTop: 8 }}>{formatDateTime(visit.scheduledFor)}</div>
                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.85rem' }}>
                                {visit.status === 'SCHEDULED' && (
                                  <button type="button" className="ghost-btn" onClick={() => updateVisitStatus(visit.id, 'IN_PROGRESS')} disabled={operationsBusy}>Start</button>
                                )}
                                <button type="button" className="kline-btn-primary" onClick={() => updateVisitStatus(visit.id, 'COMPLETED')} disabled={operationsBusy}>Complete</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </>
            )}
          </>
        )}

      </main>
    </div>
  )
}

function StatCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string
  value: number
  detail: string
  accent: string
}) {
  return (
    <div className="kline-card" style={{ padding: '1.3rem', borderTop: `4px solid ${accent}` }}>
      <div style={{ fontSize: '0.78rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--kline-text-light)', fontWeight: 800 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.9rem', fontWeight: 900, color: 'var(--kline-text)', marginTop: 8 }}>{value}</div>
      <div style={{ color: 'var(--kline-text-light)', marginTop: 6 }}>{detail}</div>
    </div>
  )
}

function Pill({ children, tone }: { children: ReactNode; tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }) {
  const styles =
    tone === 'danger'
      ? { background: 'rgba(220, 53, 69, 0.12)', color: '#c81e1e' }
      : tone === 'warning'
        ? { background: 'rgba(253, 126, 20, 0.12)', color: '#b35a00' }
        : tone === 'success'
          ? { background: 'rgba(25, 135, 84, 0.12)', color: '#198754' }
          : tone === 'info'
            ? { background: 'rgba(13, 110, 253, 0.12)', color: '#0d6efd' }
            : { background: 'rgba(15, 23, 42, 0.06)', color: 'var(--kline-text)' }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.3rem 0.62rem',
        borderRadius: 999,
        fontSize: '0.78rem',
        fontWeight: 800,
        ...styles,
      }}
    >
      {children}
    </span>
  )
}
