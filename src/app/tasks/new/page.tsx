'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

interface CustomerItem {
  id: string
  fullName: string
  email: string | null
  phone: string | null
}

interface PropertyItem {
  id: string
  address: string
  city: string
  state: string
  zip: string
  customerId: string
  customer?: {
    fullName: string
  }
}

interface ServiceItem {
  id: string
  name: string
  description?: string | null
}

interface StatusItem {
  id: string
  name: string
  color?: string | null
  notifyClient?: boolean
}

export default function NewTaskPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<CustomerItem[]>([])
  const [properties, setProperties] = useState<PropertyItem[]>([])
  const [services, setServices] = useState<ServiceItem[]>([])
  const [statuses, setStatuses] = useState<StatusItem[]>([])

  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [customerId, setCustomerId] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [statusId, setStatusId] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<FileList | null>(null)

  useEffect(() => {
    async function loadFormData() {
      try {
        setLoading(true)
        setErrorMsg(null)

        const [cRes, pRes, sRes, stRes] = await Promise.all([
          fetch('/api/customers', { cache: 'no-store' }),
          fetch('/api/properties', { cache: 'no-store' }),
          fetch('/api/services', { cache: 'no-store' }),
          fetch('/api/statuses', { cache: 'no-store' }),
        ])

        if (!cRes.ok || !pRes.ok || !sRes.ok || !stRes.ok) {
          const msg = `Load failed (customers:${cRes.status}, properties:${pRes.status}, services:${sRes.status}, statuses:${stRes.status})`
          throw new Error(msg)
        }

        const [cData, pData, sData, stData] = await Promise.all([
          cRes.json(),
          pRes.json(),
          sRes.json(),
          stRes.json(),
        ])

        setCustomers(cData)
        setProperties(pData)
        setServices(sData)
        setStatuses(stData)
      } catch (err: any) {
        console.error('❌ New Task load error:', err)
        setErrorMsg(err?.message || 'Failed to load form data')
      } finally {
        setLoading(false)
      }
    }

    loadFormData()
  }, [])

  const filteredProperties = useMemo(() => {
    if (!customerId) return []
    return properties.filter((p) => p.customerId === customerId)
  }, [properties, customerId])

  useEffect(() => {
    if (propertyId && !filteredProperties.find((p) => p.id === propertyId)) {
      setPropertyId('')
    }
  }, [filteredProperties, propertyId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    if (!customerId || !propertyId || !serviceId) {
      setSubmitError('Customer, property, and service are required')
      return
    }

    try {
      setSubmitting(true)
      const formData = new FormData()
      formData.set('customerId', customerId)
      formData.set('propertyId', propertyId)
      formData.set('serviceId', serviceId)
      if (statusId) formData.set('statusId', statusId)
      if (notes) formData.set('notes', notes)
      if (scheduledFor) formData.set('scheduledFor', scheduledFor)
      if (files && files.length > 0) {
        Array.from(files).forEach((file) => formData.append('files', file))
      }

      const res = await fetch('/api/tasks', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`Create failed: ${res.status}. ${txt}`)
      }

      router.push('/tasks')
    } catch (err: any) {
      console.error('❌ Task create error:', err)
      setSubmitError(err?.message || 'Failed to create task')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--kline-gray-light)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Header */}
      <header
        style={{
          background: '#fff',
          borderBottom: '1px solid var(--kline-gray)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '80px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  background: 'var(--kline-red)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(227, 6, 19, 0.25)',
                }}
              >
                <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1.2rem' }}>K</span>
              </div>
              <div>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--kline-text)' }}>
                  KLINE <span style={{ color: 'var(--kline-red)' }}>TASKS</span>
                </h1>
                <p style={{ margin: '2px 0 0', color: 'var(--kline-text-light)', fontSize: '0.9rem' }}>
                  New Task
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                onClick={() => router.push('/tasks')}
                style={{
                  padding: '10px 14px',
                  background: 'transparent',
                  color: 'var(--kline-text-light)',
                  fontWeight: 700,
                  borderRadius: '10px',
                  border: '2px solid var(--kline-gray)',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                Back to Tasks
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                style={{
                  padding: '10px 14px',
                  background: 'transparent',
                  color: 'var(--kline-text-light)',
                  fontWeight: 700,
                  borderRadius: '10px',
                  border: '2px solid var(--kline-gray)',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                Dashboard
              </button>
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '28px 20px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: 'var(--kline-text)' }}>Create Task</h2>
            <p style={{ margin: '6px 0 0', color: 'var(--kline-text-light)', fontSize: '1rem' }}>
              Fill out the details below
            </p>
          </div>
        </div>

        {loading && (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <div
              style={{
                width: 40,
                height: 40,
                border: '3px solid var(--kline-gray)',
                borderTop: '3px solid var(--kline-red)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 14px',
              }}
            />
            <div style={{ color: 'var(--kline-text-light)', fontWeight: 600 }}>Loading form…</div>
          </div>
        )}

        {!loading && errorMsg && (
          <div className="kline-card" style={{ padding: 18, marginTop: 20, borderLeft: '4px solid #dc3545' }}>
            <div style={{ fontWeight: 800, color: 'var(--kline-text)' }}>Could not load form data</div>
            <div style={{ marginTop: 6, color: 'var(--kline-text-light)' }}>{errorMsg}</div>
          </div>
        )}

        {!loading && !errorMsg && (
          <form onSubmit={handleSubmit} className="kline-card" style={{ padding: 24, marginTop: 22 }}>
            {submitError && (
              <div style={{
                background: 'rgba(227, 6, 19, 0.1)',
                border: '1px solid var(--kline-red)',
                color: 'var(--kline-red)',
                padding: '12px 14px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontWeight: 700,
              }}>
                {submitError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              <div>
                <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '8px', fontWeight: 700 }}>Customer</label>
                <select
                  className="kline-input"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  required
                >
                  <option value="">Select customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName}{c.email ? ` (${c.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '8px', fontWeight: 700 }}>Property</label>
                <select
                  className="kline-input"
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  required
                  disabled={!customerId || filteredProperties.length === 0}
                >
                  <option value="">
                    {customerId ? (filteredProperties.length ? 'Select property' : 'No properties for this customer') : 'Select customer first'}
                  </option>
                  {filteredProperties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.address}, {p.city}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '8px', fontWeight: 700 }}>Service</label>
                <select
                  className="kline-input"
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  required
                >
                  <option value="">Select service</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '8px', fontWeight: 700 }}>Status (optional)</label>
                <select
                  className="kline-input"
                  value={statusId}
                  onChange={(e) => setStatusId(e.target.value)}
                >
                  <option value="">Default (Completed)</option>
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '8px', fontWeight: 700 }}>Scheduled For</label>
                <input
                  type="datetime-local"
                  className="kline-input"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '8px', fontWeight: 700 }}>Attachments</label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="kline-input"
                  onChange={(e) => setFiles(e.target.files)}
                />
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '8px', fontWeight: 700 }}>Notes</label>
              <textarea
                className="kline-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Add notes for this task"
              />
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '12px 18px',
                  background: 'var(--kline-red)',
                  color: '#fff',
                  fontWeight: 800,
                  borderRadius: '10px',
                  border: 'none',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'Creating…' : 'Create Task'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/tasks')}
                style={{
                  padding: '12px 18px',
                  background: 'transparent',
                  color: 'var(--kline-text)',
                  fontWeight: 700,
                  borderRadius: '10px',
                  border: '2px solid var(--kline-gray)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>

            {(customers.length === 0 || services.length === 0) && (
              <div style={{ marginTop: 18, color: 'var(--kline-text-light)', fontSize: '0.9rem' }}>
                Tip: You need at least one customer, property, and service to create a task.
              </div>
            )}
          </form>
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
