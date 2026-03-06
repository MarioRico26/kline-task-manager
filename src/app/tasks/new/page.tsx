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
  clientMessage?: string | null
  isSequential?: boolean
  workflowGroup?: string | null
  stepOrder?: number | null
}

interface StatusItem {
  id: string
  name: string
  color?: string | null
  notifyClient?: boolean
}

interface TaskHistoryItem {
  id: string
  createdAt: string
  customer: { id: string }
  property: { id: string }
  service: {
    id: string
    isSequential?: boolean
    workflowGroup?: string | null
    stepOrder?: number | null
  }
}

function normalizeWorkflowKey(value?: string | null) {
  return (value || '').trim().toLowerCase()
}

function getNextWorkflowStep(
  definedSteps: number[],
  historySteps: Array<{ step: number; createdAt: string }>
): number | null {
  if (definedSteps.length === 0) return null

  const sortedHistory = [...historySteps].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  const startStep = definedSteps[0]
  let currentStep = 0

  for (const item of sortedHistory) {
    if (item.step === startStep) {
      currentStep = startStep
      continue
    }

    const currentIndex = definedSteps.indexOf(currentStep)
    if (currentIndex >= 0 && definedSteps[currentIndex + 1] === item.step) {
      currentStep = item.step
    }
  }

  if (currentStep === 0) return startStep

  const currentIndex = definedSteps.indexOf(currentStep)
  const nextStep = definedSteps[currentIndex + 1]
  return nextStep ?? startStep
}

type WorkflowDefinition = {
  label: string
  services: ServiceItem[]
}

export default function NewTaskPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<CustomerItem[]>([])
  const [properties, setProperties] = useState<PropertyItem[]>([])
  const [services, setServices] = useState<ServiceItem[]>([])
  const [statuses, setStatuses] = useState<StatusItem[]>([])
  const [tasksHistory, setTasksHistory] = useState<TaskHistoryItem[]>([])

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

        const [cRes, pRes, sRes, stRes, tRes] = await Promise.all([
          fetch('/api/customers', { cache: 'no-store' }),
          fetch('/api/properties', { cache: 'no-store' }),
          fetch('/api/services', { cache: 'no-store' }),
          fetch('/api/statuses', { cache: 'no-store' }),
          fetch('/api/tasks', { cache: 'no-store' }),
        ])

        if (!cRes.ok || !pRes.ok || !sRes.ok || !stRes.ok || !tRes.ok) {
          const msg = `Load failed (customers:${cRes.status}, properties:${pRes.status}, services:${sRes.status}, statuses:${stRes.status}, tasks:${tRes.status})`
          throw new Error(msg)
        }

        const [cData, pData, sData, stData, tData] = await Promise.all([
          cRes.json(),
          pRes.json(),
          sRes.json(),
          stRes.json(),
          tRes.json(),
        ])

        setCustomers(cData)
        setProperties(pData)
        setServices(sData)
        setStatuses(stData)
        setTasksHistory(tData)
      } catch (err: unknown) {
        console.error('❌ New Task load error:', err)
        setErrorMsg(err instanceof Error ? err.message : 'Failed to load form data')
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

  const workflowHistoryByKey = useMemo(() => {
    const history = new Map<string, Array<{ step: number; createdAt: string }>>()
    if (!customerId || !propertyId) return history

    tasksHistory.forEach((task) => {
      if (task.customer?.id !== customerId) return
      if (task.property?.id !== propertyId) return
      if (!task.service?.isSequential || !task.service?.stepOrder) return

      const groupKey = normalizeWorkflowKey(task.service.workflowGroup)
      if (!groupKey) return

      const list = history.get(groupKey) || []
      list.push({ step: task.service.stepOrder, createdAt: task.createdAt })
      history.set(groupKey, list)
    })

    return history
  }, [tasksHistory, customerId, propertyId])

  const workflowDefinitions = useMemo(() => {
    const grouped = new Map<string, WorkflowDefinition>()

    services.forEach((service) => {
      if (!service.isSequential || !service.stepOrder) return
      const groupKey = normalizeWorkflowKey(service.workflowGroup)
      if (!groupKey) return

      const existing = grouped.get(groupKey)
      if (existing) {
        existing.services.push(service)
      } else {
        grouped.set(groupKey, {
          label: (service.workflowGroup || '').trim() || groupKey,
          services: [service],
        })
      }
    })

    grouped.forEach((definition) => {
      definition.services.sort((a, b) => (a.stepOrder || 0) - (b.stepOrder || 0))
    })

    return grouped
  }, [services])

  const nextStepByWorkflow = useMemo(() => {
    const nextSteps = new Map<string, number | null>()

    workflowDefinitions.forEach((definition, workflowKey) => {
      const definedSteps = definition.services
        .map((service) => service.stepOrder || 0)
        .filter((step) => step > 0)

      const historySteps = workflowHistoryByKey.get(workflowKey) || []
      nextSteps.set(workflowKey, getNextWorkflowStep(definedSteps, historySteps))
    })

    return nextSteps
  }, [workflowDefinitions, workflowHistoryByKey])

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      if (!service.isSequential) return true
      if (!service.stepOrder) return false
      if (!propertyId) return false

      const groupKey = normalizeWorkflowKey(service.workflowGroup)
      if (!groupKey) return false

      const nextStep = nextStepByWorkflow.get(groupKey)
      if (nextStep === null || nextStep === undefined) return false
      return service.stepOrder === nextStep
    })
  }, [services, propertyId, nextStepByWorkflow])

  const workflowNextSteps = useMemo(() => {
    if (!customerId || !propertyId) return []

    return Array.from(workflowDefinitions.entries())
      .map(([groupKey, definition]) => {
        const nextStep = nextStepByWorkflow.get(groupKey) || null
        const nextService =
          nextStep === null
            ? null
            : definition.services.find((service) => service.stepOrder === nextStep)

        return {
          group: definition.label || groupKey,
          expectedStep: nextStep,
          nextServiceName: nextService?.name || null,
          isComplete: nextStep === null,
        }
      })
      .sort((a, b) => a.group.localeCompare(b.group))
  }, [customerId, propertyId, workflowDefinitions, nextStepByWorkflow])

  useEffect(() => {
    if (propertyId && !filteredProperties.find((p) => p.id === propertyId)) {
      setPropertyId('')
    }
  }, [filteredProperties, propertyId])

  useEffect(() => {
    if (!customerId) return
    if (filteredProperties.length === 1) {
      setPropertyId(filteredProperties[0].id)
    }
  }, [customerId, filteredProperties])

  useEffect(() => {
    if (serviceId && !filteredServices.find((service) => service.id === serviceId)) {
      setServiceId('')
    }
  }, [filteredServices, serviceId])

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
        let errorMessage = `Create failed (${res.status})`
        try {
          const data = (await res.json()) as { error?: string }
          if (data?.error) {
            errorMessage = data.error
          }
        } catch {
          const txt = await res.text().catch(() => '')
          if (txt) errorMessage = `Create failed (${res.status}): ${txt}`
        }
        throw new Error(errorMessage)
      }

      router.push('/tasks')
    } catch (err: unknown) {
      console.error('❌ Task create error:', err)
      setSubmitError(err instanceof Error ? err.message : 'Failed to create task')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--kline-gray-light)',
        fontFamily: 'var(--kline-font-sans)',
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
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 20px' }}>
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

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '28px 20px 60px' }}>
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
                      {p.address}, {p.city}, {p.state}
                    </option>
                  ))}
                </select>
                {customerId && filteredProperties.length === 1 && (
                  <div style={{ marginTop: 6, color: 'var(--kline-text-light)', fontSize: '0.8rem' }}>
                    Property auto-selected for this customer.
                  </div>
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '8px', fontWeight: 700 }}>Service</label>
                <select
                  className="kline-input"
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  required
                >
                  <option value="">Select service</option>
                  {filteredServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.isSequential && s.workflowGroup && s.stepOrder ? ` (${s.workflowGroup} #${s.stepOrder})` : ''}
                    </option>
                  ))}
                </select>
                <div style={{ marginTop: 6, color: 'var(--kline-text-light)', fontSize: '0.8rem' }}>
                  Sequential services are auto-filtered by customer + property.
                </div>
                {customerId && propertyId && workflowNextSteps.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {workflowNextSteps.map((item) => (
                      <span
                        key={item.group}
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: item.isComplete ? '#1f7a43' : 'var(--kline-text-light)',
                          background: item.isComplete ? 'rgba(25, 135, 84, 0.12)' : 'var(--kline-gray-light)',
                          border: `1px solid ${item.isComplete ? 'rgba(25, 135, 84, 0.25)' : 'var(--kline-gray)'}`,
                          borderRadius: 999,
                          padding: '6px 10px',
                        }}
                      >
                        {item.isComplete
                          ? `${item.group}: completed`
                          : `${item.group}: next ${item.nextServiceName || `step ${item.expectedStep ?? ''}`}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '8px', fontWeight: 700 }}>Status (optional)</label>
                <select
                  className="kline-input"
                  value={statusId}
                  onChange={(e) => setStatusId(e.target.value)}
                >
                  <option value="">Default (In Progress)</option>
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
