'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatEnumLabel, VoicemailImportBatchRecord, VoicemailImportsListApiResponse } from '@/lib/callsInbox'

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getBatchStatusColor(status: string) {
  switch (status) {
    case 'COMPLETED':
      return '#198754'
    case 'READY_TO_PROMOTE':
      return '#0d6efd'
    case 'PARTIALLY_PROMOTED':
      return '#fd7e14'
    case 'REVIEW_IN_PROGRESS':
      return '#7c3aed'
    default:
      return '#6c757d'
  }
}

export default function VoicemailImportsPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [batches, setBatches] = useState<VoicemailImportBatchRecord[]>([])
  const [moduleReady, setModuleReady] = useState(true)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
          user?: {
            canAccessCallsInbox?: boolean
            canAccessVoicemailImports?: boolean
            accessScope?: 'ALL' | 'PERMITS_ONLY'
          }
        }

        if (cancelled) return

        const canAccess =
          authData.user?.canAccessCallsInbox === true &&
          authData.user?.canAccessVoicemailImports === true &&
          authData.user?.accessScope !== 'PERMITS_ONLY'
        setAuthorized(canAccess)

        if (!canAccess) {
          router.replace(
            authData.user?.accessScope === 'PERMITS_ONLY'
              ? '/tasks'
              : authData.user?.canAccessCallsInbox
                ? '/calls-inbox'
                : '/dashboard'
          )
          return
        }

        const importsRes = await fetch('/api/calls-inbox/imports', { cache: 'no-store' })
        const importsData = (await importsRes.json()) as VoicemailImportsListApiResponse | { error?: string }

        if (cancelled) return

        if (!importsRes.ok) {
          throw new Error(('error' in importsData && importsData.error) || 'Unable to load voicemail imports')
        }

        const payload = importsData as VoicemailImportsListApiResponse
        setBatches(payload.batches)
        setModuleReady(payload.moduleReady)
        setMessage(payload.message || '')
      } catch (bootstrapError) {
        if (!cancelled) {
          setError(bootstrapError instanceof Error ? bootstrapError.message : 'Unable to load voicemail imports')
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
  }, [router])

  const summary = useMemo(
    () => ({
      batches: batches.length,
      readyBatches: batches.filter((batch) => batch.counts.readyToCreate > 0).length,
      review: batches.reduce((sum, batch) => sum + batch.counts.reviewRequired, 0),
      ready: batches.reduce((sum, batch) => sum + batch.counts.readyToCreate, 0),
      created: batches.reduce((sum, batch) => sum + batch.counts.created, 0),
      duplicate: batches.reduce((sum, batch) => sum + batch.counts.duplicate, 0),
    }),
    [batches]
  )

  const summaryCards = [
    {
      label: 'Batches',
      value: summary.batches,
      detail: 'Imports created for office review',
      accent: '#1f2937',
    },
    {
      label: 'Review Required',
      value: summary.review,
      detail: 'Items still waiting for cleanup',
      accent: '#7c3aed',
    },
    {
      label: 'Ready to Create',
      value: summary.ready,
      detail: 'Items clean enough to promote',
      accent: '#0d6efd',
    },
    {
      label: 'Promoted',
      value: summary.created,
      detail: 'Voicemails already in live inbox',
      accent: '#198754',
    },
    {
      label: 'Duplicates',
      value: summary.duplicate,
      detail: 'Items parked as duplicate or noise',
      accent: '#fd7e14',
    },
    {
      label: 'Ready Batches',
      value: summary.readyBatches,
      detail: 'Batch queues with promotable items',
      accent: '#1f2937',
    },
  ]

  if (authorized === null || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--kline-gray-light)' }}>
        <div className="kline-card" style={{ padding: '2rem 2.5rem', textAlign: 'center' }}>
          <h2 style={{ margin: 0, color: 'var(--kline-text)' }}>Loading voicemail imports…</h2>
          <p style={{ margin: '0.75rem 0 0', color: 'var(--kline-text-light)' }}>Preparing the batch intake workflow.</p>
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
              <p>Voicemail Imports · batch intake and review</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="ghost-btn" onClick={() => router.push('/calls-inbox')}>
              Calls Inbox
            </button>
            <button className="ghost-btn" onClick={() => router.push('/calls-inbox/new')}>
              Manual Intake
            </button>
            <button className="kline-btn-primary" onClick={() => router.push('/calls-inbox/imports/new')}>
              + New Batch Import
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        {!moduleReady && (
          <section className="kline-card" style={{ padding: '1.2rem 1.4rem', marginBottom: '1.25rem', borderLeft: '5px solid #fd7e14' }}>
            <strong style={{ color: 'var(--kline-text)' }}>Database activation pending.</strong>
            <p style={{ margin: '0.45rem 0 0', color: 'var(--kline-text-light)' }}>{message || 'Voicemail import tables still need activation.'}</p>
          </section>
        )}

        {error && (
          <section className="kline-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', borderLeft: '5px solid #c81e1e' }}>
            <strong style={{ color: '#c81e1e' }}>{error}</strong>
          </section>
        )}

        <section className="page-masthead page-masthead-imports" style={{ marginBottom: '1.5rem' }}>
          <div className="page-masthead-copy">
            <p className="page-masthead-kicker">Batch workflow · clean before live</p>
            <h2>Voicemail Imports</h2>
            <p className="page-masthead-subtitle">
              Voicemails should land here first, get cleaned in batch, and only then promote polished records into the live Calls Inbox.
            </p>
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          {summaryCards.map((card) => (
            <div key={card.label} className="kline-card" style={{ padding: '1.3rem', borderTop: `4px solid ${card.accent}` }}>
              <div style={{ fontSize: '0.82rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--kline-text-light)', fontWeight: 800 }}>{card.label}</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: card.accent, marginTop: 8 }}>{card.value}</div>
              <div style={{ color: 'var(--kline-text-light)', marginTop: 6 }}>{card.detail}</div>
            </div>
          ))}
        </section>

        <section
          className="kline-card"
          style={{
            padding: '1.2rem 1.35rem',
            marginBottom: '1.25rem',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.98), rgba(245,247,255,0.98))',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, color: 'var(--kline-text)' }}>Import pressure</h3>
              <p style={{ margin: '0.35rem 0 0', color: 'var(--kline-text-light)' }}>
                {summary.ready > 0
                  ? `${summary.ready} voicemail items are ready to promote across ${summary.readyBatches} batch${summary.readyBatches === 1 ? '' : 'es'}.`
                  : 'No voicemail items are currently waiting on promotion.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ padding: '0.42rem 0.8rem', borderRadius: 999, background: 'rgba(124, 58, 237, 0.12)', color: '#7c3aed', fontWeight: 800 }}>
                {summary.review} in review
              </span>
              <span style={{ padding: '0.42rem 0.8rem', borderRadius: 999, background: 'rgba(13, 110, 253, 0.12)', color: '#0d6efd', fontWeight: 800 }}>
                {summary.ready} ready
              </span>
              <span style={{ padding: '0.42rem 0.8rem', borderRadius: 999, background: 'rgba(25, 135, 84, 0.12)', color: '#198754', fontWeight: 800 }}>
                {summary.created} promoted
              </span>
            </div>
          </div>
        </section>

        <section className="kline-card" style={{ padding: '1.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, color: 'var(--kline-text)' }}>Import queue</h3>
              <p style={{ margin: '0.4rem 0 0', color: 'var(--kline-text-light)' }}>
                Review batches by exception first, then move into ready-to-create work.
              </p>
            </div>
            <button className="ghost-btn" type="button" onClick={() => window.location.reload()}>
              Refresh
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--kline-gray)' }}>
                  <th style={{ padding: '0.8rem 0.75rem' }}>Batch</th>
                  <th style={{ padding: '0.8rem 0.75rem' }}>Uploaded</th>
                  <th style={{ padding: '0.8rem 0.75rem' }}>Status</th>
                  <th style={{ padding: '0.8rem 0.75rem' }}>Items</th>
                  <th style={{ padding: '0.8rem 0.75rem' }}>Ready</th>
                  <th style={{ padding: '0.8rem 0.75rem' }}>Created</th>
                  <th style={{ padding: '0.8rem 0.75rem' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => {
                  const color = getBatchStatusColor(batch.status)
                  return (
                    <tr key={batch.id} style={{ borderBottom: '1px solid rgba(15, 23, 42, 0.08)' }}>
                      <td style={{ padding: '0.9rem 0.75rem' }}>
                        <div style={{ fontWeight: 800, color: 'var(--kline-text)' }}>{batch.source}</div>
                        <div style={{ color: 'var(--kline-text-light)', marginTop: 4 }}>{batch.notes || batch.id}</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                          {batch.counts.reviewRequired > 0 && (
                            <span style={{ padding: '0.22rem 0.55rem', borderRadius: 999, background: 'rgba(124, 58, 237, 0.10)', color: '#5b21b6', fontSize: '0.82rem', fontWeight: 700 }}>
                              {batch.counts.reviewRequired} needs review
                            </span>
                          )}
                          {batch.counts.readyToCreate > 0 && (
                            <span style={{ padding: '0.22rem 0.55rem', borderRadius: 999, background: 'rgba(13, 110, 253, 0.10)', color: '#0d6efd', fontSize: '0.82rem', fontWeight: 700 }}>
                              {batch.counts.readyToCreate} ready
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '0.9rem 0.75rem', color: 'var(--kline-text)' }}>
                        {formatDateTime(batch.uploadedAt)}
                        <div style={{ color: 'var(--kline-text-light)', fontSize: '0.92rem', marginTop: 4 }}>
                          by {batch.uploadedByUser?.email || 'Unknown user'}
                        </div>
                      </td>
                      <td style={{ padding: '0.9rem 0.75rem' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            borderRadius: 999,
                            padding: '0.35rem 0.75rem',
                            fontWeight: 800,
                            color,
                            background: `${color}14`,
                          }}
                        >
                          {formatEnumLabel(batch.status)}
                        </span>
                      </td>
                      <td style={{ padding: '0.9rem 0.75rem', color: 'var(--kline-text)' }}>{batch.itemCount}</td>
                      <td style={{ padding: '0.9rem 0.75rem', color: 'var(--kline-text)' }}>{batch.counts.readyToCreate}</td>
                      <td style={{ padding: '0.9rem 0.75rem', color: 'var(--kline-text)' }}>{batch.counts.created}</td>
                      <td style={{ padding: '0.9rem 0.75rem' }}>
                        <button className="ghost-btn" onClick={() => router.push(`/calls-inbox/imports/${batch.id}`)}>
                          Review Batch
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {batches.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '2rem 0.75rem', color: 'var(--kline-text-light)' }}>
                      No voicemail import batches yet. Start with a new batch import and paste your voicemail transcript dump.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <style jsx>{`
        .page-masthead {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
          padding: 1.6rem 1.7rem;
          border-radius: 24px;
          background:
            radial-gradient(circle at top right, rgba(13, 110, 253, 0.16), transparent 30%),
            linear-gradient(135deg, #ffffff 0%, #f7fbff 55%, #f7f3ff 100%);
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

      `}</style>
    </div>
  )
}
