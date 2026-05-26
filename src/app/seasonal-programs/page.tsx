'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { seasonalProgramConfigs } from '@/lib/seasonalPrograms'

export default function SeasonalProgramsPage() {
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
          user?: { email?: string; canAccessSeasonalPrograms?: boolean; accessScope?: 'ALL' | 'PERMITS_ONLY' }
        }

        if (cancelled) return

        const canAccess = data.user?.canAccessSeasonalPrograms === true && data.user?.accessScope !== 'PERMITS_ONLY'
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
      { label: 'Programs', value: '3', detail: 'Irrigation, Maintenance, Pool Services' },
      { label: 'Import Scope', value: '2026', detail: 'Active operational sheets only' },
      { label: 'Security', value: 'Restricted', detail: 'Visible only to selected users' },
    ],
    []
  )

  if (authorized === null) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--kline-gray-light)' }}>
        <div className="kline-card" style={{ padding: '2rem 2.5rem', textAlign: 'center' }}>
          <h2 style={{ margin: 0, color: 'var(--kline-text)' }}>Loading Seasonal Programs…</h2>
          <p style={{ margin: '0.75rem 0 0', color: 'var(--kline-text-light)' }}>Checking access and preparing module shell.</p>
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
                SEASONAL <span>PROGRAMS</span>
              </h1>
              <p>Operational module foundation</p>
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
            <h2>Seasonal Programs</h2>
            <p className="hero-subtitle">
              Dedicated operational workspace for Irrigation, Maintenance and Pool Services, separate from general notifications.
            </p>
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {summaryCards.map((card) => (
            <div key={card.label} className="kline-card" style={{ padding: '1.4rem' }}>
              <div style={{ fontSize: '0.82rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--kline-text-light)', fontWeight: 800 }}>
                {card.label}
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 900, color: 'var(--kline-text)', marginTop: 8 }}>{card.value}</div>
              <div style={{ color: 'var(--kline-text-light)', marginTop: 6 }}>{card.detail}</div>
            </div>
          ))}
        </section>

        <section className="kline-card" style={{ padding: '1.6rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.35rem', color: 'var(--kline-text)' }}>Phase 1 is live</h3>
              <p style={{ margin: '0.4rem 0 0', color: 'var(--kline-text-light)', maxWidth: 760 }}>
                Access control and module shell are ready. Next we can add Prisma models, roster screens and 2026 import flows.
              </p>
            </div>
            <div style={{ color: 'var(--kline-text-light)', fontSize: '0.92rem' }}>
              Signed in as <strong style={{ color: 'var(--kline-text)' }}>{userEmail || 'authorized user'}</strong>
            </div>
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {seasonalProgramConfigs.map((category) => (
            <article key={category.title} className="kline-card" style={{ padding: '1.4rem', borderTop: `4px solid ${category.accent}` }}>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--kline-text)' }}>{category.title}</div>
              <p style={{ color: 'var(--kline-text-light)', margin: '0.45rem 0 1rem', lineHeight: 1.6 }}>{category.subtitle}</p>
              <ul style={{ margin: 0, paddingLeft: '1.15rem', color: 'var(--kline-text)', lineHeight: 1.8 }}>
                {category.focusAreas.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => router.push(`/seasonal-programs/${category.key}`)}
                style={{
                  marginTop: '1rem',
                  background: 'transparent',
                  border: `2px solid ${category.accent}`,
                  color: category.accent,
                  borderRadius: '999px',
                  padding: '0.65rem 1rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Open {category.title}
              </button>
            </article>
          ))}
        </section>

        <section className="kline-card" style={{ padding: '1.6rem' }}>
          <h3 style={{ marginTop: 0, color: 'var(--kline-text)' }}>Recommended next build order</h3>
          <ol style={{ margin: '0.75rem 0 0', paddingLeft: '1.2rem', color: 'var(--kline-text)', lineHeight: 1.85 }}>
            <li>Schema base for programs, seasons, enrollments, services and issues.</li>
            <li>Build the roster UI for one category first, likely Irrigation.</li>
            <li>Create the 2026 Excel import preview flow before final writes.</li>
          </ol>
        </section>
      </main>
    </div>
  )
}
