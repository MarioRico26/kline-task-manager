'use client'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const router = useRouter()

  const handleLogout = () => {
    document.cookie = 'user-id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    // ✅ Esto SÍ funciona - recarga todo el contexto
    window.location.href = '/auth/login'
  }

  const crudCards = [
    {
      title: 'Users',
      description: 'Manage system users and permissions',
      count: '12',
      route: '/users',
      color: 'var(--kline-red)'
    },
    {
      title: 'Services',
      description: 'Manage available services',
      count: '8',
      route: '/services', 
      color: 'var(--kline-yellow)'
    },
    {
      title: 'Customers',
      description: 'Manage customer information',
      count: '45',
      route: '/customers',
      color: 'var(--kline-blue)'
    },
    {
      title: 'Tasks',
      description: 'Manage and track tasks',
      count: '23',
      route: '/tasks',
      color: 'var(--kline-green)'
    }
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--kline-gray-light)' }}>
      {/* Header */}
      <header className="kline-header" style={{ padding: '1rem 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--kline-text)' }}>
              Dashboard <span className="kline-accent">Overview</span>
            </h1>
            <button 
              onClick={handleLogout}
              className="kline-btn-primary"
              style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {crudCards.map((card, index) => (
            <div 
              key={index}
              className="kline-card"
              style={{ 
                padding: '2rem',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                borderTop: `4px solid ${card.color}`
              }}
              onClick={() => router.push(card.route)}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-5px)'
                e.currentTarget.style.boxShadow = '0 15px 40px rgba(0, 0, 0, 0.15)'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.08)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--kline-text)' }}>
                  {card.title}
                </h3>
                <div style={{
                  background: card.color,
                  color: 'white',
                  padding: '0.5rem 0.8rem',
                  borderRadius: '20px',
                  fontSize: '0.9rem',
                  fontWeight: '700'
                }}>
                  {card.count}
                </div>
              </div>
              <p style={{ color: 'var(--kline-text-light)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                {card.description}
              </p>
              <div style={{ 
                color: card.color, 
                fontWeight: '600', 
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                Manage → 
              </div>
            </div>
          ))}
        </div>

        {/* Recent Activity Section */}
        <div className="kline-card" style={{ marginTop: '2rem', padding: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem', color: 'var(--kline-text)' }}>
            Recent Activity
          </h2>
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--kline-text-light)' }}>
            <p>Activity feed will appear here</p>
            <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Recent tasks, user actions, and system events</p>
          </div>
        </div>
      </main>
    </div>
  )
}