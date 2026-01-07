'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

interface DashboardStats {
  totalTasks: number
  totalCustomers: number
  totalServices: number
  totalUsers: number
  totalProperties: number
  totalStatuses: number
  completedTasks: number
  pendingTasks: number
  overdueTasks: number
  tasksByStatus: Array<{ status: string; count: number; color: string }>
  tasksByService: Array<{ service: string; count: number }>
  recentTasks: Array<{
    id: string
    service: string
    customer: string
    status: string
    scheduledFor: string | null
    address: string
  }>
}

function fmtDate(value: string | null) {
  if (!value) return 'Not scheduled'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'Not scheduled'
  return d.toLocaleDateString()
}

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setErrorMsg(null)

        const res = await fetch('/api/dashboard/stats', { cache: 'no-store' })
        if (!res.ok) {
          const txt = await res.text().catch(() => '')
          throw new Error(`Stats request failed: ${res.status}. ${txt}`)
        }

        const data = (await res.json()) as DashboardStats
        if (!cancelled) setStats(data)
      } catch (err: any) {
        console.error('❌ Dashboard load error:', err)
        if (!cancelled) setErrorMsg(err?.message || 'Failed to load dashboard stats')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const handleLogout = () => {
    document.cookie = 'user-id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    window.location.href = '/auth/login'
  }

  const quickModules = useMemo(
    () => [
      { title: 'Customers', desc: 'Clients & profiles', route: '/customers', count: stats?.totalCustomers ?? 0, color: '#198754' },
      { title: 'Properties', desc: 'Addresses & locations', route: '/properties', count: stats?.totalProperties ?? 0, color: '#fd7e14' },
      { title: 'Tasks', desc: 'Create & track work', route: '/tasks', count: stats?.totalTasks ?? 0, color: '#0d6efd' },
      { title: 'Services', desc: 'Service catalog', route: '/services', count: stats?.totalServices ?? 0, color: '#6f42c1' },
      { title: 'Statuses', desc: 'Workflow / automation', route: '/statuses', count: stats?.totalStatuses ?? 0, color: '#20c997' },
      { title: 'Users', desc: 'Access & roles', route: '/users', count: stats?.totalUsers ?? 0, color: '#dc3545' },
    ],
    [stats]
  )

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
                  Dashboard
                </p>
              </div>
            </div>

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
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '28px 20px 60px' }}>
        {/* Top title + actions */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: 'var(--kline-text)' }}>Overview</h2>
            <p style={{ margin: '6px 0 0', color: 'var(--kline-text-light)', fontSize: '1rem' }}>
              Quick snapshot of operations
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => router.push('/customers')}
              style={{
                padding: '10px 14px',
                background: 'var(--kline-red)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              + Customer
            </button>
            <button
              onClick={() => router.push('/properties')}
              style={{
                padding: '10px 14px',
                background: '#fd7e14',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              + Property
            </button>
            <button
              onClick={() => router.push('/tasks')}
              style={{
                padding: '10px 14px',
                background: '#198754',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              + Task
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
            <div style={{ color: 'var(--kline-text-light)', fontWeight: 600 }}>Loading dashboard…</div>
          </div>
        )}

        {!loading && errorMsg && (
          <div className="kline-card" style={{ padding: 18, marginTop: 20, borderLeft: '4px solid #dc3545' }}>
            <div style={{ fontWeight: 800, color: 'var(--kline-text)' }}>Could not load dashboard</div>
            <div style={{ marginTop: 6, color: 'var(--kline-text-light)' }}>{errorMsg}</div>
            <button
              onClick={() => window.location.reload()}
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

        {/* Content */}
        {!loading && !errorMsg && stats && (
          <>
            {/* KPIs */}
            <div
              style={{
                marginTop: 22,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 16,
              }}
            >
              <KpiCard label="Total Tasks" value={stats.totalTasks} accent="var(--kline-red)" sub={`${stats.completedTasks} completed`} />
              <KpiCard label="Pending" value={stats.pendingTasks} accent="#fd7e14" sub={stats.overdueTasks > 0 ? `${stats.overdueTasks} overdue` : 'On track'} />
              <KpiCard label="Customers" value={stats.totalCustomers} accent="#198754" sub={`${stats.totalProperties} properties`} />
              <KpiCard label="Services" value={stats.totalServices} accent="#6f42c1" sub="Active service types" />
            </div>

            {/* Modules + Recent tasks */}
            <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '1fr', gap: 18 }}>
              {/* Modules */}
              <div className="kline-card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--kline-text)' }}>Modules</div>
                    <div style={{ marginTop: 4, color: 'var(--kline-text-light)', fontSize: '0.95rem' }}>
                      Quick access to management sections
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 14,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 12,
                  }}
                >
                  {quickModules.map((m) => (
                    <button
                      key={m.route}
                      onClick={() => router.push(m.route)}
                      style={{
                        textAlign: 'left',
                        padding: 14,
                        borderRadius: 12,
                        background: '#fff',
                        border: '1px solid var(--kline-gray)',
                        cursor: 'pointer',
                        transition: 'transform .15s ease, box-shadow .15s ease',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)'
                        e.currentTarget.style.boxShadow = '0 10px 24px rgba(0,0,0,0.10)'
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 900, color: 'var(--kline-text)' }}>{m.title}</div>
                          <div style={{ marginTop: 2, color: 'var(--kline-text-light)', fontSize: '0.9rem' }}>{m.desc}</div>
                        </div>
                        <div
                          style={{
                            minWidth: 38,
                            height: 38,
                            borderRadius: 10,
                            background: m.color,
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 900,
                          }}
                        >
                          {m.count}
                        </div>
                      </div>

                      <div style={{ marginTop: 10, color: m.color, fontWeight: 800, fontSize: '0.9rem' }}>
                        Open →
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Recent Tasks */}
              <div className="kline-card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--kline-text)' }}>Recent Tasks</div>
                    <div style={{ marginTop: 4, color: 'var(--kline-text-light)', fontSize: '0.95rem' }}>
                      Latest created tasks
                    </div>
                  </div>

                  <button
                    onClick={() => router.push('/tasks')}
                    style={{
                      padding: '10px 14px',
                      background: 'transparent',
                      color: 'var(--kline-red)',
                      fontWeight: 800,
                      borderRadius: 10,
                      border: '2px solid var(--kline-red)',
                      cursor: 'pointer',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'var(--kline-red)'
                      e.currentTarget.style.color = '#fff'
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'var(--kline-red)'
                    }}
                  >
                    View all
                  </button>
                </div>

                <div style={{ marginTop: 14 }}>
                  {stats.recentTasks?.length ? (
                    <div style={{ border: '1px solid var(--kline-gray)', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: 'var(--kline-gray-light)' }}>
                            <Th>Service / Customer</Th>
                            <Th>Status</Th>
                            <Th>Scheduled</Th>
                            <Th>Address</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.recentTasks.map((t) => (
                            <tr
                              key={t.id}
                              style={{ cursor: 'pointer' }}
                              onClick={() => router.push(`/tasks`)}
                              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'var(--kline-gray-light)')}
                              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              <Td>
                                <div style={{ fontWeight: 900, color: 'var(--kline-text)' }}>{t.service}</div>
                                <div style={{ marginTop: 2, color: 'var(--kline-text-light)', fontSize: '0.9rem' }}>{t.customer}</div>
                              </Td>
                              <Td>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '6px 10px',
                                    borderRadius: 10,
                                    fontWeight: 900,
                                    fontSize: '0.8rem',
                                    background: '#e7f1ff',
                                    color: '#0d6efd',
                                    border: '1px solid #b3d4ff',
                                  }}
                                >
                                  {t.status}
                                </span>
                              </Td>
                              <Td>{fmtDate(t.scheduledFor)}</Td>
                              <Td>{t.address}</Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: 28, textAlign: 'center', color: 'var(--kline-text-light)', fontWeight: 700 }}>
                      No tasks yet. Create one with “+ Task”.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
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

function KpiCard({ label, value, sub, accent }: { label: string; value: number; sub: string; accent: string }) {
  return (
    <div className="kline-card" style={{ padding: 18, borderLeft: `5px solid ${accent}` }}>
      <div style={{ color: 'var(--kline-text-light)', fontWeight: 900, letterSpacing: '.5px', textTransform: 'uppercase', fontSize: '0.8rem' }}>
        {label}
      </div>
      <div style={{ marginTop: 6, fontSize: '2.2rem', fontWeight: 1000, color: 'var(--kline-text)' }}>{value}</div>
      <div style={{ marginTop: 4, color: 'var(--kline-text-light)', fontWeight: 700 }}>{sub}</div>
    </div>
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
