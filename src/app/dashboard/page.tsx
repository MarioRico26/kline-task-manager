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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)
  const router = useRouter()

  // 🔐 VERIFICACIÓN DE AUTENTICACIÓN
  useEffect(() => {
    const checkAuth = () => {
      const userId = document.cookie
        .split('; ')
        .find(row => row.startsWith('user-id='))
        ?.split('=')[1]

      if (!userId) {
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
  }, [router])

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

  // 🔐 REDIRECCIÓN SI NO ESTÁ AUTENTICADO
  if (isAuthenticated === false) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: '#f8f9fa',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '60px',
            height: '60px',
            background: '#dc3545',
            borderRadius: '8px',
            margin: '0 auto 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1.5rem' }}>K</span>
          </div>
          <p style={{ color: '#6c757d', fontSize: '1rem' }}>Redirecting to login...</p>
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
      title: 'Task Management',
      description: 'Manage and track service tasks',
      count: stats?.totalTasks || 0,
      route: '/tasks',
      color: '#0d6efd'
    },
    {
      title: 'Customer Portal', 
      description: 'Manage customer information and profiles',
      count: stats?.totalCustomers || 0,
      route: '/customers',
      color: '#198754'
    },
    {
      title: 'Service Catalog',
      description: 'Manage service offerings and pricing',
      count: stats?.totalServices || 0,
      route: '/services', 
      color: '#6f42c1'
    },
    {
      title: 'User Administration',
      description: 'Manage system users and permissions',
      count: stats?.totalUsers || 0,
      route: '/users',
      color: '#dc3545'
    },
    {
      title: 'Property Management',
      description: 'Manage customer properties and locations',
      count: stats?.totalProperties || 0,
      route: '/properties',
      color: '#fd7e14'
    },
    {
      title: 'Workflow Status',
      description: 'Configure task statuses and workflows',
      count: stats?.totalStatuses || 0,
      route: '/statuses',
      color: '#20c997'
    }
  ]

  // Gráfica de barras para distribución de servicios
  const renderServiceChart = () => {
    if (!stats?.tasksByService || stats.tasksByService.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6c757d' }}>
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
                e.currentTarget.style.backgroundColor = '#f8f9fa'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <div style={{ 
                width: '120px', 
                fontSize: '0.875rem', 
                fontWeight: '500',
                color: '#212529'
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
                      background: 'linear-gradient(90deg, #0d6efd, #0dcaf0)',
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
                color: '#212529'
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
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6c757d' }}>
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
                e.currentTarget.style.backgroundColor = '#f8f9fa'
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
                    backgroundColor: status.color || '#6c757d'
                  }} 
                />
                <span style={{ 
                  fontSize: '0.875rem', 
                  fontWeight: '500',
                  color: '#212529'
                }}>
                  {status.status}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ 
                  fontSize: '0.875rem', 
                  fontWeight: '600',
                  color: '#212529'
                }}>
                  {status.count}
                </span>
                <span style={{ 
                  fontSize: '0.75rem', 
                  color: '#6c757d',
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
      background: '#f8f9fa',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header Sobrio */}
      <header style={{
        background: '#ffffff',
        borderBottom: '1px solid #dee2e6',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
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
            height: '70px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                background: '#212529',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>K</span>
              </div>
              <div>
                <h1 style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: '600', 
                  color: '#212529',
                  margin: 0,
                  letterSpacing: '-0.025em'
                }}>
                  KLINE Manager
                </h1>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              style={{
                padding: '8px 20px',
                background: 'transparent',
                color: '#6c757d',
                fontWeight: '500',
                borderRadius: '6px',
                border: '1px solid #6c757d',
                cursor: 'pointer',
                fontSize: '0.875rem',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#6c757d'
                e.currentTarget.style.color = 'white'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = '#6c757d'
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
        padding: '32px 20px'
      }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              border: '3px solid #e9ecef', 
              borderTop: '3px solid #0d6efd',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }} />
            <p style={{ color: '#6c757d', fontSize: '1rem' }}>
              Loading dashboard data...
            </p>
          </div>
        ) : (
          <>
            {/* Header del Dashboard */}
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ 
                fontSize: '1.75rem', 
                fontWeight: '600', 
                color: '#212529',
                margin: '0 0 8px 0'
              }}>
                Dashboard Overview
              </h2>
              <p style={{ 
                color: '#6c757d',
                fontSize: '1rem',
                margin: 0
              }}>
                Monitor your service operations and performance metrics
              </p>
            </div>

            {/* Grid de Métricas Principales */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '20px',
              marginBottom: '32px'
            }}>
              {/* Total Tasks */}
              <div style={{
                background: 'white',
                borderRadius: '8px',
                padding: '24px',
                border: '1px solid #dee2e6',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }} 
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6c757d', margin: 0 }}>
                    TOTAL TASKS
                  </p>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    background: '#0d6efd',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <span style={{ color: 'white', fontSize: '0.875rem' }}>T</span>
                  </div>
                </div>
                <p style={{ fontSize: '2rem', fontWeight: '600', color: '#212529', margin: '0 0 8px 0' }}>
                  {stats?.totalTasks || 0}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', color: '#198754' }}>
                    {stats?.completedTasks || 0} completed
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#6c757d' }}>
                    {stats?.totalTasks ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}%
                  </span>
                </div>
              </div>

              {/* Active Clients */}
              <div style={{
                background: 'white',
                borderRadius: '8px',
                padding: '24px',
                border: '1px solid #dee2e6',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6c757d', margin: 0 }}>
                    ACTIVE CLIENTS
                  </p>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    background: '#198754',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <span style={{ color: 'white', fontSize: '0.875rem' }}>C</span>
                  </div>
                </div>
                <p style={{ fontSize: '2rem', fontWeight: '600', color: '#212529', margin: '0 0 8px 0' }}>
                  {stats?.totalCustomers || 0}
                </p>
                <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>
                  {stats?.totalProperties || 0} properties
                </div>
              </div>

              {/* Pending Tasks */}
              <div style={{
                background: 'white',
                borderRadius: '8px',
                padding: '24px',
                border: '1px solid #dee2e6',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6c757d', margin: 0 }}>
                    PENDING TASKS
                  </p>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    background: '#fd7e14',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <span style={{ color: 'white', fontSize: '0.875rem' }}>P</span>
                  </div>
                </div>
                <p style={{ fontSize: '2rem', fontWeight: '600', color: '#212529', margin: '0 0 8px 0' }}>
                  {stats?.pendingTasks || 0}
                </p>
                {stats?.overdueTasks && stats.overdueTasks > 0 ? (
                  <span style={{ fontSize: '0.875rem', color: '#dc3545', fontWeight: '500' }}>
                    {stats.overdueTasks} overdue
                  </span>
                ) : (
                  <span style={{ fontSize: '0.875rem', color: '#198754' }}>
                    On track
                  </span>
                )}
              </div>

              {/* Service Coverage */}
              <div style={{
                background: 'white',
                borderRadius: '8px',
                padding: '24px',
                border: '1px solid #dee2e6',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6c757d', margin: 0 }}>
                    SERVICES
                  </p>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    background: '#6f42c1',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <span style={{ color: 'white', fontSize: '0.875rem' }}>S</span>
                  </div>
                </div>
                <p style={{ fontSize: '2rem', fontWeight: '600', color: '#212529', margin: '0 0 8px 0' }}>
                  {stats?.totalServices || 0}
                </p>
                <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>
                  Active service types
                </div>
              </div>
            </div>

            {/* Sección de Navegación y Gráficas */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr',
              gap: '24px',
              marginBottom: '32px'
            }}>
              {/* Navegación Principal */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '16px'
              }}>
                {navigationCards.map((card, index) => (
                  <div 
                    key={index}
                    style={{
                      background: 'white',
                      borderRadius: '8px',
                      padding: '20px',
                      border: '1px solid #dee2e6',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      transform: hoveredCard === index ? 'translateY(-4px)' : 'translateY(0)',
                      boxShadow: hoveredCard === index ? '0 8px 25px rgba(0,0,0,0.15)' : 'none'
                    }}
                    onClick={() => router.push(card.route)}
                    onMouseOver={() => setHoveredCard(index)}
                    onMouseOut={() => setHoveredCard(null)}
                  >
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      justifyContent: 'space-between',
                      marginBottom: '12px'
                    }}>
                      <div>
                        <h3 style={{ 
                          fontSize: '1.1rem', 
                          fontWeight: '600', 
                          color: '#212529',
                          margin: '0 0 4px 0'
                        }}>
                          {card.title}
                        </h3>
                        <p style={{ 
                          color: '#6c757d', 
                          fontSize: '0.875rem',
                          margin: 0,
                          lineHeight: '1.4'
                        }}>
                          {card.description}
                        </p>
                      </div>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        background: card.color,
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: '600',
                        fontSize: '1rem'
                      }}>
                        {card.count}
                      </div>
                    </div>
                    <div style={{
                      height: '2px',
                      background: '#e9ecef',
                      margin: '16px 0',
                      position: 'relative'
                    }}>
                      <div style={{
                        height: '2px',
                        background: card.color,
                        width: hoveredCard === index ? '100%' : '0%',
                        transition: 'width 0.3s ease',
                        position: 'absolute',
                        top: 0,
                        left: 0
                      }} />
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      color: card.color,
                      fontWeight: '500',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s ease',
                      opacity: hoveredCard === index ? 1 : 0.7
                    }}>
                      Access module
                      <span style={{ 
                        marginLeft: '8px', 
                        transition: 'transform 0.2s ease',
                        transform: hoveredCard === index ? 'translateX(4px)' : 'translateX(0)'
                      }}>
                        →
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Panel de Gráficas */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Gráfica de Servicios */}
                <div style={{
                  background: 'white',
                  borderRadius: '8px',
                  padding: '20px',
                  border: '1px solid #dee2e6'
                }}>
                  <h4 style={{ 
                    fontSize: '1rem', 
                    fontWeight: '600', 
                    color: '#212529',
                    margin: '0 0 16px 0'
                  }}>
                    Task Distribution by Service
                  </h4>
                  {renderServiceChart()}
                </div>

                {/* Gráfica de Estados */}
                <div style={{
                  background: 'white',
                  borderRadius: '8px',
                  padding: '20px',
                  border: '1px solid #dee2e6'
                }}>
                  <h4 style={{ 
                    fontSize: '1rem', 
                    fontWeight: '600', 
                    color: '#212529',
                    margin: '0 0 16px 0'
                  }}>
                    Task Status Distribution
                  </h4>
                  {renderStatusChart()}
                </div>
              </div>
            </div>

            {/* Tareas Recientes */}
            <div style={{
              background: 'white',
              borderRadius: '8px',
              padding: '24px',
              border: '1px solid #dee2e6'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                marginBottom: '20px'
              }}>
                <h3 style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: '600', 
                  color: '#212529',
                  margin: 0
                }}>
                  Recent Tasks
                </h3>
                <button 
                  onClick={() => router.push('/tasks')}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    color: '#0d6efd',
                    fontWeight: '500',
                    borderRadius: '6px',
                    border: '1px solid #0d6efd',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = '#0d6efd'
                    e.currentTarget.style.color = 'white'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = '#0d6efd'
                  }}
                >
                  View All Tasks
                </button>
              </div>

              {stats?.recentTasks && stats.recentTasks.length > 0 ? (
                <div style={{ border: '1px solid #dee2e6', borderRadius: '6px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        <th style={{ 
                          padding: '12px 16px', 
                          textAlign: 'left', 
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          color: '#6c757d',
                          textTransform: 'uppercase',
                          borderBottom: '1px solid #dee2e6'
                        }}>
                          Service & Customer
                        </th>
                        <th style={{ 
                          padding: '12px 16px', 
                          textAlign: 'left', 
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          color: '#6c757d',
                          textTransform: 'uppercase',
                          borderBottom: '1px solid #dee2e6'
                        }}>
                          Status
                        </th>
                        <th style={{ 
                          padding: '12px 16px', 
                          textAlign: 'left', 
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          color: '#6c757d',
                          textTransform: 'uppercase',
                          borderBottom: '1px solid #dee2e6'
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
                            e.currentTarget.style.backgroundColor = '#f8f9fa'
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                          }}
                        >
                          <td style={{ padding: '16px', borderBottom: '1px solid #dee2e6' }}>
                            <div style={{ fontWeight: '500', color: '#212529' }}>{task.service}</div>
                            <div style={{ fontSize: '0.875rem', color: '#6c757d', marginTop: '2px' }}>{task.customer}</div>
                          </td>
                          <td style={{ padding: '16px', borderBottom: '1px solid #dee2e6' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              background: '#e7f1ff',
                              color: '#0d6efd',
                              border: '1px solid #b3d4ff'
                            }}>
                              {task.status}
                            </span>
                          </td>
                          <td style={{ padding: '16px', borderBottom: '1px solid #dee2e6', fontSize: '0.875rem', color: '#6c757d' }}>
                            {task.scheduledFor ? new Date(task.scheduledFor).toLocaleDateString() : 'Not scheduled'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6c757d' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '12px' }}>●</div>
                  <p style={{ fontWeight: '500', marginBottom: '4px' }}>No recent tasks</p>
                  <p style={{ fontSize: '0.875rem' }}>Recently created tasks will appear here</p>
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