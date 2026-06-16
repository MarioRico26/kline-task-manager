//kline-task-manager/src/app/users/page.tsx:
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  email: string
  role: 'ADMIN' | 'VIEWER'
  accessScope: 'ALL' | 'PERMITS_ONLY' | 'NONE'
  canAccessPlanner: boolean
  canAccessSeasonalPrograms: boolean
  canAccessCallsInbox: boolean
  canAccessVoicemailImports: boolean
  canSendCallSms: boolean
  isDefaultCallsInboxOwner: boolean
  createdAt: string
}

type PermissionBadgeTone = {
  background: string
  color: string
}

type UserAccessState = {
  email: string
  role: 'ADMIN' | 'VIEWER'
  accessScope: 'ALL' | 'PERMITS_ONLY' | 'NONE'
  canAccessPlanner: boolean
  canAccessSeasonalPrograms: boolean
  canAccessCallsInbox: boolean
  canAccessVoicemailImports: boolean
  canSendCallSms: boolean
  isDefaultCallsInboxOwner: boolean
}

function buildUserAccessState<T extends UserAccessState>(
  updates: Partial<{
    canAccessPlanner: boolean
    canAccessSeasonalPrograms: boolean
    canAccessCallsInbox: boolean
    canAccessVoicemailImports: boolean
    canSendCallSms: boolean
    isDefaultCallsInboxOwner: boolean
  }>,
  current: T
): T {
  const next = { ...current, ...updates }

  if (next.canAccessVoicemailImports) {
    next.canAccessCallsInbox = true
  }

  if (next.canSendCallSms) {
    next.canAccessCallsInbox = true
  }

  if (next.isDefaultCallsInboxOwner) {
    next.canAccessCallsInbox = true
  }

  if (!next.canAccessCallsInbox) {
    next.canAccessVoicemailImports = false
    next.canSendCallSms = false
    next.isDefaultCallsInboxOwner = false
  }

  return next as T
}

function getTaskScopeTone(accessScope: User['accessScope']): PermissionBadgeTone {
  if (accessScope === 'NONE') {
    return { background: 'rgba(13, 110, 253, 0.12)', color: '#0d6efd' }
  }

  if (accessScope === 'PERMITS_ONLY') {
    return { background: 'rgba(32, 201, 151, 0.16)', color: '#198754' }
  }

  return { background: 'rgba(108, 117, 125, 0.12)', color: '#495057' }
}

function getTaskScopeLabel(accessScope: User['accessScope']) {
  if (accessScope === 'NONE') return 'Tasks: None'
  if (accessScope === 'PERMITS_ONLY') return 'Tasks: Permits Only'
  return 'Tasks: All'
}

function getPermissionBadges(user: User) {
  const badges: Array<{ label: string; tone: PermissionBadgeTone }> = [
    {
      label: getTaskScopeLabel(user.accessScope),
      tone: getTaskScopeTone(user.accessScope),
    },
  ]

  if (user.canAccessPlanner) {
    badges.push({
      label: 'Planner',
      tone: { background: 'rgba(13, 110, 253, 0.14)', color: '#0d6efd' },
    })
  }

  if (user.canAccessSeasonalPrograms) {
    badges.push({
      label: 'Seasonal Programs',
      tone: { background: 'rgba(20, 83, 45, 0.14)', color: '#14532d' },
    })
  }

  if (user.canAccessCallsInbox) {
    badges.push({
      label: 'Calls Inbox',
      tone: { background: 'rgba(124, 58, 237, 0.14)', color: '#7c3aed' },
    })
  }

  if (user.canAccessVoicemailImports) {
    badges.push({
      label: 'Voicemail Imports',
      tone: { background: 'rgba(13, 110, 253, 0.14)', color: '#0d6efd' },
    })
  }

  if (user.canSendCallSms) {
    badges.push({
      label: 'Send Call SMS',
      tone: { background: 'rgba(220, 53, 69, 0.12)', color: '#b02a37' },
    })
  }

  if (user.isDefaultCallsInboxOwner) {
    badges.push({
      label: 'Default Intake Owner',
      tone: { background: 'rgba(25, 135, 84, 0.14)', color: '#198754' },
    })
  }

  return badges
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [resettingUser, setResettingUser] = useState<User | null>(null)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null) // 🔐 NUEVO
  const router = useRouter()

  

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users')
      if (response.ok) {
        const usersData = await response.json()
        setUsers(usersData)
      } else {
        console.error('Error fetching users')
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/check', {
          credentials: 'include',
          cache: 'no-store'
        })
  
        if (res.ok) {
          setIsAuthenticated(true)
        } else {
          setIsAuthenticated(false)
          router.push('/auth/login')
        }
      } catch {
        setIsAuthenticated(false)
        router.push('/auth/login')
      }
    }
  
    checkAuth()
  }, [router])

// ✅ Cargar datos solo cuando ya estamos seguros que hay login
useEffect(() => {
  if (isAuthenticated === true) {
    fetchUsers()
  }
}, [isAuthenticated])

// ✅ Mostrar pantalla "Checking session..." mientras no sabemos
if (isAuthenticated === null) {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
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
        <p style={{ color: 'var(--kline-text-light)' }}>Checking session...</p>
      </div>
    </div>
  )
}

// ✅ Pantalla si ya sabemos que no hay sesión
if (isAuthenticated === false) {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
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
        <p style={{ color: 'var(--kline-text-light)' }}>Redirecting to login...</p>
      </div>
    </div>
  )
}

// ✅ Mostrar loader de datos solo si ya estamos autenticados y aún cargando
if (isAuthenticated === true && loading) {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      background: 'var(--kline-gray-light)'
    }}>
      <p style={{ color: 'var(--kline-text-light)' }}>Loading users...</p>
    </div>
  )
}

  const handleLogout = () => {
    document.cookie = 'user-id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    document.cookie = 'access-scope=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    window.location.href = '/auth/login'
  }

  const handleBack = () => {
    router.back()
  }

  const handleDashboard = () => {
    router.push('/dashboard')
  }

  const handleDeleteUser = async (user: User) => {
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchUsers() // Refresh the list
        setDeletingUser(null)
      } else {
        alert('Error deleting user')
      }
    } catch {
      alert('Network error')
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <button 
                onClick={handleBack}
                style={{ 
                  background: 'transparent',
                  border: '2px solid var(--kline-text-light)',
                  color: 'var(--kline-text-light)',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  transition: 'all 0.3s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = 'var(--kline-red)'
                  e.currentTarget.style.color = 'var(--kline-red)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'var(--kline-text-light)'
                  e.currentTarget.style.color = 'var(--kline-text-light)'
                }}
              >
                ← Back
              </button>
              <h1 style={{ fontSize: '1.8rem', fontWeight: '700', color: 'var(--kline-text)' }}>
                User <span className="kline-accent">Management</span>
              </h1>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button 
                onClick={handleDashboard}
                style={{ 
                  background: 'var(--kline-yellow)',
                  border: 'none',
                  color: 'var(--kline-text)',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  transition: 'all 0.3s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'var(--kline-yellow-light)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'var(--kline-yellow)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                Dashboard
              </button>
              <button 
                onClick={handleLogout}
                className="kline-btn-primary"
                style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}
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
                  style={{ paddingLeft: '2.5rem', width: '250px', padding: '0.8rem 1rem 0.8rem 2.5rem' }}
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
                style={{ width: '150px', padding: '0.8rem 1rem' }}
              >
                <option value="ALL">All Roles</option>
                <option value="ADMIN">Admin</option>
                <option value="VIEWER">Viewer</option>
              </select>
            </div>

            {/* Add User Button */}
            <button 
              className="kline-btn-primary"
              style={{ padding: '0.8rem 1.5rem', fontSize: '0.9rem' }}
              onClick={() => setIsCreateModalOpen(true)}
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
                gridTemplateColumns: 'minmax(280px, 1.25fr) auto minmax(360px, 1.5fr) minmax(180px, auto) auto', 
                padding: '1.2rem 1.5rem',
                background: 'var(--kline-gray-light)',
                borderBottom: '2px solid var(--kline-gray)',
                fontWeight: '600',
                color: 'var(--kline-text)',
                fontSize: '0.9rem'
              }}>
                <div>User</div>
                <div>Role</div>
                <div>Permissions</div>
                <div>Calls Routing</div>
                <div>Actions</div>
              </div>

              {filteredUsers.map((user) => (
                <div 
                  key={user.id}
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'minmax(280px, 1.25fr) auto minmax(360px, 1.5fr) minmax(180px, auto) auto', 
                    padding: '1.2rem 1.5rem',
                    borderBottom: '1px solid var(--kline-gray)',
                    alignItems: 'center',
                    fontSize: '0.9rem',
                    gap: '1rem'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '600', color: 'var(--kline-text)' }}>{user.email}</div>
                    <div style={{ color: 'var(--kline-text-light)', fontSize: '0.78rem', marginTop: '0.3rem' }}>
                      Created {new Date(user.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <span 
                      style={{ 
                        padding: '0.4rem 1rem', 
                        borderRadius: '20px', 
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        background: user.role === 'ADMIN' ? 'rgba(227, 6, 19, 0.1)' : 'rgba(255, 198, 0, 0.1)',
                        color: user.role === 'ADMIN' ? 'var(--kline-red)' : 'var(--kline-text)'
                      }}
                    >
                      {user.role}
                    </span>
                  </div>
                  <div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                      {getPermissionBadges(user).map((badge) => (
                        <span
                          key={`${user.id}-${badge.label}`}
                          style={{
                            padding: '0.4rem 0.85rem',
                            borderRadius: '999px',
                            fontSize: '0.76rem',
                            fontWeight: '700',
                            letterSpacing: '0.01em',
                            background: badge.tone.background,
                            color: badge.tone.color,
                          }}
                        >
                          {badge.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span
                      style={{
                        padding: '0.4rem 1rem',
                        borderRadius: '20px',
                        fontSize: '0.78rem',
                        fontWeight: '700',
                        background: user.isDefaultCallsInboxOwner ? 'rgba(25, 135, 84, 0.14)' : 'rgba(108, 117, 125, 0.12)',
                        color: user.isDefaultCallsInboxOwner ? '#198754' : '#495057',
                      }}
                    >
                      {user.isDefaultCallsInboxOwner ? 'Default Intake Owner' : 'Standard Routing'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button
                      style={{
                        background: '#0d6efd',
                        border: 'none',
                        color: 'white',
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.8rem',
                      }}
                      onClick={() => setResettingUser(user)}
                    >
                      Reset Password
                    </button>
                    <button 
                      style={{ 
                        background: 'var(--kline-yellow)',
                        border: 'none',
                        color: 'var(--kline-text)',
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.8rem',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = 'var(--kline-yellow-light)'
                        e.currentTarget.style.transform = 'translateY(-1px)'
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'var(--kline-yellow)'
                        e.currentTarget.style.transform = 'translateY(0)'
                      }}
                      onClick={() => setEditingUser(user)}
                    >
                      Edit
                    </button>
                    <button 
                      style={{ 
                        padding: '0.5rem 1rem', 
                        fontSize: '0.8rem',
                        background: 'transparent',
                        border: '2px solid var(--kline-red)',
                        color: 'var(--kline-red)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600',
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
                      onClick={() => setDeletingUser(user)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}

              {filteredUsers.length === 0 && (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--kline-text-light)' }}>
                  {users.length === 0 ? 'No users found' : 'No users match your filters'}
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
            <div style={{ color: 'var(--kline-text-light)', fontSize: '0.9rem' }}>Total Users</div>
          </div>
          <div className="kline-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--kline-red)' }}>
              {users.filter(u => u.role === 'ADMIN').length}
            </div>
            <div style={{ color: 'var(--kline-text-light)', fontSize: '0.9rem' }}>Admin Users</div>
          </div>
          <div className="kline-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--kline-red)' }}>
              {users.filter(u => u.role === 'VIEWER').length}
            </div>
            <div style={{ color: 'var(--kline-text-light)', fontSize: '0.9rem' }}>Viewer Users</div>
          </div>
          <div className="kline-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: '#198754' }}>
              {users.filter(u => u.accessScope === 'PERMITS_ONLY').length}
            </div>
            <div style={{ color: 'var(--kline-text-light)', fontSize: '0.9rem' }}>Permits-only Users</div>
          </div>
          <div className="kline-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: '#0d6efd' }}>
              {users.filter(u => u.canAccessPlanner).length}
            </div>
            <div style={{ color: 'var(--kline-text-light)', fontSize: '0.9rem' }}>Planner Users</div>
          </div>
          <div className="kline-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: '#7c3aed' }}>
              {users.filter(u => u.canAccessCallsInbox).length}
            </div>
            <div style={{ color: 'var(--kline-text-light)', fontSize: '0.9rem' }}>Calls Inbox Users</div>
          </div>
          <div className="kline-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: '#0d6efd' }}>
              {users.filter(u => u.canAccessVoicemailImports).length}
            </div>
            <div style={{ color: 'var(--kline-text-light)', fontSize: '0.9rem' }}>Voicemail Import Users</div>
          </div>
        </div>
      </main>

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <CreateUserModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onUserCreated={fetchUsers}
        />
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onUserUpdated={fetchUsers}
        />
      )}

      {/* Reset Password Modal */}
      {resettingUser && (
        <ResetPasswordModal
          user={resettingUser}
          onClose={() => setResettingUser(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <DeleteUserModal
          user={deletingUser}
          onClose={() => setDeletingUser(null)}
          onUserDeleted={handleDeleteUser}
        />
      )}
    </div>
  )
}

// Create User Modal Component
function CreateUserModal({ isOpen, onClose, onUserCreated }: { isOpen: boolean, onClose: () => void, onUserCreated: () => void }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'VIEWER' as 'ADMIN' | 'VIEWER',
    accessScope: 'ALL' as 'ALL' | 'PERMITS_ONLY' | 'NONE',
    canAccessPlanner: false,
    canAccessSeasonalPrograms: false,
    canAccessCallsInbox: false,
    canAccessVoicemailImports: false,
    canSendCallSms: false,
    isDefaultCallsInboxOwner: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        onUserCreated()
        onClose()
        setFormData({
          email: '',
          password: '',
          role: 'VIEWER',
          accessScope: 'ALL',
          canAccessPlanner: false,
          canAccessSeasonalPrograms: false,
          canAccessCallsInbox: false,
          canAccessVoicemailImports: false,
          canSendCallSms: false,
          isDefaultCallsInboxOwner: false,
        })
      } else {
        const data = await response.json()
        setError(data.error || 'Error creating user')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="kline-card" style={{ 
        width: '90%', 
        maxWidth: '500px', 
        padding: '2rem',
        position: 'relative'
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: 'var(--kline-text-light)'
          }}
        >
          ×
        </button>

        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem', color: 'var(--kline-text)' }}>
          Create New User
        </h2>

        {error && (
          <div style={{
            background: 'rgba(227, 6, 19, 0.1)',
            border: '1px solid var(--kline-red)',
            color: 'var(--kline-red)',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
              Email Address
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="kline-input"
              placeholder="user@kline.com"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
              Password
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="kline-input"
              placeholder="Enter password"
              required
              minLength={6}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
              Role
            </label>
            <select 
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as 'ADMIN' | 'VIEWER' })}
              className="kline-input"
            >
              <option value="VIEWER">Viewer</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
              Access Scope
            </label>
            <select
              value={formData.accessScope}
              onChange={(e) => setFormData({ ...formData, accessScope: e.target.value as 'ALL' | 'PERMITS_ONLY' | 'NONE' })}
              className="kline-input"
            >
              <option value="NONE">No task access</option>
              <option value="ALL">All tasks</option>
              <option value="PERMITS_ONLY">Permits tasks only</option>
            </select>
          </div>

          <label style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', color: 'var(--kline-text)', fontWeight: '600' }}>
            <input
              type="checkbox"
              checked={formData.canAccessPlanner}
              onChange={(e) => setFormData({ ...formData, canAccessPlanner: e.target.checked })}
              style={{ marginTop: 4 }}
            />
            <span>
              Planner Access
              <span style={{ display: 'block', color: 'var(--kline-text-light)', fontSize: '0.82rem', fontWeight: 500, marginTop: 3 }}>
                Allows this user to open the planning board.
              </span>
            </span>
          </label>

          <label style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', color: 'var(--kline-text)', fontWeight: '600' }}>
            <input
              type="checkbox"
              checked={formData.canAccessCallsInbox}
              onChange={(e) => setFormData((current) => buildUserAccessState({ canAccessCallsInbox: e.target.checked }, current))}
              style={{ marginTop: 4 }}
            />
            <span>
              Calls Inbox Access
              <span style={{ display: 'block', color: 'var(--kline-text-light)', fontSize: '0.82rem', fontWeight: 500, marginTop: 3 }}>
                Allows this user to access the calls, voicemail and callback workflow module.
              </span>
            </span>
          </label>

          <label style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', color: 'var(--kline-text)', fontWeight: '600' }}>
            <input
              type="checkbox"
              checked={formData.canAccessVoicemailImports}
              onChange={(e) => setFormData((current) => buildUserAccessState({ canAccessVoicemailImports: e.target.checked }, current))}
              style={{ marginTop: 4 }}
            />
            <span>
              Voicemail Imports Access
              <span style={{ display: 'block', color: 'var(--kline-text-light)', fontSize: '0.82rem', fontWeight: 500, marginTop: 3 }}>
                Allows this user to upload, review and promote voicemail batch imports.
              </span>
            </span>
          </label>

          <label style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', color: 'var(--kline-text)', fontWeight: '600' }}>
            <input
              type="checkbox"
              checked={formData.canSendCallSms}
              onChange={(e) => setFormData((current) => buildUserAccessState({ canSendCallSms: e.target.checked }, current))}
              style={{ marginTop: 4 }}
            />
            <span>
              Send Call SMS
              <span style={{ display: 'block', color: 'var(--kline-text-light)', fontSize: '0.82rem', fontWeight: 500, marginTop: 3 }}>
                Allows this user to send outbound text replies from a call record.
              </span>
            </span>
          </label>

          <label style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', color: 'var(--kline-text)', fontWeight: '600' }}>
            <input
              type="checkbox"
              checked={formData.isDefaultCallsInboxOwner}
              onChange={(e) => setFormData((current) => buildUserAccessState({ isDefaultCallsInboxOwner: e.target.checked }, current))}
              style={{ marginTop: 4 }}
            />
            <span>
              Default Calls Intake Owner
              <span style={{ display: 'block', color: 'var(--kline-text-light)', fontSize: '0.82rem', fontWeight: 500, marginTop: 3 }}>
                New voicemails or missed calls without a clear owner will route here first.
              </span>
            </span>
          </label>

          <label style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', color: 'var(--kline-text)', fontWeight: '600' }}>
            <input
              type="checkbox"
              checked={formData.canAccessSeasonalPrograms}
              onChange={(e) => setFormData({ ...formData, canAccessSeasonalPrograms: e.target.checked })}
              style={{ marginTop: 4 }}
            />
            <span>
              Seasonal Programs Access
              <span style={{ display: 'block', color: 'var(--kline-text-light)', fontSize: '0.82rem', fontWeight: 500, marginTop: 3 }}>
                Allows this user to open the Irrigation, Maintenance and Pool operations module.
              </span>
            </span>
          </label>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '2px solid var(--kline-text-light)',
                color: 'var(--kline-text-light)',
                padding: '0.8rem 1.5rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.9rem'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="kline-btn-primary"
              style={{ padding: '0.8rem 1.5rem', fontSize: '0.9rem' }}
            >
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Edit User Modal Component
function EditUserModal({ user, onClose, onUserUpdated }: { user: User | null, onClose: () => void, onUserUpdated: () => void }) {
  const [formData, setFormData] = useState({
    email: '',
    role: 'VIEWER' as 'ADMIN' | 'VIEWER',
    accessScope: 'ALL' as 'ALL' | 'PERMITS_ONLY' | 'NONE',
    canAccessPlanner: false,
    canAccessSeasonalPrograms: false,
    canAccessCallsInbox: false,
    canAccessVoicemailImports: false,
    canSendCallSms: false,
    isDefaultCallsInboxOwner: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email,
        role: user.role,
        accessScope: user.accessScope || 'ALL',
        canAccessPlanner: user.canAccessPlanner || false,
        canAccessSeasonalPrograms: user.canAccessSeasonalPrograms || false,
        canAccessCallsInbox: user.canAccessCallsInbox || false,
        canAccessVoicemailImports: user.canAccessVoicemailImports || false,
        canSendCallSms: user.canSendCallSms || false,
        isDefaultCallsInboxOwner: user.isDefaultCallsInboxOwner || false,
      })
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        onUserUpdated()
        onClose()
      } else {
        const data = await response.json()
        setError(data.error || 'Error updating user')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="kline-card" style={{ 
        width: '90%', 
        maxWidth: '500px', 
        padding: '2rem',
        position: 'relative'
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: 'var(--kline-text-light)'
          }}
        >
          ×
        </button>

        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem', color: 'var(--kline-text)' }}>
          Edit User
        </h2>

        {error && (
          <div style={{
            background: 'rgba(227, 6, 19, 0.1)',
            border: '1px solid var(--kline-red)',
            color: 'var(--kline-red)',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
              Email Address
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="kline-input"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
              Role
            </label>
            <select 
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as 'ADMIN' | 'VIEWER' })}
              className="kline-input"
            >
              <option value="VIEWER">Viewer</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
              Access Scope
            </label>
            <select
              value={formData.accessScope}
              onChange={(e) => setFormData({ ...formData, accessScope: e.target.value as 'ALL' | 'PERMITS_ONLY' | 'NONE' })}
              className="kline-input"
            >
              <option value="NONE">No task access</option>
              <option value="ALL">All tasks</option>
              <option value="PERMITS_ONLY">Permits tasks only</option>
            </select>
          </div>

          <label style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', color: 'var(--kline-text)', fontWeight: '600' }}>
            <input
              type="checkbox"
              checked={formData.canAccessPlanner}
              onChange={(e) => setFormData({ ...formData, canAccessPlanner: e.target.checked })}
              style={{ marginTop: 4 }}
            />
            <span>
              Planner Access
              <span style={{ display: 'block', color: 'var(--kline-text-light)', fontSize: '0.82rem', fontWeight: 500, marginTop: 3 }}>
                Allows this user to open the planning board.
              </span>
            </span>
          </label>

          <label style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', color: 'var(--kline-text)', fontWeight: '600' }}>
            <input
              type="checkbox"
              checked={formData.canAccessCallsInbox}
              onChange={(e) => setFormData((current) => buildUserAccessState({ canAccessCallsInbox: e.target.checked }, current))}
              style={{ marginTop: 4 }}
            />
            <span>
              Calls Inbox Access
              <span style={{ display: 'block', color: 'var(--kline-text-light)', fontSize: '0.82rem', fontWeight: 500, marginTop: 3 }}>
                Allows this user to access the calls, voicemail and callback workflow module.
              </span>
            </span>
          </label>

          <label style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', color: 'var(--kline-text)', fontWeight: '600' }}>
            <input
              type="checkbox"
              checked={formData.canAccessVoicemailImports}
              onChange={(e) => setFormData((current) => buildUserAccessState({ canAccessVoicemailImports: e.target.checked }, current))}
              style={{ marginTop: 4 }}
            />
            <span>
              Voicemail Imports Access
              <span style={{ display: 'block', color: 'var(--kline-text-light)', fontSize: '0.82rem', fontWeight: 500, marginTop: 3 }}>
                Allows this user to upload, review and promote voicemail batch imports.
              </span>
            </span>
          </label>

          <label style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', color: 'var(--kline-text)', fontWeight: '600' }}>
            <input
              type="checkbox"
              checked={formData.canSendCallSms}
              onChange={(e) => setFormData((current) => buildUserAccessState({ canSendCallSms: e.target.checked }, current))}
              style={{ marginTop: 4 }}
            />
            <span>
              Send Call SMS
              <span style={{ display: 'block', color: 'var(--kline-text-light)', fontSize: '0.82rem', fontWeight: 500, marginTop: 3 }}>
                Allows this user to send outbound text replies from a call record.
              </span>
            </span>
          </label>

          <label style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', color: 'var(--kline-text)', fontWeight: '600' }}>
            <input
              type="checkbox"
              checked={formData.isDefaultCallsInboxOwner}
              onChange={(e) => setFormData((current) => buildUserAccessState({ isDefaultCallsInboxOwner: e.target.checked }, current))}
              style={{ marginTop: 4 }}
            />
            <span>
              Default Calls Intake Owner
              <span style={{ display: 'block', color: 'var(--kline-text-light)', fontSize: '0.82rem', fontWeight: 500, marginTop: 3 }}>
                Keeps one clear office owner for new voicemail or missed call intake.
              </span>
            </span>
          </label>

          <label style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', color: 'var(--kline-text)', fontWeight: '600' }}>
            <input
              type="checkbox"
              checked={formData.canAccessSeasonalPrograms}
              onChange={(e) => setFormData({ ...formData, canAccessSeasonalPrograms: e.target.checked })}
              style={{ marginTop: 4 }}
            />
            <span>
              Seasonal Programs Access
              <span style={{ display: 'block', color: 'var(--kline-text-light)', fontSize: '0.82rem', fontWeight: 500, marginTop: 3 }}>
                Allows this user to open the Irrigation, Maintenance and Pool operations module.
              </span>
            </span>
          </label>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '2px solid var(--kline-text-light)',
                color: 'var(--kline-text-light)',
                padding: '0.8rem 1.5rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.9rem'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="kline-btn-primary"
              style={{ padding: '0.8rem 1.5rem', fontSize: '0.9rem' }}
            >
              {loading ? 'Updating...' : 'Update User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ResetPasswordModal({ user, onClose }: { user: User | null, onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  if (!user) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Password confirmation does not match.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`/api/users/${user.id}/reset-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Error resetting password')
        return
      }

      setSuccess(`Password updated for ${user.email}.`)
      setPassword('')
      setConfirmPassword('')

      window.setTimeout(() => {
        onClose()
      }, 900)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="kline-card" style={{
        width: '90%',
        maxWidth: '520px',
        padding: '2rem',
        position: 'relative'
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: 'var(--kline-text-light)'
          }}
        >
          ×
        </button>

        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.75rem', color: 'var(--kline-text)' }}>
          Reset Password
        </h2>
        <p style={{ marginBottom: '1.5rem', color: 'var(--kline-text-light)', lineHeight: 1.5 }}>
          Set a new password for <strong style={{ color: 'var(--kline-text)' }}>{user.email}</strong>. This is an admin-only action.
        </p>

        {error && (
          <div style={{
            background: 'rgba(227, 6, 19, 0.1)',
            border: '1px solid var(--kline-red)',
            color: 'var(--kline-red)',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            background: 'rgba(25, 135, 84, 0.12)',
            border: '1px solid #198754',
            color: '#198754',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1rem'
          }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
              New Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="kline-input"
              placeholder="Enter new password"
              required
              minLength={6}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="kline-input"
              placeholder="Confirm new password"
              required
              minLength={6}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '2px solid var(--kline-text-light)',
                color: 'var(--kline-text-light)',
                padding: '0.8rem 1.5rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.9rem'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="kline-btn-primary"
              style={{ padding: '0.8rem 1.5rem', fontSize: '0.9rem' }}
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Delete Confirmation Modal
function DeleteUserModal({ user, onClose, onUserDeleted }: { user: User | null, onClose: () => void, onUserDeleted: (user: User) => void }) {
  if (!user) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="kline-card" style={{ 
        width: '90%', 
        maxWidth: '500px', 
        padding: '2rem',
        position: 'relative'
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: 'var(--kline-text-light)'
          }}
        >
          ×
        </button>

        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--kline-text)' }}>
          Confirm Delete
        </h2>

        <p style={{ marginBottom: '2rem', color: 'var(--kline-text)', lineHeight: '1.5' }}>
          Are you sure you want to delete user <strong>{user.email}</strong>? This action cannot be undone.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '2px solid var(--kline-text-light)',
              color: 'var(--kline-text-light)',
              padding: '0.8rem 1.5rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem'
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onUserDeleted(user)}
            style={{
              background: 'var(--kline-red)',
              border: 'none',
              color: 'white',
              padding: '0.8rem 1.5rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem',
              transition: 'all 0.3s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#c40510'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'var(--kline-red)'
            }}
          >
            Delete User
          </button>
        </div>
      </div>
    </div>
  )
}
