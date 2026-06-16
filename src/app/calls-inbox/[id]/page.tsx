'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { buildCallSmsMessage, callSmsTemplates } from '@/lib/callSmsTemplates'
import {
  callbackOutcomeOptions,
  callPriorityOptions,
  callStatusOptions,
  callTypeOptions,
  CallsInboxDetailApiResponse,
  CallsInboxDetailRecord,
  formatEnumLabel,
} from '@/lib/callsInbox'

type AssignmentUser = {
  id: string
  email: string
  accessScope?: 'ALL' | 'PERMITS_ONLY' | 'NONE'
  canAccessCallsInbox?: boolean
}

function formatDateTime(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getStatusAccent(status: string) {
  switch (status) {
    case 'RESOLVED':
      return '#198754'
    case 'CALLBACK_PENDING':
    case 'CALLBACK_ATTEMPTED':
      return '#fd7e14'
    case 'TRIAGE_REQUIRED':
    case 'ASSIGNED':
      return '#7c3aed'
    case 'SPAM':
      return '#6c757d'
    default:
      return '#0d6efd'
  }
}

export default function CallRecordDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [record, setRecord] = useState<CallsInboxDetailRecord | null>(null)
  const [users, setUsers] = useState<AssignmentUser[]>([])
  const [moduleReady, setModuleReady] = useState(true)
  const [canSendCallSms, setCanSendCallSms] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loggingAttempt, setLoggingAttempt] = useState(false)
  const [form, setForm] = useState({
    status: '',
    priority: '',
    callType: '',
    assignedToUserId: '',
    callerNameRaw: '',
    phoneNumber: '',
    summary: '',
    transcriptRaw: '',
    internalNotes: '',
    requestedAction: '',
  })
  const [callbackForm, setCallbackForm] = useState({
    outcome: 'NO_ANSWER',
    notes: '',
    nextFollowUpAt: '',
  })
  const [smsForm, setSmsForm] = useState({
    phoneNumber: '',
    template: 'RECEIVED_MESSAGE',
    additionalNote: '',
  })
  const [sendingSms, setSendingSms] = useState(false)

  async function loadRecordDetail(recordId: string) {
    const refreshRes = await fetch(`/api/calls-inbox/${recordId}`, { cache: 'no-store' })
    const refreshData = (await refreshRes.json()) as CallsInboxDetailApiResponse | { error?: string }

    if (!refreshRes.ok) {
      throw new Error(('error' in refreshData && refreshData.error) || 'Unable to refresh call record')
    }

    const payload = refreshData as CallsInboxDetailApiResponse
    setRecord(payload.record)
    setModuleReady(payload.moduleReady)
    setMessage(payload.message || '')

    if (payload.record) {
      setForm({
        status: payload.record.status,
        priority: payload.record.priority,
        callType: payload.record.callType,
        assignedToUserId: payload.record.assignedToUserId || '',
        callerNameRaw: payload.record.callerNameRaw || '',
        phoneNumber: payload.record.phoneNumber || '',
        summary: payload.record.summary || '',
        transcriptRaw: payload.record.transcriptRaw || '',
        internalNotes: payload.record.internalNotes || '',
        requestedAction: payload.record.requestedAction || '',
      })
    }
  }

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        const authRes = await fetch('/api/auth/check', { cache: 'no-store' })
        if (!authRes.ok) {
          router.replace('/auth/login')
          return
        }

        const authData = (await authRes.json()) as {
          user?: { canAccessCallsInbox?: boolean; accessScope?: 'ALL' | 'PERMITS_ONLY'; canSendCallSms?: boolean }
        }

        if (cancelled) return

        const canAccess = authData.user?.canAccessCallsInbox === true && authData.user?.accessScope !== 'PERMITS_ONLY'
        setAuthorized(canAccess)
        setCanSendCallSms(authData.user?.canSendCallSms === true)

        if (!canAccess) {
          router.replace(authData.user?.accessScope === 'PERMITS_ONLY' ? '/tasks' : '/dashboard')
          return
        }

        const [detailRes, usersRes] = await Promise.all([
          fetch(`/api/calls-inbox/${params.id}`, { cache: 'no-store' }),
          fetch('/api/users', { cache: 'no-store' }),
        ])

        const detailData = (await detailRes.json()) as CallsInboxDetailApiResponse | { error?: string }
        const usersData = usersRes.ok ? ((await usersRes.json()) as AssignmentUser[]) : []

        if (cancelled) return

        if (!detailRes.ok) {
          throw new Error(('error' in detailData && detailData.error) || 'Unable to load call record')
        }

        const payload = detailData as CallsInboxDetailApiResponse
        setRecord(payload.record)
        setModuleReady(payload.moduleReady)
        setMessage(payload.message || '')
        setUsers(usersData.filter((user) => user.canAccessCallsInbox === true))

        if (payload.record) {
          const loadedRecord = payload.record
          setForm({
            status: loadedRecord.status,
            priority: loadedRecord.priority,
            callType: loadedRecord.callType,
            assignedToUserId: loadedRecord.assignedToUserId || '',
            callerNameRaw: loadedRecord.callerNameRaw || '',
            phoneNumber: loadedRecord.phoneNumber || '',
            summary: loadedRecord.summary || '',
            transcriptRaw: loadedRecord.transcriptRaw || '',
            internalNotes: loadedRecord.internalNotes || '',
            requestedAction: loadedRecord.requestedAction || '',
          })
          setSmsForm((current) => ({
            ...current,
            phoneNumber: loadedRecord.phoneNumber || '',
          }))
        }
      } catch (bootstrapError) {
        if (!cancelled) {
          setError(bootstrapError instanceof Error ? bootstrapError.message : 'Unable to load call record')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    bootstrap()

    return () => {
      cancelled = true
    }
  }, [params.id, router])

  const nextFollowUpAt = useMemo(() => {
    if (!record) return null
    return record.latestNextFollowUpAt || record.callbackAttempts.find((attempt) => attempt.nextFollowUpAt)?.nextFollowUpAt || null
  }, [record])

  const smsPreview = useMemo(
    () => buildCallSmsMessage(smsForm.template, smsForm.additionalNote),
    [smsForm.additionalNote, smsForm.template]
  )
  const smsActivities = useMemo(
    () =>
      record?.activities.filter(
        (activity) =>
          activity.actionType === 'NOTE_ADDED' &&
          typeof activity.note === 'string' &&
          activity.note.startsWith('SMS sent to ')
      ) || [],
    [record]
  )

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!record) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/calls-inbox/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        throw new Error(data.error || 'Unable to save changes')
      }

      router.push('/calls-inbox')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save changes')
    } finally {
      setSaving(false)
    }
  }

  async function handleCallbackAttemptSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!record) return

    setLoggingAttempt(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/calls-inbox/${record.id}/callback-attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(callbackForm),
      })

      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        throw new Error(data.error || 'Unable to log callback attempt')
      }

      setSuccess('Callback attempt logged. The activity history and status were updated.')
      setCallbackForm({
        outcome: 'NO_ANSWER',
        notes: '',
        nextFollowUpAt: '',
      })
      await loadRecordDetail(record.id)
    } catch (attemptError) {
      setError(attemptError instanceof Error ? attemptError.message : 'Unable to log callback attempt')
    } finally {
      setLoggingAttempt(false)
    }
  }

  async function handleSendSms(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!record) return

    setSendingSms(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/calls-inbox/${record.id}/send-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smsForm),
      })

      const data = (await res.json()) as { error?: string; phoneNumber?: string }
      if (!res.ok) {
        throw new Error(data.error || 'Unable to send SMS')
      }

      setSuccess(`SMS sent to ${data.phoneNumber || smsForm.phoneNumber}.`)
      setSmsForm((current) => ({
        ...current,
        additionalNote: '',
      }))
      await loadRecordDetail(record.id)
    } catch (smsError) {
      setError(smsError instanceof Error ? smsError.message : 'Unable to send SMS')
    } finally {
      setSendingSms(false)
    }
  }

  if (authorized === null || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--kline-gray-light)' }}>
        <div className="kline-card" style={{ padding: '2rem 2.5rem', textAlign: 'center' }}>
          <h2 style={{ margin: 0, color: 'var(--kline-text)' }}>Loading call detail…</h2>
          <p style={{ margin: '0.75rem 0 0', color: 'var(--kline-text-light)' }}>Preparing the callback ownership view.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--kline-gray-light)' }}>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-icon">K</div>
            <div>
              <h1>
                KLINE <span>TASKS</span>
              </h1>
              <p>Call Detail · assignment, history and callback context</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="ghost-btn" onClick={() => router.push('/calls-inbox')}>
              Calls Inbox
            </button>
            <button className="ghost-btn" onClick={() => router.push('/calls-inbox/my-followups')}>
              My Follow-Ups
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        {!moduleReady && (
          <section className="kline-card" style={{ padding: '1.2rem 1.4rem', marginBottom: '1.25rem', borderLeft: '5px solid #fd7e14' }}>
            <strong style={{ color: 'var(--kline-text)' }}>Database activation pending.</strong>
            <p style={{ margin: '0.45rem 0 0', color: 'var(--kline-text-light)' }}>{message || 'The Calls Inbox tables still need activation.'}</p>
          </section>
        )}

        {error && (
          <section className="kline-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', borderLeft: '5px solid #c81e1e' }}>
            <strong style={{ color: '#c81e1e' }}>{error}</strong>
          </section>
        )}

        {success && (
          <section className="kline-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', borderLeft: '5px solid #198754' }}>
            <strong style={{ color: '#198754' }}>{success}</strong>
          </section>
        )}

        {!record ? (
          <section className="kline-card" style={{ padding: '1.6rem' }}>
            <h3 style={{ marginTop: 0, color: 'var(--kline-text)' }}>Call record not available</h3>
            <p style={{ color: 'var(--kline-text-light)' }}>This record either does not exist yet or the new tables have not been activated.</p>
          </section>
        ) : (
          <>
        <section className="page-masthead page-masthead-detail" style={{ marginBottom: '1.5rem' }}>
          <div className="page-masthead-copy">
            <p className="page-masthead-kicker">{formatEnumLabel(record.sourceType)} · live record</p>
            <h2>{record.callerNameRaw || 'Unknown caller'}</h2>
            <p className="page-masthead-subtitle">
              {record.phoneNumber || 'No phone number captured'} · {formatDateTime(record.receivedAt)}
            </p>
            <div className="page-masthead-chips">
              <span style={{ borderColor: `${getStatusAccent(record.status)}30`, color: getStatusAccent(record.status) }}>{formatEnumLabel(record.status)}</span>
              <span>{formatEnumLabel(record.priority)}</span>
              <span>{formatEnumLabel(record.callType)}</span>
            </div>
          </div>
        </section>

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div className="kline-card" style={{ padding: '1.2rem', borderTop: `4px solid ${getStatusAccent(record.status)}` }}>
                <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800, color: 'var(--kline-text-light)' }}>Current owner</div>
                <div style={{ color: 'var(--kline-text)', marginTop: 8, fontWeight: 800 }}>{record.assignedToUser?.email || 'Unassigned'}</div>
                <div style={{ color: 'var(--kline-text-light)', marginTop: 6 }}>This is the person currently responsible for follow-up.</div>
              </div>
              <div className="kline-card" style={{ padding: '1.2rem', borderTop: '4px solid #fd7e14' }}>
                <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800, color: 'var(--kline-text-light)' }}>Next follow-up</div>
                <div style={{ color: 'var(--kline-text)', marginTop: 8, fontWeight: 800 }}>{formatDateTime(nextFollowUpAt)}</div>
                <div style={{ color: record.isFollowUpOverdue ? '#c81e1e' : record.isFollowUpDueToday ? '#fd7e14' : 'var(--kline-text-light)', marginTop: 6, fontWeight: record.isFollowUpOverdue || record.isFollowUpDueToday ? 800 : 600 }}>
                  {record.isFollowUpOverdue ? 'Overdue right now' : record.isFollowUpDueToday ? 'Due today' : 'No urgent follow-up flag'}
                </div>
              </div>
              <div className="kline-card" style={{ padding: '1.2rem', borderTop: `4px solid ${record.isSlaBreached ? '#c81e1e' : record.isSlaWarning ? '#fd7e14' : '#198754'}` }}>
                <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800, color: 'var(--kline-text-light)' }}>SLA / aging</div>
                <div style={{ color: 'var(--kline-text)', marginTop: 8, fontWeight: 800 }}>{record.ageLabel}</div>
                <div
                  style={{
                    color: record.isSlaBreached ? '#c81e1e' : record.isSlaWarning ? '#fd7e14' : 'var(--kline-text-light)',
                    marginTop: 6,
                    fontWeight: record.isSlaBreached || record.isSlaWarning ? 800 : 600,
                  }}
                >
                  {record.isSlaBreached ? 'Needs attention now' : record.isSlaWarning ? 'Aging toward SLA risk' : 'Within same-day response window'}
                </div>
              </div>
              <div className="kline-card" style={{ padding: '1.2rem', borderTop: '4px solid #0d6efd' }}>
                <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800, color: 'var(--kline-text-light)' }}>History snapshot</div>
                <div style={{ color: 'var(--kline-text)', marginTop: 8, fontWeight: 800 }}>{record.callbackAttemptCount} callback attempts</div>
                <div style={{ color: 'var(--kline-text-light)', marginTop: 6 }}>{record.activityCount} activity events recorded</div>
              </div>
            </section>

            <section className="detail-layout" style={{ alignItems: 'start' }}>
              <form onSubmit={handleSave} className="kline-card" style={{ padding: '1.6rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, color: 'var(--kline-text)' }}>Operational controls</h3>
                  <p style={{ margin: '0.35rem 0 0', color: 'var(--kline-text-light)' }}>
                    Adjust ownership, status, and caller details before office starts working the callback.
                  </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Status</label>
                    <select className="kline-input" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                      {callStatusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Priority</label>
                    <select className="kline-input" value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}>
                      {callPriorityOptions.map((option) => (
                        <option key={option} value={option}>
                          {formatEnumLabel(option)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Call Type</label>
                    <select className="kline-input" value={form.callType} onChange={(event) => setForm((current) => ({ ...current, callType: event.target.value }))}>
                      {callTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {formatEnumLabel(option)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Assigned To</label>
                    <select className="kline-input" value={form.assignedToUserId} onChange={(event) => setForm((current) => ({ ...current, assignedToUserId: event.target.value }))}>
                      <option value="">Unassigned</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.email}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--kline-gray)' }}>
                  <div style={{ fontWeight: 800, color: 'var(--kline-text)', marginBottom: '0.85rem' }}>Caller details</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Caller Name</label>
                      <input className="kline-input" value={form.callerNameRaw} onChange={(event) => setForm((current) => ({ ...current, callerNameRaw: event.target.value }))} />
                    </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Phone</label>
                      <input
                        className="kline-input"
                        value={form.phoneNumber}
                        onChange={(event) => {
                          const value = event.target.value
                          setForm((current) => ({ ...current, phoneNumber: value }))
                          setSmsForm((current) => ({ ...current, phoneNumber: value }))
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--kline-gray)' }}>
                  <div style={{ fontWeight: 800, color: 'var(--kline-text)', marginBottom: '0.85rem' }}>Call content</div>
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Summary</label>
                  <textarea className="kline-input" rows={4} value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} />
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Requested Action</label>
                  <textarea
                    className="kline-input"
                    rows={3}
                    value={form.requestedAction}
                    onChange={(event) => setForm((current) => ({ ...current, requestedAction: event.target.value }))}
                    placeholder="What exactly needs to happen next?"
                  />
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Transcript / Detailed Notes</label>
                  <textarea className="kline-input" rows={7} value={form.transcriptRaw} onChange={(event) => setForm((current) => ({ ...current, transcriptRaw: event.target.value }))} />
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Internal Notes</label>
                  <textarea className="kline-input" rows={5} value={form.internalNotes} onChange={(event) => setForm((current) => ({ ...current, internalNotes: event.target.value }))} />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
                  <button className="kline-btn-primary" type="submit" disabled={saving}>
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                  <button className="ghost-btn" type="button" onClick={() => router.push('/calls-inbox')}>
                    Back to Inbox
                  </button>
                </div>
              </form>

              <div style={{ display: 'grid', gap: '1rem' }}>
                <section className="kline-card" style={{ padding: '1.4rem', borderTop: '4px solid #198754' }}>
                  <h3 style={{ marginTop: 0, color: 'var(--kline-text)' }}>Send SMS reply</h3>
                  {!canSendCallSms ? (
                    <p style={{ color: 'var(--kline-text-light)', margin: 0 }}>
                      This user does not have permission to send customer text replies from call records.
                    </p>
                  ) : (
                    <form onSubmit={handleSendSms}>
                      <div>
                        <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>To</label>
                        <input
                          className="kline-input"
                          value={smsForm.phoneNumber}
                          onChange={(event) => setSmsForm((current) => ({ ...current, phoneNumber: event.target.value }))}
                          placeholder="Customer phone number"
                        />
                      </div>
                      <div style={{ marginTop: '0.9rem' }}>
                        <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Quick Template</label>
                        <select
                          className="kline-input"
                          value={smsForm.template}
                          onChange={(event) => setSmsForm((current) => ({ ...current, template: event.target.value }))}
                        >
                          <option value="">Manual message only</option>
                          {callSmsTemplates.map((template) => (
                            <option key={template.value} value={template.value}>
                              {template.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={{ marginTop: '0.9rem' }}>
                        <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Additional Note</label>
                        <textarea
                          className="kline-input"
                          rows={3}
                          value={smsForm.additionalNote}
                          onChange={(event) => setSmsForm((current) => ({ ...current, additionalNote: event.target.value }))}
                          placeholder="Add a short custom note for this customer."
                        />
                      </div>
                      <div style={{ marginTop: '0.9rem' }}>
                        <div style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Message Preview</div>
                        <div
                          style={{
                            border: '1px solid var(--kline-gray)',
                            borderRadius: 12,
                            padding: '0.95rem',
                            background: '#fff',
                            color: smsPreview ? 'var(--kline-text)' : 'var(--kline-text-light)',
                            lineHeight: 1.5,
                            minHeight: 94,
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {smsPreview || 'Choose a template or type a short manual message.'}
                        </div>
                        <div style={{ marginTop: 6, color: 'var(--kline-text-light)', fontSize: '0.8rem' }}>
                          {smsPreview.length}/320 characters
                        </div>
                      </div>
                      <button
                        className="kline-btn-primary"
                        type="submit"
                        disabled={sendingSms || !smsPreview.trim()}
                        style={{ marginTop: '1rem', width: '100%' }}
                      >
                        {sendingSms ? 'Sending…' : 'Send SMS'}
                      </button>
                    </form>
                  )}
                </section>

                <section className="kline-card" style={{ padding: '1.4rem', borderTop: '4px solid #fd7e14' }}>
                  <h3 style={{ marginTop: 0, color: 'var(--kline-text)' }}>Log callback attempt</h3>
                  <form onSubmit={handleCallbackAttemptSubmit}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Outcome</label>
                      <select
                        className="kline-input"
                        value={callbackForm.outcome}
                        onChange={(event) => setCallbackForm((current) => ({ ...current, outcome: event.target.value }))}
                      >
                        {callbackOutcomeOptions.map((option) => (
                          <option key={option} value={option}>
                            {formatEnumLabel(option)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ marginTop: '0.9rem' }}>
                      <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Notes</label>
                      <textarea
                        className="kline-input"
                        rows={3}
                        value={callbackForm.notes}
                        onChange={(event) => setCallbackForm((current) => ({ ...current, notes: event.target.value }))}
                        placeholder="What happened on the callback?"
                      />
                    </div>
                    <div style={{ marginTop: '0.9rem' }}>
                      <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Next Follow-Up</label>
                      <input
                        className="kline-input"
                        type="datetime-local"
                        value={callbackForm.nextFollowUpAt}
                        onChange={(event) => setCallbackForm((current) => ({ ...current, nextFollowUpAt: event.target.value }))}
                      />
                    </div>
                    <button className="kline-btn-primary" type="submit" disabled={loggingAttempt} style={{ marginTop: '1rem', width: '100%' }}>
                      {loggingAttempt ? 'Logging…' : 'Log Callback Attempt'}
                    </button>
                  </form>
                </section>

                <section className="kline-card" style={{ padding: '1.4rem', borderTop: '4px solid #0d6efd' }}>
                  <h3 style={{ marginTop: 0, color: 'var(--kline-text)' }}>SMS history</h3>
                  {smsActivities.length === 0 ? (
                    <p style={{ color: 'var(--kline-text-light)', margin: 0 }}>
                      No outbound customer texts have been sent from this call record yet.
                    </p>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.8rem' }}>
                      {smsActivities.map((activity) => (
                        <div
                          key={activity.id}
                          style={{
                            border: '1px solid rgba(13, 110, 253, 0.18)',
                            borderRadius: 14,
                            padding: '0.95rem 1rem',
                            background: 'linear-gradient(135deg, rgba(13, 110, 253, 0.06), rgba(32, 201, 151, 0.04))',
                            boxShadow: '0 10px 24px rgba(13, 110, 253, 0.08)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <div style={{ fontWeight: 800, color: 'var(--kline-text)' }}>
                              {activity.fromValue || 'Manual message'}
                            </div>
                            <span
                              style={{
                                padding: '0.32rem 0.7rem',
                                borderRadius: '999px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                background: 'rgba(13, 110, 253, 0.12)',
                                color: '#0d6efd',
                              }}
                            >
                              SMS Sent
                            </span>
                          </div>
                          <div style={{ color: 'var(--kline-text-light)', marginTop: 4, fontSize: '0.84rem' }}>
                            Customer text update
                          </div>
                          <div style={{ color: 'var(--kline-text-light)', marginTop: 8 }}>
                            {formatDateTime(activity.createdAt)} · {activity.createdByUser?.email || 'System'}
                          </div>
                          {activity.note && (
                            <div
                              style={{
                                color: 'var(--kline-text)',
                                marginTop: 10,
                                whiteSpace: 'pre-wrap',
                                lineHeight: 1.55,
                                background: 'rgba(255,255,255,0.8)',
                                borderRadius: 10,
                                padding: '0.8rem 0.85rem',
                                border: '1px solid rgba(13, 110, 253, 0.1)',
                              }}
                            >
                              {activity.note}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="kline-card" style={{ padding: '1.4rem', borderTop: '4px solid #0d6efd' }}>
                  <h3 style={{ marginTop: 0, color: 'var(--kline-text)' }}>Callback history</h3>
                  {record.callbackAttempts.length === 0 ? (
                    <p style={{ color: 'var(--kline-text-light)', margin: 0 }}>No callback attempts logged yet.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.8rem' }}>
                      {record.callbackAttempts.map((attempt) => (
                        <div key={attempt.id} style={{ border: '1px solid var(--kline-gray)', borderRadius: 12, padding: '0.85rem 0.95rem' }}>
                          <div style={{ fontWeight: 800, color: 'var(--kline-text)' }}>{formatEnumLabel(attempt.outcome)}</div>
                          <div style={{ color: 'var(--kline-text-light)', marginTop: 4 }}>
                            {formatDateTime(attempt.attemptedAt)} · {attempt.attemptedByUser?.email || 'Unknown user'}
                          </div>
                          {attempt.nextFollowUpAt && (
                            <div style={{ color: 'var(--kline-text-light)', marginTop: 6 }}>
                              Next follow-up: {formatDateTime(attempt.nextFollowUpAt)}
                            </div>
                          )}
                          {attempt.notes && <div style={{ color: 'var(--kline-text)', marginTop: 8 }}>{attempt.notes}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="kline-card" style={{ padding: '1.4rem', borderTop: '4px solid #7c3aed' }}>
                  <h3 style={{ marginTop: 0, color: 'var(--kline-text)' }}>Activity log</h3>
                  <div style={{ display: 'grid', gap: '0.8rem' }}>
                    {record.activities.map((activity) => (
                      <div key={activity.id} style={{ borderLeft: '3px solid #7c3aed', paddingLeft: '0.85rem' }}>
                        <div style={{ fontWeight: 800, color: 'var(--kline-text)' }}>{formatEnumLabel(activity.actionType)}</div>
                        <div style={{ color: 'var(--kline-text-light)', marginTop: 4 }}>
                          {formatDateTime(activity.createdAt)} · {activity.createdByUser?.email || 'System'}
                        </div>
                        {(activity.fromValue || activity.toValue) && (
                          <div style={{ color: 'var(--kline-text)', marginTop: 6 }}>
                            {activity.fromValue ? `${activity.fromValue} → ` : ''}
                            {activity.toValue || 'Updated'}
                          </div>
                        )}
                        {activity.note && <div style={{ color: 'var(--kline-text)', marginTop: 6 }}>{activity.note}</div>}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </section>
          </>
        )}
      </main>

      <style jsx>{`
        .page-masthead {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
          padding: 1.6rem 1.7rem;
          border-radius: 24px;
          background:
            radial-gradient(circle at top right, rgba(124, 58, 237, 0.14), transparent 30%),
            linear-gradient(135deg, #ffffff 0%, #faf7ff 50%, #fffbf5 100%);
          border: 1px solid rgba(124, 58, 237, 0.12);
          box-shadow: 0 18px 36px rgba(15, 23, 42, 0.06);
        }

        .page-masthead-copy h2 {
          margin: 0.25rem 0 0;
          font-size: clamp(2rem, 3vw, 2.7rem);
          line-height: 1.05;
          color: var(--kline-text);
        }

        .page-masthead-kicker {
          margin: 0;
          color: #7c3aed;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-size: 0.78rem;
        }

        .page-masthead-subtitle {
          margin: 0.8rem 0 0;
          max-width: 720px;
          color: var(--kline-text-light);
          font-size: 1rem;
          line-height: 1.7;
        }

        .page-masthead-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.6rem;
          margin-top: 1rem;
        }

        .page-masthead-chips span {
          padding: 0.42rem 0.75rem;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid rgba(124, 58, 237, 0.12);
          color: var(--kline-text);
          font-weight: 700;
          font-size: 0.9rem;
        }

        .detail-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.3fr) minmax(300px, 0.9fr);
          gap: 1rem;
        }

        @media (max-width: 1080px) {
          .detail-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
