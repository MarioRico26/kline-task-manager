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
  count: number
  route: string
  color: string
  icon: string
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
    { title: 'Tasks', count: stats?.totalTasks || 0, route: '/tasks', color: 'bg-blue-500', icon: '📋' },
    { title: 'Customers', count: stats?.totalCustomers || 0, route: '/customers', color: 'bg-green-500', icon: '👥' },
    { title: 'Services', count: stats?.totalServices || 0, route: '/services', color: 'bg-purple-500', icon: '🛠️' },
    { title: 'Users', count: stats?.totalUsers || 0, route: '/users', color: 'bg-red-500', icon: '👤' },
    { title: 'Properties', count: stats?.totalProperties || 0, route: '/properties', color: 'bg-orange-500', icon: '🏢' },
    { title: 'Statuses', count: stats?.totalStatuses || 0, route: '/statuses', color: 'bg-indigo-500', icon: '📊' }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">K</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-600">Service Management Overview</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-gray-300 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white p-6 rounded-xl shadow-sm border">
                <div className="text-2xl font-bold text-gray-900">{stats?.totalTasks || 0}</div>
                <div className="text-gray-600">Total Tasks</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border">
                <div className="text-2xl font-bold text-gray-900">{stats?.totalCustomers || 0}</div>
                <div className="text-gray-600">Customers</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border">
                <div className="text-2xl font-bold text-gray-900">{stats?.completedTasks || 0}</div>
                <div className="text-gray-600">Completed Tasks</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border">
                <div className="text-2xl font-bold text-gray-900">{stats?.pendingTasks || 0}</div>
                <div className="text-gray-600">Pending Tasks</div>
              </div>
            </div>

            {/* Navigation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {navigationCards.map((card: NavigationCard, index: number) => (
                <div 
                  key={index}
                  className="bg-white p-6 rounded-xl shadow-sm border cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => router.push(card.route)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{card.title}</h3>
                      <p className="text-2xl font-bold mt-2">{card.count}</p>
                    </div>
                    <div className={`w-12 h-12 ${card.color} rounded-lg flex items-center justify-center`}>
                      <span className="text-white text-xl">{card.icon}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent Tasks */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Tasks</h3>
              {stats?.recentTasks && stats.recentTasks.length > 0 ? (
                <div className="space-y-3">
                  {stats.recentTasks.map((task: {
                    id: string
                    service: string
                    customer: string
                    status: string
                    scheduledFor: string | null
                    address: string
                  }) => (
                    <div key={task.id} className="flex justify-between items-center p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{task.service}</div>
                        <div className="text-sm text-gray-600">{task.customer}</div>
                      </div>
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                        {task.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-3xl mb-2">📝</div>
                  <p>No recent tasks</p>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}