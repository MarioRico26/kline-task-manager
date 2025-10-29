//kline-task-manager/src/app/dashboard/page.tsx:
'use client'
import { useState, useEffect } from 'react'
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

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/dashboard/stats')
      
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    document.cookie = 'user-id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    window.location.href = '/auth/login'
  }

  // 🎯 CARDS REORDENADAS SEGÚN SOLICITUD
  const navigationCards = [
    {
      title: 'Customer Portal', 
      description: 'Manage customer information and profiles',
      count: stats?.totalCustomers || 0,
      route: '/customers',
      color: '#198754'
    },
    {
      title: 'Property Management',
      description: 'Manage customer properties and locations',
      count: stats?.totalProperties || 0,
      route: '/properties',
      color: '#fd7e14'
    },
    {
      title: 'Task Management',
      description: 'Manage and track service tasks',
      count: stats?.totalTasks || 0,
      route: '/tasks',
      color: '#0d6efd'
    },
    {
      title: 'Service Catalog',
      description: 'Manage service offerings and pricing',
      count: stats?.totalServices || 0,
      route: '/services', 
      color: '#6f42c1'
    },
    {
      title: 'Workflow Status',
      description: 'Configure task statuses and workflows',
      count: stats?.totalStatuses || 0,
      route: '/statuses',
      color: '#20c997'
    },
    {
      title: 'User Administration',
      description: 'Manage system users and permissions',
      count: stats?.totalUsers || 0,
      route: '/users',
      color: '#dc3545'
    }
  ]

  // Gráfica de barras para distribución de servicios
  const renderServiceChart = () => {
    if (!stats?.tasksByService || stats.tasksByService.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--kline-text-light)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>●</div>
          <p style={{ fontWeight: '500', marginBottom: '4px' }}>No service data</p>
          <p style={{ fontSize: '0.875rem' }}>Service statistics will appear here</p>
        </div>
      )
    }
    
    const maxCount = Math.max(...stats.tasksByService.map(item => item.count))
    const topServices = stats.tasksByService.slice(0, 6)
    
    return (
      <div style={{ padding: '8px 0' }}>
        {topServices.map((item, index) => {
          const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0
          return (
            <div 
              key={index} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: '16px',
                padding: '12px',
                borderRadius: '6px',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--kline-gray-light)'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <div style={{ 
                width: '120px', 
                fontSize: '0.875rem', 
                fontWeight: '500',
                color: 'var(--kline-text)'
              }}>
                {item.service}
              </div>
              <div style={{ flex: 1, margin: '0 16px' }}>
                <div style={{ 
                  background: '#e9ecef', 
                  borderRadius: '4px', 
                  height: '8px',
                  overflow: 'hidden'
                }}>
                  <div 
                    style={{ 
                      background: 'linear-gradient(90deg, var(--kline-red), var(--kline-yellow))',
                      height: '8px',
                      borderRadius: '4px',
                      transition: 'width 1s ease',
                      width: `${percentage}%`
                    }}
                  />
                </div>
              </div>
              <div style={{ 
                width: '40px', 
                textAlign: 'right',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: 'var(--kline-text)'
              }}>
                {item.count}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Gráfica circular para distribución de estados
  const renderStatusChart = () => {
    if (!stats?.tasksByStatus || stats.tasksByStatus.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--kline-text-light)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>●</div>
          <p style={{ fontWeight: '500', marginBottom: '4px' }}>No status data</p>
          <p style={{ fontSize: '0.875rem' }}>Status statistics will appear here</p>
        </div>
      )
    }

    const total = stats.tasksByStatus.reduce((sum, item) => sum + item.count, 0)
    
    return (
      <div style={{ padding: '16px 0' }}>
        {stats.tasksByStatus.map((status, index) => {
          const percentage = total > 0 ? (status.count / total) * 100 : 0
          return (
            <div 
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                marginBottom: '8px',
                borderRadius: '6px',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--kline-gray-light)'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div 
                  style={{ 
                    width: '12px', 
                    height: '12px', 
                    borderRadius: '50%', 
                    backgroundColor: status.color || 'var(--kline-text-light)'
                  }} 
                />
                <span style={{ 
                  fontSize: '0.875rem', 
                  fontWeight: '500',
                  color: 'var(--kline-text)'
                }}>
                  {status.status}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ 
                  fontSize: '0.875rem', 
                  fontWeight: '600',
                  color: 'var(--kline-text)'
                }}>
                  {status.count}
                </span>
                <span style={{ 
                  fontSize: '0.75rem', 
                  color: 'var(--kline-text-light)',
                  width: '40px',
                  textAlign: 'right'
                }}>
                  {percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'var(--kline-gray-light)',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header Mejorado */}
      <header style={{
        background: '#ffffff',
        borderBottom: '1px solid var(--kline-gray)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <div style={{ 
          maxWidth: '1200px', 
          margin: '0 auto', 
          padding: '0 20px'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            height: '80px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                background: 'var(--kline-red)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(227, 6, 19, 0.25)'
              }}>
                <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1.2rem' }}>K</span>
              </div>
              <div>
                <h1 style={{ 
                  fontSize: '1.75rem', 
                  fontWeight: '700', 
                  color: 'var(--kline-text)',
                  margin: 0,
                  letterSpacing: '-0.025em'
                }}>
                  KLINE <span style={{ color: 'var(--kline-red)' }}>TASKS</span>
                </h1>
                <p style={{ 
                  color: 'var(--kline-text-light)', 
                  fontSize: '0.875rem',
                  margin: '2px 0 0 0'
                }}>
                  Professional Task Management
                </p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              style={{
                padding: '10px 24px',
                background: 'transparent',
                color: 'var(--kline-text-light)',
                fontWeight: '600',
                borderRadius: '8px',
                border: '2px solid var(--kline-gray)',
                cursor: 'pointer',
                fontSize: '0.9rem',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'var(--kline-red)'
                e.currentTarget.style.color = 'white'
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

      {/* Main Content */}
      <main style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '40px 20px'
      }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              border: '3px solid var(--kline-gray)', 
              borderTop: '3px solid var(--kline-red)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }} />
            <p style={{ color: 'var(--kline-text-light)', fontSize: '1rem' }}>
              Loading dashboard data...
            </p>
          </div>
        ) : (
          <>
            {/* Header del Dashboard Mejorado */}
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{ 
                fontSize: '2rem', 
                fontWeight: '700', 
                color: 'var(--kline-text)',
                margin: '0 0 8px 0'
              }}>
                Dashboard Overview
              </h2>
              <p style={{ 
                color: 'var(--kline-text-light)',
                fontSize: '1.1rem',
                margin: 0
              }}>
                Monitor your service operations and performance metrics
              </p>
              {/* Quick Navigation Buttons */}
<div style={{ 
  display: 'flex',
  gap: '12px',
  marginTop: '20px',
  marginBottom: '35px'
}}>
  <button
    onClick={() => router.push('/customers')}
    style={{
      padding: '10px 18px',
      background: 'var(--kline-red)',
      color: 'white',
      borderRadius: '8px',
      border: 'none',
      cursor: 'pointer',
      fontWeight: '600',
      fontSize: '0.9rem',
      transition: 'opacity 0.3s ease'
    }}
    onMouseOver={(e) => { e.currentTarget.style.opacity = '0.85' }}
    onMouseOut={(e) => { e.currentTarget.style.opacity = '1' }}
  >
    + New Customer
  </button>

  <button
    onClick={() => router.push('/properties')}
    style={{
      padding: '10px 18px',
      background: 'var(--kline-blue)',
      color: 'white',
      borderRadius: '8px',
      border: 'none',
      cursor: 'pointer',
      fontWeight: '600',
      fontSize: '0.9rem',
      transition: 'opacity 0.3s ease'
    }}
    onMouseOver={(e) => { e.currentTarget.style.opacity = '0.85' }}
    onMouseOut={(e) => { e.currentTarget.style.opacity = '1' }}
  >
    + New Property
  </button>

  <button
    onClick={() => router.push('/tasks/new')}
    style={{
      padding: '10px 18px',
      background: '#198754',
      color: 'white',
      borderRadius: '8px',
      border: 'none',
      cursor: 'pointer',
      fontWeight: '600',
      fontSize: '0.9rem',
      transition: 'opacity 0.3s ease'
    }}
    onMouseOver={(e) => { e.currentTarget.style.opacity = '0.85' }}
    onMouseOut={(e) => { e.currentTarget.style.opacity = '1' }}
  >
    + New Task
  </button>
</div>
            </div>
            

            {/* Grid de Métricas Principales Mejorado */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '24px',
              marginBottom: '40px'
            }}>
              {/* Total Tasks */}
              <div className="kline-card" style={{
                padding: '28px',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }} 
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.15)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'var(--kline-shadow)'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  marginBottom: '16px' 
                }}>
                  <p style={{ 
                    fontSize: '0.9rem', 
                    fontWeight: '600', 
                    color: 'var(--kline-text-light)', 
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    TOTAL TASKS
                  </p>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    background: 'var(--kline-red)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(227, 6, 19, 0.25)'
                  }}>
                    <span style={{ color: 'white', fontSize: '1rem', fontWeight: 'bold' }}>T</span>
                  </div>
                </div>
                <p style={{ 
                  fontSize: '2.5rem', 
                  fontWeight: '700', 
                  color: 'var(--kline-text)', 
                  margin: '0 0 12px 0' 
                }}>
                  {stats?.totalTasks || 0}
                </p>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center' 
                }}>
                  <span style={{ 
                    fontSize: '0.9rem', 
                    color: '#198754',
                    fontWeight: '600'
                  }}>
                    {stats?.completedTasks || 0} completed
                  </span>
                  <span style={{ 
                    fontSize: '0.8rem', 
                    color: 'var(--kline-text-light)',
                    background: 'var(--kline-gray-light)',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontWeight: '600'
                  }}>
                    {stats?.totalTasks ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}%
                  </span>
                </div>
              </div>

              {/* Active Clients */}
              <div className="kline-card" style={{
                padding: '28px',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.15)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'var(--kline-shadow)'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  marginBottom: '16px' 
                }}>
                  <p style={{ 
                    fontSize: '0.9rem', 
                    fontWeight: '600', 
                    color: 'var(--kline-text-light)', 
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    ACTIVE CLIENTS
                  </p>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    background: '#198754',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(25, 135, 84, 0.25)'
                  }}>
                    <span style={{ color: 'white', fontSize: '1rem', fontWeight: 'bold' }}>C</span>
                  </div>
                </div>
                <p style={{ 
                  fontSize: '2.5rem', 
                  fontWeight: '700', 
                  color: 'var(--kline-text)', 
                  margin: '0 0 12px 0' 
                }}>
                  {stats?.totalCustomers || 0}
                </p>
                <div style={{ 
                  fontSize: '0.9rem', 
                  color: 'var(--kline-text-light)',
                  fontWeight: '500'
                }}>
                  {stats?.totalProperties || 0} properties
                </div>
              </div>

              {/* Pending Tasks */}
              <div className="kline-card" style={{
                padding: '28px',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.15)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'var(--kline-shadow)'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  marginBottom: '16px' 
                }}>
                  <p style={{ 
                    fontSize: '0.9rem', 
                    fontWeight: '600', 
                    color: 'var(--kline-text-light)', 
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    PENDING TASKS
                  </p>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    background: '#fd7e14',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(253, 126, 20, 0.25)'
                  }}>
                    <span style={{ color: 'white', fontSize: '1rem', fontWeight: 'bold' }}>P</span>
                  </div>
                </div>
                <p style={{ 
                  fontSize: '2.5rem', 
                  fontWeight: '700', 
                  color: 'var(--kline-text)', 
                  margin: '0 0 12px 0' 
                }}>
                  {stats?.pendingTasks || 0}
                </p>
                {stats?.overdueTasks && stats.overdueTasks > 0 ? (
                  <span style={{ 
                    fontSize: '0.9rem', 
                    color: '#dc3545', 
                    fontWeight: '600',
                    background: 'rgba(220, 53, 69, 0.1)',
                    padding: '4px 12px',
                    borderRadius: '12px'
                  }}>
                    {stats.overdueTasks} overdue
                  </span>
                ) : (
                  <span style={{ 
                    fontSize: '0.9rem', 
                    color: '#198754',
                    fontWeight: '600' 
                  }}>
                    On track
                  </span>
                )}
              </div>

              {/* Service Coverage */}
              <div className="kline-card" style={{
                padding: '28px',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.15)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'var(--kline-shadow)'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  marginBottom: '16px' 
                }}>
                  <p style={{ 
                    fontSize: '0.9rem', 
                    fontWeight: '600', 
                    color: 'var(--kline-text-light)', 
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    SERVICES
                  </p>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    background: '#6f42c1',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(111, 66, 193, 0.25)'
                  }}>
                    <span style={{ color: 'white', fontSize: '1rem', fontWeight: 'bold' }}>S</span>
                  </div>
                </div>
                <p style={{ 
                  fontSize: '2.5rem', 
                  fontWeight: '700', 
                  color: 'var(--kline-text)', 
                  margin: '0 0 12px 0' 
                }}>
                  {stats?.totalServices || 0}
                </p>
                <div style={{ 
                  fontSize: '0.9rem', 
                  color: 'var(--kline-text-light)',
                  fontWeight: '500'
                }}>
                  Active service types
                </div>
              </div>
            </div>

            {/* Sección de Navegación y Gráficas */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr',
              gap: '32px',
              marginBottom: '40px'
            }}>
              {/* Navegación Principal - REORDENADA */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '20px'
              }}>
                {navigationCards.map((card, index) => (
                  <div 
                    key={index}
                    className="kline-card"
                    style={{
                      padding: '24px',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      position: 'relative',
                      overflow: 'hidden',
                      transform: hoveredCard === index ? 'translateY(-6px)' : 'translateY(0)',
                      boxShadow: hoveredCard === index ? '0 15px 35px rgba(0,0,0,0.2)' : 'var(--kline-shadow)'
                    }}
                    onClick={() => router.push(card.route)}
                    onMouseOver={() => setHoveredCard(index)}
                    onMouseOut={() => setHoveredCard(null)}
                  >
                    {/* Barra superior con gradiente */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '3px',
                      background: `linear-gradient(90deg, ${card.color}, ${card.color}99)`,
                      transition: 'all 0.3s ease'
                    }}></div>

                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      justifyContent: 'space-between',
                      marginBottom: '16px',
                      marginTop: '8px'
                    }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ 
                          fontSize: '1.25rem', 
                          fontWeight: '700', 
                          color: 'var(--kline-text)',
                          margin: '0 0 8px 0'
                        }}>
                          {card.title}
                        </h3>
                        <p style={{ 
                          color: 'var(--kline-text-light)', 
                          fontSize: '0.95rem',
                          margin: 0,
                          lineHeight: '1.5'
                        }}>
                          {card.description}
                        </p>
                      </div>
                      <div style={{
                        width: '52px',
                        height: '52px',
                        background: card.color,
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: '700',
                        fontSize: '1.1rem',
                        boxShadow: `0 4px 15px ${card.color}40`
                      }}>
                        {card.count}
                      </div>
                    </div>
                    
                    <div style={{
                      display: 'flex', 
                      alignItems: 'center', 
                      color: card.color,
                      fontWeight: '600',
                      fontSize: '0.9rem',
                      transition: 'all 0.2s ease',
                      opacity: hoveredCard === index ? 1 : 0.8,
                      marginTop: '16px'
                    }}>
                      Access module
                      <span style={{ 
                        marginLeft: '8px', 
                        transition: 'transform 0.2s ease',
                        transform: hoveredCard === index ? 'translateX(6px)' : 'translateX(0)'
                      }}>
                        →
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Panel de Gráficas Mejorado */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {/* Gráfica de Servicios */}
                <div className="kline-card" style={{
                  padding: '24px',
                  position: 'relative'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: 'linear-gradient(90deg, var(--kline-red), var(--kline-yellow))',
                    borderTopLeftRadius: '12px',
                    borderTopRightRadius: '12px'
                  }}></div>
                  <h4 style={{ 
                    fontSize: '1.1rem', 
                    fontWeight: '700', 
                    color: 'var(--kline-text)',
                    margin: '8px 0 20px 0'
                  }}>
                    Task Distribution by Service
                  </h4>
                  {renderServiceChart()}
                </div>

                {/* Gráfica de Estados */}
                <div className="kline-card" style={{
                  padding: '24px',
                  position: 'relative'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: 'linear-gradient(90deg, var(--kline-blue), #20c997)',
                    borderTopLeftRadius: '12px',
                    borderTopRightRadius: '12px'
                  }}></div>
                  <h4 style={{ 
                    fontSize: '1.1rem', 
                    fontWeight: '700', 
                    color: 'var(--kline-text)',
                    margin: '8px 0 20px 0'
                  }}>
                    Task Status Distribution
                  </h4>
                  {renderStatusChart()}
                </div>
              </div>
            </div>

            {/* Tareas Recientes Mejorado */}
            <div className="kline-card" style={{
              padding: '32px',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: 'linear-gradient(90deg, var(--kline-red), var(--kline-yellow))',
                borderTopLeftRadius: '12px',
                borderTopRightRadius: '12px'
              }}></div>
              
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                marginBottom: '24px'
              }}>
                <h3 style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: '700', 
                  color: 'var(--kline-text)',
                  margin: 0
                }}>
                  Recent Tasks
                </h3>
                <button 
                  onClick={() => router.push('/tasks')}
                  style={{
                    padding: '10px 20px',
                    background: 'transparent',
                    color: 'var(--kline-red)',
                    fontWeight: '600',
                    borderRadius: '8px',
                    border: '2px solid var(--kline-red)',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'var(--kline-red)'
                    e.currentTarget.style.color = 'white'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'var(--kline-red)'
                  }}
                >
                  View All Tasks
                </button>
              </div>

              {stats?.recentTasks && stats.recentTasks.length > 0 ? (
                <div style={{ 
                  border: '1px solid var(--kline-gray)', 
                  borderRadius: '10px', 
                  overflow: 'hidden',
                  background: 'white'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--kline-gray-light)' }}>
                        <th style={{ 
                          padding: '16px 20px', 
                          textAlign: 'left', 
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          color: 'var(--kline-text-light)',
                          textTransform: 'uppercase',
                          borderBottom: '1px solid var(--kline-gray)'
                        }}>
                          Service & Customer
                        </th>
                        <th style={{ 
                          padding: '16px 20px', 
                          textAlign: 'left', 
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          color: 'var(--kline-text-light)',
                          textTransform: 'uppercase',
                          borderBottom: '1px solid var(--kline-gray)'
                        }}>
                          Status
                        </th>
                        <th style={{ 
                          padding: '16px 20px', 
                          textAlign: 'left', 
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          color: 'var(--kline-text-light)',
                          textTransform: 'uppercase',
                          borderBottom: '1px solid var(--kline-gray)'
                        }}>
                          Scheduled
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentTasks.map((task) => (
                        <tr 
                          key={task.id} 
                          style={{ 
                            transition: 'background-color 0.2s ease',
                            cursor: 'pointer'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--kline-gray-light)'
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                          }}
                        >
                          <td style={{ padding: '18px 20px', borderBottom: '1px solid var(--kline-gray)' }}>
                            <div style={{ fontWeight: '600', color: 'var(--kline-text)' }}>{task.service}</div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--kline-text-light)', marginTop: '4px' }}>{task.customer}</div>
                          </td>
                          <td style={{ padding: '18px 20px', borderBottom: '1px solid var(--kline-gray)' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontSize: '0.8rem',
                              fontWeight: '600',
                              background: '#e7f1ff',
                              color: '#0d6efd',
                              border: '1px solid #b3d4ff'
                            }}>
                              {task.status}
                            </span>
                          </td>
                          <td style={{ 
                            padding: '18px 20px', 
                            borderBottom: '1px solid var(--kline-gray)', 
                            fontSize: '0.9rem', 
                            color: 'var(--kline-text-light)',
                            fontWeight: '500'
                          }}>
                            {task.scheduledFor ? new Date(task.scheduledFor).toLocaleDateString() : 'Not scheduled'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--kline-text-light)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '16px' }}>●</div>
                  <p style={{ fontWeight: '600', marginBottom: '8px', fontSize: '1.1rem' }}>No recent tasks</p>
                  <p style={{ fontSize: '0.9rem' }}>Recently created tasks will appear here</p>
                </div>
              )}
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