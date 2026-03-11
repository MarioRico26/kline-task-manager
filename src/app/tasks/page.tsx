'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

interface TaskItem {
  id: string
  scheduledFor: string | null
  createdAt: string
  notes?: string | null
  customer: {
    id: string
    fullName: string
    email: string | null
    phone: string | null
  }
  property: {
    id: string
    address: string
    city: string
    state: string
    zip: string
  }
  service: {
    id: string
    name: string
    description?: string | null
    isSequential?: boolean
    workflowGroup?: string | null
    stepOrder?: number | null
  }
  status: {
    id: string
    name: string
    color?: string | null
  }
  media: Array<{ id: string; url: string }>
}

interface StatusItem {
  id: string
  name: string
  color?: string | null
}

interface ServiceStep {
  id: string
  name: string
  isSequential: boolean
  workflowGroup: string | null
  stepOrder: number | null
}

type GroupByMode = 'NONE' | 'CUSTOMER' | 'PROPERTY' | 'CUSTOMER_PROPERTY'
type ListViewMode = 'TASKS' | 'CASES' | 'PERMITS_CHART'

type TaskGroup = {
  key: string
  label: string
  subtitle: string
  tasks: TaskItem[]
}

type AccessScope = 'ALL' | 'PERMITS_ONLY'

type CaseStepState = 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED'

type CaseStep = {
  key: string
  name: string
  stepOrder: number
  status: CaseStepState
  taskId: string | null
}

type CaseItem = {
  key: string
  workflow: string
  customerName: string
  customerContact: string
  propertyLabel: string
  progressPercent: number
  completedSteps: number
  totalSteps: number
  currentStepLabel: string
  nextStepLabel: string
  steps: CaseStep[]
}

type PermitStageStatus = 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED'

type PermitWorkflowCase = {
  caseKey: string
  customerId: string
  propertyId: string
  customerName: string
  propertyLabel: string
  currentStepOrder: number
  currentStepName: string
  currentStepServiceId: string
  currentStepTaskId: string | null
  currentStepStatus: PermitStageStatus
  completedSteps: number
  totalSteps: number
  progressPercent: number
}

type PermitStageCaseAction = {
  stageCase: PermitWorkflowCase
  actionStatus: PermitStageStatus
}

type PermitStageSummary = {
  stepOrder: number
  stepName: string
  color: string
  totalCases: number
  activeCasesCount: number
  cases: PermitWorkflowCase[]
}

function normalizeWorkflow(value?: string | null) {
  return (value || '').trim().toLowerCase()
}

function isCompletedStatusName(statusName: string) {
  return statusName.trim().toLowerCase() === 'completed'
}

function formatWorkflowLabel(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return 'Workflow'
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

function isPermitsWorkflowLabel(value?: string | null) {
  return normalizeWorkflow(value).includes('permit')
}

function fmtDate(value: string | null) {
  if (!value) return 'Not scheduled'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'Not scheduled'
  return d.toLocaleDateString()
}

function fmtDateTime(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

export default function TasksPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [statuses, setStatuses] = useState<StatusItem[]>([])
  const [services, setServices] = useState<ServiceStep[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [serviceFilter, setServiceFilter] = useState('ALL')
  const [scheduleFilter, setScheduleFilter] = useState<'ALL' | 'SCHEDULED' | 'UNSCHEDULED'>('ALL')
  const [groupBy, setGroupBy] = useState<GroupByMode>('NONE')
  const [viewMode, setViewMode] = useState<ListViewMode>('TASKS')
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null)
  const [processingCaseKey, setProcessingCaseKey] = useState<string | null>(null)
  const [accessScope, setAccessScope] = useState<AccessScope>('ALL')
  const [selectedPermitStage, setSelectedPermitStage] = useState<number | null>(null)
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)
  const [detailNotes, setDetailNotes] = useState('')
  const [detailNotesDirty, setDetailNotesDirty] = useState(false)
  const [savingDetailTaskId, setSavingDetailTaskId] = useState<string | null>(null)

  const loadTasks = async () => {
    try {
      setLoading(true)
      setErrorMsg(null)
      const res = await fetch('/api/tasks', { cache: 'no-store' })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`Tasks request failed: ${res.status}. ${txt}`)
      }
      const data = (await res.json()) as TaskItem[]
      setTasks(data)
    } catch (err: unknown) {
      console.error('❌ Tasks load error:', err)
      const message = err instanceof Error ? err.message : 'Failed to load tasks'
      setErrorMsg(message)
    } finally {
      setLoading(false)
    }
  }

  const loadTaskCatalogs = async () => {
    const [statusRes, servicesRes] = await Promise.all([
      fetch('/api/statuses', { cache: 'no-store' }),
      fetch('/api/services', { cache: 'no-store' }),
    ])

    if (statusRes.ok) {
      const statusData = (await statusRes.json()) as StatusItem[]
      setStatuses(statusData)
    }

    if (servicesRes.ok) {
      const servicesData = (await servicesRes.json()) as ServiceStep[]
      setServices(servicesData)
    }
  }

  const loadSessionScope = async () => {
    try {
      const response = await fetch('/api/auth/check', { cache: 'no-store' })
      if (!response.ok) return
      const data = (await response.json()) as { user?: { accessScope?: AccessScope } }
      if (data.user?.accessScope) {
        setAccessScope(data.user.accessScope)
        if (data.user.accessScope === 'PERMITS_ONLY') {
          setGroupBy('CUSTOMER_PROPERTY')
          setViewMode('CASES')
        }
      }
    } catch (error) {
      console.error('Error fetching session scope:', error)
    }
  }

  useEffect(() => {
    loadTasks()
    loadTaskCatalogs()
    loadSessionScope()
  }, [])

  const statusOptions = useMemo(() => {
    const statuses = new Set(tasks.map((task) => task.status?.name).filter(Boolean))
    return ['ALL', ...Array.from(statuses).sort()]
  }, [tasks])

  const serviceOptions = useMemo(() => {
    const services = new Set(tasks.map((task) => task.service?.name).filter(Boolean))
    return ['ALL', ...Array.from(services).sort()]
  }, [tasks])

  const searchFilteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase()

    return tasks.filter((task) => {
      if (!query) return true

      const haystack = [
        task.service?.name,
        task.service?.description,
        task.customer?.fullName,
        task.customer?.email,
        task.customer?.phone,
        task.property?.address,
        task.property?.city,
        task.property?.state,
        task.status?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [tasks, search])

  const filteredTasks = useMemo(() => {
    return searchFilteredTasks.filter((task) => {
      if (statusFilter !== 'ALL' && task.status?.name !== statusFilter) return false
      if (serviceFilter !== 'ALL' && task.service?.name !== serviceFilter) return false
      if (scheduleFilter === 'SCHEDULED' && !task.scheduledFor) return false
      if (scheduleFilter === 'UNSCHEDULED' && task.scheduledFor) return false
      return true
    })
  }, [searchFilteredTasks, statusFilter, serviceFilter, scheduleFilter])

  const completedStatusId = useMemo(() => {
    const completed = statuses.find((status) => isCompletedStatusName(status.name))
    return completed?.id || null
  }, [statuses])

  const inProgressStatusId = useMemo(() => {
    const inProgress = statuses.find((status) => status.name.trim().toLowerCase() === 'in progress')
    if (inProgress?.id) return inProgress.id
    const open = statuses.find((status) => status.name.trim().toLowerCase() === 'open')
    return open?.id || null
  }, [statuses])

  const taskById = useMemo(() => {
    return new Map(tasks.map((task) => [task.id, task]))
  }, [tasks])

  const detailTask = useMemo(() => {
    if (!detailTaskId) return null
    return taskById.get(detailTaskId) || null
  }, [detailTaskId, taskById])

  useEffect(() => {
    if (!detailTask) {
      setDetailNotes('')
      setDetailNotesDirty(false)
      return
    }
    setDetailNotes(detailTask.notes || '')
    setDetailNotesDirty(false)
  }, [detailTask])

  const groupedTasks = useMemo<TaskGroup[]>(() => {
    if (groupBy === 'NONE') return []

    const groups = new Map<string, TaskGroup>()

    filteredTasks.forEach((task) => {
      let key = task.id
      let label = 'Unknown'
      let subtitle = ''

      if (groupBy === 'CUSTOMER') {
        key = task.customer?.id || task.id
        label = task.customer?.fullName || 'Unknown customer'
        subtitle = task.customer?.email || task.customer?.phone || 'No contact info'
      }

      if (groupBy === 'PROPERTY') {
        key = task.property?.id || task.id
        label = task.property?.address || 'Unknown property'
        subtitle = task.property
          ? `${task.property.city}, ${task.property.state} ${task.property.zip}`
          : 'No address details'
      }

      if (groupBy === 'CUSTOMER_PROPERTY') {
        key = `${task.customer?.id || 'unknown-customer'}::${task.property?.id || 'unknown-property'}`
        label = task.customer?.fullName || 'Unknown customer'
        subtitle = task.property
          ? `${task.property.address} · ${task.property.city}, ${task.property.state}`
          : 'No property assigned'
      }

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label,
          subtitle,
          tasks: [],
        })
      }

      groups.get(key)?.tasks.push(task)
    })

    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [filteredTasks, groupBy])

  const sequentialCatalogByWorkflow = useMemo(() => {
    const catalog = new Map<string, Array<{ id: string; name: string; stepOrder: number }>>()

    services.forEach((service) => {
      if (!service.isSequential || service.stepOrder === null) return
      const workflowKey = normalizeWorkflow(service.workflowGroup)
      if (!workflowKey) return

      if (!catalog.has(workflowKey)) catalog.set(workflowKey, [])
      catalog.get(workflowKey)?.push({
        id: service.id,
        name: service.name,
        stepOrder: service.stepOrder,
      })
    })

    catalog.forEach((steps) => {
      steps.sort((a, b) => a.stepOrder - b.stepOrder)
    })

    return catalog
  }, [services])

  const caseItems = useMemo<CaseItem[]>(() => {
    const sequentialTasks = searchFilteredTasks.filter(
      (task) => task.service?.isSequential && task.service?.stepOrder !== null && normalizeWorkflow(task.service?.workflowGroup) !== ''
    )

    const caseMap = new Map<string, TaskItem[]>()
    sequentialTasks.forEach((task) => {
      const workflowKey = normalizeWorkflow(task.service.workflowGroup)
      const key = `${task.customer?.id || 'unknown-customer'}::${task.property?.id || 'unknown-property'}::${workflowKey}`
      if (!caseMap.has(key)) caseMap.set(key, [])
      caseMap.get(key)?.push(task)
    })

    const cases: CaseItem[] = []

    caseMap.forEach((caseTasks, caseKey) => {
      if (caseTasks.length === 0) return

      const firstTask = caseTasks[0]
      const workflowKey = normalizeWorkflow(firstTask.service.workflowGroup)
      const fallbackSteps = caseTasks
        .filter((task) => task.service.stepOrder !== null)
        .map((task) => ({
          id: task.service.id,
          name: task.service.name,
          stepOrder: task.service.stepOrder as number,
        }))
        .sort((a, b) => a.stepOrder - b.stepOrder)

      const catalogSteps = sequentialCatalogByWorkflow.get(workflowKey) || fallbackSteps
      if (catalogSteps.length === 0) return

      const latestTaskByServiceId = new Map<string, TaskItem>()
      caseTasks.forEach((task) => {
        const existing = latestTaskByServiceId.get(task.service.id)
        if (!existing) {
          latestTaskByServiceId.set(task.service.id, task)
          return
        }
        const existingDate = new Date(existing.createdAt).getTime()
        const nextDate = new Date(task.createdAt).getTime()
        if (nextDate >= existingDate) latestTaskByServiceId.set(task.service.id, task)
      })

      const steps: CaseStep[] = catalogSteps.map((step) => {
        const taskForStep = latestTaskByServiceId.get(step.id)
        const status: CaseStepState = !taskForStep
          ? 'NOT_STARTED'
          : isCompletedStatusName(taskForStep.status.name)
            ? 'COMPLETED'
            : 'IN_PROGRESS'
        return {
          key: `${caseKey}::${step.id}`,
          name: step.name,
          stepOrder: step.stepOrder,
          status,
          taskId: taskForStep?.id || null,
        }
      })

      const completedSteps = steps.filter((step) => step.status === 'COMPLETED').length
      const totalSteps = steps.length
      const progressPercent = Math.round((completedSteps / totalSteps) * 100)
      const activeStep = steps.find((step) => step.status === 'IN_PROGRESS')
      const nextStep = steps.find((step) => step.status === 'NOT_STARTED')
      const currentStepLabel = activeStep
        ? `Step ${activeStep.stepOrder}: ${activeStep.name}`
        : completedSteps === totalSteps
          ? `Step ${steps[steps.length - 1].stepOrder}: ${steps[steps.length - 1].name}`
          : 'Not started'
      const nextStepLabel = nextStep ? `Step ${nextStep.stepOrder}: ${nextStep.name}` : 'No remaining steps'

      if (serviceFilter !== 'ALL' && !steps.some((step) => step.name === serviceFilter)) return
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'Completed' && progressPercent < 100) return
        if (statusFilter === 'In Progress' && (progressPercent === 100 || !activeStep)) return
        if (statusFilter !== 'Completed' && statusFilter !== 'In Progress') {
          const hasStatus = caseTasks.some((task) => task.status?.name === statusFilter)
          if (!hasStatus) return
        }
      }

      const scheduledDates = caseTasks
        .map((task) => task.scheduledFor)
        .filter((value): value is string => Boolean(value))
      const hasScheduled = scheduledDates.length > 0
      if (scheduleFilter === 'SCHEDULED' && !hasScheduled) return
      if (scheduleFilter === 'UNSCHEDULED' && hasScheduled) return

      cases.push({
        key: caseKey,
        workflow: formatWorkflowLabel(firstTask.service.workflowGroup || ''),
        customerName: firstTask.customer?.fullName || 'Unknown customer',
        customerContact: firstTask.customer?.email || firstTask.customer?.phone || 'No contact info',
        propertyLabel: firstTask.property
          ? `${firstTask.property.address} · ${firstTask.property.city}, ${firstTask.property.state}`
          : 'No property assigned',
        progressPercent,
        completedSteps,
        totalSteps,
        currentStepLabel,
        nextStepLabel,
        steps,
      })
    })

    return cases.sort((a, b) => a.customerName.localeCompare(b.customerName))
  }, [searchFilteredTasks, sequentialCatalogByWorkflow, scheduleFilter, serviceFilter, statusFilter])

  const permitWorkflowCases = useMemo<PermitWorkflowCase[]>(() => {
    const permitSteps = services
      .filter((service) => service.isSequential && service.stepOrder !== null && isPermitsWorkflowLabel(service.workflowGroup || service.name))
      .sort((a, b) => (a.stepOrder || 0) - (b.stepOrder || 0))
    if (permitSteps.length === 0) return []

    const permitTasks = searchFilteredTasks.filter(
      (task) =>
        task.service?.isSequential &&
        task.service?.stepOrder !== null &&
        isPermitsWorkflowLabel(task.service.workflowGroup || task.service.name) &&
        (scheduleFilter !== 'SCHEDULED' || Boolean(task.scheduledFor)) &&
        (scheduleFilter !== 'UNSCHEDULED' || !task.scheduledFor)
    )

    const permitCases = new Map<string, TaskItem[]>()
    permitTasks.forEach((task) => {
      const key = `${task.customer?.id || 'unknown-customer'}::${task.property?.id || 'unknown-property'}`
      if (!permitCases.has(key)) permitCases.set(key, [])
      permitCases.get(key)?.push(task)
    })

    const mappedCases: PermitWorkflowCase[] = []

    permitCases.forEach((caseTasks, caseKey) => {
      const firstTask = caseTasks[0]
      const latestTaskByServiceId = new Map<string, TaskItem>()
      caseTasks.forEach((task) => {
        const existing = latestTaskByServiceId.get(task.service.id)
        if (!existing || new Date(task.createdAt).getTime() >= new Date(existing.createdAt).getTime()) {
          latestTaskByServiceId.set(task.service.id, task)
        }
      })

      const statusesByStepOrder = new Map<number, PermitStageStatus>()
      permitSteps.forEach((permitStep) => {
        const taskForStep = latestTaskByServiceId.get(permitStep.id)
        let status: PermitStageStatus = 'NOT_STARTED'
        if (taskForStep) {
          status = isCompletedStatusName(taskForStep.status.name) ? 'COMPLETED' : 'IN_PROGRESS'
        }
        statusesByStepOrder.set(permitStep.stepOrder as number, status)
      })

      const completedSteps = Array.from(statusesByStepOrder.values()).filter((value) => value === 'COMPLETED').length
      const totalSteps = permitSteps.length
      const progressPercent = Math.round((completedSteps / totalSteps) * 100)

      const currentStage =
        permitSteps.find((permitStep) => statusesByStepOrder.get(permitStep.stepOrder as number) === 'IN_PROGRESS') ||
        permitSteps.find((permitStep) => statusesByStepOrder.get(permitStep.stepOrder as number) === 'NOT_STARTED') ||
        permitSteps[permitSteps.length - 1]

      mappedCases.push({
        caseKey,
        customerId: firstTask.customer?.id || '',
        propertyId: firstTask.property?.id || '',
        customerName: firstTask.customer?.fullName || 'Unknown customer',
        propertyLabel: firstTask.property
          ? `${firstTask.property.address} · ${firstTask.property.city}, ${firstTask.property.state}`
          : 'No property assigned',
        currentStepOrder: currentStage.stepOrder as number,
        currentStepName: currentStage.name,
        currentStepServiceId: currentStage.id,
        currentStepTaskId: latestTaskByServiceId.get(currentStage.id)?.id || null,
        currentStepStatus: statusesByStepOrder.get(currentStage.stepOrder as number) || 'NOT_STARTED',
        completedSteps,
        totalSteps,
        progressPercent,
      })
    })

    return mappedCases.sort((a, b) => a.customerName.localeCompare(b.customerName))
  }, [scheduleFilter, searchFilteredTasks, services])

  const permitStageSummaries = useMemo<PermitStageSummary[]>(() => {
    const stageColors = ['#4c6fbf', '#d98645', '#a5a5a5', '#5aa469', '#8b6ccf', '#2f7da7']
    const permitSteps = services
      .filter((service) => service.isSequential && service.stepOrder !== null && isPermitsWorkflowLabel(service.workflowGroup || service.name))
      .sort((a, b) => (a.stepOrder || 0) - (b.stepOrder || 0))
    if (permitSteps.length === 0) return []

    return permitSteps.map((step) => {
      const stageCases = permitWorkflowCases.filter((item) => item.currentStepOrder === step.stepOrder)
      return {
        stepOrder: step.stepOrder as number,
        stepName: step.name,
        color: stageColors[(step.stepOrder as number - 1) % stageColors.length],
        totalCases: permitWorkflowCases.length,
        activeCasesCount: stageCases.length,
        cases: stageCases,
      }
    })
  }, [permitWorkflowCases, services])

  const activePermitStage = useMemo(() => {
    if (permitStageSummaries.length === 0) return null
    const selected = permitStageSummaries.find((stage) => stage.stepOrder === selectedPermitStage)
    return selected || permitStageSummaries[0]
  }, [permitStageSummaries, selectedPermitStage])

  const activePermitStageActions = useMemo<PermitStageCaseAction[]>(() => {
    if (!activePermitStage) return []

    return activePermitStage.cases.map((stageCase) => {
      const actionStatus = stageCase.currentStepStatus
      return {
        stageCase,
        actionStatus,
      }
    })
  }, [activePermitStage])

  useEffect(() => {
    if (permitStageSummaries.length === 0) {
      setSelectedPermitStage(null)
      return
    }

    const exists = permitStageSummaries.some((stage) => stage.stepOrder === selectedPermitStage)
    if (!exists) {
      const preferred =
        [...permitStageSummaries].sort((a, b) => b.activeCasesCount - a.activeCasesCount)[0] || permitStageSummaries[0]
      setSelectedPermitStage(preferred.stepOrder)
    }
  }, [permitStageSummaries, selectedPermitStage])

  const workflowStepTotals = useMemo(() => {
    const totals = new Map<string, number>()

    services.forEach((service) => {
      if (!service.isSequential || service.stepOrder === null) return
      const groupKey = normalizeWorkflow(service.workflowGroup)
      if (!groupKey) return

      const currentMax = totals.get(groupKey) || 0
      if (service.stepOrder > currentMax) totals.set(groupKey, service.stepOrder)
    })

    return totals
  }, [services])

  const handleMarkCompleted = async (task: TaskItem) => {
    if (!completedStatusId || isCompletedStatusName(task.status.name)) return

    try {
      setUpdatingTaskId(task.id)
      const formData = new FormData()
      formData.set('customerId', task.customer.id)
      formData.set('propertyId', task.property.id)
      formData.set('serviceId', task.service.id)
      formData.set('statusId', completedStatusId)
      if (task.notes) formData.set('notes', task.notes)
      if (task.scheduledFor) formData.set('scheduledFor', task.scheduledFor)

      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        body: formData,
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || 'Failed to update status')
      }

      await loadTasks()
    } catch (error: unknown) {
      console.error('❌ Error marking task completed:', error)
      const message = error instanceof Error ? error.message : 'Failed to update status'
      setErrorMsg(message)
    } finally {
      setUpdatingTaskId(null)
    }
  }

  const handleStartSpecificStage = async (item: PermitWorkflowCase) => {
    if (!inProgressStatusId) {
      setErrorMsg('Status "In Progress" (or "Open") is required to start the next stage.')
      return
    }

    try {
      setProcessingCaseKey(item.caseKey)
      const formData = new FormData()
      formData.set('customerId', item.customerId)
      formData.set('propertyId', item.propertyId)
      formData.set('serviceId', item.currentStepServiceId)
      formData.set('statusId', inProgressStatusId)

      const response = await fetch('/api/tasks', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || 'Failed to start stage')
      }

      await loadTasks()
    } catch (error: unknown) {
      console.error('❌ Error creating stage task:', error)
      const message = error instanceof Error ? error.message : 'Failed to start stage'
      setErrorMsg(message)
    } finally {
      setProcessingCaseKey(null)
    }
  }

  const handleAdvanceCase = async (item: PermitWorkflowCase) => {
    if (item.currentStepStatus === 'COMPLETED') return

    if (item.currentStepTaskId) {
      const task = taskById.get(item.currentStepTaskId)
      if (!task) {
        setErrorMsg('Could not find the task for this stage. Please refresh and try again.')
        return
      }
      try {
        setProcessingCaseKey(item.caseKey)
        await handleMarkCompleted(task)
      } finally {
        setProcessingCaseKey(null)
      }
      return
    }

    const canStartStage = item.currentStepStatus === 'NOT_STARTED'
    if (!canStartStage) {
      setErrorMsg(`This stage cannot be started yet. Current stage is Step ${item.currentStepOrder}: ${item.currentStepName}.`)
      return
    }

    await handleStartSpecificStage(item)
  }

  const openTaskDetails = (task: TaskItem) => {
    setDetailTaskId(task.id)
  }

  const closeTaskDetails = () => {
    if (savingDetailTaskId) return
    setDetailTaskId(null)
  }

  const handleSaveDetailNotes = async () => {
    if (!detailTask || !detailNotesDirty) return

    try {
      setSavingDetailTaskId(detailTask.id)
      const formData = new FormData()
      formData.set('customerId', detailTask.customer.id)
      formData.set('propertyId', detailTask.property.id)
      formData.set('serviceId', detailTask.service.id)
      formData.set('statusId', detailTask.status.id)
      formData.set('notes', detailNotes)
      if (detailTask.scheduledFor) formData.set('scheduledFor', detailTask.scheduledFor)

      const response = await fetch(`/api/tasks/${detailTask.id}`, {
        method: 'PUT',
        body: formData,
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || 'Failed to save notes')
      }

      await loadTasks()
      setDetailNotesDirty(false)
    } catch (error: unknown) {
      console.error('❌ Error saving task notes:', error)
      const message = error instanceof Error ? error.message : 'Failed to save notes'
      setErrorMsg(message)
    } finally {
      setSavingDetailTaskId(null)
    }
  }

  const handleLogout = () => {
    document.cookie = 'user-id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    document.cookie = 'access-scope=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    window.location.href = '/auth/login'
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
                  Tasks
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {accessScope === 'ALL' ? (
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
              ) : (
                <>
                  <button
                    onClick={() => router.push('/customers')}
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
                    Customers
                  </button>
                  <button
                    onClick={() => router.push('/properties')}
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
                    Properties
                  </button>
                </>
              )}
              <button
                onClick={handleLogout}
                style={{
                  padding: '10px 18px',
                  background: 'transparent',
                  color: 'var(--kline-text-light)',
                  fontWeight: 600,
                  borderRadius: '10px',
                  border: '2px solid var(--kline-gray)',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'var(--kline-red)'
                  e.currentTarget.style.color = '#fff'
                  e.currentTarget.style.borderColor = 'var(--kline-red)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--kline-text-light)'
                  e.currentTarget.style.borderColor = 'var(--kline-gray)'
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '28px 20px 60px' }}>
        {/* Title + actions */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: 'var(--kline-text)' }}>
              {viewMode === 'TASKS' ? 'All Tasks' : viewMode === 'CASES' ? 'Case View' : 'Permits Workflow View'}
            </h2>
            <p style={{ margin: '6px 0 0', color: 'var(--kline-text-light)', fontSize: '1rem' }}>
              {viewMode === 'TASKS'
                ? 'Latest tasks from the system'
                : viewMode === 'CASES'
                  ? 'Grouped by customer + property + workflow to track one process end-to-end'
                  : 'Single interactive permits pie + stage detail board'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'inline-flex',
                border: '1px solid var(--kline-gray)',
                borderRadius: 10,
                overflow: 'hidden',
                background: '#fff',
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('TASKS')}
                style={{
                  padding: '10px 12px',
                  border: 'none',
                  borderRight: '1px solid var(--kline-gray)',
                  cursor: 'pointer',
                  fontWeight: 800,
                  color: viewMode === 'TASKS' ? '#fff' : 'var(--kline-text-light)',
                  background: viewMode === 'TASKS' ? 'var(--kline-red)' : 'transparent',
                }}
              >
                Task View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('CASES')}
                style={{
                  padding: '10px 12px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 800,
                  color: viewMode === 'CASES' ? '#fff' : 'var(--kline-text-light)',
                  background: viewMode === 'CASES' ? 'var(--kline-red)' : 'transparent',
                }}
              >
                Case View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('PERMITS_CHART')}
                style={{
                  padding: '10px 12px',
                  border: 'none',
                  borderLeft: '1px solid var(--kline-gray)',
                  cursor: 'pointer',
                  fontWeight: 800,
                  color: viewMode === 'PERMITS_CHART' ? '#fff' : 'var(--kline-text-light)',
                  background: viewMode === 'PERMITS_CHART' ? 'var(--kline-red)' : 'transparent',
                }}
              >
                Permits Pie
              </button>
            </div>
            <button
              onClick={() => router.push('/tasks/new')}
              style={{
                padding: '10px 14px',
                background: 'var(--kline-red)',
                color: '#fff',
                fontWeight: 800,
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              + New Task
            </button>
            <button
              onClick={loadTasks}
              style={{
                padding: '10px 14px',
                background: 'transparent',
                color: 'var(--kline-text)',
                fontWeight: 700,
                borderRadius: '10px',
                border: '2px solid var(--kline-gray)',
                cursor: 'pointer',
              }}
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="kline-card" style={{ marginTop: 20, padding: 16 }}>
          <div
            className="task-filters-grid"
            style={{
              display: 'grid',
              gridTemplateColumns:
                viewMode === 'TASKS'
                  ? 'minmax(220px, 1.8fr) repeat(4, minmax(160px, 1fr))'
                  : viewMode === 'CASES'
                    ? 'minmax(220px, 1.8fr) repeat(3, minmax(160px, 1fr))'
                    : 'minmax(220px, 2fr) minmax(180px, 1fr)',
              gap: 10,
            }}
          >
            <input
              type="text"
              className="kline-input"
              placeholder="Search customer, service, address, status..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {viewMode !== 'PERMITS_CHART' && (
              <select className="kline-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status === 'ALL' ? 'All statuses' : status}
                  </option>
                ))}
              </select>
            )}
            {viewMode !== 'PERMITS_CHART' && (
              <select className="kline-input" value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
                {serviceOptions.map((service) => (
                  <option key={service} value={service}>
                    {service === 'ALL' ? 'All services' : service}
                  </option>
                ))}
              </select>
            )}
            <select
              className="kline-input"
              value={scheduleFilter}
              onChange={(e) => setScheduleFilter(e.target.value as 'ALL' | 'SCHEDULED' | 'UNSCHEDULED')}
            >
              <option value="ALL">All schedule types</option>
              <option value="SCHEDULED">Scheduled only</option>
              <option value="UNSCHEDULED">Unscheduled only</option>
            </select>
            {viewMode === 'TASKS' && (
              <select className="kline-input" value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupByMode)}>
                <option value="NONE">No grouping</option>
                <option value="CUSTOMER">Group by customer</option>
                <option value="PROPERTY">Group by property</option>
                <option value="CUSTOMER_PROPERTY">Group by customer + property</option>
              </select>
            )}
          </div>
          <div style={{ marginTop: 10, color: 'var(--kline-text-light)', fontSize: '0.85rem', fontWeight: 600 }}>
            {viewMode === 'TASKS' ? (
              <>
                Showing {filteredTasks.length} of {tasks.length} tasks
                {groupBy !== 'NONE' ? ` in ${groupedTasks.length} groups` : ''}
              </>
            ) : viewMode === 'CASES' ? (
              <>Showing {caseItems.length} cases from {searchFilteredTasks.length} matching tasks</>
            ) : (
              <>Showing {permitStageSummaries.length} permit stages across {permitStageSummaries[0]?.totalCases || 0} cases</>
            )}
          </div>
          {viewMode === 'TASKS' && completedStatusId && (
            <div style={{ marginTop: 6, color: 'var(--kline-text-light)', fontSize: '0.8rem' }}>
              Tip: click a non-completed status badge to mark task as Completed.
            </div>
          )}
        </div>

        {/* Loading / error */}
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
            <div style={{ color: 'var(--kline-text-light)', fontWeight: 600 }}>Loading tasks…</div>
          </div>
        )}

        {!loading && errorMsg && (
          <div className="kline-card" style={{ padding: 18, marginTop: 20, borderLeft: '4px solid #dc3545' }}>
            <div style={{ fontWeight: 800, color: 'var(--kline-text)' }}>Could not load tasks</div>
            <div style={{ marginTop: 6, color: 'var(--kline-text-light)' }}>{errorMsg}</div>
            <button
              onClick={loadTasks}
              style={{
                marginTop: 12,
                padding: '10px 14px',
                background: 'var(--kline-red)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !errorMsg && (
          <div className="kline-card" style={{ padding: 18, marginTop: 22 }}>
            {viewMode === 'PERMITS_CHART' ? (
              permitStageSummaries.length === 0 ? (
                <div style={{ padding: 28, textAlign: 'center', color: 'var(--kline-text-light)', fontWeight: 700 }}>
                  No permit stages found for the current filters.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 18 }}>
                  <div
                    style={{
                      border: '1px solid var(--kline-gray)',
                      borderRadius: 12,
                      background: '#fff',
                      padding: 20,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                      gap: 22,
                      alignItems: 'stretch',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <PermitsStagePie
                        stages={permitStageSummaries}
                        selectedStepOrder={activePermitStage?.stepOrder || null}
                        onSelect={(stepOrder) => setSelectedPermitStage(stepOrder)}
                      />
                    </div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      <div style={{ fontWeight: 900, color: 'var(--kline-text)', fontSize: '1.05rem' }}>
                        Permits distribution by current stage
                      </div>
                      <div style={{ color: 'var(--kline-text-light)', fontSize: '0.86rem' }}>
                        Click any stage segment or legend row to open detail and board.
                      </div>
                      <div style={{ display: 'grid', gap: 6 }}>
                        {permitStageSummaries.map((stage) => {
                          const selected = activePermitStage?.stepOrder === stage.stepOrder
                          const percent = stage.totalCases > 0 ? Math.round((stage.activeCasesCount / stage.totalCases) * 100) : 0
                          return (
                            <button
                              key={stage.stepOrder}
                              type="button"
                              onClick={() => setSelectedPermitStage(stage.stepOrder)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                                border: selected ? `2px solid ${stage.color}` : '1px solid var(--kline-gray)',
                                borderRadius: 10,
                                background: '#fff',
                                padding: '8px 10px',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 10, height: 10, borderRadius: '50%', background: stage.color }} />
                                <span style={{ fontWeight: 800, color: 'var(--kline-text)', fontSize: '0.86rem' }}>
                                  Step {stage.stepOrder}: {stage.stepName}
                                </span>
                              </div>
                              <span style={{ fontWeight: 900, color: stage.color }}>
                                {stage.activeCasesCount} ({percent}%)
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {activePermitStage && (
                    <section style={{ border: '1px solid var(--kline-gray)', borderRadius: 12, overflow: 'hidden' }}>
                      <div
                        style={{
                          padding: '12px 14px',
                          background: 'var(--kline-gray-light)',
                          fontWeight: 900,
                          color: 'var(--kline-text)',
                        }}
                      >
                        Detail · Step {activePermitStage.stepOrder}: {activePermitStage.stepName}
                      </div>

                      <div style={{ padding: 14, display: 'grid', gap: 14 }}>
                        {activePermitStage.cases.length === 0 ? (
                          <div style={{ color: 'var(--kline-text-light)', fontWeight: 700 }}>No active cases in this stage.</div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                            {activePermitStageActions.map(({ stageCase }) => (
                              <article key={`${activePermitStage.stepOrder}-${stageCase.caseKey}`} style={{ border: '1px solid var(--kline-gray)', borderRadius: 12, padding: 10 }}>
                                <div style={{ fontWeight: 900, color: 'var(--kline-text)', fontSize: '0.86rem' }}>{stageCase.customerName}</div>
                                <div style={{ marginTop: 2, color: 'var(--kline-text-light)', fontSize: '0.78rem' }}>{stageCase.propertyLabel}</div>
                                <div style={{ marginTop: 6, color: 'var(--kline-text-light)', fontSize: '0.75rem', fontWeight: 700 }}>
                                  Progress: {stageCase.completedSteps}/{stageCase.totalSteps} · {stageCase.progressPercent}%
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceCase(stageCase)}
                                  disabled={stageCase.currentStepStatus === 'COMPLETED' || processingCaseKey === stageCase.caseKey}
                                  style={{
                                    marginTop: 8,
                                    border: '1px solid var(--kline-red)',
                                    background: '#fff',
                                    color: 'var(--kline-red)',
                                    borderRadius: 999,
                                    padding: '5px 9px',
                                    fontWeight: 800,
                                    fontSize: '0.72rem',
                                    cursor:
                                      stageCase.currentStepStatus === 'COMPLETED' || processingCaseKey === stageCase.caseKey
                                        ? 'not-allowed'
                                        : 'pointer',
                                    opacity:
                                      stageCase.currentStepStatus === 'COMPLETED' || processingCaseKey === stageCase.caseKey
                                        ? 0.6
                                        : 1,
                                  }}
                                >
                                  {processingCaseKey === stageCase.caseKey
                                    ? 'Processing...'
                                    : stageCase.currentStepStatus === 'IN_PROGRESS'
                                      ? 'Complete & trigger next'
                                      : stageCase.currentStepStatus === 'NOT_STARTED'
                                        ? 'Start stage'
                                        : 'Completed'}
                                </button>
                              </article>
                            ))}
                          </div>
                        )}

                        <div>
                          <div style={{ fontWeight: 900, color: 'var(--kline-text)', marginBottom: 8 }}>Workflow Board</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
                            {permitStageSummaries.map((stage) => (
                              <KanbanStageColumn
                                key={stage.stepOrder}
                                title={`Step ${stage.stepOrder}: ${stage.stepName}`}
                                color={stage.color}
                                items={stage.cases}
                                processingCaseKey={processingCaseKey}
                                onAdvanceCase={handleAdvanceCase}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </section>
                  )}
                </div>
              )
            ) : viewMode === 'CASES' ? (
              caseItems.length === 0 ? (
                <div style={{ padding: 28, textAlign: 'center', color: 'var(--kline-text-light)', fontWeight: 700 }}>
                  No cases match the current filters.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 14 }}>
                  {caseItems.map((caseItem) => (
                    <section key={caseItem.key} style={{ border: '1px solid var(--kline-gray)', borderRadius: 12, overflow: 'hidden' }}>
                      <div
                        style={{
                          padding: '12px 14px',
                          background: 'var(--kline-gray-light)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 12,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 900, color: 'var(--kline-text)', fontSize: '1rem' }}>
                            {caseItem.workflow}: {caseItem.customerName}
                          </div>
                          <div style={{ marginTop: 2, color: 'var(--kline-text-light)', fontSize: '0.85rem' }}>
                            {caseItem.customerContact} · {caseItem.propertyLabel}
                          </div>
                        </div>
                        <div style={{ minWidth: 240 }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              color: 'var(--kline-text-light)',
                            }}
                          >
                            <span>
                              {caseItem.completedSteps}/{caseItem.totalSteps} steps completed
                            </span>
                            <span>{caseItem.progressPercent}%</span>
                          </div>
                          <div
                            style={{
                              marginTop: 5,
                              height: 7,
                              borderRadius: 999,
                              background: '#e7e9ec',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${caseItem.progressPercent}%`,
                                height: '100%',
                                borderRadius: 999,
                                background: 'linear-gradient(90deg, var(--kline-red), var(--kline-yellow))',
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: '0.86rem', color: 'var(--kline-text-light)', fontWeight: 700 }}>
                          Current: <span style={{ color: 'var(--kline-text)' }}>{caseItem.currentStepLabel}</span>
                        </div>
                        <div style={{ marginTop: 2, fontSize: '0.86rem', color: 'var(--kline-text-light)', fontWeight: 700 }}>
                          Next: <span style={{ color: 'var(--kline-text)' }}>{caseItem.nextStepLabel}</span>
                        </div>

                        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                          {caseItem.steps.map((step) => (
                            <div
                              key={step.key}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 12,
                                padding: '8px 10px',
                                borderRadius: 10,
                                border: '1px solid var(--kline-gray)',
                                background: '#fff',
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 800, color: 'var(--kline-text)', fontSize: '0.9rem' }}>
                                  Step {step.stepOrder}: {step.name}
                                </div>
                                {step.status === 'IN_PROGRESS' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!step.taskId) return
                                      const currentTask = taskById.get(step.taskId)
                                      if (currentTask) handleMarkCompleted(currentTask)
                                    }}
                                    style={{
                                      marginTop: 6,
                                      border: '1px solid var(--kline-red)',
                                      background: '#fff',
                                      color: 'var(--kline-red)',
                                      borderRadius: 999,
                                      padding: '4px 8px',
                                      fontWeight: 800,
                                      fontSize: '0.72rem',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Complete & trigger next
                                  </button>
                                )}
                              </div>
                              <WorkflowStatePill status={step.status} />
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>
                  ))}
                </div>
              )
            ) : filteredTasks.length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center', color: 'var(--kline-text-light)', fontWeight: 700 }}>
                {tasks.length === 0 ? 'No tasks yet. Create one to get started.' : 'No tasks match the current filters.'}
              </div>
            ) : groupBy !== 'NONE' ? (
              <div style={{ display: 'grid', gap: 14 }}>
                {groupedTasks.map((group) => (
                  <section key={group.key} style={{ border: '1px solid var(--kline-gray)', borderRadius: 12, overflow: 'hidden' }}>
                    <div
                      style={{
                        padding: '12px 14px',
                        background: 'var(--kline-gray-light)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 900, color: 'var(--kline-text)', fontSize: '1rem' }}>{group.label}</div>
                        <div style={{ marginTop: 2, color: 'var(--kline-text-light)', fontSize: '0.85rem' }}>{group.subtitle}</div>
                      </div>
                      <div
                        style={{
                          borderRadius: 999,
                          padding: '4px 10px',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          color: 'var(--kline-text-light)',
                          background: '#fff',
                          border: '1px solid var(--kline-gray)',
                        }}
                      >
                        {group.tasks.length} task{group.tasks.length === 1 ? '' : 's'}
                      </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                        <thead>
                          <tr style={{ background: '#fff' }}>
                            <Th>Service</Th>
                            {groupBy === 'PROPERTY' && <Th>Customer</Th>}
                            {groupBy === 'CUSTOMER' && <Th>Property</Th>}
                            <Th>Status</Th>
                            <Th>Scheduled</Th>
                            <Th>Created</Th>
                            <Th>Actions</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.tasks.map((t) => (
                            <tr key={t.id}>
                              <Td>
                                <div style={{ fontWeight: 900, color: 'var(--kline-text)' }}>{t.service?.name || '—'}</div>
                                {t.service?.description ? (
                                  <div style={{ marginTop: 2, color: 'var(--kline-text-light)', fontSize: '0.85rem' }}>
                                    {t.service.description}
                                  </div>
                                ) : null}
                                {t.service?.isSequential && t.service.stepOrder ? (
                                  <WorkflowProgress
                                    stepOrder={t.service.stepOrder}
                                    workflowGroup={t.service.workflowGroup || ''}
                                    workflowStepTotals={workflowStepTotals}
                                  />
                                ) : null}
                              </Td>
                              {groupBy === 'PROPERTY' && (
                                <Td>
                                  <div style={{ fontWeight: 900, color: 'var(--kline-text)' }}>{t.customer?.fullName || '—'}</div>
                                  <div style={{ marginTop: 2, color: 'var(--kline-text-light)', fontSize: '0.85rem' }}>
                                    {t.customer?.email || t.customer?.phone || '—'}
                                  </div>
                                </Td>
                              )}
                              {groupBy === 'CUSTOMER' && (
                                <Td>
                                  <div style={{ fontWeight: 800, color: 'var(--kline-text)' }}>{t.property?.address || '—'}</div>
                                  <div style={{ marginTop: 2, color: 'var(--kline-text-light)', fontSize: '0.85rem' }}>
                                    {t.property ? `${t.property.city}, ${t.property.state} ${t.property.zip}` : '—'}
                                  </div>
                                </Td>
                              )}
                              <Td>
                                <StatusBadge
                                  name={t.status?.name || 'Unknown'}
                                  color={t.status?.color || '#0d6efd'}
                                  clickable={Boolean(completedStatusId) && !isCompletedStatusName(t.status?.name || '')}
                                  loading={updatingTaskId === t.id}
                                  onClick={() => handleMarkCompleted(t)}
                                />
                              </Td>
                              <Td>{fmtDate(t.scheduledFor)}</Td>
                              <Td>{fmtDateTime(t.createdAt)}</Td>
                              <Td>
                                <button
                                  type="button"
                                  onClick={() => openTaskDetails(t)}
                                  style={{
                                    border: '1px solid var(--kline-gray)',
                                    background: '#fff',
                                    color: 'var(--kline-text)',
                                    borderRadius: 8,
                                    padding: '6px 10px',
                                    fontWeight: 800,
                                    fontSize: '0.78rem',
                                    cursor: 'pointer',
                                  }}
                                >
                                  View
                                </button>
                              </Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
                  <thead>
                    <tr style={{ background: 'var(--kline-gray-light)' }}>
                      <Th>Service</Th>
                      <Th>Customer</Th>
                      <Th>Status</Th>
                      <Th>Scheduled</Th>
                      <Th>Property</Th>
                      <Th>Created</Th>
                      <Th>Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((t) => (
                      <tr key={t.id}>
                        <Td>
                          <div style={{ fontWeight: 900, color: 'var(--kline-text)' }}>{t.service?.name || '—'}</div>
                          {t.service?.description ? (
                            <div style={{ marginTop: 2, color: 'var(--kline-text-light)', fontSize: '0.85rem' }}>
                              {t.service.description}
                            </div>
                          ) : null}
                          {t.service?.isSequential && t.service.stepOrder ? (
                            <WorkflowProgress
                              stepOrder={t.service.stepOrder}
                              workflowGroup={t.service.workflowGroup || ''}
                              workflowStepTotals={workflowStepTotals}
                            />
                          ) : null}
                        </Td>
                        <Td>
                          <div style={{ fontWeight: 900, color: 'var(--kline-text)' }}>{t.customer?.fullName || '—'}</div>
                          <div style={{ marginTop: 2, color: 'var(--kline-text-light)', fontSize: '0.85rem' }}>
                            {t.customer?.email || t.customer?.phone || '—'}
                          </div>
                        </Td>
                        <Td>
                          <StatusBadge
                            name={t.status?.name || 'Unknown'}
                            color={t.status?.color || '#0d6efd'}
                            clickable={Boolean(completedStatusId) && !isCompletedStatusName(t.status?.name || '')}
                            loading={updatingTaskId === t.id}
                            onClick={() => handleMarkCompleted(t)}
                          />
                        </Td>
                        <Td>{fmtDate(t.scheduledFor)}</Td>
                        <Td>
                          <div style={{ fontWeight: 800, color: 'var(--kline-text)' }}>{t.property?.address || '—'}</div>
                          <div style={{ marginTop: 2, color: 'var(--kline-text-light)', fontSize: '0.85rem' }}>
                            {t.property ? `${t.property.city}, ${t.property.state} ${t.property.zip}` : '—'}
                          </div>
                        </Td>
                        <Td>{fmtDateTime(t.createdAt)}</Td>
                        <Td>
                          <button
                            type="button"
                            onClick={() => openTaskDetails(t)}
                            style={{
                              border: '1px solid var(--kline-gray)',
                              background: '#fff',
                              color: 'var(--kline-text)',
                              borderRadius: 8,
                              padding: '6px 10px',
                              fontWeight: 800,
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                            }}
                          >
                            View
                          </button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {detailTask && (
          <TaskDetailsModal
            task={detailTask}
            notesDraft={detailNotes}
            notesDirty={detailNotesDirty}
            saving={savingDetailTaskId === detailTask.id}
            onChangeNotes={(value) => {
              setDetailNotes(value)
              setDetailNotesDirty(value !== (detailTask.notes || ''))
            }}
            onSaveNotes={handleSaveDetailNotes}
            onClose={closeTaskDetails}
          />
        )}
      </main>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @media (max-width: 980px) {
          .task-filters-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}

function StatusBadge({
  name,
  color,
  clickable = false,
  loading = false,
  onClick,
}: {
  name: string
  color: string
  clickable?: boolean
  loading?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={clickable && !loading ? onClick : undefined}
      title={clickable ? 'Mark as Completed' : undefined}
      style={{
        display: 'inline-block',
        padding: '6px 10px',
        borderRadius: 10,
        fontWeight: 900,
        fontSize: '0.8rem',
        background: `${color}1A`,
        color,
        border: `1px solid ${color}55`,
        cursor: clickable && !loading ? 'pointer' : 'default',
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? 'Updating...' : name}
    </button>
  )
}

function WorkflowProgress({
  stepOrder,
  workflowGroup,
  workflowStepTotals,
}: {
  stepOrder: number
  workflowGroup: string
  workflowStepTotals: Map<string, number>
}) {
  const groupKey = normalizeWorkflow(workflowGroup)
  const totalSteps = workflowStepTotals.get(groupKey) || stepOrder
  const percentage = Math.min(100, Math.round((stepOrder / totalSteps) * 100))

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--kline-text-light)', fontWeight: 700 }}>
        Workflow progress: Step {stepOrder} of {totalSteps}
      </div>
      <div
        style={{
          marginTop: 4,
          width: '100%',
          height: 6,
          borderRadius: 999,
          background: '#e7e9ec',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            borderRadius: 999,
            background: 'linear-gradient(90deg, var(--kline-red), var(--kline-yellow))',
          }}
        />
      </div>
    </div>
  )
}

function WorkflowStatePill({ status }: { status: CaseStepState }) {
  const styleByState: Record<CaseStepState, { label: string; color: string }> = {
    COMPLETED: { label: 'Completed', color: '#198754' },
    IN_PROGRESS: { label: 'In Progress', color: '#fd7e14' },
    NOT_STARTED: { label: 'Not Started', color: '#6c757d' },
  }

  const config = styleByState[status]
  return (
    <span
      style={{
        display: 'inline-flex',
        padding: '5px 9px',
        borderRadius: 999,
        fontWeight: 800,
        fontSize: '0.75rem',
        color: config.color,
        background: `${config.color}1A`,
        border: `1px solid ${config.color}55`,
      }}
    >
      {config.label}
    </span>
  )
}

function PermitsStagePie({
  stages,
  selectedStepOrder,
  onSelect,
}: {
  stages: PermitStageSummary[]
  selectedStepOrder: number | null
  onSelect: (stepOrder: number) => void
}) {
  const total = stages.reduce((sum, stage) => sum + stage.activeCasesCount, 0)
  const size = 340
  const center = size / 2
  const radius = 126
  const hasData = total > 0
  const denominator = hasData ? total : Math.max(1, stages.length)

  const toPoint = (radius: number, angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180
    return {
      x: center + radius * Math.cos(rad),
      y: center + radius * Math.sin(rad),
    }
  }

  const segments = stages.reduce<
    Array<{
      stepOrder: number
      stepName: string
      color: string
      value: number
      start: number
      sweep: number
      selected: boolean
    }>
  >((acc, stage, index) => {
    const previousSweep = acc.reduce((sum, item) => sum + item.sweep, 0)
    const start = -90 + previousSweep
    const value = hasData ? stage.activeCasesCount : 1
    const sweep = (value / denominator) * 360
    acc.push({
      stepOrder: stage.stepOrder,
      stepName: stage.stepName,
      color: stage.color,
      value: stage.activeCasesCount,
      start,
      sweep: index === stages.length - 1 ? 360 - previousSweep : sweep,
      selected: selectedStepOrder === stage.stepOrder,
    })
    return acc
  }, [])

  const visibleSegments = hasData ? segments.filter((segment) => segment.value > 0) : segments
  const selectedSegment = visibleSegments.find((segment) => segment.selected) || visibleSegments[0] || null

  const getPiePath = (start: number, sweep: number) => {
    if (sweep >= 359.99) {
      return `
        M ${center} ${center - radius}
        A ${radius} ${radius} 0 1 1 ${center - 0.01} ${center - radius}
        A ${radius} ${radius} 0 1 1 ${center} ${center - radius}
        Z
      `
    }

    const end = start + sweep
    const largeArc = sweep > 180 ? 1 : 0
    const startPoint = toPoint(radius, start)
    const endPoint = toPoint(radius, end)

    return `
      M ${center} ${center}
      L ${startPoint.x} ${startPoint.y}
      A ${radius} ${radius} 0 ${largeArc} 1 ${endPoint.x} ${endPoint.y}
      Z
    `
  }

  const getLabelPoint = (start: number, sweep: number) => {
    const midAngle = start + sweep / 2
    return toPoint(radius * 0.62, midAngle)
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 400,
        aspectRatio: '1 / 1',
        margin: '0 auto',
        borderRadius: '50%',
        background: 'radial-gradient(circle at 30% 30%, #ffffff 0%, #f5f7fa 65%, #ebeff3 100%)',
        border: '1px solid #e0e4e8',
        boxShadow: '0 18px 36px rgba(15, 23, 42, 0.12), inset 0 1px 0 rgba(255,255,255,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="Permits stage distribution">
        <circle cx={center} cy={center} r={radius + 3} fill="#f4f6f9" />
        {hasData && visibleSegments.length === 1 ? (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill={visibleSegments[0].color}
            stroke={visibleSegments[0].selected ? '#1f2328' : '#fff'}
            strokeWidth={visibleSegments[0].selected ? 4 : 2.5}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelect(visibleSegments[0].stepOrder)}
          />
        ) : (
          visibleSegments.map((segment) => (
            <path
              key={segment.stepOrder}
              d={getPiePath(segment.start, segment.sweep)}
              fill={segment.color}
              stroke={segment.selected ? '#1f2328' : '#fff'}
              strokeWidth={segment.selected ? 4 : 2.5}
              style={{
                cursor: 'pointer',
                opacity: hasData ? 1 : 0.35,
                transition: 'opacity 120ms ease, stroke-width 120ms ease',
              }}
              onClick={() => onSelect(segment.stepOrder)}
            />
          ))
        )}

        {hasData &&
          visibleSegments.map((segment) => {
            const percent = Math.round((segment.value / total) * 100)
            if (percent < 7) return null
            const point = getLabelPoint(segment.start, segment.sweep)
            return (
              <text
                key={`label-${segment.stepOrder}`}
                x={point.x}
                y={point.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#fff"
                style={{ fontWeight: 900, fontSize: 18, pointerEvents: 'none' }}
              >
                {percent}%
              </text>
            )
          })}
      </svg>

      <div
        style={{
          position: 'absolute',
          bottom: 30,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255,255,255,0.92)',
          border: `1px solid ${selectedSegment?.color || '#d3d8de'}`,
          borderRadius: 999,
          padding: '6px 12px',
          fontSize: '0.78rem',
          fontWeight: 900,
          color: 'var(--kline-text)',
          boxShadow: '0 8px 18px rgba(15,23,42,0.12)',
          whiteSpace: 'nowrap',
        }}
      >
        {selectedSegment
          ? `Step ${selectedSegment.stepOrder}: ${selectedSegment.value} case${selectedSegment.value === 1 ? '' : 's'}`
          : `Total active cases: ${total}`}
      </div>
    </div>
  )
}

function KanbanStageColumn({
  title,
  color,
  items,
  processingCaseKey,
  onAdvanceCase,
}: {
  title: string
  color: string
  items: PermitWorkflowCase[]
  processingCaseKey: string | null
  onAdvanceCase: (item: PermitWorkflowCase) => Promise<void>
}) {
  return (
    <div style={{ border: '1px solid var(--kline-gray)', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid var(--kline-gray)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: `${color}12`,
        }}
      >
        <span style={{ fontWeight: 900, color, fontSize: '0.86rem' }}>{title}</span>
        <span style={{ fontWeight: 900, color }}>{items.length}</span>
      </div>
      <div style={{ padding: 10, display: 'grid', gap: 8, minHeight: 120 }}>
        {items.length === 0 ? (
          <div style={{ fontSize: '0.8rem', color: 'var(--kline-text-light)' }}>No cases in this column</div>
        ) : (
          items.map((item) => (
            <article key={`${item.caseKey}-${title}`} style={{ border: '1px solid var(--kline-gray)', borderRadius: 10, padding: 10 }}>
              <div style={{ fontWeight: 900, color: 'var(--kline-text)', fontSize: '0.84rem' }}>{item.customerName}</div>
              <div style={{ marginTop: 3, color: 'var(--kline-text-light)', fontSize: '0.78rem' }}>{item.propertyLabel}</div>
              <div style={{ marginTop: 6, color: 'var(--kline-text-light)', fontSize: '0.75rem', fontWeight: 700 }}>
                Progress: {item.completedSteps}/{item.totalSteps} · {item.progressPercent}%
              </div>
              {(item.currentStepStatus === 'IN_PROGRESS' || item.currentStepStatus === 'NOT_STARTED') && (
                <button
                  type="button"
                  onClick={() => onAdvanceCase(item)}
                  disabled={processingCaseKey === item.caseKey}
                  style={{
                    marginTop: 8,
                    border: '1px solid var(--kline-red)',
                    background: '#fff',
                    color: 'var(--kline-red)',
                    borderRadius: 999,
                    padding: '5px 9px',
                    fontWeight: 800,
                    fontSize: '0.72rem',
                    cursor: processingCaseKey === item.caseKey ? 'not-allowed' : 'pointer',
                    opacity: processingCaseKey === item.caseKey ? 0.6 : 1,
                  }}
                >
                  {processingCaseKey === item.caseKey
                    ? 'Processing...'
                    : item.currentStepStatus === 'IN_PROGRESS'
                      ? 'Complete & trigger next'
                      : 'Start stage'}
                </button>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  )
}

function TaskDetailsModal({
  task,
  notesDraft,
  notesDirty,
  saving,
  onChangeNotes,
  onSaveNotes,
  onClose,
}: {
  task: TaskItem
  notesDraft: string
  notesDirty: boolean
  saving: boolean
  onChangeNotes: (value: string) => void
  onSaveNotes: () => Promise<void>
  onClose: () => void
}) {
  const canSave = notesDirty && !saving

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(980px, 100%)',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#fff',
          borderRadius: 14,
          border: '1px solid var(--kline-gray)',
          boxShadow: '0 20px 40px rgba(15,23,42,0.2)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--kline-gray)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontWeight: 900, color: 'var(--kline-text)', fontSize: '1.05rem' }}>{task.service.name}</div>
            <div style={{ marginTop: 2, fontSize: '0.84rem', color: 'var(--kline-text-light)' }}>
              {task.customer.fullName} · {task.property.address}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: '1px solid var(--kline-gray)',
              background: '#fff',
              color: 'var(--kline-text)',
              borderRadius: 8,
              padding: '6px 10px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>

        <div style={{ padding: 16, display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gap: 4, fontSize: '0.86rem', color: 'var(--kline-text-light)', fontWeight: 700 }}>
            <div>
              Status: <span style={{ color: 'var(--kline-text)' }}>{task.status.name}</span>
            </div>
            <div>
              Scheduled: <span style={{ color: 'var(--kline-text)' }}>{fmtDate(task.scheduledFor)}</span>
            </div>
            <div>
              Created: <span style={{ color: 'var(--kline-text)' }}>{fmtDateTime(task.createdAt)}</span>
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 900, color: 'var(--kline-text)', marginBottom: 8 }}>Notes</div>
            <textarea
              value={notesDraft}
              onChange={(event) => onChangeNotes(event.target.value)}
              rows={4}
              className="kline-input"
              placeholder="No notes for this task."
            />
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={onSaveNotes}
                disabled={!canSave}
                style={{
                  border: 'none',
                  background: 'var(--kline-red)',
                  color: '#fff',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontWeight: 800,
                  cursor: canSave ? 'pointer' : 'not-allowed',
                  opacity: canSave ? 1 : 0.6,
                }}
              >
                {saving ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 900, color: 'var(--kline-text)', marginBottom: 8 }}>
              Attachments ({task.media.length})
            </div>
            {task.media.length === 0 ? (
              <div style={{ color: 'var(--kline-text-light)', fontWeight: 700 }}>No photos attached.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                {task.media.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      border: '1px solid var(--kline-gray)',
                      borderRadius: 10,
                      overflow: 'hidden',
                      display: 'block',
                      background: '#fff',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt="Task attachment"
                      style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }}
                    />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th
      style={{
        padding: '14px 12px',
        textAlign: 'left',
        fontSize: '0.75rem',
        fontWeight: 900,
        color: 'var(--kline-text-light)',
        textTransform: 'uppercase',
        borderBottom: '1px solid var(--kline-gray)',
      }}
    >
      {children}
    </th>
  )
}

function Td({ children }: { children: ReactNode }) {
  return (
    <td style={{ padding: '14px 12px', borderBottom: '1px solid var(--kline-gray)', color: 'var(--kline-text)', fontWeight: 700, fontSize: '0.9rem' }}>
      {children}
    </td>
  )
}
