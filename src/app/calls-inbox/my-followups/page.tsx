'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CallsInboxApiResponse,
  CallsInboxRecord,
  callPriorityOptions,
  callSourceOptions,
  callStatusOptions,
  formatEnumLabel,
} from '@/lib/callsInbox'

const followUpColumns = [
  { key: 'CALLBACK_PENDING', title: 'Callback Pending', color: '#fd7e14' },
  { key: 'CALLBACK_ATTEMPTED', title: 'Attempted', color: '#0d6efd' },
  { key: 'RESOLVED', title: 'Resolved', color: '#198754' },
] as const

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

function getAgeAccent(record: CallsInboxRecord) {
  if (record.isSlaBreached) return '#c81e1e'
  if (record.isSlaWarning) return '#fd7e14'
  return '#198754'
}

export default function MyFollowUpsPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [records, setRecords] = useState<CallsInboxRecord[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [moduleReady, setModuleReady] = useState(true)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    query: '',
    status: 'ALL',
    priority: 'ALL',
    sourceType: 'ALL',
    serviceCategory: 'ALL',
    overdueOnly: false,
    dueTodayOnly: false,
    unresolvedOnly: false,
    voicemailOnly: false,
  })

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        const authRes = await fetch('/api/auth/check', { cache: 'no-store' })
        if (!authRes.ok) {
          router.replace('/auth/login')
          return
        }

        const authData = (await authRes.json()) as {
          user?: { canAccessCallsInbox?: boolean; accessScope?: 'ALL' | 'PERMITS_ONLY' }
        }

        if (cancelled) return

        const canAccess = authData.user?.canAccessCallsInbox === true && authData.user?.accessScope !== 'PERMITS_ONLY'
        setAuthorized(canAccess)

        if (!canAccess) {
          router.replace(authData.user?.accessScope === 'PERMITS_ONLY' ? '/tasks' : '/dashboard')
          return
        }

        const res = await fetch('/api/calls-inbox', { cache: 'no-store' })
        const data = (await res.json()) as CallsInboxApiResponse

        if (cancelled) return

        if (!res.ok) {
          setRecords([])
          setMessage('Unable to load follow-ups right now.')
          setLoading(false)
          return
        }

        setRecords(data.records)
        setCurrentUserId(data.currentUserId)
        setModuleReady(data.moduleReady)
        setMessage(data.message || '')
      } catch {
        if (!cancelled) {
          setRecords([])
          setMessage('Unable to load follow-ups right now.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    bootstrap()
    return () => {
      cancelled = true
    }
  }, [router])

  const myRecords = useMemo(
    () => records.filter((record) => record.assignedToUserId === currentUserId),
    [currentUserId, records]
  )

  const serviceCategoryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          myRecords
            .map((record) => record.detectedServiceCategory)
            .filter((value): value is string => Boolean(value))
        )
      ),
    [myRecords]
  )

  const filteredRecords = useMemo(() => {
    const query = filters.query.trim().toLowerCase()

    return myRecords.filter((record) => {
      if (filters.status !== 'ALL' && record.status !== filters.status) return false
      if (filters.priority !== 'ALL' && record.priority !== filters.priority) return false
      if (filters.sourceType !== 'ALL' && record.sourceType !== filters.sourceType) return false
      if (filters.serviceCategory !== 'ALL' && (record.detectedServiceCategory || '') !== filters.serviceCategory) return false
      if (filters.overdueOnly && !record.isFollowUpOverdue) return false
      if (filters.dueTodayOnly && !record.isFollowUpDueToday) return false
      if (filters.unresolvedOnly && ['RESOLVED', 'CLOSED', 'SPAM'].includes(record.status)) return false
      if (filters.voicemailOnly && record.sourceType !== 'VOICEMAIL') return false

      if (!query) return true

      const haystack = [
        record.callerNameRaw,
        record.phoneNumber,
        record.summary,
        record.transcriptRaw,
        record.detectedAddress,
        record.detectedTown,
        record.property?.address,
        record.customer?.fullName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [filters, myRecords])

  const personalSummaryCards = useMemo(
    () => [
      {
        label: 'Callback Pending',
        value: filteredRecords.filter((record) => record.status === 'CALLBACK_PENDING').length,
        accent: '#fd7e14',
      },
      {
        label: 'Overdue',
        value: filteredRecords.filter((record) => record.isFollowUpOverdue).length,
        accent: '#c81e1e',
      },
      {
        label: 'Due Today',
        value: filteredRecords.filter((record) => record.isFollowUpDueToday).length,
        accent: '#0d6efd',
      },
      {
        label: 'Resolved',
        value: filteredRecords.filter((record) => record.status === 'RESOLVED').length,
        accent: '#198754',
      },
    ],
    [filteredRecords]
  )

  if (authorized === null) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--kline-gray-light)' }}>
        <div className="kline-card" style={{ padding: '2rem 2.5rem', textAlign: 'center' }}>
          <h2 style={{ margin: 0, color: 'var(--kline-text)' }}>Loading My Follow-Ups…</h2>
          <p style={{ margin: '0.75rem 0 0', color: 'var(--kline-text-light)' }}>Preparing the personal callback queue.</p>
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
                MY <span>FOLLOW-UPS</span>
              </h1>
              <p>Personal callback board</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="ghost-btn" onClick={() => router.push('/calls-inbox')}>
              Calls Inbox
            </button>
            <button className="ghost-btn" onClick={() => router.push('/dashboard')}>
              Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <section className="hero" style={{ marginBottom: '1.5rem' }}>
          <div>
            <p className="hero-overline">Personal Queue</p>
            <h2>My Follow-Ups</h2>
            <p className="hero-subtitle">
              This board shows only the call records currently assigned to the signed-in user.
            </p>
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {personalSummaryCards.map((card) => (
            <div key={card.label} className="kline-card" style={{ padding: '1.2rem 1.3rem', borderTop: `4px solid ${card.accent}` }}>
              <div style={{ fontSize: '0.8rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--kline-text-light)', fontWeight: 800 }}>
                {card.label}
              </div>
              <div style={{ marginTop: 8, fontSize: '1.65rem', fontWeight: 900, color: 'var(--kline-text)' }}>{card.value}</div>
            </div>
          ))}
        </section>

        <section className="kline-card" style={{ padding: '1.25rem 1.35rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, color: 'var(--kline-text)' }}>Filter my queue</h3>
              <p style={{ margin: '0.4rem 0 0', color: 'var(--kline-text-light)' }}>
                {loading ? 'Loading assigned records…' : `${filteredRecords.length} of ${myRecords.length} assigned records shown.`}
              </p>
            </div>
            <button
              className="ghost-btn"
              type="button"
              onClick={() =>
                setFilters({
                  query: '',
                  status: 'ALL',
                  priority: 'ALL',
                  sourceType: 'ALL',
                  serviceCategory: 'ALL',
                  overdueOnly: false,
                  dueTodayOnly: false,
                  unresolvedOnly: false,
                  voicemailOnly: false,
                })
              }
            >
              Clear Filters
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.85rem',
              padding: '1rem',
              borderRadius: 16,
              background: 'rgba(255,255,255,0.72)',
              border: '1px solid var(--kline-gray)',
            }}
          >
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.45rem', color: 'var(--kline-text)' }}>Search</label>
              <input
                className="kline-input"
                value={filters.query}
                onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
                placeholder="Search caller, phone, summary, address or customer..."
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

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap', gridColumn: '1 / -1' }}>
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
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--kline-text)' }}>
                <input
                  type="checkbox"
                  checked={filters.unresolvedOnly}
                  onChange={(event) => setFilters((current) => ({ ...current, unresolvedOnly: event.target.checked }))}
                />
                Unresolved only
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--kline-text)' }}>
                <input
                  type="checkbox"
                  checked={filters.voicemailOnly}
                  onChange={(event) => setFilters((current) => ({ ...current, voicemailOnly: event.target.checked }))}
                />
                Voicemails only
              </label>
            </div>
          </div>
        </section>

        {!moduleReady && (
          <section className="kline-card" style={{ padding: '1.2rem 1.4rem', marginBottom: '1.25rem', borderLeft: '5px solid #fd7e14' }}>
            <strong style={{ color: 'var(--kline-text)' }}>Module activation pending.</strong>
            <p style={{ margin: '0.45rem 0 0', color: 'var(--kline-text-light)' }}>{message || 'Database tables are not active yet.'}</p>
          </section>
        )}

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          {followUpColumns.map((column) => {
            const items = filteredRecords
              .filter((record) => record.status === column.key)
              .sort((a, b) => {
                const aDue = a.latestNextFollowUpAt ? new Date(a.latestNextFollowUpAt).getTime() : Number.MAX_SAFE_INTEGER
                const bDue = b.latestNextFollowUpAt ? new Date(b.latestNextFollowUpAt).getTime() : Number.MAX_SAFE_INTEGER
                return aDue - bDue
              })

            return (
              <article key={column.title} className="kline-card" style={{ padding: '1.4rem', borderTop: `4px solid ${column.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
                  <h3 style={{ marginTop: 0, marginBottom: 0, color: 'var(--kline-text)' }}>{column.title}</h3>
                  <span style={{ fontWeight: 800, color: column.color }}>{items.length}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1rem' }}>
                  {loading ? (
                    <div style={{ color: 'var(--kline-text-light)' }}>Loading…</div>
                  ) : items.length === 0 ? (
                    <div style={{ padding: '0.95rem 1rem', borderRadius: 12, background: '#fff', border: '1px solid var(--kline-gray)', color: 'var(--kline-text-light)' }}>
                      No records in {column.title.toLowerCase()}.
                    </div>
                  ) : (
                    items.map((item) => (
                      <div key={item.id} style={{ padding: '0.9rem 1rem', borderRadius: 12, background: '#fff', border: '1px solid var(--kline-gray)' }}>
                        <div style={{ fontWeight: 800, color: 'var(--kline-text)' }}>{item.callerNameRaw || 'Unknown caller'}</div>
                        <div style={{ color: 'var(--kline-text-light)', marginTop: 4 }}>{item.phoneNumber || 'No phone number captured'}</div>
                        <div style={{ color: 'var(--kline-text)', marginTop: 8 }}>{item.summary}</div>
                        <div style={{ color: 'var(--kline-text-light)', marginTop: 8, fontSize: '0.92rem' }}>
                          {formatEnumLabel(item.sourceType)} · {formatReceivedAt(item.receivedAt)}
                        </div>
                        {item.detectedServiceCategory && (
                          <div style={{ marginTop: 8, display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                            <span style={{ padding: '0.22rem 0.55rem', borderRadius: 999, background: 'rgba(13, 110, 253, 0.10)', color: '#0d6efd', fontSize: '0.82rem', fontWeight: 700 }}>
                              {formatEnumLabel(item.detectedServiceCategory)}
                            </span>
                            <span
                              style={{
                                padding: '0.22rem 0.55rem',
                                borderRadius: 999,
                                background: `${getAgeAccent(item)}14`,
                                color: getAgeAccent(item),
                                fontSize: '0.82rem',
                                fontWeight: 800,
                              }}
                            >
                              Age {item.ageLabel}
                            </span>
                          </div>
                        )}
                        {!item.detectedServiceCategory && (
                          <div style={{ marginTop: 8 }}>
                            <span
                              style={{
                                padding: '0.22rem 0.55rem',
                                borderRadius: 999,
                                background: `${getAgeAccent(item)}14`,
                                color: getAgeAccent(item),
                                fontSize: '0.82rem',
                                fontWeight: 800,
                              }}
                            >
                              Age {item.ageLabel}
                            </span>
                          </div>
                        )}
                        {item.latestNextFollowUpAt && (
                          <div
                            style={{
                              marginTop: 8,
                              color: item.isFollowUpOverdue ? '#c81e1e' : item.isFollowUpDueToday ? '#fd7e14' : 'var(--kline-text-light)',
                              fontSize: '0.9rem',
                              fontWeight: item.isFollowUpOverdue || item.isFollowUpDueToday ? 800 : 600,
                            }}
                          >
                            {item.isFollowUpOverdue ? 'Overdue follow-up' : item.isFollowUpDueToday ? 'Follow-up due today' : 'Next follow-up'} ·{' '}
                            {formatFollowUpAt(item.latestNextFollowUpAt)}
                          </div>
                        )}
                        <button className="ghost-btn" style={{ marginTop: '0.85rem' }} onClick={() => router.push(`/calls-inbox/${item.id}`)}>
                          Open Record
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </article>
            )
          })}
        </section>
      </main>
    </div>
  )
}
