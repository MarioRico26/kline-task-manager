'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  formatEnumLabel,
  VoicemailImportBatchDetailApiResponse,
  VoicemailImportBatchRecord,
  VoicemailImportItemRecord,
} from '@/lib/callsInbox'

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

function getItemStatusColor(status: string) {
  switch (status) {
    case 'READY_TO_CREATE':
      return '#0d6efd'
    case 'CREATED_AS_CALL_RECORD':
      return '#198754'
    case 'DUPLICATE':
      return '#fd7e14'
    case 'SKIPPED':
      return '#6c757d'
    default:
      return '#7c3aed'
  }
}

function ReviewItemCard({
  item,
  onUpdated,
}: {
  item: VoicemailImportItemRecord
  onUpdated: () => Promise<void>
}) {
  const [reviewNotes, setReviewNotes] = useState(item.reviewNotes || '')
  const [callerNameRaw, setCallerNameRaw] = useState(item.callerNameRaw || '')
  const [phoneNumberRaw, setPhoneNumberRaw] = useState(item.phoneNumberRaw || '')
  const [summaryDraft, setSummaryDraft] = useState(item.summaryDraft || '')
  const [transcriptRaw, setTranscriptRaw] = useState(item.transcriptRaw || '')
  const [saving, setSaving] = useState(false)
  const [promoting, setPromoting] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setReviewNotes(item.reviewNotes || '')
    setCallerNameRaw(item.callerNameRaw || '')
    setPhoneNumberRaw(item.phoneNumberRaw || '')
    setSummaryDraft(item.summaryDraft || '')
    setTranscriptRaw(item.transcriptRaw || '')
  }, [item.callerNameRaw, item.phoneNumberRaw, item.reviewNotes, item.summaryDraft, item.transcriptRaw])

  async function saveStatus(status: string) {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/calls-inbox/imports/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          reviewNotes,
          callerNameRaw,
          phoneNumberRaw,
          transcriptRaw,
          summaryDraft,
          detectedAddress: item.detectedAddress,
          detectedTown: item.detectedTown,
          detectedServiceCategory: item.detectedServiceCategory,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Unable to update import item')
      await onUpdated()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update import item')
    } finally {
      setSaving(false)
    }
  }

  async function promoteItem() {
    setPromoting(true)
    setError('')
    try {
      const res = await fetch(`/api/calls-inbox/imports/items/${item.id}/promote`, {
        method: 'POST',
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Unable to promote import item')
      await onUpdated()
    } catch (promoteError) {
      setError(promoteError instanceof Error ? promoteError.message : 'Unable to promote import item')
    } finally {
      setPromoting(false)
    }
  }

  async function retryTranscription() {
    setTranscribing(true)
    setError('')
    try {
      const res = await fetch(`/api/calls-inbox/imports/items/${item.id}/transcribe`, {
        method: 'POST',
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Unable to transcribe voicemail audio')
      await onUpdated()
    } catch (transcriptionError) {
      setError(transcriptionError instanceof Error ? transcriptionError.message : 'Unable to transcribe voicemail audio')
    } finally {
      setTranscribing(false)
    }
  }

  const color = getItemStatusColor(item.status)

  return (
    <article style={{ border: '1px solid var(--kline-gray)', borderRadius: 16, padding: '1.1rem 1.2rem', background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 900, color: 'var(--kline-text)', fontSize: '1.02rem' }}>
            {item.callerNameRaw || 'Unknown caller'} · {item.phoneNumberRaw || 'No phone'}
          </div>
          <div style={{ color: 'var(--kline-text-light)', marginTop: 4 }}>
            {formatDateTime(item.recordedAt)}{item.detectedAddress ? ` · ${item.detectedAddress}` : ''}{item.detectedTown ? ` · ${item.detectedTown}` : ''}
          </div>
        </div>
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
          {formatEnumLabel(item.status)}
        </span>
      </div>

      {item.audioUrl && (
        <div style={{ marginTop: '0.9rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <a className="ghost-btn" href={item.audioUrl} target="_blank" rel="noreferrer">
            Open Audio
          </a>
          <span style={{ color: 'var(--kline-text-light)' }}>
            {item.audioFileName || 'Uploaded voicemail audio'} · {formatEnumLabel(item.transcriptionStatus)}
            {item.audioSizeBytes ? ` · ${(item.audioSizeBytes / (1024 * 1024)).toFixed(2)} MB` : ''}
          </span>
        </div>
      )}

      <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.45rem', color: 'var(--kline-text)' }}>Caller Name</label>
          <input className="kline-input" value={callerNameRaw} onChange={(event) => setCallerNameRaw(event.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.45rem', color: 'var(--kline-text)' }}>Phone</label>
          <input className="kline-input" value={phoneNumberRaw} onChange={(event) => setPhoneNumberRaw(event.target.value)} />
        </div>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.45rem', color: 'var(--kline-text)' }}>Summary Draft</label>
        <textarea
          className="kline-input"
          rows={3}
          value={summaryDraft}
          onChange={(event) => setSummaryDraft(event.target.value)}
          placeholder="Short office summary used before promoting into the live inbox"
        />
      </div>

      <div style={{ marginTop: '1rem' }}>
        <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.45rem', color: 'var(--kline-text)' }}>Transcript</label>
        <textarea
          className="kline-input"
          rows={6}
          value={transcriptRaw}
          onChange={(event) => setTranscriptRaw(event.target.value)}
          placeholder="Transcript not available yet. You can retry transcription or paste/edit it manually here."
        />
      </div>

      {item.transcriptionError && (
        <div style={{ marginTop: '0.75rem', color: '#c81e1e', fontWeight: 700 }}>
          Transcription note: {item.transcriptionError}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
        {item.detectedServiceCategory && (
          <span
            style={{
              padding: '0.35rem 0.7rem',
              borderRadius: 999,
              background: 'rgba(13, 110, 253, 0.12)',
              color: '#0d6efd',
              fontWeight: 700,
              fontSize: '0.85rem',
            }}
          >
            {formatEnumLabel(item.detectedServiceCategory)}
          </span>
        )}
        {item.createdCallRecordId && (
          <span
            style={{
              padding: '0.35rem 0.7rem',
              borderRadius: 999,
              background: 'rgba(25, 135, 84, 0.12)',
              color: '#198754',
              fontWeight: 700,
              fontSize: '0.85rem',
            }}
          >
            Promoted to live inbox
          </span>
        )}
      </div>

      <div style={{ marginTop: '1rem' }}>
        <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.45rem', color: 'var(--kline-text)' }}>Review Notes</label>
        <textarea
          className="kline-input"
          rows={3}
          value={reviewNotes}
          onChange={(event) => setReviewNotes(event.target.value)}
          placeholder="Office cleanup note, duplicate reason, ownership hint..."
        />
      </div>

      {error && <div style={{ marginTop: '0.75rem', color: '#c81e1e', fontWeight: 700 }}>{error}</div>}

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
        <button className="ghost-btn" type="button" onClick={() => saveStatus('REVIEW_REQUIRED')} disabled={saving || promoting || transcribing}>
          {saving ? 'Saving…' : 'Keep in Review'}
        </button>
        <button className="ghost-btn" type="button" onClick={() => saveStatus('READY_TO_CREATE')} disabled={saving || promoting || transcribing}>
          Mark Ready
        </button>
        <button className="ghost-btn" type="button" onClick={() => saveStatus('DUPLICATE')} disabled={saving || promoting || transcribing}>
          Mark Duplicate
        </button>
        <button className="ghost-btn" type="button" onClick={() => saveStatus('SKIPPED')} disabled={saving || promoting || transcribing}>
          Skip
        </button>
        {item.audioUrl && (
          <button className="ghost-btn" type="button" onClick={retryTranscription} disabled={saving || promoting || transcribing}>
            {transcribing ? 'Transcribing…' : item.transcriptionStatus === 'FAILED' ? 'Retry Transcription' : 'Re-run Transcription'}
          </button>
        )}
        <button
          className="kline-btn-primary"
          type="button"
          onClick={promoteItem}
          disabled={promoting || saving || transcribing || item.status === 'CREATED_AS_CALL_RECORD'}
          style={item.status !== 'READY_TO_CREATE' && item.status !== 'CREATED_AS_CALL_RECORD' ? { opacity: 0.75 } : undefined}
        >
          {promoting ? 'Promoting…' : item.status === 'CREATED_AS_CALL_RECORD' ? 'Already Promoted' : 'Promote to Calls Inbox'}
        </button>
      </div>
    </article>
  )
}

export default function VoicemailImportBatchDetailPage() {
  const params = useParams<{ batchId: string }>()
  const router = useRouter()
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [batch, setBatch] = useState<VoicemailImportBatchRecord | null>(null)
  const [items, setItems] = useState<VoicemailImportItemRecord[]>([])
  const [moduleReady, setModuleReady] = useState(true)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadBatch = useCallback(async () => {
    const res = await fetch(`/api/calls-inbox/imports/${params.batchId}`, { cache: 'no-store' })
    const data = (await res.json()) as VoicemailImportBatchDetailApiResponse | { error?: string }
    if (!res.ok) {
      throw new Error(('error' in data && data.error) || 'Unable to load voicemail import batch')
    }
    const payload = data as VoicemailImportBatchDetailApiResponse
    setBatch(payload.batch)
    setItems(payload.items)
    setModuleReady(payload.moduleReady)
    setMessage(payload.message || '')
  }, [params.batchId])

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
          user?: {
            canAccessCallsInbox?: boolean
            canAccessVoicemailImports?: boolean
            accessScope?: 'ALL' | 'PERMITS_ONLY'
          }
        }

        if (cancelled) return

        const canAccess =
          data.user?.canAccessCallsInbox === true &&
          data.user?.canAccessVoicemailImports === true &&
          data.user?.accessScope !== 'PERMITS_ONLY'
        setAuthorized(canAccess)

        if (!canAccess) {
          router.replace(
            data.user?.accessScope === 'PERMITS_ONLY'
              ? '/tasks'
              : data.user?.canAccessCallsInbox
                ? '/calls-inbox'
                : '/dashboard'
          )
          return
        }

        await loadBatch()
      } catch (bootstrapError) {
        if (!cancelled) {
          setError(bootstrapError instanceof Error ? bootstrapError.message : 'Unable to load voicemail import batch')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    checkAccess()
    return () => {
      cancelled = true
    }
  }, [loadBatch, router])

  const counts = useMemo(
    () => ({
      review: items.filter((item) => item.status === 'REVIEW_REQUIRED').length,
      ready: items.filter((item) => item.status === 'READY_TO_CREATE').length,
      duplicates: items.filter((item) => item.status === 'DUPLICATE').length,
      created: items.filter((item) => item.status === 'CREATED_AS_CALL_RECORD').length,
    }),
    [items]
  )

  if (authorized === null || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--kline-gray-light)' }}>
        <div className="kline-card" style={{ padding: '2rem 2.5rem', textAlign: 'center' }}>
          <h2 style={{ margin: 0, color: 'var(--kline-text)' }}>Loading batch review…</h2>
          <p style={{ margin: '0.75rem 0 0', color: 'var(--kline-text-light)' }}>Preparing the voicemail batch review workflow.</p>
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
                BATCH <span>REVIEW</span>
              </h1>
              <p>Transcript cleanup before records enter the live inbox</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="ghost-btn" onClick={() => router.push('/calls-inbox/imports')}>
              Back to Imports
            </button>
            <button className="ghost-btn" onClick={() => router.push('/calls-inbox')}>
              Calls Inbox
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

        <section className="hero" style={{ marginBottom: '1.5rem' }}>
          <div>
            <p className="hero-overline">Batch Review</p>
            <h2>{batch?.source || params.batchId}</h2>
            <p className="hero-subtitle">
              {batch?.notes || 'Review each imported voicemail, clean it up, and decide whether it should become a live call record, be skipped, or be marked duplicate.'}
            </p>
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="kline-card" style={{ padding: '1.3rem' }}>
            <div style={{ fontSize: '0.82rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--kline-text-light)', fontWeight: 800 }}>Review Required</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#7c3aed', marginTop: 8 }}>{counts.review}</div>
          </div>
          <div className="kline-card" style={{ padding: '1.3rem' }}>
            <div style={{ fontSize: '0.82rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--kline-text-light)', fontWeight: 800 }}>Ready</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0d6efd', marginTop: 8 }}>{counts.ready}</div>
          </div>
          <div className="kline-card" style={{ padding: '1.3rem' }}>
            <div style={{ fontSize: '0.82rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--kline-text-light)', fontWeight: 800 }}>Created</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#198754', marginTop: 8 }}>{counts.created}</div>
          </div>
          <div className="kline-card" style={{ padding: '1.3rem' }}>
            <div style={{ fontSize: '0.82rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--kline-text-light)', fontWeight: 800 }}>Duplicates</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#fd7e14', marginTop: 8 }}>{counts.duplicates}</div>
          </div>
        </section>

        <section className="kline-card" style={{ padding: '1.4rem' }}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {items.map((item) => (
              <ReviewItemCard key={item.id} item={item} onUpdated={loadBatch} />
            ))}
            {items.length === 0 && <div style={{ color: 'var(--kline-text-light)' }}>This batch does not have any voicemail items yet.</div>}
          </div>
        </section>
      </main>
    </div>
  )
}
