'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

const sourceOptions = ['Answered Call', 'Voicemail', 'Missed Call']
const statusOptions = ['New', 'Triage Required', 'Assigned', 'Callback Pending', 'Resolved']

export default function CallsInboxPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')

  useEffect(() => {
    let cancelled = false

    async function checkAccess() {
      try {
        const res = await fetch('/api/auth/check', { cache: 'no-store' })
        if (!res.ok) {
          router.replace('/auth/login')
          return
        }

        const data = (await res.json()) as {
          user?: { email?: string; canAccessCallsInbox?: boolean; accessScope?: 'ALL' | 'PERMITS_ONLY' }
        }

        if (cancelled) return

        const canAccess = data.user?.canAccessCallsInbox === true && data.user?.accessScope !== 'PERMITS_ONLY'
        setAuthorized(canAccess)
        setUserEmail(data.user?.email || '')

        if (!canAccess) {
          router.replace(data.user?.accessScope === 'PERMITS_ONLY' ? '/tasks' : '/dashboard')
        }
      } catch {
        if (!cancelled) {
          setAuthorized(false)
          router.replace('/dashboard')
        }
      }
    }

    checkAccess()

    return () => {
      cancelled = true
    }
  }, [router])

  const summaryCards = useMemo(
    () => [
      { label: 'Default Owner', value: 'Office Intake', detail: 'Ambiguous inbound calls route here first' },
      { label: 'Sources', value: '3', detail: 'Answered calls, voicemails and missed calls' },
      { label: 'Readiness', value: 'Voicemail Ready', detail: 'Prepared for transcript and recording intake' },
    ],
    []
  )

  if (authorized === null) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--kline-gray-light)' }}>
        <div className="kline-card" style={{ padding: '2rem 2.5rem', textAlign: 'center' }}>
          <h2 style={{ margin: 0, color: 'var(--kline-text)' }}>Loading Calls Inbox…</h2>
          <p style={{ margin: '0.75rem 0 0', color: 'var(--kline-text-light)' }}>Checking access and preparing the callback workflow shell.</p>
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
                CALLS <span>INBOX</span>
              </h1>
              <p>Callbacks, voicemails and office follow-up</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="ghost-btn" onClick={() => router.push('/dashboard')}>
              Dashboard
            </button>
            <button className="ghost-btn" onClick={() => router.push('/tasks')}>
              Task Management
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <section className="hero" style={{ marginBottom: '1.75rem' }}>
          <div>
            <p className="hero-overline">Restricted Module</p>
            <h2>Calls Inbox</h2>
            <p className="hero-subtitle">
              Operational inbox for answered calls, missed calls, voicemails, assignment ownership and callback accountability.
            </p>
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {summaryCards.map((card) => (
            <div key={card.label} className="kline-card" style={{ padding: '1.4rem' }}>
              <div style={{ fontSize: '0.82rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--kline-text-light)', fontWeight: 800 }}>
                {card.label}
              </div>
              <div style={{ fontSize: '1.7rem', fontWeight: 900, color: 'var(--kline-text)', marginTop: 8 }}>{card.value}</div>
              <div style={{ color: 'var(--kline-text-light)', marginTop: 6 }}>{card.detail}</div>
            </div>
          ))}
        </section>

        <section className="kline-card" style={{ padding: '1.6rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.35rem', color: 'var(--kline-text)' }}>Phase 1 shell is ready</h3>
              <p style={{ margin: '0.4rem 0 0', color: 'var(--kline-text-light)', maxWidth: 760 }}>
                Next we can add manual call records, assignment rules, callback attempts and voicemail transcript storage without touching the current task workflows.
              </p>
            </div>
            <div style={{ color: 'var(--kline-text-light)', fontSize: '0.92rem' }}>
              Signed in as <strong style={{ color: 'var(--kline-text)' }}>{userEmail || 'authorized user'}</strong>
            </div>
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <article className="kline-card" style={{ padding: '1.4rem', borderTop: '4px solid #7c3aed' }}>
            <h3 style={{ marginTop: 0, color: 'var(--kline-text)' }}>Supported intake types</h3>
            <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.15rem', lineHeight: 1.8, color: 'var(--kline-text)' }}>
              {sourceOptions.map((option) => (
                <li key={option}>{option}</li>
              ))}
            </ul>
          </article>

          <article className="kline-card" style={{ padding: '1.4rem', borderTop: '4px solid #7c3aed' }}>
            <h3 style={{ marginTop: 0, color: 'var(--kline-text)' }}>Default statuses</h3>
            <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.15rem', lineHeight: 1.8, color: 'var(--kline-text)' }}>
              {statusOptions.map((option) => (
                <li key={option}>{option}</li>
              ))}
            </ul>
          </article>

          <article className="kline-card" style={{ padding: '1.4rem', borderTop: '4px solid #7c3aed' }}>
            <h3 style={{ marginTop: 0, color: 'var(--kline-text)' }}>Assignment policy</h3>
            <p style={{ margin: '0.75rem 0 0', lineHeight: 1.75, color: 'var(--kline-text-light)' }}>
              Voicemails or missed calls without a clear owner should route to the configured office intake owner first, then be reassigned internally with an email notification to the new assignee.
            </p>
          </article>
        </section>

        <section className="kline-card" style={{ padding: '1.6rem' }}>
          <h3 style={{ marginTop: 0, color: 'var(--kline-text)' }}>Recommended next build order</h3>
          <ol style={{ margin: '0.75rem 0 0', paddingLeft: '1.2rem', color: 'var(--kline-text)', lineHeight: 1.85 }}>
            <li>Create the Prisma domain for call records, callback attempts and activity history.</li>
            <li>Build manual intake for answered calls and voicemails.</li>
            <li>Add reassignment emails and voicemail transcript readiness.</li>
          </ol>
        </section>
      </main>
    </div>
  )
}
