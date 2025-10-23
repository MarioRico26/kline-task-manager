'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      
      if (res.ok) {
        router.push('/dashboard')
      } else {
        alert('Invalid credentials')
      }
    } catch (error) {
      alert('Server error - please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="kline-gradient-bg" style={{ 
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      position: 'relative'
    }}>
      <div style={{ maxWidth: '440px', width: '100%' }}>
        <div className="kline-card" style={{ padding: '3rem' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <div style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, var(--kline-blue), var(--kline-green))',
              borderRadius: '16px',
              margin: '0 auto 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ color: 'white', fontWeight: 'bold', fontSize: '2rem' }}>K</span>
            </div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '700', marginBottom: '0.5rem' }} className="kline-text-gradient">
              KLINE TASKS
            </h1>
            <p style={{ color: 'var(--kline-text)', opacity: 0.8, fontSize: '1.1rem' }}>
              Professional Task Management
            </p>
          </div>
          
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
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="kline-btn-primary"
              style={{ width: '100', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Signing in...' : 'Sign in to Dashboard'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}