'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type TaskItem = {
  id: string
  scheduledFor: string | null
  createdAt: string
  customer: {
    fullName: string
  }
  property: {
    address: string
    city: string
    state: string
  }
  service: {
    name: string
  }
  status: {
    name: string
    color?: string | null
  }
}

function startOfWeek(date: Date) {
  const next = new Date(date)
  const day = next.getDay()
  const diff = day === 0 ? -6 : 1 - day
  next.setDate(next.getDate() + diff)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatDayTitle(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(value: string | null) {
  if (!value) return 'No time'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No time'
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function formatWeekRange(weekStart: Date) {
  const weekEnd = addDays(weekStart, 6)
  return `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}

function isCompletedStatus(statusName: string) {
  return statusName.trim().toLowerCase() === 'completed'
}

export default function PlannerPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [authorized, setAuthorized] = useState<boolean | null>(null)

  const loadPlanner = useCallback(async () => {
    try {
      setLoading(true)
      setErrorMsg(null)

      const authResponse = await fetch('/api/auth/check', { cache: 'no-store' })
      if (!authResponse.ok) {
        router.push('/auth/login')
        return
      }

      const authData = (await authResponse.json()) as { user?: { canAccessPlanner?: boolean } }
      if (!authData.user?.canAccessPlanner) {
        setAuthorized(false)
        return
      }

      setAuthorized(true)

      const tasksResponse = await fetch('/api/tasks', { cache: 'no-store' })
      if (!tasksResponse.ok) {
        const message = await tasksResponse.text().catch(() => '')
        throw new Error(`Tasks request failed (${tasksResponse.status}): ${message}`)
      }

      const data = (await tasksResponse.json()) as TaskItem[]
      setTasks(data)
    } catch (error: unknown) {
      console.error('Planner load error:', error)
      setErrorMsg(error instanceof Error ? error.message : 'Failed to load planner')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    loadPlanner()
  }, [loadPlanner])

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart])

  const statusOptions = useMemo(() => {
    const values = new Set(tasks.map((task) => task.status?.name).filter(Boolean))
    return ['ALL', ...Array.from(values).sort()]
  }, [tasks])

  const visibleTasks = useMemo(() => {
    const query = search.trim().toLowerCase()
    return tasks.filter((task) => {
      if (statusFilter !== 'ALL' && task.status.name !== statusFilter) return false
      if (!query) return true

      const haystack = [
        task.service.name,
        task.customer.fullName,
        task.property.address,
        task.property.city,
        task.property.state,
        task.status.name,
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [tasks, search, statusFilter])

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskItem[]>()

    weekDays.forEach((day) => {
      map.set(day.toDateString(), [])
    })

    visibleTasks.forEach((task) => {
      if (!task.scheduledFor) return
      const scheduled = new Date(task.scheduledFor)
      if (Number.isNaN(scheduled.getTime())) return
      const match = weekDays.find((day) => isSameDay(day, scheduled))
      if (!match) return
      map.get(match.toDateString())?.push(task)
    })

    map.forEach((dayTasks) => {
      dayTasks.sort((a, b) => {
        const aTime = a.scheduledFor ? new Date(a.scheduledFor).getTime() : 0
        const bTime = b.scheduledFor ? new Date(b.scheduledFor).getTime() : 0
        return aTime - bTime
      })
    })

    return map
  }, [visibleTasks, weekDays])

  const unscheduledCount = visibleTasks.filter((task) => !task.scheduledFor).length
  const scheduledThisWeek = Array.from(tasksByDay.values()).reduce((sum, dayTasks) => sum + dayTasks.length, 0)
  const completedThisWeek = Array.from(tasksByDay.values())
    .flat()
    .filter((task) => isCompletedStatus(task.status.name)).length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--kline-gray-light)', fontFamily: 'var(--kline-font-sans)' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid var(--kline-gray)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 22px', height: 76, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--kline-red)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900 }}>
              K
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.45rem', color: 'var(--kline-text)', fontWeight: 900 }}>Planner</h1>
              <p style={{ margin: '2px 0 0', color: 'var(--kline-text-light)', fontSize: '0.9rem' }}>Weekly task schedule</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="kline-btn-secondary" onClick={() => router.push('/dashboard')}>
              Dashboard
            </button>
            <button type="button" className="kline-btn-primary" onClick={() => router.push('/tasks/new')}>
              + New Task
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1440, margin: '0 auto', padding: '28px 22px 44px' }}>
        <section className="kline-card" style={{ padding: 24, marginBottom: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <div style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 900, color: 'var(--kline-text-light)', fontSize: '0.78rem' }}>
                Schedule Board
              </div>
              <h2 style={{ margin: '8px 0 0', fontSize: '2rem', color: 'var(--kline-text)', fontWeight: 900 }}>
                {formatWeekRange(weekStart)}
              </h2>
              <p style={{ margin: '8px 0 0', color: 'var(--kline-text-light)' }}>
                Plan daily workload and quickly spot unscheduled work.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="kline-btn-secondary" onClick={() => setWeekStart(addDays(weekStart, -7))}>
                Previous
              </button>
              <button type="button" className="kline-btn-secondary" onClick={() => setWeekStart(startOfWeek(new Date()))}>
                Today
              </button>
              <button type="button" className="kline-btn-secondary" onClick={() => setWeekStart(addDays(weekStart, 7))}>
                Next
              </button>
            </div>
          </div>

          <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div style={{ padding: 14, border: '1px solid var(--kline-gray)', borderRadius: 12 }}>
              <div style={{ color: 'var(--kline-text-light)', fontSize: '0.78rem', fontWeight: 800 }}>Scheduled This Week</div>
              <div style={{ marginTop: 4, fontSize: '1.7rem', fontWeight: 900, color: 'var(--kline-text)' }}>{scheduledThisWeek}</div>
            </div>
            <div style={{ padding: 14, border: '1px solid var(--kline-gray)', borderRadius: 12 }}>
              <div style={{ color: 'var(--kline-text-light)', fontSize: '0.78rem', fontWeight: 800 }}>Completed This Week</div>
              <div style={{ marginTop: 4, fontSize: '1.7rem', fontWeight: 900, color: '#198754' }}>{completedThisWeek}</div>
            </div>
            <div style={{ padding: 14, border: '1px solid var(--kline-gray)', borderRadius: 12 }}>
              <div style={{ color: 'var(--kline-text-light)', fontSize: '0.78rem', fontWeight: 800 }}>Unscheduled</div>
              <div style={{ marginTop: 4, fontSize: '1.7rem', fontWeight: 900, color: unscheduledCount ? 'var(--kline-red)' : 'var(--kline-text)' }}>{unscheduledCount}</div>
            </div>
          </div>
        </section>

        {loading && (
          <div className="kline-card" style={{ padding: 32, textAlign: 'center', color: 'var(--kline-text-light)' }}>
            Loading planner...
          </div>
        )}

        {!loading && authorized === false && (
          <div className="kline-card" style={{ padding: 32, textAlign: 'center' }}>
            <h2 style={{ margin: 0, color: 'var(--kline-text)' }}>Planner access required</h2>
            <p style={{ color: 'var(--kline-text-light)' }}>Ask an admin to enable Planner Access for your user.</p>
          </div>
        )}

        {!loading && errorMsg && (
          <div className="kline-card" style={{ padding: 22, borderLeft: '4px solid var(--kline-red)' }}>
            <strong style={{ color: 'var(--kline-red)' }}>Could not load planner</strong>
            <p style={{ color: 'var(--kline-text-light)' }}>{errorMsg}</p>
          </div>
        )}

        {!loading && authorized && !errorMsg && (
          <>
            <section className="kline-card" style={{ padding: 18, marginBottom: 22 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(220px, 280px)', gap: 14 }}>
                <input
                  className="kline-input"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search customer, service, property, status..."
                />
                <select className="kline-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status === 'ALL' ? 'All statuses' : status}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
              {weekDays.map((day) => {
                const dayTasks = tasksByDay.get(day.toDateString()) || []
                const isToday = isSameDay(day, new Date())

                return (
                  <div key={day.toDateString()} className="kline-card" style={{ padding: 0, overflow: 'hidden', border: isToday ? '2px solid var(--kline-red)' : undefined }}>
                    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--kline-gray)', background: isToday ? 'rgba(227, 6, 19, 0.05)' : '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                        <strong style={{ color: 'var(--kline-text)', fontSize: '1rem' }}>{formatDayTitle(day)}</strong>
                        <span style={{ borderRadius: 999, padding: '4px 9px', background: 'var(--kline-gray-light)', color: 'var(--kline-text-light)', fontSize: '0.78rem', fontWeight: 800 }}>
                          {dayTasks.length}
                        </span>
                      </div>
                    </div>

                    <div style={{ padding: 12, display: 'grid', gap: 10, minHeight: 160 }}>
                      {dayTasks.length === 0 ? (
                        <div style={{ color: 'var(--kline-text-light)', fontSize: '0.86rem', padding: 8 }}>No tasks scheduled</div>
                      ) : (
                        dayTasks.map((task) => (
                          <button
                            key={task.id}
                            type="button"
                            onClick={() => router.push('/tasks')}
                            style={{
                              textAlign: 'left',
                              border: '1px solid var(--kline-gray)',
                              background: '#fff',
                              borderRadius: 12,
                              padding: 12,
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                              <strong style={{ color: 'var(--kline-text)', fontSize: '0.92rem' }}>{task.service.name}</strong>
                              <span style={{ color: 'var(--kline-text-light)', fontSize: '0.78rem', fontWeight: 800 }}>
                                {formatTime(task.scheduledFor)}
                              </span>
                            </div>
                            <div style={{ marginTop: 6, color: 'var(--kline-text)', fontWeight: 800, fontSize: '0.84rem' }}>
                              {task.customer.fullName}
                            </div>
                            <div style={{ marginTop: 3, color: 'var(--kline-text-light)', fontSize: '0.8rem' }}>
                              {task.property.address} · {task.property.city}, {task.property.state}
                            </div>
                            <div style={{ marginTop: 10 }}>
                              <span
                                style={{
                                  borderRadius: 999,
                                  padding: '4px 9px',
                                  background: `${task.status.color || '#0d6efd'}18`,
                                  color: task.status.color || '#0d6efd',
                                  fontSize: '0.76rem',
                                  fontWeight: 900,
                                }}
                              >
                                {task.status.name}
                              </span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
