//kline-task-manager/src/app/tasks/page.tsx:
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Task {
  id: string
  notes: string | null
  scheduledFor: string | null
  completedAt: string | null
  createdAt: string
  customer: {
    id: string
    fullName: string
    email: string
  }
  property: {
    id: string
    address: string
    city: string
    state: string
  }
  service: {
    id: string
    name: string
  }
  status: {
    id: string
    name: string
    color: string | null
    notifyClient: boolean
  }
  media: {
    id: string
    url: string
  }[]
}

interface Customer {
  id: string
  fullName: string
  email: string
}

interface Property {
  id: string
  address: string
  city: string
  state: string
  customerId: string
}

interface Service {
  id: string
  name: string
}

interface TaskStatus {
  id: string
  name: string
  color: string | null
  notifyClient: boolean
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [statuses, setStatuses] = useState<TaskStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [customerFilter, setCustomerFilter] = useState('ALL')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [deletingTask, setDeletingTask] = useState<Task | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null) // 🔐 NUEVO
  const router = useRouter()

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/check', {
          credentials: 'include',
          cache: 'no-store'
        })
  
        if (res.ok) {
          setIsAuthenticated(true)
        } else {
          setIsAuthenticated(false)
          router.push('/auth/login')
        }
      } catch (error) {
        setIsAuthenticated(false)
        router.push('/auth/login')
      }
    }
  
    checkAuth()
  }, [router])

// ✅ Cargar datos solo cuando ya estamos seguros que hay login
useEffect(() => {
  if (isAuthenticated === true) {
    fetchData()
  }
}, [isAuthenticated])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [tasksRes, customersRes, propertiesRes, servicesRes, statusesRes] = await Promise.all([
        fetch('/api/tasks', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/customers', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/properties', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/services', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/statuses', { cache: 'no-store', credentials: 'include' })
      ])

      if (tasksRes.ok && customersRes.ok && propertiesRes.ok && servicesRes.ok && statusesRes.ok) {
        const tasksData = await tasksRes.json()
        const customersData = await customersRes.json()
        const propertiesData = await propertiesRes.json()
        const servicesData = await servicesRes.json()
        const statusesData = await statusesRes.json()
        
        setTasks(tasksData)
        setCustomers(customersData)
        setProperties(propertiesData)
        setServices(servicesData)
        setStatuses(statusesData)
      } else {
        console.error('Error fetching data')
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }
  if (isAuthenticated === null) {
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
          <p style={{ color: 'var(--kline-text-light)' }}>Checking session...</p>
        </div>
      </div>
    )
  }

  // 🔐 REDIRECCIÓN SI NO ESTÁ AUTENTICADO (AÑADIDO)
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
  if (isAuthenticated === true && loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'var(--kline-gray-light)'
      }}>
        <p style={{ color: 'var(--kline-text-light)' }}>Loading tasks...</p>
      </div>
    )
  }

  const handleLogout = () => {
    document.cookie = 'user-id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    window.location.href = '/auth/login'
  }

  const handleBack = () => {
    router.back()
  }

  const handleDashboard = () => {
    router.push('/dashboard')
  }

  const handleDeleteTask = async (task: Task) => {
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchData()
        setDeletingTask(null)
      } else {
        alert('Error deleting task')
      }
    } catch (error) {
      alert('Network error')
    }
  }

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = 
      task.customer.fullName.toLowerCase().includes(filter.toLowerCase()) ||
      task.property.address.toLowerCase().includes(filter.toLowerCase()) ||
      task.service.name.toLowerCase().includes(filter.toLowerCase()) ||
      (task.notes && task.notes.toLowerCase().includes(filter.toLowerCase()))
    
    const matchesStatus = statusFilter === 'ALL' || task.status.id === statusFilter
    const matchesCustomer = customerFilter === 'ALL' || task.customer.id === customerFilter
    
    return matchesSearch && matchesStatus && matchesCustomer
  })

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not scheduled'
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getStatusColor = (color: string | null) => {
    return color || '#6b7280'
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--kline-gray-light)' }}>
      {/* Header */}
      <header className="kline-header" style={{ padding: '1rem 0' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <button 
                onClick={handleBack}
                style={{ 
                  background: 'transparent',
                  border: '2px solid var(--kline-text-light)',
                  color: 'var(--kline-text-light)',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  transition: 'all 0.3s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = 'var(--kline-red)'
                  e.currentTarget.style.color = 'var(--kline-red)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'var(--kline-text-light)'
                  e.currentTarget.style.color = 'var(--kline-text-light)'
                }}
              >
                ← Back
              </button>
              <h1 style={{ fontSize: '1.8rem', fontWeight: '700', color: 'var(--kline-text)' }}>
                Task <span className="kline-accent">Management</span>
              </h1>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button 
                onClick={handleDashboard}
                style={{ 
                  background: 'var(--kline-yellow)',
                  border: 'none',
                  color: 'var(--kline-text)',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  transition: 'all 0.3s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'var(--kline-yellow-light)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'var(--kline-yellow)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                Dashboard
              </button>
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
        {/* Action Bar */}
        <div className="kline-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Search */}
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="kline-input"
                  style={{ paddingLeft: '2.5rem', width: '300px', padding: '0.8rem 1rem 0.8rem 2.5rem' }}
                />
                <span style={{ 
                  position: 'absolute', 
                  left: '1rem', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: 'var(--kline-text-light)'
                }}>
                  🔍
                </span>
              </div>

              {/* Status Filter */}
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="kline-input"
                style={{ width: '180px', padding: '0.8rem 1rem' }}
              >
                <option value="ALL">All Statuses</option>
                {statuses.map(status => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                  </option>
                ))}
              </select>

              {/* Customer Filter */}
              <select 
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                className="kline-input"
                style={{ width: '200px', padding: '0.8rem 1rem' }}
              >
                <option value="ALL">All Customers</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.fullName}
                  </option>
                ))}
              </select>
            </div>

            {/* Add Task Button */}
            <button 
              className="kline-btn-primary"
              style={{ padding: '0.8rem 1.5rem', fontSize: '0.9rem' }}
              onClick={() => setIsCreateModalOpen(true)}
              disabled={customers.length === 0 || properties.length === 0 || services.length === 0 || statuses.length === 0}
            >
              {customers.length === 0 ? 'Need Customers' : 
               properties.length === 0 ? 'Need Properties' :
               services.length === 0 ? 'Need Services' :
               statuses.length === 0 ? 'Need Statuses' : '+ New Task'}
            </button>
          </div>
        </div>

        {/* Tasks Table - Compact View */}
        {loading ? (
          <div className="kline-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--kline-text-light)' }}>
            Loading tasks...
          </div>
        ) : customers.length === 0 || properties.length === 0 || services.length === 0 || statuses.length === 0 ? (
          <div className="kline-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--kline-text-light)' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--kline-text)' }}>Setup Required</h3>
            <p>You need to create customers, properties, services, and statuses before adding tasks.</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem', flexWrap: 'wrap' }}>
              {customers.length === 0 && (
                <button 
                  className="kline-btn-primary"
                  style={{ padding: '0.6rem 1.2rem', fontSize: '0.8rem' }}
                  onClick={() => router.push('/customers')}
                >
                  Create Customers
                </button>
              )}
              {properties.length === 0 && (
                <button 
                  className="kline-btn-primary"
                  style={{ padding: '0.6rem 1.2rem', fontSize: '0.8rem' }}
                  onClick={() => router.push('/properties')}
                >
                  Create Properties
                </button>
              )}
              {services.length === 0 && (
                <button 
                  className="kline-btn-primary"
                  style={{ padding: '0.6rem 1.2rem', fontSize: '0.8rem' }}
                  onClick={() => router.push('/services')}
                >
                  Create Services
                </button>
              )}
              {statuses.length === 0 && (
                <button 
                  className="kline-btn-primary"
                  style={{ padding: '0.6rem 1.2rem', fontSize: '0.8rem' }}
                  onClick={() => router.push('/statuses')}
                >
                  Create Statuses
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="kline-card" style={{ overflow: 'hidden' }}>
            {/* Table Header */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1.5fr 1.2fr 1fr 1fr 1fr auto',
              padding: '1rem 1.5rem',
              background: 'var(--kline-gray-light)',
              borderBottom: '2px solid var(--kline-gray)',
              fontWeight: '600',
              color: 'var(--kline-text)',
              fontSize: '0.85rem'
            }}>
              <div>Customer & Property</div>
              <div>Service & Notes</div>
              <div>Status</div>
              <div>Scheduled</div>
              <div>Created</div>
              <div>Actions</div>
            </div>

            {/* Table Rows */}
            {filteredTasks.map((task) => (
              <div 
                key={task.id}
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1.5fr 1.2fr 1fr 1fr 1fr auto',
                  padding: '1rem 1.5rem',
                  borderBottom: '1px solid var(--kline-gray)',
                  alignItems: 'center',
                  fontSize: '0.85rem',
                  transition: 'background 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'var(--kline-gray-light)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                {/* Customer & Property Column */}
                <div>
                  <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                    {task.customer.fullName}
                  </div>
                  <div style={{ 
                    color: 'var(--kline-text-light)', 
                    fontSize: '0.75rem'
                  }}>
                    {task.property.address}, {task.property.city}, {task.property.state}
                  </div>
                </div>

                {/* Service & Notes Column */}
                <div>
                  <div style={{ fontWeight: '600', color: 'var(--kline-blue)', marginBottom: '0.25rem' }}>
                    {task.service.name}
                  </div>
                  <div style={{ 
                    color: 'var(--kline-text-light)', 
                    fontSize: '0.75rem',
                    fontStyle: task.notes ? 'normal' : 'italic'
                  }}>
                    {task.notes || 'No notes'}
                  </div>
                </div>

                {/* Status Column */}
                <div>
                  <span style={{ 
                    background: getStatusColor(task.status.color),
                    color: 'white',
                    padding: '0.3rem 0.6rem',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    display: 'inline-block'
                  }}>
                    {task.status.name}
                  </span>
                </div>

                {/* Scheduled Column */}
                <div style={{ color: 'var(--kline-text)', fontSize: '0.8rem' }}>
                  {formatDate(task.scheduledFor)}
                </div>

                {/* Created Column */}
                <div style={{ 
                  color: 'var(--kline-text-light)', 
                  fontSize: '0.75rem'
                }}>
                  {new Date(task.createdAt).toLocaleDateString()}
                </div>

                {/* Actions Column */}
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button 
                    style={{ 
                      background: 'var(--kline-yellow)',
                      border: 'none',
                      color: 'var(--kline-text)',
                      padding: '0.4rem 0.8rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '0.75rem',
                      transition: 'all 0.2s ease',
                      minWidth: '60px'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'var(--kline-yellow-light)'
                      e.currentTarget.style.transform = 'translateY(-1px)'
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'var(--kline-yellow)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                    onClick={() => setEditingTask(task)}
                  >
                    Edit
                  </button>
                  <button 
                    style={{ 
                      padding: '0.4rem 0.8rem', 
                      fontSize: '0.75rem',
                      background: 'transparent',
                      border: '1px solid var(--kline-red)',
                      color: 'var(--kline-red)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      transition: 'all 0.2s ease',
                      minWidth: '60px'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'var(--kline-red)'
                      e.currentTarget.style.color = 'white'
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'var(--kline-red)'
                    }}
                    onClick={() => setDeletingTask(task)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {filteredTasks.length === 0 && (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--kline-text-light)' }}>
                {tasks.length === 0 ? 'No tasks found' : 'No tasks match your search'}
              </div>
            )}
          </div>
        )}

        {/* Compact Stats */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
          gap: '0.75rem', 
          marginTop: '1.5rem' 
        }}>
          <div className="kline-card" style={{ 
            padding: '1rem', 
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--kline-red)' }}>
              {tasks.length}
            </div>
            <div style={{ 
              color: 'var(--kline-text-light)', 
              fontSize: '0.8rem',
              fontWeight: '600'
            }}>
              Total Tasks
            </div>
          </div>
          <div className="kline-card" style={{ 
            padding: '1rem', 
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--kline-red)' }}>
              {tasks.filter(t => t.scheduledFor && new Date(t.scheduledFor) > new Date()).length}
            </div>
            <div style={{ 
              color: 'var(--kline-text-light)', 
              fontSize: '0.8rem',
              fontWeight: '600'
            }}>
              Upcoming
            </div>
          </div>
          <div className="kline-card" style={{ 
            padding: '1rem', 
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--kline-red)' }}>
              {tasks.filter(t => t.completedAt).length}
            </div>
            <div style={{ 
              color: 'var(--kline-text-light)', 
              fontSize: '0.8rem',
              fontWeight: '600'
            }}>
              Completed
            </div>
          </div>
          <div className="kline-card" style={{ 
            padding: '1rem', 
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--kline-red)' }}>
              {tasks.filter(t => t.status.notifyClient).length}
            </div>
            <div style={{ 
              color: 'var(--kline-text-light)', 
              fontSize: '0.8rem',
              fontWeight: '600'
            }}>
              Notify Client
            </div>
          </div>
        </div>
      </main>

      {/* Create Task Modal */}
      {isCreateModalOpen && (
        <CreateTaskModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onTaskCreated={fetchData}
          customers={customers}
          properties={properties}
          services={services}
          statuses={statuses}
        />
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onTaskUpdated={fetchData}
          customers={customers}
          properties={properties}
          services={services}
          statuses={statuses}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingTask && (
        <DeleteTaskModal
          task={deletingTask}
          onClose={() => setDeletingTask(null)}
          onTaskDeleted={handleDeleteTask}
        />
      )}
    </div>
  )
}

// Create Task Modal Component
// Create Task Modal Component (Property-first, Human-proof)
function CreateTaskModal({
  isOpen,
  onClose,
  onTaskCreated,
  customers,
  properties,
  services,
  statuses
}: {
  isOpen: boolean
  onClose: () => void
  onTaskCreated: () => void
  customers: Customer[]
  properties: Property[]
  services: Service[]
  statuses: TaskStatus[]
}) {
  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '', // ✅ read-only display
    propertyId: '',
    propertySearch: '',

    serviceId: services[0]?.id || '',
    statusId: statuses[0]?.id || '',
    notes: '',
    scheduledFor: '',
    files: [] as File[]
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false)

  // Helpers
  const getCustomerById = (id: string) => customers.find(c => c.id === id)
  const getPropertyById = (id: string) => properties.find(p => p.id === id)

  const formatPropertyLabel = (p: Property) => `${p.address}, ${p.city}, ${p.state}`

  const filteredProperties = (() => {
    const q = formData.propertySearch.trim().toLowerCase()
    if (!q) return properties.slice(0, 25)

    return properties
      .filter(p => {
        const c = customers.find(x => x.id === p.customerId)
        const customerText = c ? `${c.fullName} ${c.email}`.toLowerCase() : ''
        const propText = `${p.address} ${p.city} ${p.state}`.toLowerCase()
        return propText.includes(q) || customerText.includes(q)
      })
      .slice(0, 50)
  })()

  const selectProperty = (p: Property) => {
    const c = getCustomerById(p.customerId)
    setFormData(prev => ({
      ...prev,
      propertyId: p.id,
      propertySearch: formatPropertyLabel(p),
      customerId: p.customerId,
      customerName: c ? c.fullName : 'Unknown customer'
    }))
    setShowPropertyDropdown(false)
  }

  const clearProperty = () => {
    setFormData(prev => ({
      ...prev,
      propertyId: '',
      propertySearch: '',
      customerId: '',
      customerName: ''
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // ✅ hard guardrails
      if (!formData.propertyId) {
        setError('Please select a property (address).')
        setLoading(false)
        return
      }
      if (!formData.customerId) {
        setError('Customer is missing. Please re-select the property.')
        setLoading(false)
        return
      }

      const formDataToSend = new FormData()
      formDataToSend.append('customerId', formData.customerId)
      formDataToSend.append('propertyId', formData.propertyId)
      formDataToSend.append('serviceId', formData.serviceId)
      formDataToSend.append('statusId', formData.statusId)
      formDataToSend.append('notes', formData.notes)
      if (formData.scheduledFor) formDataToSend.append('scheduledFor', formData.scheduledFor)

      // Append files
      formData.files.forEach(file => {
        formDataToSend.append('files', file)
      })

      const response = await fetch('/api/tasks', {
        method: 'POST',
        body: formDataToSend
      })

      if (response.ok) {
        onTaskCreated()
        onClose()

        setFormData({
          customerId: '',
          customerName: '',
          propertyId: '',
          propertySearch: '',
          serviceId: services[0]?.id || '',
          statusId: statuses[0]?.id || '',
          notes: '',
          scheduledFor: '',
          files: []
        })
        setShowPropertyDropdown(false)
      } else {
        const data = await response.json()
        setError(data.error || 'Error creating task')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFormData(prev => ({
        ...prev,
        files: Array.from(e.target.files!)
      }))
    }
  }

  const removeFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index)
    }))
  }

  if (!isOpen) return null

  const selectedProperty = formData.propertyId ? getPropertyById(formData.propertyId) : null
  const selectedCustomer = formData.customerId ? getCustomerById(formData.customerId) : null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={() => setShowPropertyDropdown(false)}
    >
      <div
        className="kline-card"
        style={{
          width: '90%',
          maxWidth: '600px',
          padding: '2rem',
          position: 'relative',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: 'var(--kline-text-light)'
          }}
        >
          ×
        </button>

        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem', color: 'var(--kline-text)' }}>
          Create New Task
        </h2>

        {error && (
          <div
            style={{
              background: 'rgba(227, 6, 19, 0.1)',
              border: '1px solid var(--kline-red)',
              color: 'var(--kline-red)',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1rem'
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* ✅ Property FIRST */}
          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
              Property (Address) *
            </label>

            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search address, city, state, or customer..."
                value={formData.propertySearch}
                onChange={(e) => {
                  const val = e.target.value
                  // if user edits after selecting, we clear selection to prevent mismatch
                  setFormData(prev => ({
                    ...prev,
                    propertySearch: val
                  }))
                  setShowPropertyDropdown(true)

                  // Human-proof behavior: if they change the text, nuke the selected ids
                  if (formData.propertyId) {
                    clearProperty()
                    setFormData(prev => ({ ...prev, propertySearch: val }))
                  }
                }}
                onFocus={() => setShowPropertyDropdown(true)}
                className="kline-input"
                style={{ width: '100%', paddingRight: '2rem' }}
              />

              <span
                style={{
                  position: 'absolute',
                  right: '0.8rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--kline-text-light)',
                  pointerEvents: 'none'
                }}
              >
                ⌄
              </span>

              {formData.propertyId && (
                <button
                  type="button"
                  onClick={clearProperty}
                  style={{
                    position: 'absolute',
                    right: '2rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--kline-text-light)',
                    fontSize: '0.9rem'
                  }}
                  title="Clear selection"
                >
                  Clear
                </button>
              )}

              {showPropertyDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    background: 'white',
                    border: '1px solid var(--kline-gray)',
                    borderRadius: '6px',
                    marginTop: '0.25rem',
                    width: '100%',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    zIndex: 10,
                    boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                  }}
                >
                  {filteredProperties.length === 0 ? (
                    <div style={{ padding: '0.8rem 1rem', color: 'var(--kline-text-light)', fontSize: '0.85rem' }}>
                      No matching properties.
                    </div>
                  ) : (
                    filteredProperties.map(p => {
                      const c = getCustomerById(p.customerId)
                      const isSelected = formData.propertyId === p.id

                      return (
                        <div
                          key={p.id}
                          onClick={() => selectProperty(p)}
                          style={{
                            padding: '0.6rem 1rem',
                            cursor: 'pointer',
                            background: isSelected ? 'var(--kline-gray-light)' : 'white'
                          }}
                          onMouseOver={(e) => (e.currentTarget.style.background = 'var(--kline-gray-light)')}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = isSelected ? 'var(--kline-gray-light)' : 'white'
                          }}
                        >
                          <div style={{ fontWeight: 700 }}>{formatPropertyLabel(p)}</div>
                          <div style={{ color: 'var(--kline-text-light)', fontSize: '0.8rem' }}>
                            {c ? c.fullName : 'Unknown customer'}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            {!formData.propertyId && (
              <div style={{ color: 'var(--kline-text-light)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                Select an address to auto-link the customer.
              </div>
            )}
          </div>

          {/* ✅ Customer READ-ONLY */}
          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
              Customer (Auto)
            </label>

            <input
              type="text"
              value={
                selectedCustomer
                  ? `${selectedCustomer.fullName} (${selectedCustomer.email})`
                  : formData.customerName || ''
              }
              className="kline-input"
              readOnly
              disabled
              style={{ opacity: 0.85, cursor: 'not-allowed' }}
              placeholder="Select a property first"
            />

            {formData.propertyId && !selectedCustomer && (
              <div style={{ color: 'var(--kline-red)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                Customer not found for this property. (Data issue)
              </div>
            )}
          </div>

          {/* Service / Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
                Service *
              </label>
              <select
                value={formData.serviceId}
                onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                className="kline-input"
                required
                disabled={!formData.propertyId}
              >
                <option value="">Select a service</option>
                {services.map(service => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
              {!formData.propertyId && (
                <div style={{ color: 'var(--kline-text-light)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  Select a property first.
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
                Status *
              </label>
              <select
                value={formData.statusId}
                onChange={(e) => setFormData({ ...formData, statusId: e.target.value })}
                className="kline-input"
                required
                disabled={!formData.propertyId}
              >
                <option value="">Select a status</option>
                {statuses.map(status => (
                  <option key={status.id} value={status.id}>
                    {status.name} {status.notifyClient ? '(Notifies Customer)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Scheduled For */}
          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
              Scheduled For
            </label>
            <input
              type="datetime-local"
              value={formData.scheduledFor}
              onChange={(e) => setFormData({ ...formData, scheduledFor: e.target.value })}
              className="kline-input"
              disabled={!formData.propertyId}
            />
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="kline-input"
              placeholder="Add any notes about this task..."
              rows={3}
              style={{ resize: 'vertical' }}
              disabled={!formData.propertyId}
            />
          </div>

          {/* Attach Images */}
          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
              Attach Images
            </label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              className="kline-input"
              style={{ padding: '0.5rem' }}
              disabled={!formData.propertyId}
            />

            {formData.files.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--kline-text-light)', marginBottom: '0.5rem' }}>
                  Selected files:
                </div>
                {formData.files.map((file, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem',
                      background: 'var(--kline-gray-light)',
                      borderRadius: '6px',
                      marginBottom: '0.25rem'
                    }}
                  >
                    <span style={{ fontSize: '0.8rem' }}>{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      style={{
                        background: 'var(--kline-red)',
                        border: 'none',
                        color: 'white',
                        borderRadius: '4px',
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.7rem',
                        cursor: 'pointer'
                      }}
                      disabled={!formData.propertyId}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '2px solid var(--kline-text-light)',
                color: 'var(--kline-text-light)',
                padding: '0.8rem 1.5rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.9rem'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.propertyId}
              className="kline-btn-primary"
              style={{ padding: '0.8rem 1.5rem', fontSize: '0.9rem' }}
            >
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Edit Task Modal Component
function EditTaskModal({ task, onClose, onTaskUpdated, customers, properties, services, statuses }: { 
  task: Task | null, 
  onClose: () => void, 
  onTaskUpdated: () => void,
  customers: Customer[],
  properties: Property[],
  services: Service[],
  statuses: TaskStatus[]
}) {
  const [formData, setFormData] = useState({
    customerId: '',
    propertyId: '',
    serviceId: '',
    statusId: '',
    notes: '',
    scheduledFor: '',
    files: [] as File[]
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [customerProperties, setCustomerProperties] = useState<Property[]>([])

  useEffect(() => {
    if (task) {
      setFormData({
        customerId: task.customer.id,
        propertyId: task.property.id,
        serviceId: task.service.id,
        statusId: task.status.id,
        notes: task.notes || '',
        scheduledFor: task.scheduledFor ? new Date(task.scheduledFor).toISOString().slice(0, 16) : '',
        files: []
      })
      
      // Load properties for the selected customer
      const filtered = properties.filter(p => p.customerId === task.customer.id)
      setCustomerProperties(filtered)
    }
  }, [task, properties])

  // Filter properties when customer changes
  useEffect(() => {
    if (formData.customerId) {
      const filtered = properties.filter(p => p.customerId === formData.customerId)
      setCustomerProperties(filtered)
    } else {
      setCustomerProperties([])
    }
  }, [formData.customerId, properties])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!task) return

    setLoading(true)
    setError('')

    try {
      const formDataToSend = new FormData()
      formDataToSend.append('customerId', formData.customerId)
      formDataToSend.append('propertyId', formData.propertyId)
      formDataToSend.append('serviceId', formData.serviceId)
      formDataToSend.append('statusId', formData.statusId)
      formDataToSend.append('notes', formData.notes)
      if (formData.scheduledFor) {
        formDataToSend.append('scheduledFor', formData.scheduledFor)
      }
      
      // Append files
      formData.files.forEach(file => {
        formDataToSend.append('files', file)
      })

      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        body: formDataToSend
      })

      if (response.ok) {
        onTaskUpdated()
        onClose()
      } else {
        const data = await response.json()
        setError(data.error || 'Error updating task')
      }
    } catch (error) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFormData(prev => ({
        ...prev,
        files: Array.from(e.target.files!)
      }))
    }
  }

  const removeFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index)
    }))
  }

  if (!task) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="kline-card" style={{ 
        width: '90%', 
        maxWidth: '600px', 
        padding: '2rem',
        position: 'relative',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: 'var(--kline-text-light)'
          }}
        >
          ×
        </button>

        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem', color: 'var(--kline-text)' }}>
          Edit Task
        </h2>

        {error && (
          <div style={{
            background: 'rgba(227, 6, 19, 0.1)',
            border: '1px solid var(--kline-red)',
            color: 'var(--kline-red)',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
              Customer *
            </label>
            <select 
              value={formData.customerId}
              onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
              className="kline-input"
              required
            >
              {customers.map(customer => (
                <option key={customer.id} value={customer.id}>
                  {customer.fullName} ({customer.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
              Property *
            </label>
            <select 
              value={formData.propertyId}
              onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
              className="kline-input"
              required
              disabled={customerProperties.length === 0}
            >
              {customerProperties.map(property => (
                <option key={property.id} value={property.id}>
                  {property.address}, {property.city}, {property.state}
                </option>
              ))}
            </select>
            {customerProperties.length === 0 && formData.customerId && (
              <div style={{ color: 'var(--kline-red)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                This customer has no properties.
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
                Service *
              </label>
              <select 
                value={formData.serviceId}
                onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                className="kline-input"
                required
              >
                {services.map(service => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
                Status *
              </label>
              <select 
                value={formData.statusId}
                onChange={(e) => setFormData({ ...formData, statusId: e.target.value })}
                className="kline-input"
                required
              >
                {statuses.map(status => (
                  <option key={status.id} value={status.id}>
                    {status.name} {status.notifyClient ? '(Notifies Customer)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
              Scheduled For
            </label>
            <input
              type="datetime-local"
              value={formData.scheduledFor}
              onChange={(e) => setFormData({ ...formData, scheduledFor: e.target.value })}
              className="kline-input"
            />
          </div>

          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="kline-input"
              placeholder="Add any notes about this task..."
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
              Attach Additional Images
            </label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              className="kline-input"
              style={{ padding: '0.5rem' }}
            />
            {formData.files.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--kline-text-light)', marginBottom: '0.5rem' }}>
                  New files to attach:
                </div>
                {formData.files.map((file, index) => (
                  <div key={index} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    padding: '0.5rem',
                    background: 'var(--kline-gray-light)',
                    borderRadius: '6px',
                    marginBottom: '0.25rem'
                  }}>
                    <span style={{ fontSize: '0.8rem' }}>{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      style={{
                        background: 'var(--kline-red)',
                        border: 'none',
                        color: 'white',
                        borderRadius: '4px',
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.7rem',
                        cursor: 'pointer'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            {task.media.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--kline-text-light)', marginBottom: '0.5rem' }}>
                  Current attachments:
                </div>
                {task.media.map(media => (
                  <div key={media.id} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    padding: '0.5rem',
                    background: 'var(--kline-gray-light)',
                    borderRadius: '6px',
                    marginBottom: '0.25rem'
                  }}>
                    <span style={{ fontSize: '0.8rem' }}>📷 Image</span>
                    <a 
                      href={media.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ 
                        color: 'var(--kline-blue)', 
                        fontSize: '0.7rem',
                        textDecoration: 'none'
                      }}
                    >
                      View
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '2px solid var(--kline-text-light)',
                color: 'var(--kline-text-light)',
                padding: '0.8rem 1.5rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.9rem'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="kline-btn-primary"
              style={{ padding: '0.8rem 1.5rem', fontSize: '0.9rem' }}
            >
              {loading ? 'Updating...' : 'Update Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Delete Confirmation Modal
function DeleteTaskModal({ task, onClose, onTaskDeleted }: { 
  task: Task | null, 
  onClose: () => void, 
  onTaskDeleted: (task: Task) => void 
}) {
  if (!task) return null

  const formatAddress = (task: Task) => {
    return `${task.property.address}, ${task.property.city}, ${task.property.state}`
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="kline-card" style={{ 
        width: '90%', 
        maxWidth: '500px', 
        padding: '2rem',
        position: 'relative'
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: 'var(--kline-text-light)'
          }}
        >
          ×
        </button>

        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--kline-text)' }}>
          Confirm Delete
        </h2>

        <p style={{ marginBottom: '1rem', color: 'var(--kline-text)', lineHeight: '1.5' }}>
          Are you sure you want to delete this task?
        </p>
        
        <div style={{ 
          background: 'var(--kline-gray-light)', 
          padding: '1rem', 
          borderRadius: '8px',
          marginBottom: '2rem'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
            {task.service.name} for {task.customer.fullName}
          </div>
          <div style={{ color: 'var(--kline-text-light)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            {formatAddress(task)}
          </div>
          <div style={{ color: 'var(--kline-text-light)', fontSize: '0.9rem' }}>
            Status: <span style={{ 
              background: task.status.color || '#6b7280',
              color: 'white',
              padding: '0.2rem 0.5rem',
              borderRadius: '8px',
              fontSize: '0.8rem'
            }}>
              {task.status.name}
            </span>
          </div>
        </div>

        <p style={{ color: 'var(--kline-red)', fontWeight: '600', marginBottom: '2rem' }}>
          ⚠️ This action cannot be undone.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '2px solid var(--kline-text-light)',
              color: 'var(--kline-text-light)',
              padding: '0.8rem 1.5rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem'
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onTaskDeleted(task)}
            style={{
              background: 'var(--kline-red)',
              border: 'none',
              color: 'white',
              padding: '0.8rem 1.5rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem',
              transition: 'all 0.3s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#c40510'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'var(--kline-red)'
            }}
          >
            Delete Task
          </button>
        </div>
      </div>
    </div>
  )
}