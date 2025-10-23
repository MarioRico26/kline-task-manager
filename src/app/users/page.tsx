'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  email: string
  role: 'ADMIN' | 'VIEWER'
  createdAt: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const router = useRouter()

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      // Esto lo implementaremos después con la API
      const mockUsers: User[] = [
        { id: '1', email: 'admin@kline.com', role: 'ADMIN', createdAt: '2024-01-01' },
        { id: '2', email: 'viewer@kline.com', role: 'VIEWER', createdAt: '2024-01-02' },
      ]
      setUsers(mockUsers)
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(filter.toLowerCase())
    const matchesRole = roleFilter === 'ALL' || user.role === roleFilter
    return matchesSearch && matchesRole
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--kline-gray-light)' }}>
      {/* Header */}
      <header className="kline-header" style={{ padding: '1rem 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
              <button 
                onClick={() => router.back()}
                className="kline-btn-secondary"
                style={{ padding: '0.5rem 1rem' }}
              >
                ← Back
              </button>
              <h1 style={{ fontSize: '1.8rem', fontWeight: '700', color: 'var(--kline-text)' }}>
                User <span className="kline-accent">Management</span>
              </h1>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button 
                onClick={() => router.push('/dashboard')}
                className="kline-btn-secondary"
              >
                Dashboard
              </button>
              <button 
                onClick={() => {/* Logout implementation */}}
                className="kline-btn-primary"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem' }}>
        {/* Action Bar */}
        <div className="kline-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Search */}
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search users..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="kline-input"
                  style={{ paddingLeft: '2.5rem', width: '250px' }}
                />
                <span style={{ 
                  position: 'absolute', 
                  left: '1rem', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: 'var(--kline-text-light)'
                }}>
                  🔍
                </span>
              </div>

              {/* Role Filter */}
              <select 
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="kline-input"
                style={{ width: '150px' }}
              >
                <option value="ALL">All Roles</option>
                <option value="ADMIN">Admin</option>
                <option value="VIEWER">Viewer</option>
              </select>
            </div>

            {/* Add User Button */}
            <button 
              className="kline-btn-primary"
              onClick={() => {/* Open create modal */}}
            >
              + New User
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="kline-card" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--kline-text-light)' }}>
              Loading users...
            </div>
          ) : (
            <>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr auto auto', 
                padding: '1rem 1.5rem',
                background: 'var(--kline-gray-light)',
                borderBottom: '2px solid var(--kline-gray)',
                fontWeight: '600',
                color: 'var(--kline-text)'
              }}>
                <div>Email</div>
                <div>Role</div>
                <div>Actions</div>
              </div>

              {filteredUsers.map((user) => (
                <div 
                  key={user.id}
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr auto auto', 
                    padding: '1rem 1.5rem',
                    borderBottom: '1px solid var(--kline-gray)',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ fontWeight: '500' }}>{user.email}</div>
                  <div>
                    <span 
                      style={{ 
                        padding: '0.25rem 0.75rem', 
                        borderRadius: '20px', 
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        background: user.role === 'ADMIN' ? 'rgba(227, 6, 19, 0.1)' : 'rgba(255, 198, 0, 0.1)',
                        color: user.role === 'ADMIN' ? 'var(--kline-red)' : 'var(--kline-text)'
                      }}
                    >
                      {user.role}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      className="kline-btn-secondary"
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                      onClick={() => {/* Edit user */}}
                    >
                      Edit
                    </button>
                    <button 
                      style={{ 
                        padding: '0.4rem 0.8rem', 
                        fontSize: '0.85rem',
                        background: 'transparent',
                        border: '1px solid var(--kline-red)',
                        color: 'var(--kline-red)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = 'var(--kline-red)'
                        e.currentTarget.style.color = 'white'
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = 'var(--kline-red)'
                      }}
                      onClick={() => {/* Delete user */}}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}

              {filteredUsers.length === 0 && (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--kline-text-light)' }}>
                  No users found
                </div>
              )}
            </>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '2rem' }}>
          <div className="kline-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--kline-red)' }}>
              {users.length}
            </div>
            <div style={{ color: 'var(--kline-text-light)' }}>Total Users</div>
          </div>
          <div className="kline-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--kline-red)' }}>
              {users.filter(u => u.role === 'ADMIN').length}
            </div>
            <div style={{ color: 'var(--kline-text-light)' }}>Admin Users</div>
          </div>
          <div className="kline-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--kline-red)' }}>
              {users.filter(u => u.role === 'VIEWER').length}
            </div>
            <div style={{ color: 'var(--kline-text-light)' }}>Viewer Users</div>
          </div>
        </div>
      </main>
    </div>
  )
}