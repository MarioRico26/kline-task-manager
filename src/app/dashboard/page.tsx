'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface DashboardStats {
  totalTasks: number
  totalCustomers: number
  totalServices: number
  totalUsers: number
  totalProperties: number
  completedTasks: number
  pendingTasks: number
  overdueTasks: number
  tasksByStatus: { status: string; count: number; color: string }[]
  tasksByService: { service: string; count: number }[]
  recentTasks: {
    id: string
    service: string
    customer: string
    status: string
    scheduledFor: string | null
  }[]
  monthlyStats: { month: string; tasks: number; completed: number }[]
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month')
  const router = useRouter()

  // 🔐 VERIFICACIÓN DE AUTENTICACIÓN
  useEffect(() => {
    const checkAuth = () => {
      const userId = document.cookie
        .split('; ')
        .find(row => row.startsWith('user-id='))
        ?.split('=')[1]

      if (!userId) {
        console.log('🚫 NO HAY SESIÓN - Redirigiendo a login')
        router.push('/auth/login')
        setIsAuthenticated(false)
        return false
      }
      
      setIsAuthenticated(true)
      return true
    }

    if (checkAuth()) {
      fetchDashboardData()
    }
  }, [router, timeRange])

  const fetchDashboardData = async () => {
    try {
      const response = await fetch(`/api/dashboard/stats?range=${timeRange}`)
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      } else {
        console.error('Error fetching dashboard data')
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  // 🔐 REDIRECCIÓN SI NO ESTÁ AUTENTICADO
  if (isAuthenticated === false) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'var(--kline-gray-light)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '60px',
            height: '60px',
            background: 'var(--kline-red)',
            borderRadius: '8px',
            margin: '0 auto 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1.5rem' }}>K</span>
          </div>
          <p style={{ color: 'var(--kline-text-light)' }}>Redirecting to login...</p>
        </div>
      </div>
    )
  }

  const handleLogout = () => {
    document.cookie = 'user-id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    window.location.href = '/auth/login'
  }

  const navigationCards = [
    {
      title: 'Tasks',
      description: 'Manage and track tasks',
      count: stats?.totalTasks || 0,
      route: '/tasks',
      color: 'var(--kline-green)',
      icon: '✅',
      trend: '+12%'
    },
    {
      title: 'Customers',
      description: 'Manage customer information',
      count: stats?.totalCustomers || 0,
      route: '/customers',
      color: 'var(--kline-blue)',
      icon: '👨‍💼',
      trend: '+5%'
    },
    {
      title: 'Services',
      description: 'Manage available services',
      count: stats?.totalServices || 0,
      route: '/services', 
      color: 'var(--kline-yellow)',
      icon: '🛠️',
      trend: '+8%'
    },
    {
      title: 'Users',
      description: 'Manage system users',
      count: stats?.totalUsers || 0,
      route: '/users',
      color: 'var(--kline-red)',
      icon: '👥',
      trend: '+2%'
    }
  ]

  // Función para el gráfico de barras
  const renderBarChart = () => {
    if (!stats?.tasksByService.length) return null
    
    const maxCount = Math.max(...stats.tasksByService.map(item => item.count))
    
    return (
      <div style={{ display: 'flex', alignItems: 'end', gap: '12px', height: '200px', padding: '20px 0' }}>
        {stats.tasksByService.slice(0, 6).map((item, index) => (
          <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div 
              style={{ 
                background: `linear-gradient(to top, var(--kline-blue), var(--kline-green))`,
                height: `${(item.count / maxCount) * 150}px`,
                width: '40px',
                borderRadius: '8px 8px 0 0',
                transition: 'height 1s ease',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'rgba(255,255,255,0.2)',
                height: '30%'
              }} />
            </div>
            <div style={{ 
              marginTop: '8px', 
              fontSize: '0.75rem', 
              color: 'var(--kline-text-light)',
              textAlign: 'center',
              fontWeight: '600'
            }}>
              {item.service.length > 10 ? item.service.substring(0, 10) + '...' : item.service}
            </div>
            <div style={{ 
              fontSize: '0.8rem', 
              color: 'var(--kline-text)',
              fontWeight: '700',
              marginTop: '4px'
            }}>
              {item.count}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Función para el gráfico circular de estados
  const renderStatusChart = () => {
    if (!stats?.tasksByStatus.length) return null
    
    const total = stats.tasksByStatus.reduce((sum, item) => sum + item.count, 0)
    let currentAngle = 0
    
    return (
      <div style={{ position: 'relative', width: '160px', height: '160px', margin: '0 auto' }}>
        <svg width="160" height="160" viewBox="0 0 160 160">
          {stats.tasksByStatus.map((item, index) => {
            const percentage = (item.count / total) * 100
            const angle = (percentage / 100) * 360
            const largeArc = percentage > 50 ? 1 : 0
            
            const x1 = 80 + 60 * Math.cos((currentAngle * Math.PI) / 180)
            const y1 = 80 + 60 * Math.sin((currentAngle * Math.PI) / 180)
            const x2 = 80 + 60 * Math.cos(((currentAngle + angle) * Math.PI) / 180)
            const y2 = 80 + 60 * Math.sin(((currentAngle + angle) * Math.PI) / 180)
            
            const path = `M 80 80 L ${x1} ${y1} A 60 60 0 ${largeArc} 1 ${x2} ${y2} Z`
            
            const segment = (
              <path
                key={index}
                d={path}
                fill={item.color}
                stroke="white"
                strokeWidth="2"
              />
            )
            
            currentAngle += angle
            return segment
          })}
          <circle cx="80" cy="80" r="30" fill="white" />
        </svg>
        
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--kline-text)' }}>
            {total}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--kline-text-light)' }}>
            Total
          </div>
        </div>
      </div>
    )
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not scheduled'
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--kline-gray-light)' }}>
      {/* Header */}
      <header className="kline-header" style={{ padding: '1rem 0' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--kline-text)', marginBottom: '0.5rem' }}>
                Dashboard <span className="kline-accent">Overview</span>
              </h1>
              <p style={{ color: 'var(--kline-text-light)', fontSize: '1rem' }}>
                Welcome back! Here's what's happening today.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <select 
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                style={{
                  padding: '0.5rem 1rem',
                  border: '2px solid var(--kline-gray)',
                  borderRadius: '8px',
                  background: 'white',
                  color: 'var(--kline-text)',
                  fontWeight: '600'
                }}
              >
                <option value="week">Last Week</option>
                <option value="month">Last Month</option>
                <option value="year">Last Year</option>
              </select>
              <button 
                onClick={handleLogout}
                className="kline-btn-primary"
                style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: '1400px', margin: '2rem auto', padding: '0 1rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--kline-text-light)' }}>
            <div style={{ 
              width: '50px', 
              height: '50px', 
              border: '4px solid var(--kline-gray)', 
              borderTop: '4px solid var(--kline-red)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem'
            }} />
            <p>Loading dashboard data...</p>
          </div>
        ) : (
          <>
            {/* Stats Overview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              <div className="kline-card" style={{ textAlign: 'center', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ 
                  position: 'absolute', 
                  top: '-10px', 
                  right: '-10px', 
                  fontSize: '4rem', 
                  opacity: 0.1
                }}>
                  ✅
                </div>
                <div style={{ fontSize: '2.5rem', fontWeight: '700', color: 'var(--kline-green)', marginBottom: '0.5rem' }}>
                  {stats?.totalTasks || 0}
                </div>
                <div style={{ color: 'var(--kline-text-light)', fontSize: '0.9rem', fontWeight: '600' }}>Total Tasks</div>
                <div style={{ color: 'var(--kline-green)', fontSize: '0.8rem', fontWeight: '600', marginTop: '0.5rem' }}>
                  ↑ 12% from last month
                </div>
              </div>
              
              <div className="kline-card" style={{ textAlign: 'center', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ 
                  position: 'absolute', 
                  top: '-10px', 
                  right: '-10px', 
                  fontSize: '4rem', 
                  opacity: 0.1
                }}>
                  👨‍💼
                </div>
                <div style={{ fontSize: '2.5rem', fontWeight: '700', color: 'var(--kline-blue)', marginBottom: '0.5rem' }}>
                  {stats?.totalCustomers || 0}
                </div>
                <div style={{ color: 'var(--kline-text-light)', fontSize: '0.9rem', fontWeight: '600' }}>Total Customers</div>
                <div style={{ color: 'var(--kline-blue)', fontSize: '0.8rem', fontWeight: '600', marginTop: '0.5rem' }}>
                  ↑ 5% from last month
                </div>
              </div>
              
              <div className="kline-card" style={{ textAlign: 'center', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ 
                  position: 'absolute', 
                  top: '-10px', 
                  right: '-10px', 
                  fontSize: '4rem', 
                  opacity: 0.1
                }}>
                  ✅
                </div>
                <div style={{ fontSize: '2.5rem', fontWeight: '700', color: 'var(--kline-green)', marginBottom: '0.5rem' }}>
                  {stats?.completedTasks || 0}
                </div>
                <div style={{ color: 'var(--kline-text-light)', fontSize: '0.9rem', fontWeight: '600' }}>Completed Tasks</div>
                <div style={{ color: 'var(--kline-green)', fontSize: '0.8rem', fontWeight: '600', marginTop: '0.5rem' }}>
                  {stats?.totalTasks ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}% completion rate
                </div>
              </div>
              
              <div className="kline-card" style={{ textAlign: 'center', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ 
                  position: 'absolute', 
                  top: '-10px', 
                  right: '-10px', 
                  fontSize: '4rem', 
                  opacity: 0.1
                }}>
                  ⏰
                </div>
                <div style={{ fontSize: '2.5rem', fontWeight: '700', color: 'var(--kline-red)', marginBottom: '0.5rem' }}>
                  {stats?.pendingTasks || 0}
                </div>
                <div style={{ color: 'var(--kline-text-light)', fontSize: '0.9rem', fontWeight: '600' }}>Pending Tasks</div>
                <div style={{ color: 'var(--kline-red)', fontSize: '0.8rem', fontWeight: '600', marginTop: '0.5rem' }}>
                  Needs attention
                </div>
              </div>
            </div>

            {/* Main Navigation Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              {navigationCards.map((card, index) => (
                <div 
                  key={index}
                  className="kline-card"
                  style={{ 
                    padding: '2rem',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    borderTop: `4px solid ${card.color}`,
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onClick={() => router.push(card.route)}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)'
                    e.currentTarget.style.boxShadow = '0 15px 40px rgba(0, 0, 0, 0.15)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.08)'
                  }}
                >
                  <div style={{ 
                    position: 'absolute', 
                    top: '-20px', 
                    right: '-20px', 
                    fontSize: '6rem', 
                    opacity: 0.1
                  }}>
                    {card.icon}
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--kline-text)', marginBottom: '0.5rem' }}>
                        {card.title}
                      </h3>
                      <p style={{ color: 'var(--kline-text-light)', lineHeight: '1.5', fontSize: '0.9rem' }}>
                        {card.description}
                      </p>
                    </div>
                    <div style={{
                      background: card.color,
                      color: 'white',
                      padding: '0.5rem 1rem',
                      borderRadius: '20px',
                      fontSize: '1.1rem',
                      fontWeight: '700',
                      minWidth: '50px',
                      textAlign: 'center'
                    }}>
                      {card.count}
                    </div>
                  </div>
                  
                  <div style={{ 
                    color: card.color, 
                    fontWeight: '600', 
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginTop: '1.5rem'
                  }}>
                    Manage <span style={{ transition: 'transform 0.3s ease' }}>→</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Charts and Recent Tasks */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
              {/* Left Column - Charts */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Tasks by Service Chart */}
                <div className="kline-card" style={{ padding: '2rem' }}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem', color: 'var(--kline-text)' }}>
                    Tasks by Service
                  </h2>
                  {renderBarChart()}
                </div>

                {/* Task Status Distribution */}
                <div className="kline-card" style={{ padding: '2rem' }}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem', color: 'var(--kline-text)' }}>
                    Task Status Distribution
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    {renderStatusChart()}
                    <div style={{ flex: 1 }}>
                      {stats?.tasksByStatus.map((status, index) => (
                        <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                          <div style={{ 
                            width: '12px', 
                            height: '12px', 
                            borderRadius: '50%', 
                            background: status.color 
                          }} />
                          <div style={{ flex: 1, fontSize: '0.9rem', color: 'var(--kline-text)' }}>
                            {status.status}
                          </div>
                          <div style={{ fontWeight: '700', color: 'var(--kline-text)' }}>
                            {status.count}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Recent Tasks */}
              <div className="kline-card" style={{ padding: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem', color: 'var(--kline-text)' }}>
                  Recent Tasks
                </h2>
                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  {stats?.recentTasks && stats.recentTasks.length > 0 ? (
                    stats.recentTasks.slice(0, 8).map((task, index) => (
                      <div 
                        key={task.id}
                        style={{ 
                          padding: '1rem',
                          borderBottom: index < stats.recentTasks.length - 1 ? '1px solid var(--kline-gray)' : 'none',
                          transition: 'background 0.2s ease'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = 'var(--kline-gray-light)'
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        <div style={{ fontWeight: '600', color: 'var(--kline-text)', marginBottom: '0.25rem' }}>
                          {task.service}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--kline-text-light)', marginBottom: '0.25rem' }}>
                          {task.customer}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ 
                            padding: '0.2rem 0.6rem',
                            borderRadius: '12px',
                            fontSize: '0.7rem',
                            fontWeight: '600',
                            background: 'var(--kline-gray)',
                            color: 'var(--kline-text)'
                          }}>
                            {task.status}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--kline-text-light)' }}>
                            {formatDate(task.scheduledFor)}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--kline-text-light)' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
                      <p>No recent tasks</p>
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