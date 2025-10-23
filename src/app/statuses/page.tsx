'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface TaskStatus {
  id: string
  name: string
  color: string | null
  notifyClient: boolean
  createdAt: string
}

export default function StatusesPage() {
  const [statuses, setStatuses] = useState<TaskStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingStatus, setEditingStatus] = useState<TaskStatus | null>(null)
  const [deletingStatus, setDeletingStatus] = useState<TaskStatus | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetchStatuses()
  }, [])

  const fetchStatuses = async () => {
    try {
      const response = await fetch('/api/statuses')
      if (response.ok) {
        const statusesData = await response.json()
        setStatuses(statusesData)
      } else {
        console.error('Error fetching statuses')
      }
    } catch (error) {
      console.error('Error fetching statuses:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    document.cookie = 'user-id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    router.push('/auth/login')
  }

  const handleBack = () => {
    router.back()
  }

  const handleDashboard = () => {
    router.push('/dashboard')
  }

  const handleDeleteStatus = async (status: TaskStatus) => {
    try {
      const response = await fetch(`/api/statuses/${status.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchStatuses()
        setDeletingStatus(null)
      } else {
        alert('Error deleting status')
      }
    } catch (error) {
      alert('Network error')
    }
  }

  const filteredStatuses = statuses.filter(status => 
    status.name.toLowerCase().includes(filter.toLowerCase())
  )

  const defaultColors = [
    '#e30613', // Kline Red
    '#ffc600', // Kline Yellow
    '#1e3a5f', // Kline Blue
    '#0a5c36', // Kline Green
    '#8b5cf6', // Purple
    '#06b6d4', // Cyan
    '#f97316', // Orange
    '#ef4444', // Red
    '#10b981', // Emerald
    '#6366f1'  // Indigo
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--kline-gray-light)' }}>
      {/* Header */}
      <header className="kline-header" style={{ padding: '1rem 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}>
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
                Task Status <span className="kline-accent">Management</span>
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
      <main style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem' }}>
        {/* Action Bar */}
        <div className="kline-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Search */}
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search statuses..."
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
            </div>

            {/* Add Status Button */}
            <button 
              className="kline-btn-primary"
              style={{ padding: '0.8rem 1.5rem', fontSize: '0.9rem' }}
              onClick={() => setIsCreateModalOpen(true)}
            >
              + New Status
            </button>
          </div>
        </div>

        {/* Statuses Grid */}
        {loading ? (
          <div className="kline-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--kline-text-light)' }}>
            Loading statuses...
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {filteredStatuses.map((status) => (
              <div key={status.id} className="kline-card" style={{ padding: '1.5rem', position: 'relative' }}>
                {/* Color Indicator */}
                <div 
                  style={{ 
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: status.color || defaultColors[0],
                    borderTopLeftRadius: '12px',
                    borderTopRightRadius: '12px'
                  }}
                />
                
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '1.3rem', fontWeight: '700', color: 'var(--kline-text)', marginBottom: '0.5rem' }}>
                        {status.name}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <div 
                          style={{ 
                            width: '16px', 
                            height: '16px', 
                            borderRadius: '50%', 
                            background: status.color || defaultColors[0],
                            border: '2px solid white',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                          }} 
                        />
                        <span style={{ color: 'var(--kline-text-light)', fontSize: '0.9rem' }}>
                          {status.color || 'Default color'}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        style={{ 
                          background: 'var(--kline-yellow)',
                          border: 'none',
                          color: 'var(--kline-text)',
                          padding: '0.5rem 1rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '0.8rem',
                          transition: 'all 0.3s ease'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = 'var(--kline-yellow-light)'
                          e.currentTarget.style.transform = 'translateY(-1px)'
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'var(--kline-yellow)'
                          e.currentTarget.style.transform = 'translateY(0)'
                        }}
                        onClick={() => setEditingStatus(status)}
                      >
                        Edit
                      </button>
                      <button 
                        style={{ 
                          padding: '0.5rem 1rem', 
                          fontSize: '0.8rem',
                          background: 'transparent',
                          border: '2px solid var(--kline-red)',
                          color: 'var(--kline-red)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '600',
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
                        onClick={() => setDeletingStatus(status)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <div style={{ 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      background: status.notifyClient ? 'var(--kline-green)' : 'var(--kline-text-light)'
                    }} />
                    <span style={{ 
                      color: status.notifyClient ? 'var(--kline-green)' : 'var(--kline-text-light)', 
                      fontSize: '0.8rem',
                      fontWeight: '600'
                    }}>
                      {status.notifyClient ? 'Notifies client' : 'No client notification'}
                    </span>
                  </div>
                  
                  <div style={{ color: 'var(--kline-text-light)', fontSize: '0.8rem' }}>
                    Created: {new Date(status.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}

            {filteredStatuses.length === 0 && (
              <div className="kline-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--kline-text-light)', gridColumn: '1 / -1' }}>
                {statuses.length === 0 ? 'No statuses found' : 'No statuses match your search'}
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '2rem' }}>
          <div className="kline-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--kline-red)' }}>
              {statuses.length}
            </div>
            <div style={{ color: 'var(--kline-text-light)', fontSize: '0.9rem' }}>Total Statuses</div>
          </div>
          <div className="kline-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--kline-red)' }}>
              {statuses.filter(s => s.notifyClient).length}
            </div>
            <div style={{ color: 'var(--kline-text-light)', fontSize: '0.9rem' }}>Notify Client</div>
          </div>
          <div className="kline-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--kline-red)' }}>
              {statuses.filter(s => s.color).length}
            </div>
            <div style={{ color: 'var(--kline-text-light)', fontSize: '0.9rem' }}>Custom Colors</div>
          </div>
        </div>
      </main>

      {/* Create Status Modal */}
      <CreateStatusModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onStatusCreated={fetchStatuses}
        defaultColors={defaultColors}
      />

      {/* Edit Status Modal */}
      <EditStatusModal
        status={editingStatus}
        onClose={() => setEditingStatus(null)}
        onStatusUpdated={fetchStatuses}
        defaultColors={defaultColors}
      />

      {/* Delete Confirmation Modal */}
      <DeleteStatusModal
        status={deletingStatus}
        onClose={() => setDeletingStatus(null)}
        onStatusDeleted={handleDeleteStatus}
      />
    </div>
  )
}

// Create Status Modal Component
function CreateStatusModal({ isOpen, onClose, onStatusCreated, defaultColors }: { 
  isOpen: boolean, 
  onClose: () => void, 
  onStatusCreated: () => void,
  defaultColors: string[]
}) {
  const [formData, setFormData] = useState({
    name: '',
    color: defaultColors[0],
    notifyClient: false
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        onStatusCreated()
        onClose()
        setFormData({ name: '', color: defaultColors[0], notifyClient: false })
      } else {
        const data = await response.json()
        setError(data.error || 'Error creating status')
      }
    } catch (error) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

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

        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem', color: 'var(--kline-text)' }}>
          Create New Status
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
              Status Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="kline-input"
              placeholder="e.g., In Progress, Completed, On Hold"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
              Color
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
              {defaultColors.map((color, index) => (
                <button
                  key={index}
                  type="button"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    background: color,
                    border: formData.color === color ? '3px solid var(--kline-text)' : '2px solid var(--kline-gray)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => setFormData({ ...formData, color })}
                />
              ))}
            </div>
            <input
              type="text"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="kline-input"
              placeholder="#000000"
              style={{ fontFamily: 'monospace' }}
            />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--kline-text)', fontWeight: '600', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.notifyClient}
                onChange={(e) => setFormData({ ...formData, notifyClient: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              Notify client when task reaches this status
            </label>
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
              {loading ? 'Creating...' : 'Create Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Edit Status Modal Component
function EditStatusModal({ status, onClose, onStatusUpdated, defaultColors }: { 
  status: TaskStatus | null, 
  onClose: () => void, 
  onStatusUpdated: () => void,
  defaultColors: string[]
}) {
  const [formData, setFormData] = useState({
    name: '',
    color: defaultColors[0],
    notifyClient: false
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status) {
      setFormData({
        name: status.name,
        color: status.color || defaultColors[0],
        notifyClient: status.notifyClient
      })
    }
  }, [status, defaultColors])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!status) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/statuses/${status.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        onStatusUpdated()
        onClose()
      } else {
        const data = await response.json()
        setError(data.error || 'Error updating status')
      }
    } catch (error) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (!status) return null

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

        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem', color: 'var(--kline-text)' }}>
          Edit Status
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
              Status Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="kline-input"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
              Color
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
              {defaultColors.map((color, index) => (
                <button
                  key={index}
                  type="button"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    background: color,
                    border: formData.color === color ? '3px solid var(--kline-text)' : '2px solid var(--kline-gray)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => setFormData({ ...formData, color })}
                />
              ))}
            </div>
            <input
              type="text"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="kline-input"
              placeholder="#000000"
              style={{ fontFamily: 'monospace' }}
            />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--kline-text)', fontWeight: '600', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.notifyClient}
                onChange={(e) => setFormData({ ...formData, notifyClient: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              Notify client when task reaches this status
            </label>
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
              {loading ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Delete Confirmation Modal
function DeleteStatusModal({ status, onClose, onStatusDeleted }: { 
  status: TaskStatus | null, 
  onClose: () => void, 
  onStatusDeleted: (status: TaskStatus) => void 
}) {
  if (!status) return null

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

        <p style={{ marginBottom: '2rem', color: 'var(--kline-text)', lineHeight: '1.5' }}>
          Are you sure you want to delete status <strong>"{status.name}"</strong>? This action cannot be undone.
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
            onClick={() => onStatusDeleted(status)}
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
            Delete Status
          </button>
        </div>
      </div>
    </div>
  )
}