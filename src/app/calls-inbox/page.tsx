'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CallsInboxApiResponse,
  CallsInboxRecord,
  callPriorityOptions,
  callSourceOptions,
  callStatusOptions,
  callTypeOptions,
  formatEnumLabel,
} from '@/lib/callsInbox'

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
  const [moduleReady, setModuleReady] = useState(true)
  const [loadingRecords, setLoadingRecords] = useState(true)
  const [moduleMessage, setModuleMessage] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [filters, setFilters] = useState({
    query: '',
    status: 'ALL',
    assignedTo: 'ALL',
    priority: 'ALL',
    callType: 'ALL',
    sourceType: 'ALL',
    serviceCategory: 'ALL',
    unassignedOnly: false,
    mineOnly: false,
    overdueOnly: false,
    dueTodayOnly: false,
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
        const res = await fetch('/api/calls-inbox', { cache: 'no-store' })
        const data = (await res.json()) as CallsInboxApiResponse | { error?: string }

        if (!res.ok) {
          throw new Error(('error' in data && data.error) || 'Unable to load call records')
        }

        if (cancelled) return

        const payload = data as CallsInboxApiResponse
        setRecords(payload.records)
        setCurrentUserId(payload.currentUserId)
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
  }, [authorized])

  const summaryCards = useMemo(
    () => [
      {
        label: 'Open Records',
        value: records.filter((record) => !['RESOLVED', 'CLOSED', 'SPAM'].includes(record.status)).length.toString(),
        detail: 'Still need office follow-up',
        accent: '#c81e1e',
      },
      {
        label: 'Assigned To Me',
        value: records.filter((record) => record.assignedToUserId === currentUserId).length.toString(),
        detail: 'Owned by the signed-in user',
        accent: '#0d6efd',
      },
      {
        label: 'Voicemails',
        value: records.filter((record) => record.sourceType === 'VOICEMAIL').length.toString(),
        detail: 'Current voicemail intake records',
        accent: '#7c3aed',
      },
      {
        label: '4h+ Aging',
        value: records.filter((record) => !['RESOLVED', 'CLOSED', 'SPAM'].includes(record.status) && record.isSlaWarning).length.toString(),
        detail: 'Open call records older than four hours',
        accent: '#fd7e14',
      },
      {
        label: 'Overdue Follow-Ups',
        value: records.filter((record) => record.isFollowUpOverdue).length.toString(),
        detail: 'Past the scheduled callback time',
        accent: '#c81e1e',
      },
    ],
    [currentUserId, records]
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

  const filteredRecords = useMemo(() => {
    const query = filters.query.trim().toLowerCase()

    return records.filter((record) => {
      if (filters.status !== 'ALL' && record.status !== filters.status) return false
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
  }, [currentUserId, filters, records])

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
        <div className="topbar-inner">
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

      <main className="main-content">
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
                {loadingRecords ? 'Loading records…' : `${filteredRecords.length} of ${records.length} call records shown.`}
              </p>
            </div>
            <button className="ghost-btn" onClick={() => window.location.reload()}>
              Refresh
            </button>
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
                    status: 'ALL',
                    assignedTo: 'ALL',
                    priority: 'ALL',
                    callType: 'ALL',
                    sourceType: 'ALL',
                    serviceCategory: 'ALL',
                    unassignedOnly: false,
                    mineOnly: false,
                    overdueOnly: false,
                    dueTodayOnly: false,
                  })
                }
              >
                Clear Filters
              </button>
            </div>
          </div>

          {loadingRecords ? (
            <div style={{ padding: '2rem 0', color: 'var(--kline-text-light)' }}>Loading call records…</div>
          ) : filteredRecords.length === 0 ? (
            <div style={{ padding: '2rem 0', color: 'var(--kline-text-light)' }}>
              {records.length === 0
                ? 'No call records yet. The next safe test is to create an answered call or voicemail manually.'
                : 'No call records match the current filters.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                  {filteredRecords.map((record) => (
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
                      <td style={{ padding: '0.9rem 0.75rem', color: 'var(--kline-text)' }}>{record.assignedToUser?.email || 'Unassigned'}</td>
                      <td style={{ padding: '0.9rem 0.75rem', minWidth: 320 }}>
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
                      <td style={{ padding: '0.9rem 0.75rem', color: 'var(--kline-text-light)', whiteSpace: 'nowrap' }}>
                        {record.callbackAttemptCount} callbacks · {record.activityCount} events
                      </td>
                      <td style={{ padding: '0.9rem 0.75rem' }}>
                        <button className="ghost-btn" onClick={() => router.push(`/calls-inbox/${record.id}`)}>
                          View
                        </button>
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
