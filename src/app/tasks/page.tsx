'use client'

import { useEffect, useState } from 'react'
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
    } catch (err: any) {
      console.error('❌ Tasks load error:', err)
      setErrorMsg(err?.message || 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [])

  const handleLogout = () => {
    document.cookie = 'user-id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    window.location.href = '/auth/login'
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--kline-gray-light)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
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
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
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

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '28px 20px 60px' }}>
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
            {tasks.length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center', color: 'var(--kline-text-light)', fontWeight: 700 }}>
                No tasks yet. Create one to get started.
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
                    {tasks.map((t) => (
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

function Th({ children }: { children: any }) {
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

function Td({ children }: { children: any }) {
  return (
    <td style={{ padding: '14px 12px', borderBottom: '1px solid var(--kline-gray)', color: 'var(--kline-text)', fontWeight: 700, fontSize: '0.9rem' }}>
      {children}
    </td>
  )
}
