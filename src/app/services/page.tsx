'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Service {
  id: string
  name: string
  description: string | null
  clientMessage: string | null
  isSequential: boolean
  workflowGroup: string | null
  stepOrder: number | null
  createdAt: string
}

interface ServiceFormData {
  name: string
  description: string
  clientMessage: string
  isSequential: boolean
  workflowGroup: string
  stepOrder: string
}

function defaultForm(): ServiceFormData {
  return {
    name: '',
    description: '',
    clientMessage: '',
    isSequential: false,
    workflowGroup: '',
    stepOrder: '',
  }
}

function toFormData(service: Service): ServiceFormData {
  return {
    name: service.name,
    description: service.description || '',
    clientMessage: service.clientMessage || '',
    isSequential: service.isSequential,
    workflowGroup: service.workflowGroup || '',
    stepOrder: service.stepOrder ? String(service.stepOrder) : '',
  }
}

function buildPayload(formData: ServiceFormData) {
  return {
    name: formData.name.trim(),
    description: formData.description.trim() || null,
    clientMessage: formData.clientMessage.trim() || null,
    isSequential: formData.isSequential,
    workflowGroup: formData.isSequential ? formData.workflowGroup.trim() : null,
    stepOrder:
      formData.isSequential && formData.stepOrder.trim() !== ''
        ? Number(formData.stepOrder)
        : null,
  }
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [deletingService, setDeletingService] = useState<Service | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetchServices()
  }, [])

  const fetchServices = async () => {
    try {
      const response = await fetch('/api/services', { cache: 'no-store' })
      if (response.ok) {
        const servicesData = (await response.json()) as Service[]
        setServices(servicesData)
      } else {
        console.error('Error fetching services')
      }
    } catch (error) {
      console.error('Error fetching services:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    document.cookie = 'user-id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    window.location.href = '/auth/login'
  }

  const handleDeleteService = async (service: Service) => {
    try {
      const response = await fetch(`/api/services/${service.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchServices()
        setDeletingService(null)
      } else {
        alert('Error deleting service')
      }
    } catch {
      alert('Network error')
    }
  }

  const filteredServices = useMemo(() => {
    const query = filter.toLowerCase().trim()
    if (!query) return services

    return services.filter((service) => {
      return (
        service.name.toLowerCase().includes(query) ||
        (service.description || '').toLowerCase().includes(query) ||
        (service.clientMessage || '').toLowerCase().includes(query) ||
        (service.workflowGroup || '').toLowerCase().includes(query)
      )
    })
  }, [services, filter])

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
                Service <span className="kline-accent">Management</span>
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
                placeholder="Search services, flow or message..."
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
              + New Service
            </button>
          </div>
        </div>

        {loading ? (
          <div className="kline-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--kline-text-light)' }}>
            Loading services...
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.2rem' }}>
            {filteredServices.map((service) => (
              <div key={service.id} className="kline-card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.8rem' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--kline-text)', margin: 0 }}>{service.name}</h3>
                    <p style={{ color: 'var(--kline-text-light)', lineHeight: '1.45', marginTop: '0.55rem' }}>
                      {service.description || 'No description provided'}
                    </p>
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
                      onClick={() => setEditingService(service)}
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
                      onClick={() => setDeletingService(service)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: 'var(--kline-text-light)' }}>
                  {service.isSequential
                    ? `Sequential: ${service.workflowGroup || 'No group'} · Step ${service.stepOrder || '-'}`
                    : 'Independent service'}
                </div>

                {service.clientMessage ? (
                  <div style={{ marginTop: '0.65rem', fontSize: '0.82rem', color: 'var(--kline-text-light)', lineHeight: 1.4 }}>
                    Client message: {service.clientMessage}
                  </div>
                ) : null}

                <div style={{ color: 'var(--kline-text-light)', fontSize: '0.78rem', marginTop: '0.85rem' }}>
                  Created: {new Date(service.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}

            {filteredServices.length === 0 && (
              <div className="kline-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--kline-text-light)', gridColumn: '1 / -1' }}>
                {services.length === 0 ? 'No services found' : 'No services match your search'}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
          <StatCard label="Total" value={services.length} />
          <StatCard label="Sequential" value={services.filter((s) => s.isSequential).length} />
          <StatCard label="Independent" value={services.filter((s) => !s.isSequential).length} />
          <StatCard label="With Client Msg" value={services.filter((s) => (s.clientMessage || '').trim().length > 0).length} />
        </div>
      </main>

      {isCreateModalOpen && (
        <ServiceModal
          mode="create"
          onClose={() => setIsCreateModalOpen(false)}
          onSaved={async () => {
            await fetchServices()
            setIsCreateModalOpen(false)
          }}
        />
      )}

      {editingService && (
        <ServiceModal
          mode="edit"
          service={editingService}
          onClose={() => setEditingService(null)}
          onSaved={async () => {
            await fetchServices()
            setEditingService(null)
          }}
        />
      )}

      {deletingService && (
        <DeleteServiceModal service={deletingService} onClose={() => setDeletingService(null)} onServiceDeleted={handleDeleteService} />
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

function ServiceModal({
  mode,
  service,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit'
  service?: Service
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const isEdit = mode === 'edit'
  const [formData, setFormData] = useState<ServiceFormData>(service ? toFormData(service) : defaultForm())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (service) setFormData(toFormData(service))
  }, [service])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (formData.isSequential) {
      if (!formData.workflowGroup.trim()) {
        setError('Workflow group is required for sequential service')
        setLoading(false)
        return
      }

      const order = Number(formData.stepOrder)
      if (!Number.isInteger(order) || order < 1) {
        setError('Step order must be a positive integer')
        setLoading(false)
        return
      }
    }

    try {
      const response = await fetch(isEdit ? `/api/services/${service?.id}` : '/api/services', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(formData)),
      })

      if (response.ok) {
        await onSaved()
      } else {
        const data = (await response.json()) as { error?: string }
        setError(data.error || `Error ${isEdit ? 'updating' : 'creating'} service`)
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
      <div className="kline-card" style={{ width: '92%', maxWidth: '680px', padding: '1.6rem', position: 'relative' }}>
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
          {isEdit ? 'Edit Service' : 'Create New Service'}
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
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.35rem', fontWeight: '600' }}>Service Name *</label>
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
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.35rem', fontWeight: '600' }}>Description (internal)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="kline-input"
              rows={3}
              placeholder="Internal notes/description"
            />
          </div>

          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.35rem', fontWeight: '600' }}>Client Message (optional)</label>
            <textarea
              value={formData.clientMessage}
              onChange={(e) => setFormData({ ...formData, clientMessage: e.target.value })}
              className="kline-input"
              rows={4}
              placeholder="Message that client receives for this service step"
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
              This service is part of a sequential workflow
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
              {loading ? (isEdit ? 'Updating...' : 'Creating...') : isEdit ? 'Update Service' : 'Create Service'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteServiceModal({
  service,
  onClose,
  onServiceDeleted,
}: {
  service: Service | null
  onClose: () => void
  onServiceDeleted: (service: Service) => void
}) {
  if (!service) return null

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
          Are you sure you want to delete service <strong>&quot;{service.name}&quot;</strong>? This action cannot be undone.
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
            onClick={() => onServiceDeleted(service)}
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
            Delete Service
          </button>
        </div>
      </div>
    </div>
  )
}
