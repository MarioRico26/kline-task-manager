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

interface NavigationCard {
  title: string
  description: string
  count: number
  route: string
  color: string
  icon: string
  subtitle: string
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-600 rounded-lg mx-auto mb-4 flex items-center justify-center">
            <span className="text-white font-bold text-xl">K</span>
          </div>
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  const handleLogout = () => {
    document.cookie = 'user-id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    window.location.href = '/auth/login'
  }

  const navigationCards: NavigationCard[] = [
    {
      title: 'Task Management',
      description: 'Manage and track service tasks',
      count: stats?.totalTasks || 0,
      route: '/tasks',
      color: 'from-blue-600 to-blue-800',
      icon: '📋',
      subtitle: 'Active Tasks'
    },
    {
      title: 'Customer Portal',
      description: 'Manage customer information and profiles',
      count: stats?.totalCustomers || 0,
      route: '/customers',
      color: 'from-green-600 to-green-800',
      icon: '👥',
      subtitle: 'Total Clients'
    },
    {
      title: 'Service Catalog',
      description: 'Manage service offerings and pricing',
      count: stats?.totalServices || 0,
      route: '/services', 
      color: 'from-purple-600 to-purple-800',
      icon: '🛠️',
      subtitle: 'Services'
    },
    {
      title: 'User Administration',
      description: 'Manage system users and permissions',
      count: stats?.totalUsers || 0,
      route: '/users',
      color: 'from-red-600 to-red-800',
      icon: '👤',
      subtitle: 'System Users'
    },
    {
      title: 'Property Management',
      description: 'Manage customer properties and locations',
      count: stats?.totalProperties || 0,
      route: '/properties',
      color: 'from-orange-600 to-orange-800',
      icon: '🏢',
      subtitle: 'Properties'
    },
    {
      title: 'Workflow Status',
      description: 'Configure task statuses and workflows',
      count: stats?.totalStatuses || 0,
      route: '/statuses',
      color: 'from-indigo-600 to-indigo-800',
      icon: '📊',
      subtitle: 'Status Types'
    }
  ]

  // Métricas clave con diseño corporativo
  const renderKeyMetrics = () => {
    const completionRate = stats?.totalTasks ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 transform transition-all duration-300 hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Total Tasks</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.totalTasks || 0}</p>
            </div>
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-2xl text-white">📋</span>
            </div>
          </div>
          <div className="mt-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-green-600 font-semibold">{stats?.completedTasks || 0} completed</span>
              <span className="text-gray-500 font-medium">{completionRate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-1000 shadow-sm"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 transform transition-all duration-300 hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Active Clients</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.totalCustomers || 0}</p>
            </div>
            <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-700 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-2xl text-white">👥</span>
            </div>
          </div>
          <div className="mt-6 text-sm text-gray-600">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span>Properties:</span>
              <span className="font-semibold text-gray-900">{stats?.totalProperties || 0}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span>Active Services:</span>
              <span className="font-semibold text-gray-900">{stats?.totalServices || 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 transform transition-all duration-300 hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Pending Tasks</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.pendingTasks || 0}</p>
            </div>
            <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-700 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-2xl text-white">⏱️</span>
            </div>
          </div>
          <div className="mt-6">
            {stats?.overdueTasks && stats.overdueTasks > 0 ? (
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center space-x-2">
                  <span className="text-red-600">⚠️</span>
                  <span className="text-red-800 font-semibold text-sm">{stats.overdueTasks} overdue</span>
                </div>
                <span className="text-red-600 text-xs font-medium">Attention needed</span>
              </div>
            ) : (
              <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                <span className="text-green-800 font-semibold text-sm">All tasks on track</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 transform transition-all duration-300 hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Service Coverage</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.totalServices || 0}</p>
            </div>
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-2xl text-white">🛠️</span>
            </div>
          </div>
          <div className="mt-6">
            <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-200">
              <span className="text-purple-800 font-semibold text-sm">Active service types</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Gráfico de barras profesional
  const renderBarChart = () => {
    if (!stats?.tasksByService || stats.tasksByService.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <div className="text-5xl mb-4">📊</div>
          <p className="font-medium text-lg">No service data available</p>
          <p className="text-sm mt-2">Service statistics will appear here</p>
        </div>
      )
    }
    
    const maxCount = Math.max(...stats.tasksByService.map(item => item.count))
    const topServices = stats.tasksByService.slice(0, 5)
    
    return (
      <div className="space-y-5">
        {topServices.map((item, index) => {
          const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0
          return (
            <div key={index} className="flex items-center space-x-4 group">
              <div className="w-40 text-sm font-semibold text-gray-700 truncate">
                {item.service}
              </div>
              <div className="flex-1">
                <div className="bg-gray-100 rounded-full h-4 overflow-hidden shadow-inner">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-blue-700 h-4 rounded-full transition-all duration-1000 group-hover:from-blue-600 group-hover:to-blue-800"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
              <div className="w-16 text-right">
                <span className="font-bold text-gray-900 text-lg">{item.count}</span>
                <span className="text-xs text-gray-500 ml-1">tasks</span>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Tabla de tareas recientes profesional
  const renderRecentTasks = () => {
    if (!stats?.recentTasks || stats.recentTasks.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <div className="text-5xl mb-4">📝</div>
          <p className="font-medium text-lg">No recent tasks</p>
          <p className="text-sm mt-2">Recently created tasks will appear here</p>
        </div>
      )
    }

    return (
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Service & Customer
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Location
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Scheduled
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {stats.recentTasks.map((task) => (
              <tr key={task.id} className="hover:bg-blue-50 transition-colors duration-200">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-semibold text-gray-900">{task.service}</div>
                  <div className="text-sm text-gray-600">{task.customer}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900 max-w-xs truncate">
                    {task.address}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                    {task.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {task.scheduledFor ? new Date(task.scheduledFor).toLocaleDateString() : 'Not scheduled'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header Corporativo */}
      <header className="bg-white shadow-xl border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-red-800 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-xl">K</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">KLINE Task Manager</h1>
                <p className="text-gray-600 font-medium">Service Management Dashboard</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="px-6 py-3 bg-gradient-to-br from-red-600 to-red-800 text-white font-semibold rounded-xl hover:from-red-700 hover:to-red-900 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 border-4 border-gray-300 border-t-red-600 rounded-full animate-spin mx-auto mb-6"></div>
            <p className="text-gray-600 text-lg font-medium">Loading dashboard data...</p>
          </div>
        ) : (
          <>
            {/* Bienvenida */}
            <div className="mb-10 text-center">
              <h2 className="text-4xl font-bold text-gray-900 mb-3">Dashboard Overview</h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Welcome to your professional service management dashboard. Monitor performance and manage operations efficiently.
              </p>
            </div>

            {/* Métricas Clave */}
            {renderKeyMetrics()}

            {/* Navegación Principal */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
              {navigationCards.map((card, index) => (
                <div 
                  key={index}
                  className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 cursor-pointer transition-all duration-500 hover:shadow-2xl hover:border-gray-200 group transform hover:scale-105"
                  onClick={() => router.push(card.route)}
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow`}>
                      <span className="text-white text-2xl">{card.icon}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-gray-900">{card.count}</div>
                      <div className="text-sm text-gray-500 font-medium mt-1">{card.subtitle}</div>
                    </div>
                  </div>
                  <h3 className="font-bold text-gray-900 text-xl mb-3 group-hover:text-blue-600 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-gray-600 text-sm mb-6 leading-relaxed">{card.description}</p>
                  <div className="flex items-center text-blue-600 font-semibold text-sm group-hover:text-blue-700 transition-colors">
                    Access module
                    <svg className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>

            {/* Sección Inferior - Estadísticas y Tareas Recientes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Estadísticas de Servicios */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-bold text-gray-900">Service Distribution</h3>
                  <span className="text-sm text-gray-500 font-semibold bg-gray-100 px-3 py-1 rounded-full">Top Services</span>
                </div>
                {renderBarChart()}
              </div>

              {/* Tareas Recientes */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-bold text-gray-900">Recent Tasks</h3>
                  <button 
                    onClick={() => router.push('/tasks')}
                    className="px-4 py-2 bg-gradient-to-br from-blue-600 to-blue-800 text-white text-sm font-semibold rounded-lg hover:from-blue-700 hover:to-blue-900 transition-all duration-300 shadow-lg hover:shadow-xl"
                  >
                    View All Tasks
                  </button>
                </div>
                {renderRecentTasks()}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}