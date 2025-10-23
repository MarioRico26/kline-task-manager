'use client'
import { useState } from 'react'

interface CreateUserModalProps {
  isOpen: boolean
  onClose: () => void
  onUserCreated: () => void
}

export default function CreateUserModal({ isOpen, onClose, onUserCreated }: CreateUserModalProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'VIEWER' as 'ADMIN' | 'VIEWER'
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
        setFormData({ email: '', password: '', role: 'VIEWER' })
      } else {
        const data = await response.json()
        setError(data.error || 'Error creating user')
      }
    } catch (error) {
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
        {/* Close button */}
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