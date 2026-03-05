'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

interface TaskStatus {
  id: string
  name: string
  color: string | null
  notifyClient: boolean
  clientMessage: string | null
  isSequential: boolean
  workflowGroup: string | null
  stepOrder: number | null
  createdAt: string
}

interface StatusFormData {
  name: string
  color: string
  notifyClient: boolean
  clientMessage: string
  isSequential: boolean
  workflowGroup: string
  stepOrder: string
}

const defaultColors = [
  '#e30613',
  '#ffc600',
  '#1e3a5f',
  '#0a5c36',
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
  '#ef4444',
  '#10b981',
  '#6366f1',
]

function defaultForm(): StatusFormData {
  return {
    name: '',
    color: defaultColors[0],
    notifyClient: false,
    clientMessage: '',
    isSequential: false,
    workflowGroup: '',
    stepOrder: '',
  }
}

function toFormData(status: TaskStatus): StatusFormData {
  return {
    name: status.name,
    color: status.color || defaultColors[0],
    notifyClient: status.notifyClient,
    clientMessage: status.clientMessage || '',
    isSequential: status.isSequential,
    workflowGroup: status.workflowGroup || '',
    stepOrder: status.stepOrder ? String(status.stepOrder) : '',
  }
}

function buildPayload(formData: StatusFormData) {
  return {
    name: formData.name.trim(),
    color: formData.color.trim() || null,
    notifyClient: formData.notifyClient,
    clientMessage: formData.clientMessage.trim() || null,
    isSequential: formData.isSequential,
    workflowGroup: formData.isSequential ? formData.workflowGroup.trim() : null,
    stepOrder:
      formData.isSequential && formData.stepOrder.trim() !== ''
        ? Number(formData.stepOrder)
        : null,
  }
}

export default function StatusesPage() {
  const router = useRouter()
  const [statuses, setStatuses] = useState<TaskStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingStatus, setEditingStatus] = useState<TaskStatus | null>(null)
  const [deletingStatus, setDeletingStatus] = useState<TaskStatus | null>(null)

  const fetchStatuses = async () => {
    try {
      const response = await fetch('/api/statuses', { cache: 'no-store' })
      if (response.ok) {
        const statusesData = (await response.json()) as TaskStatus[]
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

  useEffect(() => {
    fetchStatuses()
  }, [])

  const filteredStatuses = useMemo(() => {
    const query = filter.toLowerCase().trim()
    if (!query) return statuses

    return statuses.filter((status) => {
      return (
        status.name.toLowerCase().includes(query) ||
        (status.workflowGroup || '').toLowerCase().includes(query) ||
        (status.clientMessage || '').toLowerCase().includes(query)
      )
    })
  }, [statuses, filter])

  const handleDeleteStatus = async (status: TaskStatus) => {
    try {
      const response = await fetch(`/api/statuses/${status.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchStatuses()
        setDeletingStatus(null)
      } else {
        alert('Error deleting status')
      }
    } catch {
      alert('Network error')
    }
  }

  const handleLogout = () => {
    document.cookie = 'user-id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    window.location.href = '/auth/login'
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--kline-gray-light)' }}>
      <header className="kline-header" style={{ padding: '1rem 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                onClick={() => router.back()}
                style={{
                  background: 'transparent',
                  border: '2px solid var(--kline-text-light)',
                  color: 'var(--kline-text-light)',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                }}
              >
                Back
              </button>
              <h1 style={{ fontSize: '1.8rem', fontWeight: '700', color: 'var(--kline-text)' }}>
                Task Status <span className="kline-accent">Management</span>
              </h1>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button
                onClick={() => router.push('/dashboard')}
                style={{
                  background: 'var(--kline-yellow)',
                  border: 'none',
                  color: 'var(--kline-text)',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                }}
              >
                Dashboard
              </button>
              <button onClick={handleLogout} className="kline-btn-primary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}>
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem' }}>
        <div className="kline-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search by name, flow or message..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="kline-input"
                style={{ paddingLeft: '2.5rem', width: '340px', maxWidth: '100%' }}
              />
              <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--kline-text-light)' }}>
                🔍
              </span>
            </div>

            <button className="kline-btn-primary" style={{ padding: '0.8rem 1.5rem', fontSize: '0.9rem' }} onClick={() => setIsCreateModalOpen(true)}>
              + New Status
            </button>
          </div>
        </div>

        {loading ? (
          <div className="kline-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--kline-text-light)' }}>
            Loading statuses...
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.2rem' }}>
            {filteredStatuses.map((status) => (
              <div key={status.id} className="kline-card" style={{ padding: '1.25rem', borderTop: `4px solid ${status.color || defaultColors[0]}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--kline-text)' }}>{status.name}</h3>
                    <div style={{ marginTop: '0.45rem', fontSize: '0.8rem', color: 'var(--kline-text-light)' }}>
                      {status.isSequential ? `Sequential: ${status.workflowGroup || 'No group'} · Step ${status.stepOrder || '-'}` : 'Independent status'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      style={{
                        background: 'var(--kline-yellow)',
                        border: 'none',
                        color: 'var(--kline-text)',
                        padding: '0.45rem 0.85rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.8rem',
                      }}
                      onClick={() => setEditingStatus(status)}
                    >
                      Edit
                    </button>
                    <button
                      style={{
                        padding: '0.45rem 0.85rem',
                        fontSize: '0.8rem',
                        background: 'transparent',
                        border: '2px solid var(--kline-red)',
                        color: 'var(--kline-red)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600',
                      }}
                      onClick={() => setDeletingStatus(status)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: status.notifyClient ? '#198754' : 'var(--kline-text-light)',
                    }}
                  />
                  <span style={{ color: status.notifyClient ? '#198754' : 'var(--kline-text-light)', fontSize: '0.82rem', fontWeight: '600' }}>
                    {status.notifyClient ? 'Client notification enabled' : 'No client notification'}
                  </span>
                </div>

                {status.clientMessage ? (
                  <div style={{ marginTop: '0.8rem', fontSize: '0.82rem', color: 'var(--kline-text-light)', lineHeight: 1.4 }}>
                    Message: {status.clientMessage}
                  </div>
                ) : null}

                <div style={{ marginTop: '0.9rem', color: 'var(--kline-text-light)', fontSize: '0.78rem' }}>
                  Created: {new Date(status.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}

            {filteredStatuses.length === 0 && (
              <div className="kline-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--kline-text-light)', gridColumn: '1 / -1' }}>
                {statuses.length === 0 ? 'No statuses found' : 'No statuses match your search'}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
          <StatCard label="Total" value={statuses.length} />
          <StatCard label="Sequential" value={statuses.filter((s) => s.isSequential).length} />
          <StatCard label="Independent" value={statuses.filter((s) => !s.isSequential).length} />
          <StatCard label="Notify Client" value={statuses.filter((s) => s.notifyClient).length} />
        </div>
      </main>

      {isCreateModalOpen && (
        <StatusModal
          mode="create"
          onClose={() => setIsCreateModalOpen(false)}
          onSaved={async () => {
            await fetchStatuses()
            setIsCreateModalOpen(false)
          }}
        />
      )}

      {editingStatus && (
        <StatusModal
          mode="edit"
          status={editingStatus}
          onClose={() => setEditingStatus(null)}
          onSaved={async () => {
            await fetchStatuses()
            setEditingStatus(null)
          }}
        />
      )}

      {deletingStatus && (
        <DeleteStatusModal status={deletingStatus} onClose={() => setDeletingStatus(null)} onStatusDeleted={handleDeleteStatus} />
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="kline-card" style={{ padding: '1rem', textAlign: 'center' }}>
      <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--kline-red)' }}>{value}</div>
      <div style={{ color: 'var(--kline-text-light)', fontSize: '0.82rem' }}>{label}</div>
    </div>
  )
}

function StatusModal({
  mode,
  status,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit'
  status?: TaskStatus
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [formData, setFormData] = useState<StatusFormData>(status ? toFormData(status) : defaultForm())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status) {
      setFormData(toFormData(status))
    }
  }, [status])

  const isEdit = mode === 'edit'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (formData.isSequential) {
      if (!formData.workflowGroup.trim()) {
        setLoading(false)
        setError('Workflow group is required for sequential status')
        return
      }

      const order = Number(formData.stepOrder)
      if (!Number.isInteger(order) || order < 1) {
        setLoading(false)
        setError('Step order must be a positive integer')
        return
      }
    }

    try {
      const response = await fetch(isEdit ? `/api/statuses/${status?.id}` : '/api/statuses', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(formData)),
      })

      if (response.ok) {
        await onSaved()
      } else {
        const data = (await response.json()) as { error?: string }
        setError(data.error || `Error ${isEdit ? 'updating' : 'creating'} status`)
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

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
        zIndex: 1000,
      }}
    >
      <div className="kline-card" style={{ width: '92%', maxWidth: '620px', padding: '1.6rem', position: 'relative' }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '0.8rem',
            right: '0.9rem',
            background: 'none',
            border: 'none',
            fontSize: '1.35rem',
            cursor: 'pointer',
            color: 'var(--kline-text-light)',
          }}
        >
          ×
        </button>

        <h2 style={{ fontSize: '1.4rem', fontWeight: '700', marginBottom: '1.1rem', color: 'var(--kline-text)' }}>
          {isEdit ? 'Edit Status' : 'Create New Status'}
        </h2>

        {error && (
          <div
            style={{
              background: 'rgba(227, 6, 19, 0.1)',
              border: '1px solid var(--kline-red)',
              color: 'var(--kline-red)',
              padding: '0.85rem',
              borderRadius: '8px',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.35rem', fontWeight: '600' }}>Status Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="kline-input"
              placeholder="e.g., Permit In Progress"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.35rem', fontWeight: '600' }}>Color</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem', marginBottom: '0.5rem' }}>
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
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--kline-text)', fontWeight: '600', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.notifyClient}
                onChange={(e) => setFormData({ ...formData, notifyClient: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              Notify client when task reaches this status
            </label>
          </div>

          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.35rem', fontWeight: '600' }}>Client Message (optional)</label>
            <textarea
              value={formData.clientMessage}
              onChange={(e) => setFormData({ ...formData, clientMessage: e.target.value })}
              className="kline-input"
              rows={4}
              placeholder="Custom notification message sent to client"
            />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--kline-text)', fontWeight: '600', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.isSequential}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    isSequential: e.target.checked,
                    workflowGroup: e.target.checked ? formData.workflowGroup : '',
                    stepOrder: e.target.checked ? formData.stepOrder : '',
                  })
                }
                style={{ width: '18px', height: '18px' }}
              />
              This status is part of a sequential workflow
            </label>
          </div>

          {formData.isSequential && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '0.8rem' }}>
              <div>
                <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.35rem', fontWeight: '600' }}>Workflow Group *</label>
                <input
                  type="text"
                  value={formData.workflowGroup}
                  onChange={(e) => setFormData({ ...formData, workflowGroup: e.target.value })}
                  className="kline-input"
                  placeholder="e.g., permit_flow"
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.35rem', fontWeight: '600' }}>Step Order *</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={formData.stepOrder}
                  onChange={(e) => setFormData({ ...formData, stepOrder: e.target.value })}
                  className="kline-input"
                  placeholder="1"
                  required
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.6rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '2px solid var(--kline-text-light)',
                color: 'var(--kline-text-light)',
                padding: '0.72rem 1.2rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.9rem',
              }}
            >
              Cancel
            </button>
            <button type="submit" disabled={loading} className="kline-btn-primary" style={{ padding: '0.72rem 1.2rem', fontSize: '0.9rem' }}>
              {loading ? (isEdit ? 'Updating...' : 'Creating...') : isEdit ? 'Update Status' : 'Create Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteStatusModal({
  status,
  onClose,
  onStatusDeleted,
}: {
  status: TaskStatus | null
  onClose: () => void
  onStatusDeleted: (status: TaskStatus) => void
}) {
  if (!status) return null

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
        zIndex: 1000,
      }}
    >
      <div className="kline-card" style={{ width: '90%', maxWidth: '500px', padding: '2rem', position: 'relative' }}>
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
            color: 'var(--kline-text-light)',
          }}
        >
          ×
        </button>

        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--kline-text)' }}>Confirm Delete</h2>

        <p style={{ marginBottom: '2rem', color: 'var(--kline-text)', lineHeight: '1.5' }}>
          Are you sure you want to delete status <strong>&quot;{status.name}&quot;</strong>? This action cannot be undone.
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
              fontSize: '0.9rem',
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
            }}
          >
            Delete Status
          </button>
        </div>
      </div>
    </div>
  )
}
