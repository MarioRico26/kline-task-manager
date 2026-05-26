'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MAX_VOICEMAIL_AUDIO_BYTES } from '@/lib/callsInboxTranscription'

export default function NewVoicemailImportPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [form, setForm] = useState({
    source: 'Xfinity Voicemail Export',
    notes: '',
    rawTranscriptDump: '',
  })
  const [inputMode, setInputMode] = useState<'TRANSCRIPT' | 'AUDIO'>('TRANSCRIPT')
  const [audioFiles, setAudioFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [progressLabel, setProgressLabel] = useState('')

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setProgressLabel('')

    try {
      const createBatchRes = await fetch('/api/calls-inbox/imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: form.source,
          notes: form.notes,
          rawTranscriptDump: inputMode === 'TRANSCRIPT' ? form.rawTranscriptDump : '',
          createEmptyBatch: inputMode === 'AUDIO',
        }),
      })

      const data = (await createBatchRes.json()) as { error?: string; id?: string }
      if (!createBatchRes.ok || !data.id) {
        throw new Error(data.error || 'Unable to create voicemail import batch')
      }

      if (inputMode === 'AUDIO') {
        if (audioFiles.length === 0) {
          throw new Error('Select at least one voicemail audio file')
        }
        const oversizedFile = audioFiles.find((file) => file.size > MAX_VOICEMAIL_AUDIO_BYTES)
        if (oversizedFile) {
          throw new Error(
            `${oversizedFile.name} is too large. Keep each voicemail audio file under ${(MAX_VOICEMAIL_AUDIO_BYTES / (1024 * 1024)).toFixed(1)} MB.`
          )
        }

        for (let index = 0; index < audioFiles.length; index += 1) {
          const file = audioFiles[index]
          setProgressLabel(`Uploading voicemail ${index + 1} of ${audioFiles.length}: ${file.name}`)

          const uploadFormData = new FormData()
          uploadFormData.append('file', file)

          const uploadRes = await fetch(`/api/calls-inbox/imports/${data.id}/audio`, {
            method: 'POST',
            body: uploadFormData,
          })

          const uploadData = (await uploadRes.json()) as { error?: string; warning?: string }
          if (!uploadRes.ok) {
            throw new Error(uploadData.error || `Unable to upload ${file.name}`)
          }
        }
      }

      router.push(`/calls-inbox/imports/${data.id}`)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to create voicemail import batch')
    } finally {
      setSaving(false)
      setProgressLabel('')
    }
  }

  if (authorized === null) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--kline-gray-light)' }}>
        <div className="kline-card" style={{ padding: '2rem 2.5rem', textAlign: 'center' }}>
          <h2 style={{ margin: 0, color: 'var(--kline-text)' }}>Loading new batch import…</h2>
          <p style={{ margin: '0.75rem 0 0', color: 'var(--kline-text-light)' }}>Preparing voicemail batch intake.</p>
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
              <p>New Batch Import · stage voicemail intake safely</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
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
        <section className="page-masthead page-masthead-batch" style={{ marginBottom: '1.5rem' }}>
          <div className="page-masthead-copy">
            <p className="page-masthead-kicker">Batch intake · stage first</p>
            <h2>New Voicemail Import</h2>
            <p className="page-masthead-subtitle">
              Build the batch here, keep it safely in review, and only then decide what deserves to become a live call record.
            </p>
          </div>
        </section>

        {error && (
          <section className="kline-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', borderLeft: '5px solid #c81e1e' }}>
            <strong style={{ color: '#c81e1e' }}>{error}</strong>
          </section>
        )}

        <form onSubmit={handleSubmit} className="batch-layout">
          <section className="kline-card" style={{ padding: '1.6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--kline-text)' }}>Batch setup</h3>
                <p style={{ margin: '0.35rem 0 0', color: 'var(--kline-text-light)' }}>Choose the intake mode, name the batch, then load the content you want office to review.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={inputMode === 'TRANSCRIPT' ? 'kline-btn-primary' : 'ghost-btn'}
                  onClick={() => setInputMode('TRANSCRIPT')}
                >
                  Transcript Dump
                </button>
                <button
                  type="button"
                  className={inputMode === 'AUDIO' ? 'kline-btn-primary' : 'ghost-btn'}
                  onClick={() => setInputMode('AUDIO')}
                >
                  Audio Files
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Source</label>
                <input
                  className="kline-input"
                  value={form.source}
                  onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Batch Notes</label>
                <input
                  className="kline-input"
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Optional label, shift, or office note"
                />
              </div>
            </div>

            {inputMode === 'TRANSCRIPT' ? (
              <div style={{ marginTop: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Transcript Dump</label>
                <textarea
                  className="kline-input"
                  rows={18}
                  value={form.rawTranscriptDump}
                  onChange={(event) => setForm((current) => ({ ...current, rawTranscriptDump: event.target.value }))}
                  placeholder={`1:42 PM\nBob Agrigenis, 1214 North Atlantic, called saying the crew started opening the pool but never finished...\n\n1:50 PM\nMaria da Silva, 175 Bernard Drive, Manahawkin, requested a quote...`}
                  required={inputMode === 'TRANSCRIPT'}
                />
                <p style={{ margin: '0.5rem 0 0', color: 'var(--kline-text-light)' }}>
                  Separate each voicemail with a blank line. We will parse these into review items, not directly into the live callback queue.
                </p>
              </div>
            ) : (
              <div style={{ marginTop: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--kline-text)' }}>Voicemail Audio Files</label>
                <input
                  className="kline-input"
                  type="file"
                  accept="audio/*,.mp3,.m4a,.wav,.mp4,.aac,.ogg,.webm"
                  multiple
                  onChange={(event) => setAudioFiles(Array.from(event.target.files || []))}
                />
                <p style={{ margin: '0.5rem 0 0', color: 'var(--kline-text-light)' }}>
                  Upload voicemail audio one file at a time into the batch. Each file is processed separately to keep the live system stable. Recommended max per file:{' '}
                  {(MAX_VOICEMAIL_AUDIO_BYTES / (1024 * 1024)).toFixed(1)} MB.
                </p>
                {audioFiles.length > 0 && (
                  <ul style={{ margin: '0.75rem 0 0', color: 'var(--kline-text)', paddingLeft: '1.1rem', lineHeight: 1.7 }}>
                    {audioFiles.map((file) => (
                      <li key={`${file.name}-${file.size}`}>{file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {progressLabel && <p style={{ margin: '1rem 0 0', color: 'var(--kline-text)', fontWeight: 700 }}>{progressLabel}</p>}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
              <button className="kline-btn-primary" type="submit" disabled={saving}>
                {saving ? 'Processing…' : inputMode === 'AUDIO' ? 'Create Audio Batch' : 'Create Import Batch'}
              </button>
              <button className="ghost-btn" type="button" onClick={() => router.push('/calls-inbox/imports')}>
                Cancel
              </button>
            </div>
          </section>

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
            radial-gradient(circle at top right, rgba(25, 135, 84, 0.14), transparent 30%),
            linear-gradient(135deg, #ffffff 0%, #f6fff9 52%, #f8faff 100%);
          border: 1px solid rgba(25, 135, 84, 0.12);
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
          color: #198754;
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

        .batch-layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
        }

        @media (max-width: 980px) {
          .batch-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
