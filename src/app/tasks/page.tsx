'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

interface TaskItem {
  id: string
  scheduledFor: string | null
  createdAt: string
  customer: {
    fullName: string
    email: string | null
    phone: string | null
  }
  property: {
    address: string
    city: string
    state: string
    zip: string
  }
  service: {
    name: string
    description?: string | null
  }
  status: {
    name: string
    color?: string | null
  }
  media: Array<{ id: string; url: string }>
}

function fmtDate(value: string | null) {
  if (!value) return 'Not scheduled'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'Not scheduled'
  return d.toLocaleDateString()
}

function fmtDateTime(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

export default function TasksPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [serviceFilter, setServiceFilter] = useState('ALL')
  const [scheduleFilter, setScheduleFilter] = useState<'ALL' | 'SCHEDULED' | 'UNSCHEDULED'>('ALL')

  const loadTasks = async () => {
    try {
      setLoading(true)
      setErrorMsg(null)
      const res = await fetch('/api/tasks', { cache: 'no-store' })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`Tasks request failed: ${res.status}. ${txt}`)
      }
      const data = (await res.json()) as TaskItem[]
      setTasks(data)
    } catch (err: unknown) {
      console.error('❌ Tasks load error:', err)
      const message = err instanceof Error ? err.message : 'Failed to load tasks'
      setErrorMsg(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [])

  const statusOptions = useMemo(() => {
    const statuses = new Set(tasks.map((task) => task.status?.name).filter(Boolean))
    return ['ALL', ...Array.from(statuses).sort()]
  }, [tasks])

  const serviceOptions = useMemo(() => {
    const services = new Set(tasks.map((task) => task.service?.name).filter(Boolean))
    return ['ALL', ...Array.from(services).sort()]
  }, [tasks])

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase()

    return tasks.filter((task) => {
      if (statusFilter !== 'ALL' && task.status?.name !== statusFilter) return false
      if (serviceFilter !== 'ALL' && task.service?.name !== serviceFilter) return false
      if (scheduleFilter === 'SCHEDULED' && !task.scheduledFor) return false
      if (scheduleFilter === 'UNSCHEDULED' && task.scheduledFor) return false

      if (!query) return true

      const haystack = [
        task.service?.name,
        task.service?.description,
        task.customer?.fullName,
        task.customer?.email,
        task.customer?.phone,
        task.property?.address,
        task.property?.city,
        task.property?.state,
        task.status?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [tasks, search, statusFilter, serviceFilter, scheduleFilter])

  const handleLogout = () => {
    document.cookie = 'user-id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    window.location.href = '/auth/login'
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--kline-gray-light)',
        fontFamily: 'var(--kline-font-sans)',
      }}
    >
      {/* Header */}
      <header
        style={{
          background: '#fff',
          borderBottom: '1px solid var(--kline-gray)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '80px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  background: 'var(--kline-red)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(227, 6, 19, 0.25)',
                }}
              >
                <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1.2rem' }}>K</span>
              </div>
              <div>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--kline-text)' }}>
                  KLINE <span style={{ color: 'var(--kline-red)' }}>TASKS</span>
                </h1>
                <p style={{ margin: '2px 0 0', color: 'var(--kline-text-light)', fontSize: '0.9rem' }}>
                  Tasks
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                onClick={() => router.push('/dashboard')}
                style={{
                  padding: '10px 14px',
                  background: 'transparent',
                  color: 'var(--kline-text-light)',
                  fontWeight: 700,
                  borderRadius: '10px',
                  border: '2px solid var(--kline-gray)',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                Dashboard
              </button>
              <button
                onClick={handleLogout}
                style={{
                  padding: '10px 18px',
                  background: 'transparent',
                  color: 'var(--kline-text-light)',
                  fontWeight: 600,
                  borderRadius: '10px',
                  border: '2px solid var(--kline-gray)',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'var(--kline-red)'
                  e.currentTarget.style.color = '#fff'
                  e.currentTarget.style.borderColor = 'var(--kline-red)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--kline-text-light)'
                  e.currentTarget.style.borderColor = 'var(--kline-gray)'
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '28px 20px 60px' }}>
        {/* Title + actions */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: 'var(--kline-text)' }}>All Tasks</h2>
            <p style={{ margin: '6px 0 0', color: 'var(--kline-text-light)', fontSize: '1rem' }}>
              Latest tasks from the system
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => router.push('/tasks/new')}
              style={{
                padding: '10px 14px',
                background: 'var(--kline-red)',
                color: '#fff',
                fontWeight: 800,
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              + New Task
            </button>
            <button
              onClick={loadTasks}
              style={{
                padding: '10px 14px',
                background: 'transparent',
                color: 'var(--kline-text)',
                fontWeight: 700,
                borderRadius: '10px',
                border: '2px solid var(--kline-gray)',
                cursor: 'pointer',
              }}
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="kline-card" style={{ marginTop: 20, padding: 16 }}>
          <div className="task-filters-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.8fr) repeat(3, minmax(160px, 1fr))', gap: 10 }}>
            <input
              type="text"
              className="kline-input"
              placeholder="Search customer, service, address, status..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="kline-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status === 'ALL' ? 'All statuses' : status}
                </option>
              ))}
            </select>
            <select className="kline-input" value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
              {serviceOptions.map((service) => (
                <option key={service} value={service}>
                  {service === 'ALL' ? 'All services' : service}
                </option>
              ))}
            </select>
            <select
              className="kline-input"
              value={scheduleFilter}
              onChange={(e) => setScheduleFilter(e.target.value as 'ALL' | 'SCHEDULED' | 'UNSCHEDULED')}
            >
              <option value="ALL">All schedule types</option>
              <option value="SCHEDULED">Scheduled only</option>
              <option value="UNSCHEDULED">Unscheduled only</option>
            </select>
          </div>
          <div style={{ marginTop: 10, color: 'var(--kline-text-light)', fontSize: '0.85rem', fontWeight: 600 }}>
            Showing {filteredTasks.length} of {tasks.length} tasks
          </div>
        </div>

        {/* Loading / error */}
        {loading && (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <div
              style={{
                width: 40,
                height: 40,
                border: '3px solid var(--kline-gray)',
                borderTop: '3px solid var(--kline-red)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 14px',
              }}
            />
            <div style={{ color: 'var(--kline-text-light)', fontWeight: 600 }}>Loading tasks…</div>
          </div>
        )}

        {!loading && errorMsg && (
          <div className="kline-card" style={{ padding: 18, marginTop: 20, borderLeft: '4px solid #dc3545' }}>
            <div style={{ fontWeight: 800, color: 'var(--kline-text)' }}>Could not load tasks</div>
            <div style={{ marginTop: 6, color: 'var(--kline-text-light)' }}>{errorMsg}</div>
            <button
              onClick={loadTasks}
              style={{
                marginTop: 12,
                padding: '10px 14px',
                background: 'var(--kline-red)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !errorMsg && (
          <div className="kline-card" style={{ padding: 18, marginTop: 22 }}>
            {filteredTasks.length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center', color: 'var(--kline-text-light)', fontWeight: 700 }}>
                {tasks.length === 0 ? 'No tasks yet. Create one to get started.' : 'No tasks match the current filters.'}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
                  <thead>
                    <tr style={{ background: 'var(--kline-gray-light)' }}>
                      <Th>Service</Th>
                      <Th>Customer</Th>
                      <Th>Status</Th>
                      <Th>Scheduled</Th>
                      <Th>Property</Th>
                      <Th>Created</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((t) => (
                      <tr key={t.id}>
                        <Td>
                          <div style={{ fontWeight: 900, color: 'var(--kline-text)' }}>{t.service?.name || '—'}</div>
                          {t.service?.description ? (
                            <div style={{ marginTop: 2, color: 'var(--kline-text-light)', fontSize: '0.85rem' }}>
                              {t.service.description}
                            </div>
                          ) : null}
                        </Td>
                        <Td>
                          <div style={{ fontWeight: 900, color: 'var(--kline-text)' }}>{t.customer?.fullName || '—'}</div>
                          <div style={{ marginTop: 2, color: 'var(--kline-text-light)', fontSize: '0.85rem' }}>
                            {t.customer?.email || t.customer?.phone || '—'}
                          </div>
                        </Td>
                        <Td>
                          <StatusBadge name={t.status?.name || 'Unknown'} color={t.status?.color || '#0d6efd'} />
                        </Td>
                        <Td>{fmtDate(t.scheduledFor)}</Td>
                        <Td>
                          <div style={{ fontWeight: 800, color: 'var(--kline-text)' }}>{t.property?.address || '—'}</div>
                          <div style={{ marginTop: 2, color: 'var(--kline-text-light)', fontSize: '0.85rem' }}>
                            {t.property ? `${t.property.city}, ${t.property.state} ${t.property.zip}` : '—'}
                          </div>
                        </Td>
                        <Td>{fmtDateTime(t.createdAt)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @media (max-width: 980px) {
          .task-filters-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}

function StatusBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '6px 10px',
        borderRadius: 10,
        fontWeight: 900,
        fontSize: '0.8rem',
        background: `${color}1A`,
        color,
        border: `1px solid ${color}55`,
      }}
    >
      {name}
    </span>
  )
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th
      style={{
        padding: '14px 12px',
        textAlign: 'left',
        fontSize: '0.75rem',
        fontWeight: 900,
        color: 'var(--kline-text-light)',
        textTransform: 'uppercase',
        borderBottom: '1px solid var(--kline-gray)',
      }}
    >
      {children}
    </th>
  )
}

function Td({ children }: { children: ReactNode }) {
  return (
    <td style={{ padding: '14px 12px', borderBottom: '1px solid var(--kline-gray)', color: 'var(--kline-text)', fontWeight: 700, fontSize: '0.9rem' }}>
      {children}
    </td>
  )
}
