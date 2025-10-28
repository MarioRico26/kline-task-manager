//kline-task-manager/src/app/auth/login/page.tsx:
'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// Componente principal envuelto en Suspense
function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from') || '/dashboard'

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      
      const data = await res.json()
      
      if (res.ok && data.user) {
        // ✅ SETEAR COOKIE DE SESIÓN CORRECTAMENTE
        document.cookie = `user-id=${data.user.id}; path=/; max-age=86400; SameSite=Lax` // 24 horas
        
        // ✅ REDIRIGIR A LA PÁGINA ORIGINAL O DASHBOARD
        router.push(from)
        router.refresh() // Forzar actualización del middleware
      } else {
        setError(data.error || 'Invalid credentials')
      }
    } catch (error) {
      setError('Server error - please try again')
      console.error('Login error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'var(--kline-gray-light)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{ maxWidth: '440px', width: '100%' }}>
        <div className="kline-card" style={{ padding: '3rem', position: 'relative' }}>
          {/* Accent bar */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, var(--kline-red), var(--kline-yellow))',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px'
          }}></div>
          
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '2.5rem', marginTop: '1rem' }}>
            <div style={{
              width: '80px',
              height: '80px',
              background: 'var(--kline-red)',
              borderRadius: '12px',
              margin: '0 auto 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(227, 6, 19, 0.3)'
            }}>
              <span style={{ color: 'white', fontWeight: 'bold', fontSize: '2rem' }}>K</span>
            </div>
            <h1 style={{ 
              fontSize: '2.5rem', 
              fontWeight: '700', 
              color: 'var(--kline-text)',
              marginBottom: '0.5rem'
            }}>
              KLINE <span style={{ color: 'var(--kline-red)' }}>TASKS</span>
            </h1>
            <p style={{ color: 'var(--kline-text-light)', fontSize: '1.1rem' }}>
              Professional Task Management
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              background: 'rgba(227, 6, 19, 0.1)',
              border: '1px solid var(--kline-red)',
              color: 'var(--kline-red)',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              textAlign: 'center',
              fontWeight: '600'
            }}>
              {error}
            </div>
          )}
          
          {/* Form */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.75rem', fontWeight: '600' }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="kline-input"
                disabled={loading}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.75rem', fontWeight: '600' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="kline-input"
                disabled={loading}
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="kline-btn-primary"
              style={{ 
                width: '100%', 
                opacity: loading ? 0.7 : 1,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Signing in...' : 'SIGN IN TO DASHBOARD'}
            </button>
          </form>
        </div>
        
        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--kline-text-light)' }}>
          <p>Kline Brothers Task Notification System</p>
        </div>
      </div>
    </div>
  )
}

// Componente de carga para Suspense
function LoginLoading() {
  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'var(--kline-gray-light)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{ maxWidth: '440px', width: '100%' }}>
        <div className="kline-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'var(--kline-gray)',
            borderRadius: '12px',
            margin: '0 auto 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '2rem' }}>K</span>
          </div>
          <p style={{ color: 'var(--kline-text-light)' }}>Loading...</p>
        </div>
      </div>
    </div>
  )
}

// Página principal con Suspense boundary
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  )
}