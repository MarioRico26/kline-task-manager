'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { callPriorityOptions, callSourceOptions, callStatusOptions, callTypeOptions, formatEnumLabel } from '@/lib/callsInbox'

type AssignmentUser = {
  id: string
  email: string
  accessScope?: 'ALL' | 'PERMITS_ONLY'
}

const initialForm = {
  sourceType: 'VOICEMAIL',
  status: 'NEW',
  priority: 'MEDIUM',
  callType: 'UNKNOWN',
  receivedAt: '',
  callerNameRaw: '',
  phoneNumber: '',
  detectedAddress: '',
  detectedTown: '',
  summary: '',
  transcriptRaw: '',
  internalNotes: '',
  assignedToUserId: '',
}

export default function NewCallRecordPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [users, setUsers] = useState<AssignmentUser[]>([])
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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
          user?: { id?: string; canAccessCallsInbox?: boolean; accessScope?: 'ALL' | 'PERMITS_ONLY' }
        }

        if (cancelled) return

        const canAccess = authData.user?.canAccessCallsInbox === true && authData.user?.accessScope !== 'PERMITS_ONLY'
        setAuthorized(canAccess)

        if (!canAccess) {
          router.replace(authData.user?.accessScope === 'PERMITS_ONLY' ? '/tasks' : '/dashboard')
          return
        }

        setForm((current) => ({
          ...current,
          receivedAt: current.receivedAt || new Date().toISOString().slice(0, 16),
          assignedToUserId: current.assignedToUserId,
        }))

        const usersRes = await fetch('/api/users', { cache: 'no-store' })
        if (!usersRes.ok) {
          throw new Error('Unable to load assignment users')
        }

        const usersData = (await usersRes.json()) as AssignmentUser[]
        if (cancelled) return

        setUsers(usersData.filter((user) => user.accessScope !== 'PERMITS_ONLY'))
      } catch (bootstrapError) {
        if (!cancelled) {
          setAuthorized(false)
          setError(bootstrapError instanceof Error ? bootstrapError.message : 'Unable to load form data')
        }
      }
    }

    bootstrap()

    return () => {
      cancelled = true
    }
  }, [router])

  const activeSource = useMemo(
    () => callSourceOptions.find((option) => option.value === form.sourceType),
    [form.sourceType]
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/calls-inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = (await res.json()) as { error?: string; id?: string }
      if (!res.ok) {
        throw new Error(data.error || 'Unable to save call record')
      }

      setSuccess('Call record saved. We now have manual intake + ownership captured safely.')
      setForm({
        ...initialForm,
        receivedAt: new Date().toISOString().slice(0, 16),
        assignedToUserId: '',
      })

      setTimeout(() => {
        router.push('/calls-inbox')
      }, 800)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save call record')
    } finally {
      setSaving(false)
    }
  }

  if (authorized === null) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--kline-gray-light)' }}>
        <div className="kline-card" style={{ padding: '2rem 2.5rem', textAlign: 'center' }}>
          <h2 style={{ margin: 0, color: 'var(--kline-text)' }}>Loading new call record…</h2>
          <p style={{ margin: '0.75rem 0 0', color: 'var(--kline-text-light)' }}>Preparing the manual intake workflow.</p>
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
              <p>Manual Intake · answered calls, voicemails and missed calls</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="ghost-btn" onClick={() => router.push('/calls-inbox')}>
              Calls Inbox
            </button>
            <button className="ghost-btn" onClick={() => router.push('/dashboard')}>
              Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <section className="page-masthead page-masthead-manual" style={{ marginBottom: '1.5rem' }}>
          <div className="page-masthead-copy">
            <p className="page-masthead-kicker">Live intake · office-safe workflow</p>
            <h2>Manual Call Intake</h2>
            <p className="page-masthead-subtitle">
              Capture answered calls, missed calls and voicemails now, with clean ownership from minute one and no dependency on future automation.
            </p>
          </div>
        </section>

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

        <form onSubmit={handleSubmit} className="intake-layout">
          <div style={{ display: 'grid', gap: '1rem' }}>
            <section className="kline-card" style={{ padding: '1.6rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, color: 'var(--kline-text)' }}>Call setup</h3>
                <p style={{ margin: '0.35rem 0 0', color: 'var(--kline-text-light)' }}>Capture the intake type, urgency, and when the message or call came in.</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Source Type</label>
                  <select className="kline-input" value={form.sourceType} onChange={(event) => setForm((current) => ({ ...current, sourceType: event.target.value }))}>
                    {callSourceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p style={{ margin: '0.45rem 0 0', color: 'var(--kline-text-light)' }}>{activeSource?.description}</p>
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Received At</label>
                  <input
                    className="kline-input"
                    type="datetime-local"
                    value={form.receivedAt}
                    onChange={(event) => setForm((current) => ({ ...current, receivedAt: event.target.value }))}
                    required
                  />
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
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Status</label>
                  <select className="kline-input" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                    {callStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="kline-card" style={{ padding: '1.6rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, color: 'var(--kline-text)' }}>Caller and routing</h3>
                <p style={{ margin: '0.35rem 0 0', color: 'var(--kline-text-light)' }}>Capture who called, the service context, and where office should route the follow-up first.</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Caller Name</label>
                  <input className="kline-input" value={form.callerNameRaw} onChange={(event) => setForm((current) => ({ ...current, callerNameRaw: event.target.value }))} placeholder="Caller name if known" />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Phone Number</label>
                  <input className="kline-input" value={form.phoneNumber} onChange={(event) => setForm((current) => ({ ...current, phoneNumber: event.target.value }))} placeholder="609-555-0000" />
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
                  <select
                    className="kline-input"
                    value={form.assignedToUserId}
                    onChange={(event) => setForm((current) => ({ ...current, assignedToUserId: event.target.value }))}
                  >
                    <option value="">Route to default office intake owner</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.email}
                      </option>
                    ))}
                  </select>
                  <p style={{ margin: '0.45rem 0 0', color: 'var(--kline-text-light)' }}>
                    Leave this on default when the voicemail or missed call does not clearly belong to one office person.
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Detected Address</label>
                  <input className="kline-input" value={form.detectedAddress} onChange={(event) => setForm((current) => ({ ...current, detectedAddress: event.target.value }))} placeholder="Street address from the message" />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Town</label>
                  <input className="kline-input" value={form.detectedTown} onChange={(event) => setForm((current) => ({ ...current, detectedTown: event.target.value }))} placeholder="Town or area" />
                </div>
              </div>
            </section>

            <section className="kline-card" style={{ padding: '1.6rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, color: 'var(--kline-text)' }}>Call content</h3>
                <p style={{ margin: '0.35rem 0 0', color: 'var(--kline-text-light)' }}>Summarize what matters, then add transcript detail and internal notes for office follow-up.</p>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Summary</label>
                <textarea
                  className="kline-input"
                  rows={4}
                  value={form.summary}
                  onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
                  placeholder="Short operational summary of the call"
                  required
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Transcript / Detailed Notes</label>
                <textarea
                  className="kline-input"
                  rows={7}
                  value={form.transcriptRaw}
                  onChange={(event) => setForm((current) => ({ ...current, transcriptRaw: event.target.value }))}
                  placeholder="Paste the voicemail transcript or detailed call notes here"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Internal Notes</label>
                <textarea
                  className="kline-input"
                  rows={4}
                  value={form.internalNotes}
                  onChange={(event) => setForm((current) => ({ ...current, internalNotes: event.target.value }))}
                  placeholder="Office notes, ownership notes, or callback context"
                />
              </div>
            </section>
          </div>

          <aside style={{ display: 'grid', gap: '1rem', alignContent: 'start' }}>
            <section className="kline-card" style={{ padding: '1.35rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button className="kline-btn-primary" type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Call Record'}
                </button>
                <button className="ghost-btn" type="button" onClick={() => router.push('/calls-inbox')}>
                  Back to Inbox
                </button>
              </div>
            </section>
          </aside>
        </form>
      </main>

      <style jsx>{`
        .page-masthead {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
          padding: 1.6rem 1.7rem;
          border-radius: 24px;
          background:
            radial-gradient(circle at top right, rgba(13, 110, 253, 0.14), transparent 30%),
            linear-gradient(135deg, #ffffff 0%, #f7fbff 52%, #fff8f2 100%);
          border: 1px solid rgba(13, 110, 253, 0.12);
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
          color: #0d6efd;
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

        .intake-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.78fr);
          gap: 1rem;
        }

        @media (max-width: 980px) {
          .intake-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
