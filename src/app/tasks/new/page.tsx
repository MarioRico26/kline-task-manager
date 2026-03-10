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
  status?: {
    name: string
  }
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

function isCompletedStatusName(statusName?: string | null) {
  return (statusName || '').trim().toLowerCase() === 'completed'
}

function getNextWorkflowStep(
  definedSteps: number[],
  historySteps: Array<{ step: number; createdAt: string; isCompleted: boolean }>
): number | null {
  if (definedSteps.length === 0) return null

  const orderedHistory = [...historySteps].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  let nextIndex = 0
  orderedHistory.forEach((item) => {
    const expectedStep = definedSteps[nextIndex]
    if (item.step !== expectedStep) return
    if (!item.isCompleted) return
    nextIndex = (nextIndex + 1) % definedSteps.length
  })

  return definedSteps[nextIndex] ?? null
}

type WorkflowDefinition = {
  label: string
  services: ServiceItem[]
}

function getCustomerDisplay(customer: CustomerItem) {
  return `${customer.fullName}${customer.email ? ` (${customer.email})` : ''}`
}

function getPropertyDisplay(property: PropertyItem, customerName?: string) {
  const base = `${property.address}, ${property.city}, ${property.state} ${property.zip}`
  return customerName ? `${base} • ${customerName}` : base
}

const MAX_UPLOAD_TOTAL_BYTES = 24 * 1024 * 1024
const MAX_UPLOAD_FILE_BYTES = 3.5 * 1024 * 1024
const TARGET_COMPRESSED_FILE_BYTES = 2.2 * 1024 * 1024
const MAX_IMAGE_DIMENSION = 1920

function formatBytes(value: number) {
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`
  if (value >= 1024) return `${Math.round(value / 1024)} KB`
  return `${value} B`
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
          return
        }
        reject(new Error('Unable to process image'))
      },
      'image/jpeg',
      quality
    )
  })
}

async function compressImageForUpload(file: File) {
  if (!file.type.startsWith('image/')) return file
  if (typeof createImageBitmap !== 'function') return file
  if (file.size <= TARGET_COMPRESSED_FILE_BYTES) return file

  const image = await createImageBitmap(file)
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    image.close()
    return file
  }

  context.drawImage(image, 0, 0, width, height)
  image.close()

  let quality = 0.84
  let blob = await canvasToBlob(canvas, quality)
  while (blob.size > TARGET_COMPRESSED_FILE_BYTES && quality > 0.45) {
    quality -= 0.08
    blob = await canvasToBlob(canvas, quality)
  }

  if (blob.size >= file.size) return file

  const normalizedName = file.name.replace(/\.[^.]+$/, '')
  return new File([blob], `${normalizedName}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })
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
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [customerId, setCustomerId] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [statusId, setStatusId] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<FileList | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [propertySearch, setPropertySearch] = useState('')
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false)
  const [showPropertySuggestions, setShowPropertySuggestions] = useState(false)

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

  const customerById = useMemo(() => {
    return new Map(customers.map((customer) => [customer.id, customer]))
  }, [customers])

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase()
    if (!query) return customers

    return customers.filter((customer) => {
      const fullName = customer.fullName.toLowerCase()
      const email = (customer.email || '').toLowerCase()
      const phone = (customer.phone || '').toLowerCase()
      return fullName.includes(query) || email.includes(query) || phone.includes(query)
    })
  }, [customerSearch, customers])

  const filteredProperties = useMemo(() => {
    const query = propertySearch.trim().toLowerCase()

    return properties.filter((property) => {
      if (customerId && property.customerId !== customerId) return false

      if (!query) return true

      const relatedCustomer = customerById.get(property.customerId)
      const haystack = [
        property.address,
        property.city,
        property.state,
        property.zip,
        relatedCustomer?.fullName || '',
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [properties, customerId, propertySearch, customerById])

  const customerScopedProperties = useMemo(() => {
    if (!customerId) return []
    return properties.filter((property) => property.customerId === customerId)
  }, [customerId, properties])

  const availableProperties = useMemo(() => {
    return customerId ? customerScopedProperties : properties
  }, [customerId, customerScopedProperties, properties])

  const workflowHistoryByKey = useMemo(() => {
    const history = new Map<string, Array<{ step: number; createdAt: string; isCompleted: boolean }>>()
    if (!customerId || !propertyId) return history

    tasksHistory.forEach((task) => {
      if (task.customer?.id !== customerId) return
      if (task.property?.id !== propertyId) return
      if (!task.service?.isSequential || !task.service?.stepOrder) return

      const groupKey = normalizeWorkflowKey(task.service.workflowGroup)
      if (!groupKey) return

      const list = history.get(groupKey) || []
      list.push({
        step: task.service.stepOrder,
        createdAt: task.createdAt,
        isCompleted: isCompletedStatusName(task.status?.name),
      })
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

  const selectedService = useMemo(
    () => services.find((service) => service.id === serviceId) || null,
    [services, serviceId]
  )

  const selectedWorkflowHint = useMemo(() => {
    if (!selectedService?.isSequential) return null
    const workflowKey = normalizeWorkflowKey(selectedService.workflowGroup)
    if (!workflowKey) return null

    const definition = workflowDefinitions.get(workflowKey)
    if (!definition) return null

    const nextStep = nextStepByWorkflow.get(workflowKey) || null
    const nextService =
      nextStep === null ? null : definition.services.find((service) => service.stepOrder === nextStep)

    return {
      group: definition.label || workflowKey,
      expectedStep: nextStep,
      nextServiceName: nextService?.name || null,
      isComplete: nextStep === null,
    }
  }, [selectedService, workflowDefinitions, nextStepByWorkflow])

  useEffect(() => {
    if (propertyId && !availableProperties.find((p) => p.id === propertyId)) {
      setPropertyId('')
    }
  }, [availableProperties, propertyId])

  useEffect(() => {
    if (!customerId) return
    if (!propertySearch.trim() && customerScopedProperties.length === 1) {
      setPropertyId(customerScopedProperties[0].id)
    }
  }, [customerId, customerScopedProperties, propertySearch])

  useEffect(() => {
    if (serviceId && !filteredServices.find((service) => service.id === serviceId)) {
      setServiceId('')
    }
  }, [filteredServices, serviceId])

  useEffect(() => {
    if (!propertyId) return
    const selectedProperty = properties.find((property) => property.id === propertyId)
    if (!selectedProperty) return
    if (!customerId || customerId !== selectedProperty.customerId) {
      setCustomerId(selectedProperty.customerId)
    }
    const selectedCustomer = customerById.get(selectedProperty.customerId)
    if (selectedCustomer) {
      setCustomerSearch(getCustomerDisplay(selectedCustomer))
    }
    setPropertySearch(getPropertyDisplay(selectedProperty))
  }, [propertyId, properties, customerId, customerById])

  const handleSelectCustomer = (id: string) => {
    const selectedCustomer = customerById.get(id)
    if (!selectedCustomer) return

    setCustomerId(id)
    setCustomerSearch(getCustomerDisplay(selectedCustomer))
    setShowCustomerSuggestions(false)

    if (propertyId) {
      const selectedProperty = properties.find((property) => property.id === propertyId)
      if (selectedProperty && selectedProperty.customerId !== id) {
        setPropertyId('')
        setPropertySearch('')
      }
    }
  }

  const handleSelectProperty = (id: string) => {
    const selectedProperty = properties.find((property) => property.id === id)
    if (!selectedProperty) return

    setPropertyId(id)
    setPropertySearch(getPropertyDisplay(selectedProperty))
    setShowPropertySuggestions(false)

    const selectedCustomer = customerById.get(selectedProperty.customerId)
    if (selectedCustomer) {
      setCustomerId(selectedCustomer.id)
      setCustomerSearch(getCustomerDisplay(selectedCustomer))
    }
  }

  const uploadSelectedFiles = async (selectedFiles: FileList) => {
    const totalFiles = selectedFiles.length
    const uploadedUrls: string[] = []

    for (let index = 0; index < totalFiles; index += 1) {
      const originalFile = selectedFiles[index]
      setUploadProgress(`Processing attachment ${index + 1} of ${totalFiles}...`)
      const processedFile = await compressImageForUpload(originalFile)

      if (processedFile.size > MAX_UPLOAD_FILE_BYTES) {
        throw new Error(
          `"${originalFile.name}" is still too large after optimization (${formatBytes(processedFile.size)}). Keep each file under ${formatBytes(MAX_UPLOAD_FILE_BYTES)}.`
        )
      }

      setUploadProgress(`Uploading attachment ${index + 1} of ${totalFiles}...`)
      const uploadData = new FormData()
      uploadData.set('file', processedFile)
      uploadData.set('folder', 'tasks/manual')

      const uploadResponse = await fetch('/api/uploads', {
        method: 'POST',
        body: uploadData,
      })

      if (!uploadResponse.ok) {
        const payload = (await uploadResponse.json().catch(() => ({}))) as { error?: string }
        throw new Error(payload.error || `Upload failed for "${originalFile.name}" (${uploadResponse.status}).`)
      }

      const uploadPayload = (await uploadResponse.json()) as { url?: string }
      if (!uploadPayload.url) {
        throw new Error(`Upload finished without URL for "${originalFile.name}".`)
      }
      uploadedUrls.push(uploadPayload.url)
    }

    return uploadedUrls
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    setAttachmentError(null)
    setUploadProgress(null)

    if (!customerId || !propertyId || !serviceId) {
      setSubmitError('Customer, property, and service are required')
      return
    }

    const totalUploadBytes = files ? Array.from(files).reduce((sum, file) => sum + file.size, 0) : 0
    if (totalUploadBytes > MAX_UPLOAD_TOTAL_BYTES) {
      setAttachmentError(
        `Selected files total ${formatBytes(totalUploadBytes)}. Please keep total attachments under ${formatBytes(MAX_UPLOAD_TOTAL_BYTES)}.`
      )
      return
    }

    try {
      setSubmitting(true)
      let uploadedImageUrls: string[] = []
      if (files && files.length > 0) {
        uploadedImageUrls = await uploadSelectedFiles(files)
      }

      setUploadProgress('Creating task...')
      const formData = new FormData()
      formData.set('customerId', customerId)
      formData.set('propertyId', propertyId)
      formData.set('serviceId', serviceId)
      if (statusId) formData.set('statusId', statusId)
      if (notes) formData.set('notes', notes)
      if (scheduledFor) formData.set('scheduledFor', scheduledFor)
      uploadedImageUrls.forEach((url) => formData.append('uploadedImageUrls', url))

      const res = await fetch('/api/tasks', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        if (res.status === 413) {
          throw new Error(
            `Attachments are too large for Vercel limits. Please use smaller photos (max ${formatBytes(MAX_UPLOAD_FILE_BYTES)} each).`
          )
        }
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
      setUploadProgress(null)
      setSubmitting(false)
    }
  }

  const handleFileSelection = (list: FileList | null, clearInput?: () => void) => {
    setAttachmentError(null)
    setUploadProgress(null)
    if (!list || list.length === 0) {
      setFiles(null)
      return
    }

    const unsupportedFile = Array.from(list).find((file) => !file.type.startsWith('image/'))
    if (unsupportedFile) {
      setFiles(null)
      setAttachmentError(`"${unsupportedFile.name}" is not an image. Please upload image files only.`)
      if (clearInput) clearInput()
      return
    }

    const oversizedFile = Array.from(list).find((file) => file.size > 10 * 1024 * 1024)
    if (oversizedFile) {
      setFiles(null)
      setAttachmentError(
        `"${oversizedFile.name}" is ${formatBytes(oversizedFile.size)}. Please keep each original file under 10 MB before upload.`
      )
      if (clearInput) clearInput()
      return
    }

    const totalUploadBytes = Array.from(list).reduce((sum, file) => sum + file.size, 0)
    if (totalUploadBytes > MAX_UPLOAD_TOTAL_BYTES) {
      setFiles(null)
      setAttachmentError(
        `Selected files total ${formatBytes(totalUploadBytes)}. Please keep total attachments under ${formatBytes(MAX_UPLOAD_TOTAL_BYTES)}.`
      )
      if (clearInput) clearInput()
      return
    }

    setFiles(list)
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
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="kline-input"
                    value={customerSearch}
                    onFocus={() => setShowCustomerSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 120)}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value)
                      setShowCustomerSuggestions(true)
                      if (customerId) {
                        setCustomerId('')
                        setPropertyId('')
                        setPropertySearch('')
                        setServiceId('')
                      }
                    }}
                    placeholder="Search and select customer"
                    required={!customerId}
                  />
                  {showCustomerSuggestions && filteredCustomers.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        right: 0,
                        background: '#fff',
                        border: '1px solid var(--kline-gray)',
                        borderRadius: 10,
                        boxShadow: '0 10px 24px rgba(0,0,0,0.12)',
                        zIndex: 20,
                        maxHeight: 240,
                        overflowY: 'auto',
                      }}
                    >
                      {filteredCustomers.slice(0, 8).map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            handleSelectCustomer(customer.id)
                          }}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '10px 12px',
                            border: 'none',
                            borderBottom: '1px solid #f0f0f0',
                            background: customerId === customer.id ? 'rgba(227, 6, 19, 0.08)' : '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ fontWeight: 800, color: 'var(--kline-text)' }}>{customer.fullName}</div>
                          <div style={{ marginTop: 2, fontSize: '0.8rem', color: 'var(--kline-text-light)' }}>
                            {customer.email || customer.phone || 'No contact'}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {customerId && (
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ color: 'var(--kline-text-light)', fontSize: '0.8rem' }}>
                      Selected customer linked to this task.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerId('')
                        setCustomerSearch('')
                        setPropertyId('')
                        setPropertySearch('')
                        setServiceId('')
                      }}
                      style={{
                        border: '1px solid var(--kline-gray)',
                        background: '#fff',
                        borderRadius: 999,
                        padding: '2px 8px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: 'var(--kline-text-light)',
                        cursor: 'pointer',
                      }}
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '8px', fontWeight: 700 }}>Property</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="kline-input"
                    value={propertySearch}
                    onFocus={() => setShowPropertySuggestions(true)}
                    onBlur={() => setTimeout(() => setShowPropertySuggestions(false), 120)}
                    onChange={(e) => {
                      setPropertySearch(e.target.value)
                      setShowPropertySuggestions(true)
                      if (propertyId) {
                        setPropertyId('')
                        setServiceId('')
                      }
                    }}
                    placeholder="Search property and auto-fill customer"
                    required={!propertyId}
                  />
                  {showPropertySuggestions && filteredProperties.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        right: 0,
                        background: '#fff',
                        border: '1px solid var(--kline-gray)',
                        borderRadius: 10,
                        boxShadow: '0 10px 24px rgba(0,0,0,0.12)',
                        zIndex: 20,
                        maxHeight: 260,
                        overflowY: 'auto',
                      }}
                    >
                      {filteredProperties.slice(0, 8).map((property) => {
                        const relatedCustomer = customerById.get(property.customerId)
                        const displayLabel = getPropertyDisplay(property, relatedCustomer?.fullName)
                        return (
                          <button
                            key={property.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              handleSelectProperty(property.id)
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '10px 12px',
                              border: 'none',
                              borderBottom: '1px solid #f0f0f0',
                              background: propertyId === property.id ? 'rgba(227, 6, 19, 0.08)' : '#fff',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ fontWeight: 800, color: 'var(--kline-text)' }}>{displayLabel}</div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                {propertyId && (
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ color: 'var(--kline-text-light)', fontSize: '0.8rem' }}>
                      Customer auto-selected from chosen property.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPropertyId('')
                        setPropertySearch('')
                        setServiceId('')
                      }}
                      style={{
                        border: '1px solid var(--kline-gray)',
                        background: '#fff',
                        borderRadius: 999,
                        padding: '2px 8px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: 'var(--kline-text-light)',
                        cursor: 'pointer',
                      }}
                    >
                      Change
                    </button>
                  </div>
                )}
                {customerId && customerScopedProperties.length === 1 && !propertyId && !propertySearch.trim() && (
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
                  Independent services can be created anytime. Sequential services are locked by customer + property and advance when previous step is Completed (after final step, cycle restarts at step 1).
                </div>
                {customerId && propertyId && selectedWorkflowHint && (
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: selectedWorkflowHint.isComplete ? '#1f7a43' : 'var(--kline-text-light)',
                        background: selectedWorkflowHint.isComplete ? 'rgba(25, 135, 84, 0.12)' : 'var(--kline-gray-light)',
                        border: `1px solid ${selectedWorkflowHint.isComplete ? 'rgba(25, 135, 84, 0.25)' : 'var(--kline-gray)'}`,
                        borderRadius: 999,
                        padding: '6px 10px',
                      }}
                    >
                      {selectedWorkflowHint.isComplete
                        ? `${selectedWorkflowHint.group}: completed`
                        : `${selectedWorkflowHint.group}: next ${selectedWorkflowHint.nextServiceName || `step ${selectedWorkflowHint.expectedStep ?? ''}`}`}
                    </span>
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
                  <option value="">Default (Completed)</option>
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <div style={{ marginTop: 6, color: 'var(--kline-text-light)', fontSize: '0.8rem' }}>
                  {selectedService?.isSequential
                    ? 'For sequential workflows, step 1 starts as In Progress automatically.'
                    : 'For independent services, selected status is applied directly.'}
                </div>
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
                  onChange={(e) =>
                    handleFileSelection(e.target.files, () => {
                      e.currentTarget.value = ''
                    })
                  }
                />
                {attachmentError && (
                  <div style={{ marginTop: 6, color: 'var(--kline-red)', fontSize: '0.8rem', fontWeight: 700 }}>
                    {attachmentError}
                  </div>
                )}
                {uploadProgress && (
                  <div style={{ marginTop: 6, color: 'var(--kline-text-light)', fontSize: '0.8rem', fontWeight: 700 }}>
                    {uploadProgress}
                  </div>
                )}
                <div style={{ marginTop: 6, color: 'var(--kline-text-light)', fontSize: '0.78rem' }}>
                  Images are auto-optimized before upload. Max total: {formatBytes(MAX_UPLOAD_TOTAL_BYTES)}. Max per processed image: {formatBytes(MAX_UPLOAD_FILE_BYTES)}.
                </div>
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
                {submitting ? uploadProgress || 'Creating…' : 'Create Task'}
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
