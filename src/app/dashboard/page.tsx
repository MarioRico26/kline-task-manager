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

interface ModuleCard {
  title: string
  description: string
  route: string
  color: string
  count: number
}

function formatDate(value: string | null) {
  if (!value) return 'Not scheduled'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not scheduled'
  return date.toLocaleDateString()
}

function KpiCard({
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
    <div className="kpi-card" style={{ borderTop: `3px solid ${accent}` }}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-detail">{detail}</div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    let canceled = false

    async function fetchDashboardData() {
      try {
        setLoading(true)
        setErrorMsg(null)

        const response = await fetch('/api/dashboard/stats', { cache: 'no-store' })
        if (!response.ok) {
          const message = await response.text().catch(() => '')
          throw new Error(`Dashboard request failed (${response.status}): ${message}`)
        }

        const data = (await response.json()) as DashboardStats
        if (!canceled) setStats(data)
      } catch (error: unknown) {
        console.error('Error fetching dashboard data:', error)
        if (!canceled) {
          const message = error instanceof Error ? error.message : 'Failed to load dashboard data'
          setErrorMsg(message)
        }
      } finally {
        if (!canceled) setLoading(false)
      }
    }

    fetchDashboardData()

    return () => {
      canceled = true
    }
  }, [])

  const handleLogout = () => {
    document.cookie = 'user-id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    window.location.href = '/auth/login'
  }

  const moduleCards = useMemo<ModuleCard[]>(
    () => [
      {
        title: 'Customer Portal',
        description: 'Profiles, contacts and account history',
        route: '/customers',
        color: '#198754',
        count: stats?.totalCustomers ?? 0,
      },
      {
        title: 'Property Management',
        description: 'Service addresses and locations',
        route: '/properties',
        color: '#fd7e14',
        count: stats?.totalProperties ?? 0,
      },
      {
        title: 'Task Management',
        description: 'Track and update active jobs',
        route: '/tasks',
        color: '#0d6efd',
        count: stats?.totalTasks ?? 0,
      },
      {
        title: 'Service Catalog',
        description: 'Service types and descriptions',
        route: '/services',
        color: '#6f42c1',
        count: stats?.totalServices ?? 0,
      },
      {
        title: 'Workflow Status',
        description: 'Statuses and notification behavior',
        route: '/statuses',
        color: '#20c997',
        count: stats?.totalStatuses ?? 0,
      },
      {
        title: 'User Administration',
        description: 'System users and permissions',
        route: '/users',
        color: '#dc3545',
        count: stats?.totalUsers ?? 0,
      },
    ],
    [stats]
  )

  const maxServiceCount = Math.max(1, ...(stats?.tasksByService.map((item) => item.count) ?? [1]))
  const maxStatusCount = Math.max(1, ...(stats?.tasksByStatus.map((item) => item.count) ?? [1]))

  return (
    <div className="dashboard-page">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-icon">K</div>
            <div>
              <h1>
                KLINE <span>TASKS</span>
              </h1>
              <p>Operations Dashboard</p>
            </div>
          </div>

          <button onClick={handleLogout} className="ghost-btn">
            Logout
          </button>
        </div>
      </header>

      <main className="main-content">
        <section className="hero">
          <div>
            <p className="hero-overline">Daily Operations</p>
            <h2>Dashboard Overview</h2>
            <p className="hero-subtitle">Cleaner snapshot of workload, progress and where to act next.</p>
          </div>

          <div className="hero-actions">
            <button onClick={() => router.push('/customers')} className="action-btn action-red">
              + New Customer
            </button>
            <button onClick={() => router.push('/properties')} className="action-btn action-orange">
              + New Property
            </button>
            <button onClick={() => router.push('/tasks/new')} className="action-btn action-green">
              + New Task
            </button>
          </div>
        </section>

        {loading && (
          <div className="state-card">
            <div className="spinner" />
            <p>Loading dashboard data...</p>
          </div>
        )}

        {!loading && errorMsg && (
          <div className="state-card error">
            <h3>Could not load dashboard</h3>
            <p>{errorMsg}</p>
            <button className="action-btn action-red" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        )}

        {!loading && !errorMsg && stats && (
          <>
            <section className="kpi-grid">
              <KpiCard
                label="Total Tasks"
                value={stats.totalTasks}
                detail={`${stats.completedTasks} completed`}
                accent="var(--kline-red)"
              />
              <KpiCard
                label="Pending Tasks"
                value={stats.pendingTasks}
                detail={stats.overdueTasks > 0 ? `${stats.overdueTasks} overdue` : 'On schedule'}
                accent="#fd7e14"
              />
              <KpiCard
                label="Customers"
                value={stats.totalCustomers}
                detail={`${stats.totalProperties} properties`}
                accent="#198754"
              />
              <KpiCard
                label="Services"
                value={stats.totalServices}
                detail="Active service catalog"
                accent="#6f42c1"
              />
            </section>

            <section className="content-grid">
              <div className="panel card-panel">
                <div className="panel-head">
                  <h3>Core Modules</h3>
                  <p>Navigate directly to each management area</p>
                </div>
                <div className="module-grid">
                  {moduleCards.map((card) => (
                    <button
                      key={card.route}
                      className="module-card"
                      onClick={() => router.push(card.route)}
                      style={{ borderLeft: `4px solid ${card.color}` }}
                    >
                      <div className="module-top">
                        <div>
                          <strong>{card.title}</strong>
                          <span>{card.description}</span>
                        </div>
                        <div className="module-count" style={{ background: `${card.color}1A`, color: card.color }}>
                          {card.count}
                        </div>
                      </div>
                      <div className="module-link" style={{ color: card.color }}>
                        Open Module
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="insight-stack">
                <div className="panel card-panel">
                  <div className="panel-head">
                    <h3>Tasks by Service</h3>
                    <p>Top services by workload</p>
                  </div>

                  {stats.tasksByService.length === 0 ? (
                    <div className="empty-state">No service data yet</div>
                  ) : (
                    <div className="bars">
                      {stats.tasksByService.slice(0, 6).map((item) => (
                        <div key={item.service} className="bar-row">
                          <div className="bar-label">{item.service}</div>
                          <div className="bar-track">
                            <div
                              className="bar-fill"
                              style={{ width: `${(item.count / maxServiceCount) * 100}%` }}
                            />
                          </div>
                          <div className="bar-value">{item.count}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="panel card-panel">
                  <div className="panel-head">
                    <h3>Tasks by Status</h3>
                    <p>Current pipeline distribution</p>
                  </div>

                  {stats.tasksByStatus.length === 0 ? (
                    <div className="empty-state">No status data yet</div>
                  ) : (
                    <div className="bars">
                      {stats.tasksByStatus.map((item) => (
                        <div key={item.status} className="bar-row">
                          <div className="bar-label status-label">
                            <span className="status-dot" style={{ backgroundColor: item.color || '#6c757d' }} />
                            {item.status}
                          </div>
                          <div className="bar-track">
                            <div
                              className="bar-fill"
                              style={{
                                width: `${(item.count / maxStatusCount) * 100}%`,
                                background: item.color || 'var(--kline-red)',
                              }}
                            />
                          </div>
                          <div className="bar-value">{item.count}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="panel card-panel recent-panel">
              <div className="panel-head row">
                <div>
                  <h3>Recent Tasks</h3>
                  <p>Last tasks created in the system</p>
                </div>
                <div className="recent-actions">
                  <button className="ghost-btn" onClick={() => router.push('/tasks/new')}>
                    + New Task
                  </button>
                  <button className="outline-red" onClick={() => router.push('/tasks')}>
                    View All Tasks
                  </button>
                </div>
              </div>

              {stats.recentTasks.length === 0 ? (
                <div className="empty-state">No recent tasks yet</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Service / Customer</th>
                        <th>Status</th>
                        <th>Scheduled</th>
                        <th>Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentTasks.map((task) => (
                        <tr key={task.id} onClick={() => router.push('/tasks')}>
                          <td>
                            <strong>{task.service}</strong>
                            <span>{task.customer}</span>
                          </td>
                          <td>
                            <span className="status-pill">{task.status}</span>
                          </td>
                          <td>{formatDate(task.scheduledFor)}</td>
                          <td>{task.address}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <style jsx>{`
        .dashboard-page {
          min-height: 100vh;
          background: radial-gradient(circle at top right, #fff2dc 0%, #f5f5f5 30%, #f5f5f5 100%);
          color: var(--kline-text);
          font-family: var(--kline-font-sans);
        }

        .topbar {
          background: #fff;
          border-bottom: 1px solid var(--kline-gray);
          position: sticky;
          top: 0;
          z-index: 50;
          backdrop-filter: blur(8px);
        }

        .topbar-inner {
          max-width: 1320px;
          margin: 0 auto;
          padding: 0 28px;
          min-height: 84px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .brand-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          color: #fff;
          background: linear-gradient(160deg, #e30613, #b80510);
          box-shadow: 0 8px 18px rgba(227, 6, 19, 0.25);
        }

        .brand h1 {
          margin: 0;
          font-size: 1.4rem;
          line-height: 1.1;
          letter-spacing: -0.02em;
        }

        .brand h1 span {
          color: var(--kline-red);
        }

        .brand p {
          margin: 4px 0 0;
          color: var(--kline-text-light);
          font-size: 0.88rem;
        }

        .main-content {
          max-width: 1320px;
          margin: 0 auto;
          padding: 36px 28px 72px;
          display: grid;
          gap: 26px;
        }

        .hero {
          background: #fff;
          border: 1px solid var(--kline-gray);
          border-radius: 18px;
          padding: 28px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 24px;
          box-shadow: 0 8px 28px rgba(0, 0, 0, 0.06);
        }

        .hero-overline {
          margin: 0 0 10px;
          text-transform: uppercase;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: var(--kline-text-light);
        }

        .hero h2 {
          margin: 0;
          font-size: clamp(1.6rem, 2.8vw, 2.3rem);
          line-height: 1.1;
          letter-spacing: -0.02em;
        }

        .hero-subtitle {
          margin: 10px 0 0;
          color: var(--kline-text-light);
          font-size: 1rem;
          max-width: 680px;
        }

        .hero-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .action-btn {
          border: none;
          border-radius: 10px;
          padding: 11px 14px;
          font-size: 0.92rem;
          font-weight: 700;
          color: #fff;
          cursor: pointer;
          transition: transform 0.15s ease, opacity 0.15s ease;
        }

        .action-btn:hover {
          transform: translateY(-1px);
          opacity: 0.92;
        }

        .action-red {
          background: var(--kline-red);
        }

        .action-orange {
          background: #fd7e14;
        }

        .action-green {
          background: #198754;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 18px;
        }

        .kpi-card {
          background: #fff;
          border: 1px solid var(--kline-gray);
          border-radius: 14px;
          padding: 20px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);
        }

        .kpi-label {
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--kline-text-light);
        }

        .kpi-value {
          margin-top: 8px;
          font-size: clamp(1.8rem, 3vw, 2.2rem);
          line-height: 1.1;
          font-weight: 800;
        }

        .kpi-detail {
          margin-top: 8px;
          color: var(--kline-text-light);
          font-size: 0.92rem;
          font-weight: 600;
        }

        .content-grid {
          display: grid;
          grid-template-columns: 1.55fr 1fr;
          gap: 18px;
          align-items: start;
        }

        .card-panel {
          background: #fff;
          border: 1px solid var(--kline-gray);
          border-radius: 16px;
          padding: 22px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);
        }

        .panel-head h3 {
          margin: 0;
          font-size: 1.15rem;
        }

        .panel-head p {
          margin: 6px 0 0;
          color: var(--kline-text-light);
          font-size: 0.92rem;
        }

        .module-grid {
          margin-top: 16px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
        }

        .module-card {
          border: 1px solid var(--kline-gray);
          background: #fff;
          border-radius: 12px;
          padding: 14px;
          text-align: left;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .module-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.08);
        }

        .module-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .module-top strong {
          display: block;
          font-size: 0.96rem;
          margin-bottom: 3px;
          color: var(--kline-text);
        }

        .module-top span {
          display: block;
          font-size: 0.84rem;
          color: var(--kline-text-light);
          line-height: 1.35;
        }

        .module-count {
          min-width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 0.9rem;
        }

        .module-link {
          margin-top: 10px;
          font-size: 0.82rem;
          font-weight: 700;
        }

        .insight-stack {
          display: grid;
          gap: 18px;
        }

        .bars {
          margin-top: 14px;
          display: grid;
          gap: 10px;
        }

        .bar-row {
          display: grid;
          grid-template-columns: 120px 1fr 32px;
          gap: 10px;
          align-items: center;
        }

        .bar-label {
          font-size: 0.83rem;
          color: var(--kline-text);
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .status-label {
          display: inline-flex;
          align-items: center;
          gap: 7px;
        }

        .status-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
        }

        .bar-track {
          height: 8px;
          border-radius: 999px;
          background: #e9ecef;
          overflow: hidden;
        }

        .bar-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, var(--kline-red), var(--kline-yellow));
          transition: width 0.3s ease;
        }

        .bar-value {
          text-align: right;
          font-size: 0.82rem;
          font-weight: 800;
          color: var(--kline-text);
        }

        .recent-panel {
          padding-top: 20px;
        }

        .panel-head.row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
        }

        .recent-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .table-wrap {
          margin-top: 14px;
          border: 1px solid var(--kline-gray);
          border-radius: 12px;
          overflow-x: auto;
          background: #fff;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 760px;
        }

        th {
          text-align: left;
          padding: 12px 14px;
          font-size: 0.74rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--kline-text-light);
          background: var(--kline-gray-light);
          border-bottom: 1px solid var(--kline-gray);
        }

        td {
          padding: 14px;
          font-size: 0.9rem;
          color: var(--kline-text);
          border-bottom: 1px solid var(--kline-gray);
        }

        td strong {
          display: block;
          font-size: 0.92rem;
          margin-bottom: 3px;
        }

        td span {
          color: var(--kline-text-light);
          font-size: 0.84rem;
        }

        tbody tr {
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        tbody tr:hover {
          background: #fafafa;
        }

        .status-pill {
          display: inline-block;
          font-size: 0.77rem;
          font-weight: 700;
          border-radius: 999px;
          border: 1px solid #b8d5ff;
          background: #edf5ff;
          color: #0d6efd;
          padding: 5px 10px;
        }

        .state-card {
          border: 1px solid var(--kline-gray);
          border-radius: 14px;
          background: #fff;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);
          padding: 30px;
          text-align: center;
        }

        .state-card h3 {
          margin: 0;
          font-size: 1.1rem;
        }

        .state-card p {
          margin: 8px 0 0;
          color: var(--kline-text-light);
        }

        .state-card.error {
          border-left: 4px solid var(--kline-red);
          text-align: left;
        }

        .state-card.error .action-btn {
          margin-top: 12px;
        }

        .empty-state {
          margin-top: 12px;
          padding: 16px;
          border-radius: 10px;
          background: #f8f9fa;
          color: var(--kline-text-light);
          font-size: 0.9rem;
          font-weight: 600;
        }

        .spinner {
          width: 38px;
          height: 38px;
          margin: 0 auto 12px;
          border: 3px solid var(--kline-gray);
          border-top-color: var(--kline-red);
          border-radius: 50%;
          animation: spin 0.9s linear infinite;
        }

        .ghost-btn {
          padding: 10px 14px;
          background: #fff;
          color: var(--kline-text-light);
          font-weight: 700;
          border-radius: 10px;
          border: 1px solid var(--kline-gray);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ghost-btn:hover {
          border-color: #d0d0d0;
          color: var(--kline-text);
          transform: translateY(-1px);
        }

        .outline-red {
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid var(--kline-red);
          color: var(--kline-red);
          background: #fff;
          font-weight: 700;
          cursor: pointer;
        }

        .outline-red:hover {
          background: var(--kline-red);
          color: #fff;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1120px) {
          .content-grid {
            grid-template-columns: 1fr;
          }

          .hero {
            flex-direction: column;
            align-items: flex-start;
          }

          .hero-actions {
            justify-content: flex-start;
          }
        }

        @media (max-width: 760px) {
          .topbar-inner,
          .main-content {
            padding-left: 16px;
            padding-right: 16px;
          }

          .hero,
          .card-panel,
          .state-card {
            padding: 16px;
          }

          .panel-head.row {
            flex-direction: column;
            align-items: stretch;
          }

          .recent-actions {
            justify-content: flex-start;
          }

          .bar-row {
            grid-template-columns: 1fr;
            gap: 6px;
          }

          .bar-value {
            text-align: left;
          }

          .brand p {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}
