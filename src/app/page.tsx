'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Verificar si está logueado
    const userId = document.cookie
      .split('; ')
      .find(row => row.startsWith('user-id='))
      ?.split('=')[1]

    if (userId) {
      router.push('/dashboard')
    } else {
      router.push('/auth/login')
    }
  }, [router])

  return (
    <div style={{ 
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--kline-gray-light)'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '60px',
          height: '60px',
          background: 'var(--kline-red)',
          borderRadius: '8px',
          margin: '0 auto 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1.5rem' }}>K</span>
        </div>
        <p style={{ color: 'var(--kline-text-light)' }}>Redirecting...</p>
      </div>
    </div>
  )
}