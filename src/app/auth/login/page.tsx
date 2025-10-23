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
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a5c36 0%, #1a7d4e 50%, #1e3a5f 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background pattern */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 0%, transparent 50%)',
        pointerEvents: 'none'
      }}></div>
      
      <div style={{ 
        maxWidth: '440px', 
        width: '100%',
        position: 'relative',
        zIndex: 10
      }}>
        {/* Main Card */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          padding: '3rem',
          boxShadow: '0 20px 60px rgba(10, 92, 54, 0.2)',
          border: '1px solid rgba(255, 255, 255, 0.3)'
        }}>
          {/* Logo Header */}
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <div style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #0a5c36, #1a7d4e)',
              borderRadius: '16px',
              margin: '0 auto 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 25px rgba(10, 92, 54, 0.3)'
            }}>
              <span style={{ 
                color: 'white', 
                fontWeight: 'bold', 
                fontSize: '2rem',
                fontFamily: 'Arial, sans-serif'
              }}>K</span>
            </div>
            <h1 style={{ 
              fontSize: '2.5rem', 
              fontWeight: '700', 
              color: '#0a5c36',
              marginBottom: '0.5rem',
              fontFamily: 'Arial, sans-serif'
            }}>
              KLINE TASKS
            </h1>
            <p style={{ 
              color: '#1e3a5f', 
              fontSize: '1.1rem',
              opacity: 0.8
            }}>
              Professional Task Management System
            </p>
          </div>
          
          {/* Login Form */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={{ 
                display: 'block', 
                color: '#1e3a5f', 
                marginBottom: '0.75rem',
                fontSize: '0.95rem',
                fontWeight: '600',
                fontFamily: 'Arial, sans-serif'
              }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                style={{
                  width: '100%',
                  padding: '1rem 1.25rem',
                  background: 'rgba(248, 249, 250, 0.8)',
                  border: '2px solid #e9ecef',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  color: '#1e3a5f',
                  transition: 'all 0.3s ease',
                  fontFamily: 'Arial, sans-serif'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#0a5c36'
                  e.target.style.background = '#ffffff'
                  e.target.style.boxShadow = '0 0 0 3px rgba(10, 92, 54, 0.1)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e9ecef'
                  e.target.style.background = 'rgba(248, 249, 250, 0.8)'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>
            
            <div>
              <label style={{ 
                display: 'block', 
                color: '#1e3a5f', 
                marginBottom: '0.75rem',
                fontSize: '0.95rem',
                fontWeight: '600',
                fontFamily: 'Arial, sans-serif'
              }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                style={{
                  width: '100%',
                  padding: '1rem 1.25rem',
                  background: 'rgba(248, 249, 250, 0.8)',
                  border: '2px solid #e9ecef',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  color: '#1e3a5f',
                  transition: 'all 0.3s ease',
                  fontFamily: 'Arial, sans-serif'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#0a5c36'
                  e.target.style.background = '#ffffff'
                  e.target.style.boxShadow = '0 0 0 3px rgba(10, 92, 54, 0.1)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e9ecef'
                  e.target.style.background = 'rgba(248, 249, 250, 0.8)'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              style={{ 
                width: '100%',
                background: 'linear-gradient(135deg, #0a5c36, #1a7d4e)',
                color: 'white',
                border: 'none',
                padding: '1.25rem 2rem',
                borderRadius: '12px',
                fontSize: '1.1rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.3s ease',
                fontFamily: 'Arial, sans-serif',
                boxShadow: '0 8px 25px rgba(10, 92, 54, 0.3)'
              }}
              onMouseOver={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 12px 30px rgba(10, 92, 54, 0.4)'
                }
              }}
              onMouseOut={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(10, 92, 54, 0.3)'
                }
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg 
                    style={{ animation: 'spin 1s linear infinite', marginRight: '0.75rem' }} 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25"/>
                    <path fill="currentColor" opacity="0.75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign in to Dashboard'
              )}
            </button>
          </form>
        </div>
        
        {/* Footer */}
        <div style={{ 
          textAlign: 'center', 
          marginTop: '2rem',
          color: 'rgba(255, 255, 255, 0.8)',
          fontSize: '0.9rem'
        }}>
          <p>Kline Brothers Task Management System</p>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}