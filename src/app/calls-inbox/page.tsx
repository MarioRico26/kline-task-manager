'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CallsInboxApiResponse,
  CallsInboxRecord,
  CallsInboxStats,
  callPriorityOptions,
  callSourceOptions,
  callStatusOptions,
  callTypeOptions,
  formatEnumLabel,
} from '@/lib/callsInbox'

const OPEN_RECORD_STATUSES = ['NEW', 'TRIAGE_REQUIRED', 'ASSIGNED', 'CALLBACK_PENDING'] as const
const DEFAULT_PAGE_SIZE = 100

function formatReceivedAt(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatFollowUpAt(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getStatusColor(status: string) {
  switch (status) {
    case 'RESOLVED':
    case 'CLOSED':
      return '#198754'
    case 'CALLBACK_PENDING':
    case 'CALLBACK_ATTEMPTED':
      return '#fd7e14'
    case 'TRIAGE_REQUIRED':
      return '#7c3aed'
    case 'SPAM':
      return '#6c757d'
    default:
      return '#c81e1e'
  }
}

function getSourceAccent(sourceType: string) {
  switch (sourceType) {
    case 'VOICEMAIL':
      return '#7c3aed'
    case 'MISSED_CALL':
      return '#c81e1e'
    default:
      return '#0d6efd'
  }
}

function getAgeAccent(record: CallsInboxRecord) {
  if (record.isSlaBreached) return '#c81e1e'
  if (record.isSlaWarning) return '#fd7e14'
  return '#198754'
}

export default function CallsInboxPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [canAccessVoicemailImports, setCanAccessVoicemailImports] = useState(false)
  const [records, setRecords] = useState<CallsInboxRecord[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [totalRecords, setTotalRecords] = useState(0)
  const [loadedRecords, setLoadedRecords] = useState(0)
  const [stats, setStats] = useState<CallsInboxStats | null>(null)
  const [moduleReady, setModuleReady] = useState(true)
  const [loadingRecords, setLoadingRecords] = useState(true)
  const [moduleMessage, setModuleMessage] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [quickActionRecordId, setQuickActionRecordId] = useState<string | null>(null)
  const [quickActionType, setQuickActionType] = useState<'TAKE_OWNERSHIP' | 'CLOSE' | null>(null)
  const [filters, setFilters] = useState({
    query: '',
    status: 'OPEN',
    assignedTo: 'ALL',
    priority: 'ALL',
    callType: 'ALL',
    sourceType: 'ALL',
    serviceCategory: 'ALL',
    unassignedOnly: false,
    mineOnly: false,
    overdueOnly: false,
    dueTodayOnly: false,
    sortBy: 'RECEIVED_AT_DESC',
  })

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
          user?: {
            email?: string
            canAccessCallsInbox?: boolean
            canAccessVoicemailImports?: boolean
            accessScope?: 'ALL' | 'PERMITS_ONLY'
          }
        }

        if (cancelled) return

        const canAccess = data.user?.canAccessCallsInbox === true && data.user?.accessScope !== 'PERMITS_ONLY'
        setAuthorized(canAccess)
        setCanAccessVoicemailImports(data.user?.canAccessVoicemailImports === true)

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
    if (!authorized) return

    let cancelled = false

    async function loadRecords() {
      setLoadingRecords(true)
      setError('')

      try {
        const res = await fetch(`/api/calls-inbox?page=${currentPage}&pageSize=${pageSize}`, { cache: 'no-store' })
        const data = (await res.json()) as CallsInboxApiResponse | { error?: string }

        if (!res.ok) {
          throw new Error(('error' in data && data.error) || 'Unable to load call records')
        }

        if (cancelled) return

        const payload = data as CallsInboxApiResponse
        setRecords(payload.records)
        setCurrentUserId(payload.currentUserId)
        setTotalRecords(payload.totalRecords || payload.records.length)
        setLoadedRecords(payload.loadedRecords || payload.records.length)
        setPageSize(payload.pageSize || DEFAULT_PAGE_SIZE)
        setCurrentPage(payload.page || currentPage)
        setStats(payload.stats || null)
        setModuleReady(payload.moduleReady)
        setModuleMessage(payload.message || '')
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load call records')
        }
      } finally {
        if (!cancelled) {
          setLoadingRecords(false)
        }
      }
    }

    loadRecords()

    return () => {
      cancelled = true
    }
  }, [authorized, currentPage, pageSize, refreshKey])

  async function runQuickAction(record: CallsInboxRecord, action: 'TAKE_OWNERSHIP' | 'CLOSE') {
    if (action === 'TAKE_OWNERSHIP' && !currentUserId) return

    if (
      action === 'CLOSE' &&
      !window.confirm(`This will mark the call from ${record.callerNameRaw || record.phoneNumber || 'this caller'} as closed. Continue?`)
    ) {
      return
    }

    setQuickActionRecordId(record.id)
    setQuickActionType(action)
    setError('')

    try {
      const res = await fetch(`/api/calls-inbox/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          action === 'TAKE_OWNERSHIP'
            ? { assignedToUserId: currentUserId }
            : { status: 'CLOSED' }
        ),
      })

      const data = (await res.json()) as { error?: string }

      if (!res.ok) {
        throw new Error(data.error || 'Unable to apply quick action')
      }

      setRefreshKey((value) => value + 1)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to apply quick action')
    } finally {
      setQuickActionRecordId(null)
      setQuickActionType(null)
    }
  }

  const summaryCards = useMemo(
    () => [
      {
        label: 'Open Records',
        value: (stats?.openRecords ?? records.filter((record) => OPEN_RECORD_STATUSES.includes(record.status as (typeof OPEN_RECORD_STATUSES)[number])).length).toString(),
        detail: 'Currently active office follow-up records',
        accent: '#c81e1e',
      },
      {
        label: 'Unassigned',
        value: (stats?.unassignedOpen ?? records.filter((record) => OPEN_RECORD_STATUSES.includes(record.status as (typeof OPEN_RECORD_STATUSES)[number]) && !record.assignedToUserId).length).toString(),
        detail: 'Open records that still need ownership',
        accent: '#7c3aed',
      },
      {
        label: 'Callback Attempted',
        value: (stats?.callbackAttempted ?? records.filter((record) => record.status === 'CALLBACK_ATTEMPTED').length).toString(),
        detail: 'Records currently sitting in attempted status',
        accent: '#0d6efd',
      },
      {
        label: 'Overdue Follow-Ups',
        value: (stats?.overdueFollowUps ?? records.filter((record) => record.isFollowUpOverdue).length).toString(),
        detail: 'Past the scheduled callback time',
        accent: '#fd7e14',
      },
      {
        label: '24h+ Aging',
        value: (stats?.aging24h ?? records.filter((record) => OPEN_RECORD_STATUSES.includes(record.status as (typeof OPEN_RECORD_STATUSES)[number]) && record.isSlaBreached).length).toString(),
        detail: 'Open records older than 24 hours',
        accent: '#c81e1e',
      },
      {
        label: 'Resolved / Closed',
        value: (stats?.resolvedClosed ?? records.filter((record) => ['RESOLVED', 'CLOSED'].includes(record.status)).length).toString(),
        detail: 'Handled and no longer active',
        accent: '#198754',
      },
    ],
    [records, stats]
  )

  const agingCards = useMemo(
    () => [
      {
        label: '0-4h',
        value: stats?.agingBuckets.under4Hours ?? records.filter((record) => OPEN_RECORD_STATUSES.includes(record.status as (typeof OPEN_RECORD_STATUSES)[number]) && record.ageBucket === 'UNDER_4_HOURS').length,
        accent: '#198754',
      },
      {
        label: '4-24h',
        value: stats?.agingBuckets.fourToTwentyFourHours ?? records.filter((record) => OPEN_RECORD_STATUSES.includes(record.status as (typeof OPEN_RECORD_STATUSES)[number]) && record.ageBucket === 'FOUR_TO_TWENTY_FOUR_HOURS').length,
        accent: '#fd7e14',
      },
      {
        label: '24-48h',
        value: stats?.agingBuckets.oneToTwoDays ?? records.filter((record) => OPEN_RECORD_STATUSES.includes(record.status as (typeof OPEN_RECORD_STATUSES)[number]) && record.ageBucket === 'ONE_TO_TWO_DAYS').length,
        accent: '#c81e1e',
      },
      {
        label: '48h+',
        value: stats?.agingBuckets.overTwoDays ?? records.filter((record) => OPEN_RECORD_STATUSES.includes(record.status as (typeof OPEN_RECORD_STATUSES)[number]) && record.ageBucket === 'OVER_TWO_DAYS').length,
        accent: '#7b1e1e',
      },
    ],
    [records, stats]
  )

  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const record of records) {
      if (record.assignedToUser?.id && record.assignedToUser.email) {
        map.set(record.assignedToUser.id, record.assignedToUser.email)
      }
    }
    return Array.from(map.entries()).map(([id, email]) => ({ id, email }))
  }, [records])

  const serviceCategoryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          records
            .map((record) => record.detectedServiceCategory)
            .filter((value): value is string => Boolean(value))
        )
      ),
    [records]
  )

  const visibleRecords = useMemo(() => {
    const query = filters.query.trim().toLowerCase()

    const filtered = records.filter((record) => {
      if (filters.status === 'OPEN' && !OPEN_RECORD_STATUSES.includes(record.status as (typeof OPEN_RECORD_STATUSES)[number])) return false
      if (filters.status !== 'ALL' && filters.status !== 'OPEN' && record.status !== filters.status) return false
      if (filters.assignedTo !== 'ALL' && (record.assignedToUserId || '') !== filters.assignedTo) return false
      if (filters.priority !== 'ALL' && record.priority !== filters.priority) return false
      if (filters.callType !== 'ALL' && record.callType !== filters.callType) return false
      if (filters.sourceType !== 'ALL' && record.sourceType !== filters.sourceType) return false
      if (filters.serviceCategory !== 'ALL' && (record.detectedServiceCategory || '') !== filters.serviceCategory) return false
      if (filters.unassignedOnly && record.assignedToUserId) return false
      if (filters.mineOnly && record.assignedToUserId !== currentUserId) return false
      if (filters.overdueOnly && !record.isFollowUpOverdue) return false
      if (filters.dueTodayOnly && !record.isFollowUpDueToday) return false

      if (!query) return true

      const haystack = [
        record.callerNameRaw,
        record.phoneNumber,
        record.summary,
        record.transcriptRaw,
        record.detectedAddress,
        record.detectedTown,
        record.customer?.fullName,
        record.property?.address,
        record.assignedToUser?.email,
        record.relatedTask?.serviceName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })

    return [...filtered].sort((a, b) => {
      switch (filters.sortBy) {
        case 'RECEIVED_AT_ASC':
          return new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime()
        case 'ASSIGNED_TO_ASC':
          return (a.assignedToUser?.email || 'zzzz').localeCompare(b.assignedToUser?.email || 'zzzz')
        case 'ASSIGNED_TO_DESC':
          return (b.assignedToUser?.email || '').localeCompare(a.assignedToUser?.email || '')
        case 'RECEIVED_AT_DESC':
        default:
          return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
      }
    })
  }, [currentUserId, filters, records])

  const totalPages = Math.max(1, Math.ceil(totalRecords / Math.max(pageSize, 1)))
  const rangeStart = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const rangeEnd = totalRecords === 0 ? 0 : Math.min((currentPage - 1) * pageSize + loadedRecords, totalRecords)
  const canGoPrevious = currentPage > 1
  const canGoNext = currentPage < totalPages

  if (authorized === null) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--kline-gray-light)' }}>
        <div className="kline-card" style={{ padding: '2rem 2.5rem', textAlign: 'center' }}>
          <h2 style={{ margin: 0, color: 'var(--kline-text)' }}>Loading Calls Inbox…</h2>
          <p style={{ margin: '0.75rem 0 0', color: 'var(--kline-text-light)' }}>Checking access and preparing the callback workflow.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--kline-gray-light)' }}>
      <header className="topbar">
        <div className="topbar-inner" style={{ maxWidth: 1560 }}>
          <div className="brand">
            <div className="brand-icon">K</div>
            <div>
              <h1>
                KLINE <span>TASKS</span>
              </h1>
              <p>Calls Inbox · callbacks, voicemails and office follow-up</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="ghost-btn" onClick={() => router.push('/dashboard')}>
              Dashboard
            </button>
              {canAccessVoicemailImports && (
                <button className="ghost-btn" onClick={() => router.push('/calls-inbox/imports')}>
                  Voicemail Imports
                </button>
              )}
            <button className="ghost-btn" onClick={() => router.push('/calls-inbox/my-followups')}>
              My Follow-Ups
            </button>
            <button className="kline-btn-primary" onClick={() => router.push('/calls-inbox/new')}>
              + New Call Record
            </button>
          </div>
        </div>
      </header>

      <main className="main-content" style={{ maxWidth: 1560 }}>
        <section className="page-masthead page-masthead-calls" style={{ marginBottom: '1.5rem' }}>
          <div className="page-masthead-copy">
            <p className="page-masthead-kicker">Restricted module · office follow-up</p>
            <h2>Calls Inbox</h2>
            <p className="page-masthead-subtitle">
              One operational queue for answered calls, missed calls and voicemails, with assignment ownership and callback accountability.
            </p>
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {summaryCards.map((card) => (
            <div key={card.label} className="kline-card" style={{ padding: '1.4rem', borderTop: `4px solid ${card.accent}` }}>
              <div style={{ fontSize: '0.82rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--kline-text-light)', fontWeight: 800 }}>
                {card.label}
              </div>
              <div style={{ fontSize: '1.7rem', fontWeight: 900, color: 'var(--kline-text)', marginTop: 8 }}>{card.value}</div>
              <div style={{ color: 'var(--kline-text-light)', marginTop: 6 }}>{card.detail}</div>
            </div>
          ))}
        </section>

        <section
          className="kline-card"
          style={{
            padding: '1.15rem 1.3rem',
            marginBottom: '1.4rem',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.96), rgba(252,247,240,0.96))',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.9rem' }}>
            <div>
              <h3 style={{ margin: 0, color: 'var(--kline-text)' }}>Aging buckets</h3>
              <p style={{ margin: '0.35rem 0 0', color: 'var(--kline-text-light)' }}>Fast view of open record pressure by elapsed time.</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.85rem' }}>
            {agingCards.map((card) => (
              <div key={card.label} style={{ borderRadius: 14, border: '1px solid var(--kline-gray)', padding: '0.95rem 1rem', background: '#fff' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--kline-text-light)' }}>{card.label}</div>
                <div style={{ marginTop: 8, fontSize: '1.5rem', fontWeight: 900, color: card.accent }}>{card.value}</div>
              </div>
            ))}
          </div>
        </section>

        {!moduleReady && (
          <section className="kline-card" style={{ padding: '1.3rem 1.5rem', marginBottom: '1.25rem', borderLeft: '5px solid #fd7e14' }}>
            <h3 style={{ margin: 0, color: 'var(--kline-text)' }}>Database activation pending</h3>
            <p style={{ margin: '0.5rem 0 0', color: 'var(--kline-text-light)' }}>
              {moduleMessage || 'The Calls Inbox code is ready, but the database tables still need to be activated before records can be stored.'}
            </p>
          </section>
        )}

        {error && (
          <section className="kline-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', borderLeft: '5px solid #c81e1e' }}>
            <strong style={{ color: '#c81e1e' }}>{error}</strong>
          </section>
        )}

        <section className="kline-card" style={{ padding: '1.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, color: 'var(--kline-text)' }}>Current records</h3>
              <p style={{ margin: '0.4rem 0 0', color: 'var(--kline-text-light)' }}>
                {loadingRecords
                  ? 'Loading records…'
                  : totalRecords > 0
                    ? `${rangeStart}-${rangeEnd} of ${totalRecords} total records${visibleRecords.length !== loadedRecords ? ` (${visibleRecords.length} match filters on this page)` : ''}.`
                    : '0 records found.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--kline-text-light)', fontSize: '0.92rem', fontWeight: 700 }}>
                Page {currentPage} of {totalPages}
              </span>
              <button className="ghost-btn" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={!canGoPrevious || loadingRecords}>
                Previous
              </button>
              <button className="ghost-btn" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={!canGoNext || loadingRecords}>
                Next
              </button>
              <button className="ghost-btn" onClick={() => setRefreshKey((value) => value + 1)} disabled={loadingRecords}>
                Refresh
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.85rem',
              marginBottom: '1rem',
              padding: '1rem',
              borderRadius: 16,
              background: 'rgba(255,255,255,0.7)',
              border: '1px solid var(--kline-gray)',
            }}
          >
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.45rem', color: 'var(--kline-text)' }}>Search</label>
              <input
                className="kline-input"
                value={filters.query}
                onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
                placeholder="Search caller, phone, summary, address, town, customer..."
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.45rem', color: 'var(--kline-text)' }}>Status</label>
              <select className="kline-input" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                <option value="OPEN">Open only</option>
                <option value="ALL">All statuses</option>
                {callStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.45rem', color: 'var(--kline-text)' }}>Assigned To</label>
              <select className="kline-input" value={filters.assignedTo} onChange={(event) => setFilters((current) => ({ ...current, assignedTo: event.target.value }))}>
                <option value="ALL">All owners</option>
                {assigneeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.45rem', color: 'var(--kline-text)' }}>Priority</label>
              <select className="kline-input" value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}>
                <option value="ALL">All priorities</option>
                {callPriorityOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatEnumLabel(option)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.45rem', color: 'var(--kline-text)' }}>Call Type</label>
              <select className="kline-input" value={filters.callType} onChange={(event) => setFilters((current) => ({ ...current, callType: event.target.value }))}>
                <option value="ALL">All call types</option>
                {callTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatEnumLabel(option)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.45rem', color: 'var(--kline-text)' }}>Source</label>
              <select className="kline-input" value={filters.sourceType} onChange={(event) => setFilters((current) => ({ ...current, sourceType: event.target.value }))}>
                <option value="ALL">All sources</option>
                {callSourceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.45rem', color: 'var(--kline-text)' }}>Service Category</label>
              <select
                className="kline-input"
                value={filters.serviceCategory}
                onChange={(event) => setFilters((current) => ({ ...current, serviceCategory: event.target.value }))}
              >
                <option value="ALL">All categories</option>
                {serviceCategoryOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatEnumLabel(option)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.45rem', color: 'var(--kline-text)' }}>Sort By</label>
              <select className="kline-input" value={filters.sortBy} onChange={(event) => setFilters((current) => ({ ...current, sortBy: event.target.value }))}>
                <option value="RECEIVED_AT_DESC">Newest first</option>
                <option value="RECEIVED_AT_ASC">Oldest first</option>
                <option value="ASSIGNED_TO_ASC">Assigned to (A-Z)</option>
                <option value="ASSIGNED_TO_DESC">Assigned to (Z-A)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--kline-text)' }}>
                <input
                  type="checkbox"
                  checked={filters.unassignedOnly}
                  onChange={(event) => setFilters((current) => ({ ...current, unassignedOnly: event.target.checked }))}
                />
                Unassigned only
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--kline-text)' }}>
                <input
                  type="checkbox"
                  checked={filters.mineOnly}
                  onChange={(event) => setFilters((current) => ({ ...current, mineOnly: event.target.checked }))}
                />
                Assigned to me
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--kline-text)' }}>
                <input
                  type="checkbox"
                  checked={filters.overdueOnly}
                  onChange={(event) => setFilters((current) => ({ ...current, overdueOnly: event.target.checked }))}
                />
                Overdue only
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--kline-text)' }}>
                <input
                  type="checkbox"
                  checked={filters.dueTodayOnly}
                  onChange={(event) => setFilters((current) => ({ ...current, dueTodayOnly: event.target.checked }))}
                />
                Due today
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
              <button
                className="ghost-btn"
                type="button"
                onClick={() =>
                  setFilters({
                    query: '',
                    status: 'OPEN',
                    assignedTo: 'ALL',
                    priority: 'ALL',
                    callType: 'ALL',
                    sourceType: 'ALL',
                    serviceCategory: 'ALL',
                    unassignedOnly: false,
                    mineOnly: false,
                    overdueOnly: false,
                    dueTodayOnly: false,
                    sortBy: 'RECEIVED_AT_DESC',
                  })
                }
              >
                Clear Filters
              </button>
            </div>
          </div>

          {loadingRecords ? (
            <div style={{ padding: '2rem 0', color: 'var(--kline-text-light)' }}>Loading call records…</div>
          ) : visibleRecords.length === 0 ? (
            <div style={{ padding: '2rem 0', color: 'var(--kline-text-light)' }}>
              {records.length === 0
                ? 'No call records yet. The next safe test is to create an answered call or voicemail manually.'
                : 'No call records match the current filters.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', paddingBottom: '0.25rem' }}>
              <table style={{ width: '100%', minWidth: 1450, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--kline-gray)' }}>
                    <th style={{ padding: '0.8rem 0.75rem' }}>Received</th>
                    <th style={{ padding: '0.8rem 0.75rem' }}>Caller</th>
                    <th style={{ padding: '0.8rem 0.75rem' }}>Source</th>
                    <th style={{ padding: '0.8rem 0.75rem' }}>Status</th>
                    <th style={{ padding: '0.8rem 0.75rem' }}>Assigned To</th>
                    <th style={{ padding: '0.8rem 0.75rem' }}>Summary</th>
                    <th style={{ padding: '0.8rem 0.75rem' }}>Activity</th>
                    <th style={{ padding: '0.8rem 0.75rem' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRecords.map((record) => (
                    <tr key={record.id} style={{ borderBottom: '1px solid rgba(15, 23, 42, 0.08)' }}>
                      <td style={{ padding: '0.9rem 0.75rem', whiteSpace: 'nowrap', color: 'var(--kline-text)' }}>{formatReceivedAt(record.receivedAt)}</td>
                      <td style={{ padding: '0.9rem 0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 999,
                              background: getSourceAccent(record.sourceType),
                              flex: '0 0 auto',
                            }}
                          />
                          <div style={{ fontWeight: 700, color: 'var(--kline-text)' }}>{record.callerNameRaw || 'Unknown caller'}</div>
                        </div>
                        <div style={{ color: 'var(--kline-text-light)', fontSize: '0.95rem' }}>{record.phoneNumber || 'No phone on record'}</div>
                      </td>
                      <td style={{ padding: '0.9rem 0.75rem', color: 'var(--kline-text)' }}>{formatEnumLabel(record.sourceType)}</td>
                      <td style={{ padding: '0.9rem 0.75rem' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            borderRadius: 999,
                            padding: '0.35rem 0.75rem',
                            fontWeight: 800,
                            color: getStatusColor(record.status),
                            background: `${getStatusColor(record.status)}14`,
                          }}
                        >
                          {formatEnumLabel(record.status)}
                        </span>
                      </td>
                      <td style={{ padding: '0.9rem 0.75rem', color: 'var(--kline-text)', minWidth: 190 }}>{record.assignedToUser?.email || 'Unassigned'}</td>
                      <td style={{ padding: '0.9rem 0.75rem', minWidth: 430 }}>
                        <div style={{ color: 'var(--kline-text)' }}>{record.summary}</div>
                        {(record.customer || record.property) && (
                          <div style={{ color: 'var(--kline-text-light)', fontSize: '0.92rem', marginTop: 8 }}>
                            {[record.customer?.fullName, record.property?.address].filter(Boolean).join(' · ')}
                          </div>
                        )}
                        {(record.detectedTown || record.detectedServiceCategory) && (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                            {record.detectedTown && (
                              <span style={{ padding: '0.22rem 0.55rem', borderRadius: 999, background: 'rgba(15, 23, 42, 0.06)', color: 'var(--kline-text-light)', fontSize: '0.82rem', fontWeight: 700 }}>
                                {record.detectedTown}
                              </span>
                            )}
                            {record.detectedServiceCategory && (
                              <span style={{ padding: '0.22rem 0.55rem', borderRadius: 999, background: 'rgba(13, 110, 253, 0.10)', color: '#0d6efd', fontSize: '0.82rem', fontWeight: 700 }}>
                                {formatEnumLabel(record.detectedServiceCategory)}
                              </span>
                            )}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                          <span
                            style={{
                              padding: '0.22rem 0.55rem',
                              borderRadius: 999,
                              background: `${getAgeAccent(record)}14`,
                              color: getAgeAccent(record),
                              fontSize: '0.82rem',
                              fontWeight: 800,
                            }}
                          >
                            Age {record.ageLabel}
                          </span>
                          {record.isSlaBreached && (
                            <span
                              style={{
                                padding: '0.22rem 0.55rem',
                                borderRadius: 999,
                                background: 'rgba(200, 30, 30, 0.12)',
                                color: '#c81e1e',
                                fontSize: '0.82rem',
                                fontWeight: 800,
                              }}
                            >
                              SLA breached
                            </span>
                          )}
                          {!record.isSlaBreached && record.isSlaWarning && (
                            <span
                              style={{
                                padding: '0.22rem 0.55rem',
                                borderRadius: 999,
                                background: 'rgba(253, 126, 20, 0.12)',
                                color: '#fd7e14',
                                fontSize: '0.82rem',
                                fontWeight: 800,
                              }}
                            >
                              Aging warning
                            </span>
                          )}
                        </div>
                        {record.latestNextFollowUpAt && (
                          <div
                            style={{
                              marginTop: 8,
                              color: record.isFollowUpOverdue ? '#c81e1e' : record.isFollowUpDueToday ? '#fd7e14' : 'var(--kline-text-light)',
                              fontSize: '0.9rem',
                              fontWeight: record.isFollowUpOverdue || record.isFollowUpDueToday ? 800 : 600,
                            }}
                          >
                            {record.isFollowUpOverdue ? 'Overdue follow-up' : record.isFollowUpDueToday ? 'Follow-up due today' : 'Next follow-up'} ·{' '}
                            {formatFollowUpAt(record.latestNextFollowUpAt)}
                          </div>
                        )}
                        {record.relatedTask?.serviceName && (
                          <div style={{ color: 'var(--kline-text-light)', fontSize: '0.88rem', marginTop: 8 }}>
                            Related task: {record.relatedTask.serviceName}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.9rem 0.75rem', color: 'var(--kline-text-light)', whiteSpace: 'nowrap', minWidth: 150 }}>
                        {record.callbackAttemptCount} callbacks · {record.activityCount} events
                      </td>
                      <td style={{ padding: '0.9rem 0.75rem', minWidth: 220 }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button className="ghost-btn" onClick={() => router.push(`/calls-inbox/${record.id}`)}>
                            View
                          </button>
                          {!record.assignedToUserId && currentUserId && (
                            <button
                              className="ghost-btn"
                              onClick={() => runQuickAction(record, 'TAKE_OWNERSHIP')}
                              disabled={quickActionRecordId === record.id}
                            >
                              {quickActionRecordId === record.id && quickActionType === 'TAKE_OWNERSHIP' ? 'Taking…' : 'Take Ownership'}
                            </button>
                          )}
                          {!['CLOSED', 'RESOLVED', 'SPAM'].includes(record.status) && (
                            <button
                              className="ghost-btn"
                              onClick={() => runQuickAction(record, 'CLOSE')}
                              disabled={quickActionRecordId === record.id}
                            >
                              {quickActionRecordId === record.id && quickActionType === 'CLOSE' ? 'Closing…' : 'Close'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <style jsx>{`
        .page-masthead {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
          padding: 1.6rem 1.7rem;
          border-radius: 24px;
          background:
            radial-gradient(circle at top right, rgba(124, 58, 237, 0.18), transparent 32%),
            linear-gradient(135deg, #ffffff 0%, #fffaf4 55%, #f8f5ff 100%);
          border: 1px solid rgba(124, 58, 237, 0.12);
          box-shadow: 0 18px 36px rgba(15, 23, 42, 0.06);
        }

        .page-masthead-copy h2 {
          margin: 0.25rem 0 0;
          font-size: clamp(2rem, 3vw, 2.7rem);
          line-height: 1.05;
          color: var(--kline-text);
        }

        .page-masthead-kicker {
          margin: 0;
          color: #7c3aed;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-size: 0.78rem;
        }

        .page-masthead-subtitle {
          margin: 0.8rem 0 0;
          max-width: 720px;
          color: var(--kline-text-light);
          font-size: 1rem;
          line-height: 1.7;
        }

      `}</style>
    </div>
  )
}
