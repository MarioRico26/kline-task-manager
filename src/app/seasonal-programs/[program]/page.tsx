'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSeasonalProgramConfig } from '@/lib/seasonalPrograms'

export default function SeasonalProgramDetailPage() {
  const router = useRouter()
  const params = useParams<{ program: string }>()
  const [authorized, setAuthorized] = useState<boolean | null>(null)

  const config = useMemo(() => getSeasonalProgramConfig(params?.program || ''), [params])

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
          user?: { canAccessSeasonalPrograms?: boolean; accessScope?: 'ALL' | 'PERMITS_ONLY' }
        }

        if (cancelled) return

        const canAccess = data.user?.canAccessSeasonalPrograms === true && data.user?.accessScope !== 'PERMITS_ONLY'
        setAuthorized(canAccess)

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

  if (!config) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--kline-gray-light)' }}>
        <div className="kline-card" style={{ padding: '2rem 2.5rem', textAlign: 'center' }}>
          <h2 style={{ margin: 0, color: 'var(--kline-text)' }}>Program not found</h2>
          <p style={{ margin: '0.75rem 0 0', color: 'var(--kline-text-light)' }}>This category is not configured yet.</p>
          <button className="kline-btn-primary" style={{ marginTop: '1rem' }} onClick={() => router.push('/seasonal-programs')}>
            Back to Seasonal Programs
          </button>
        </div>
      </div>
    )
  }

  if (authorized === null) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--kline-gray-light)' }}>
        <div className="kline-card" style={{ padding: '2rem 2.5rem', textAlign: 'center' }}>
          <h2 style={{ margin: 0, color: 'var(--kline-text)' }}>Loading {config.title}…</h2>
          <p style={{ margin: '0.75rem 0 0', color: 'var(--kline-text-light)' }}>Checking access and preparing the category shell.</p>
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
                {config.title.toUpperCase()} <span>PROGRAM</span>
              </h1>
              <p>{config.subtitle}</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="ghost-btn" onClick={() => router.push('/seasonal-programs')}>
              Seasonal Programs
            </button>
            <button className="ghost-btn" onClick={() => router.push('/dashboard')}>
              Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <section className="hero" style={{ marginBottom: '1.75rem' }}>
          <div>
            <p className="hero-overline">Category Shell</p>
            <h2>{config.title}</h2>
            <p className="hero-subtitle">{config.summary}</p>
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="kline-card" style={{ padding: '1.4rem', borderTop: `4px solid ${config.accent}` }}>
            <h3 style={{ marginTop: 0, color: 'var(--kline-text)' }}>Focus areas</h3>
            <ul style={{ margin: '0.65rem 0 0', paddingLeft: '1.15rem', color: 'var(--kline-text)', lineHeight: 1.8 }}>
              {config.focusAreas.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="kline-card" style={{ padding: '1.4rem', borderTop: `4px solid ${config.accent}` }}>
            <h3 style={{ marginTop: 0, color: 'var(--kline-text)' }}>Operational examples</h3>
            <ul style={{ margin: '0.65rem 0 0', paddingLeft: '1.15rem', color: 'var(--kline-text)', lineHeight: 1.8 }}>
              {config.examples.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="kline-card" style={{ padding: '1.6rem' }}>
          <h3 style={{ marginTop: 0, color: 'var(--kline-text)' }}>What comes next for {config.title}</h3>
          <ol style={{ margin: '0.75rem 0 0', paddingLeft: '1.2rem', color: 'var(--kline-text)', lineHeight: 1.9 }}>
            <li>Create Prisma-backed roster entities for the category.</li>
            <li>Build the roster table and enrollment detail screen.</li>
            <li>Add import preview for the active 2026 workbook sheet.</li>
          </ol>
        </section>
      </main>
    </div>
  )
}
