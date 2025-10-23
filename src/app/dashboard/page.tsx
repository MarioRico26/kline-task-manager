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
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
            borderRadius: '16px',
            margin: '0 auto 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 25px rgba(220, 38, 38, 0.3)'
          }}>
            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '2rem' }}>K</span>
          </div>
          <p style={{ color: '#64748b', fontSize: '1.1rem', fontWeight: '500' }}>Redirecting to login...</p>
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
      color: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
      icon: '📋',
      subtitle: 'Active Tasks'
    },
    {
      title: 'Customer Portal',
      description: 'Manage customer information and profiles',
      count: stats?.totalCustomers || 0,
      route: '/customers',
      color: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      icon: '👥',
      subtitle: 'Total Clients'
    },
    {
      title: 'Service Catalog',
      description: 'Manage service offerings and pricing',
      count: stats?.totalServices || 0,
      route: '/services', 
      color: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
      icon: '🛠️',
      subtitle: 'Services'
    },
    {
      title: 'User Administration',
      description: 'Manage system users and permissions',
      count: stats?.totalUsers || 0,
      route: '/users',
      color: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
      icon: '👤',
      subtitle: 'System Users'
    },
    {
      title: 'Property Management',
      description: 'Manage customer properties and locations',
      count: stats?.totalProperties || 0,
      route: '/properties',
      color: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
      icon: '🏢',
      subtitle: 'Properties'
    },
    {
      title: 'Workflow Status',
      description: 'Configure task statuses and workflows',
      count: stats?.totalStatuses || 0,
      route: '/statuses',
      color: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
      icon: '📊',
      subtitle: 'Status Types'
    }
  ]

  // Métricas clave
  const renderKeyMetrics = () => {
    const completionRate = stats?.totalTasks ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0
    
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '24px',
        marginBottom: '32px'
      }}>
        {/* Total Tasks Card */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e2e8f0',
          transition: 'all 0.3s ease',
          cursor: 'pointer'
        }} onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)'
          e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.12)'
        }} onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <p style={{ fontSize: '14px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Tasks
              </p>
              <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#1e293b', margin: '8px 0 0 0' }}>
                {stats?.totalTasks || 0}
              </p>
            </div>
            <div style={{
              width: '56px',
              height: '56px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
            }}>
              <span style={{ fontSize: '1.5rem', color: 'white' }}>📋</span>
            </div>
          </div>
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
              <span style={{ color: '#059669', fontWeight: '600' }}>{stats?.completedTasks || 0} completed</span>
              <span style={{ color: '#64748b', fontWeight: '500' }}>{completionRate}%</span>
            </div>
            <div style={{ width: '100%', background: '#e2e8f0', borderRadius: '8px', height: '8px' }}>
              <div style={{ 
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                height: '8px',
                borderRadius: '8px',
                transition: 'width 1s ease',
                width: `${completionRate}%`
              }} />
            </div>
          </div>
        </div>

        {/* Customers Card */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e2e8f0',
          transition: 'all 0.3s ease',
          cursor: 'pointer'
        }} onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)'
          e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.12)'
        }} onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <p style={{ fontSize: '14px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Active Clients
              </p>
              <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#1e293b', margin: '8px 0 0 0' }}>
                {stats?.totalCustomers || 0}
              </p>
            </div>
            <div style={{
              width: '56px',
              height: '56px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}>
              <span style={{ fontSize: '1.5rem', color: 'white' }}>👥</span>
            </div>
          </div>
          <div style={{ marginTop: '20px', fontSize: '14px', color: '#64748b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span>Properties:</span>
              <span style={{ fontWeight: '600', color: '#1e293b' }}>{stats?.totalProperties || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
              <span>Active Services:</span>
              <span style={{ fontWeight: '600', color: '#1e293b' }}>{stats?.totalServices || 0}</span>
            </div>
          </div>
        </div>

        {/* Pending Tasks Card */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e2e8f0',
          transition: 'all 0.3s ease',
          cursor: 'pointer'
        }} onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)'
          e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.12)'
        }} onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <p style={{ fontSize: '14px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Pending Tasks
              </p>
              <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#1e293b', margin: '8px 0 0 0' }}>
                {stats?.pendingTasks || 0}
              </p>
            </div>
            <div style={{
              width: '56px',
              height: '56px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
            }}>
              <span style={{ fontSize: '1.5rem', color: 'white' }}>⏱️</span>
            </div>
          </div>
          <div style={{ marginTop: '20px' }}>
            {stats?.overdueTasks && stats.overdueTasks > 0 ? (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                padding: '12px',
                background: '#fef2f2',
                borderRadius: '8px',
                border: '1px solid #fecaca'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#dc2626', fontSize: '18px' }}>⚠️</span>
                  <span style={{ color: '#dc2626', fontWeight: '600', fontSize: '14px' }}>
                    {stats.overdueTasks} overdue
                  </span>
                </div>
                <span style={{ color: '#dc2626', fontSize: '12px', fontWeight: '500' }}>Attention needed</span>
              </div>
            ) : (
              <div style={{ 
                textAlign: 'center',
                padding: '12px',
                background: '#f0fdf4',
                borderRadius: '8px',
                border: '1px solid #bbf7d0'
              }}>
                <span style={{ color: '#059669', fontWeight: '600', fontSize: '14px' }}>All tasks on track</span>
              </div>
            )}
          </div>
        </div>

        {/* Service Coverage Card */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e2e8f0',
          transition: 'all 0.3s ease',
          cursor: 'pointer'
        }} onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)'
          e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.12)'
        }} onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <p style={{ fontSize: '14px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Service Coverage
              </p>
              <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#1e293b', margin: '8px 0 0 0' }}>
                {stats?.totalServices || 0}
              </p>
            </div>
            <div style={{
              width: '56px',
              height: '56px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
            }}>
              <span style={{ fontSize: '1.5rem', color: 'white' }}>🛠️</span>
            </div>
          </div>
          <div style={{ marginTop: '20px' }}>
            <div style={{ 
              textAlign: 'center',
              padding: '12px',
              background: '#faf5ff',
              borderRadius: '8px',
              border: '1px solid #e9d5ff'
            }}>
              <span style={{ color: '#7c3aed', fontWeight: '600', fontSize: '14px' }}>Active service types</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
    }}>
      {/* Header Corporativo */}
      <header style={{
        background: 'white',
        boxShadow: '0 4px 25px rgba(0, 0, 0, 0.1)',
        borderBottom: '1px solid #e2e8f0'
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
            padding: '20px 0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 20px rgba(220, 38, 38, 0.3)'
              }}>
                <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1.25rem' }}>K</span>
              </div>
              <div>
                <h1 style={{ 
                  fontSize: '2rem', 
                  fontWeight: 'bold', 
                  color: '#1e293b',
                  margin: 0
                }}>
                  KLINE Task Manager
                </h1>
                <p style={{ 
                  color: '#64748b', 
                  fontSize: '1rem',
                  fontWeight: '500',
                  margin: '4px 0 0 0'
                }}>
                  Service Management Dashboard
                </p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                color: 'white',
                fontWeight: '600',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(220, 38, 38, 0.3)',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(220, 38, 38, 0.4)'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(220, 38, 38, 0.3)'
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
              width: '60px', 
              height: '60px', 
              border: '4px solid #e2e8f0', 
              borderTop: '4px solid #dc2626',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }} />
            <p style={{ color: '#64748b', fontSize: '1.125rem', fontWeight: '500' }}>
              Loading dashboard data...
            </p>
          </div>
        ) : (
          <>
            {/* Bienvenida */}
            <div style={{ textAlign: 'center', marginBottom: '48px' }}>
              <h2 style={{ 
                fontSize: '2.5rem', 
                fontWeight: 'bold', 
                color: '#1e293b',
                margin: '0 0 12px 0'
              }}>
                Dashboard Overview
              </h2>
              <p style={{ 
                fontSize: '1.25rem', 
                color: '#64748b',
                maxWidth: '600px',
                margin: '0 auto',
                lineHeight: '1.6'
              }}>
                Welcome to your professional service management dashboard
              </p>
            </div>

            {/* Métricas Clave */}
            {renderKeyMetrics()}

            {/* Navegación Principal */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
              gap: '24px',
              marginBottom: '48px'
            }}>
              {navigationCards.map((card, index) => (
                <div 
                  key={index}
                  style={{
                    background: 'white',
                    borderRadius: '20px',
                    padding: '32px',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer',
                    transition: 'all 0.4s ease',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onClick={() => router.push(card.route)}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-8px)'
                    e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.15)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.08)'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    justifyContent: 'space-between', 
                    marginBottom: '20px',
                    position: 'relative',
                    zIndex: 2
                  }}>
                    <div style={{
                      width: '64px',
                      height: '64px',
                      background: card.color,
                      borderRadius: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)'
                    }}>
                      <span style={{ fontSize: '1.75rem', color: 'white' }}>{card.icon}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#1e293b' }}>
                        {card.count}
                      </div>
                      <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '500', marginTop: '4px' }}>
                        {card.subtitle}
                      </div>
                    </div>
                  </div>
                  
                  <h3 style={{ 
                    fontSize: '1.5rem', 
                    fontWeight: 'bold', 
                    color: '#1e293b',
                    margin: '0 0 12px 0',
                    position: 'relative',
                    zIndex: 2
                  }}>
                    {card.title}
                  </h3>
                  <p style={{ 
                    color: '#64748b', 
                    fontSize: '14px',
                    lineHeight: '1.6',
                    margin: '0 0 24px 0',
                    position: 'relative',
                    zIndex: 2
                  }}>
                    {card.description}
                  </p>
                  
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    color: '#2563eb',
                    fontWeight: '600',
                    fontSize: '14px',
                    position: 'relative',
                    zIndex: 2
                  }}>
                    Access module
                    <span style={{ marginLeft: '8px', transition: 'transform 0.3s ease' }}>→</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Sección de Tareas Recientes */}
            <div style={{
              background: 'white',
              borderRadius: '20px',
              padding: '32px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                marginBottom: '24px'
              }}>
                <h3 style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 'bold', 
                  color: '#1e293b',
                  margin: 0
                }}>
                  Recent Tasks
                </h3>
                <button 
                  onClick={() => router.push('/tasks')}
                  style={{
                    padding: '10px 20px',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: 'white',
                    fontWeight: '600',
                    borderRadius: '10px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(37, 99, 235, 0.4)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(37, 99, 235, 0.3)'
                  }}
                >
                  View All Tasks
                </button>
              </div>

              {stats?.recentTasks && stats.recentTasks.length > 0 ? (
                <div style={{ overflow: 'hidden', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
                        <th style={{ 
                          padding: '16px 20px', 
                          textAlign: 'left', 
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#64748b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          borderBottom: '1px solid #e2e8f0'
                        }}>
                          Service & Customer
                        </th>
                        <th style={{ 
                          padding: '16px 20px', 
                          textAlign: 'left', 
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#64748b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          borderBottom: '1px solid #e2e8f0'
                        }}>
                          Location
                        </th>
                        <th style={{ 
                          padding: '16px 20px', 
                          textAlign: 'left', 
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#64748b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          borderBottom: '1px solid #e2e8f0'
                        }}>
                          Status
                        </th>
                        <th style={{ 
                          padding: '16px 20px', 
                          textAlign: 'left', 
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#64748b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          borderBottom: '1px solid #e2e8f0'
                        }}>
                          Scheduled
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentTasks.map((task) => (
                        <tr key={task.id} style={{ 
                          transition: 'background-color 0.2s ease',
                          cursor: 'pointer'
                        }} onMouseOver={(e) => {
                          e.currentTarget.style.backgroundColor = '#f8fafc'
                        }} onMouseOut={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }}>
                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{ fontWeight: '600', color: '#1e293b' }}>{task.service}</div>
                            <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>{task.customer}</div>
                          </td>
                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{ fontSize: '14px', color: '#1e293b' }}>{task.address}</div>
                          </td>
                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '6px 12px',
                              borderRadius: '20px',
                              fontSize: '12px',
                              fontWeight: '600',
                              background: '#dbeafe',
                              color: '#1e40af',
                              border: '1px solid #bfdbfe'
                            }}>
                              {task.status}
                            </span>
                          </td>
                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', fontSize: '14px', color: '#64748b' }}>
                            {task.scheduledFor ? new Date(task.scheduledFor).toLocaleDateString() : 'Not scheduled'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📝</div>
                  <p style={{ fontSize: '1.125rem', fontWeight: '500', marginBottom: '8px' }}>No recent tasks</p>
                  <p style={{ fontSize: '14px' }}>Recently created tasks will appear here</p>
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