//kline-task-manager/src/app/customers/page.tsx:
'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { buildCallSmsMessage, callSmsTemplates } from '@/lib/callSmsTemplates'

interface Customer {
  id: string
  fullName: string
  email: string
  phone: string
  createdAt: string
  properties: CustomerPropertySummary[]
}

interface CustomerPropertySummary {
  id: string
  address: string
  city: string
  state: string
  zip: string
}

interface CallHistoryRecord {
  id: string
  sourceType: string
  status: string
  priority: string
  receivedAt: string
  callerNameRaw: string | null
  phoneNumber: string | null
  summary: string
  property: { id: string; address: string; city: string; state: string } | null
  relatedTask: { id: string; serviceName: string | null; statusName: string | null } | null
  assignedToUser: { id: string; email: string } | null
  latestNextFollowUpAt: string | null
  isFollowUpOverdue: boolean
  isFollowUpDueToday: boolean
  ageLabel: string
  isSlaWarning: boolean
  isSlaBreached: boolean
}

interface CustomerSmsHistoryRecord {
  id: string
  timestamp: string
  userEmail: string | null
  phoneNumber: string | null
  template: string | null
  additionalNote: string | null
  message: string | null
  sid: string | null
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [contactFilter, setContactFilter] = useState<'ALL' | 'EMAIL' | 'PHONE' | 'BOTH'>('ALL')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [canAccessCallsInbox, setCanAccessCallsInbox] = useState(false)
  const [canSendCallSms, setCanSendCallSms] = useState(false)
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null)
  const [historyRecords, setHistoryRecords] = useState<CallHistoryRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const router = useRouter()

  // ✅ Con middleware, solo cargamos data
useEffect(() => {
  fetchCustomers()
  fetchAuthState()
}, [])

  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/customers')
      if (response.ok) {
        const customersData = await response.json()
        setCustomers(customersData)
      } else {
        console.error('Error fetching customers')
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAuthState = async () => {
    try {
      const response = await fetch('/api/auth/check', { cache: 'no-store' })
      if (!response.ok) return
      const data = (await response.json()) as {
        user?: { canAccessCallsInbox?: boolean; accessScope?: 'ALL' | 'PERMITS_ONLY'; canSendCallSms?: boolean }
      }
      setCanAccessCallsInbox(data.user?.canAccessCallsInbox === true && data.user?.accessScope !== 'PERMITS_ONLY')
      setCanSendCallSms(data.user?.canSendCallSms === true)
    } catch (error) {
      console.error('Error checking calls access:', error)
    }
  }

  const loadCustomerCallHistory = async (customer: Customer) => {
    setHistoryCustomer(customer)
    setHistoryLoading(true)
    setHistoryError('')
    setHistoryRecords([])

    try {
      const response = await fetch(`/api/customers/${customer.id}/calls`, { cache: 'no-store' })
      const data = (await response.json()) as { records?: CallHistoryRecord[]; error?: string }
      if (!response.ok) {
        throw new Error(data.error || 'Unable to load customer call history')
      }
      setHistoryRecords(data.records || [])
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : 'Unable to load customer call history')
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleLogout = () => {
    document.cookie = 'user-id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    window.location.href = '/auth/login'
  }

  const handleBack = () => {
    router.back()
  }

  const handleDashboard = () => {
    router.push('/dashboard')
  }

  const handleDeleteCustomer = async (customer: Customer) => {
    try {
      const response = await fetch(`/api/customers/${customer.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchCustomers()
        setDeletingCustomer(null)
      } else {
        alert('Error deleting customer')
      }
    } catch (error) {
      alert('Network error')
    }
  }

  // 🔐 SI NO ESTÁ AUTENTICADO, MOSTRAR LOADING
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

  const query = filter.toLowerCase().trim()
  const filteredCustomers = customers.filter((customer) => {
    const matchesQuery =
      !query ||
      customer.fullName.toLowerCase().includes(query) ||
      customer.email.toLowerCase().includes(query) ||
      customer.phone.includes(query)

    if (!matchesQuery) return false

    const hasEmail = Boolean(customer.email?.trim())
    const hasPhone = Boolean(customer.phone?.trim())

    if (contactFilter === 'EMAIL') return hasEmail
    if (contactFilter === 'PHONE') return hasPhone
    if (contactFilter === 'BOTH') return hasEmail && hasPhone
    return true
  })

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return phone;
  }

  const formatPropertyLabel = (property: CustomerPropertySummary) =>
    `${property.address}, ${property.city}, ${property.state} ${property.zip}`

  const formatEnumLabel = (value: string) =>
    value
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')

  const formatCallDate = (value: string | null) => {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--kline-gray-light)' }}>
      {/* Header */}
      <header className="kline-header" style={{ padding: '1rem 0' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1rem' }}>
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
                Customer <span className="kline-accent">Management</span>
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
      <main style={{ maxWidth: '1280px', margin: '1.6rem auto', padding: '0 1rem' }}>
        {/* Action Bar */}
        <div className="kline-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Search */}
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="kline-input"
                  style={{ paddingLeft: '2.5rem', width: '300px', padding: '0.8rem 1rem 0.8rem 2.5rem' }}
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
              <select
                className="kline-input"
                value={contactFilter}
                onChange={(e) => setContactFilter(e.target.value as 'ALL' | 'EMAIL' | 'PHONE' | 'BOTH')}
                style={{ width: '220px' }}
              >
                <option value="ALL">All contacts</option>
                <option value="EMAIL">Has email</option>
                <option value="PHONE">Has phone</option>
                <option value="BOTH">Has email + phone</option>
              </select>

              {/* View Mode Toggle */}
              <div style={{ display: 'flex', background: 'var(--kline-gray)', borderRadius: '8px', padding: '4px' }}>
                <button
                  onClick={() => setViewMode('table')}
                  style={{
                    padding: '0.6rem 1rem',
                    background: viewMode === 'table' ? 'var(--kline-white)' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.8rem',
                    color: viewMode === 'table' ? 'var(--kline-text)' : 'var(--kline-text-light)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Table
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  style={{
                    padding: '0.6rem 1rem',
                    background: viewMode === 'cards' ? 'var(--kline-white)' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.8rem',
                    color: viewMode === 'cards' ? 'var(--kline-text)' : 'var(--kline-text-light)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Cards
                </button>
              </div>
            </div>

            {/* Add Customer Button */}
            <button 
              className="kline-btn-primary"
              style={{ padding: '0.8rem 1.5rem', fontSize: '0.9rem' }}
              onClick={() => setIsCreateModalOpen(true)}
            >
              + New Customer
            </button>
          </div>
          <div style={{ marginTop: '0.75rem', color: 'var(--kline-text-light)', fontSize: '0.84rem', fontWeight: 600 }}>
            Showing {filteredCustomers.length} of {customers.length} customers
          </div>
        </div>

        {/* Customers Content */}
        {loading ? (
          <div className="kline-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--kline-text-light)' }}>
            Loading customers...
          </div>
        ) : viewMode === 'table' ? (
          /* TABLE VIEW */
          <div className="kline-card" style={{ overflow: 'hidden' }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1.6fr 2fr 1.35fr 2fr auto', 
              padding: '1.2rem 1.5rem',
              background: 'var(--kline-gray-light)',
              borderBottom: '2px solid var(--kline-gray)',
              fontWeight: '600',
              color: 'var(--kline-text)',
              fontSize: '0.9rem'
            }}>
              <div>Name</div>
              <div>Email</div>
              <div>Phone</div>
              <div>Properties</div>
              <div>Actions</div>
            </div>

            {filteredCustomers.map((customer) => (
              <div 
                key={customer.id}
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1.6fr 2fr 1.35fr 2fr auto', 
                  padding: '1.2rem 1.5rem',
                  borderBottom: '1px solid var(--kline-gray)',
                  alignItems: 'center',
                  fontSize: '0.9rem'
                }}
              >
                <div style={{ fontWeight: '500' }}>{customer.fullName}</div>
                <div style={{ color: 'var(--kline-blue)' }}>{customer.email}</div>
                <div style={{ color: 'var(--kline-text-light)', fontFamily: 'monospace' }}>
                  {formatPhone(customer.phone)}
                </div>
                <div>
                  {customer.properties.length === 0 ? (
                    <span style={{ color: 'var(--kline-text-light)', fontSize: '0.82rem' }}>No properties yet</span>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                      {customer.properties.slice(0, 2).map((property) => (
                        <span
                          key={property.id}
                          title={formatPropertyLabel(property)}
                          style={{
                            display: 'inline-flex',
                            maxWidth: '100%',
                            padding: '0.28rem 0.62rem',
                            borderRadius: 999,
                            background: 'rgba(15, 23, 42, 0.05)',
                            color: 'var(--kline-text)',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {property.address}
                        </span>
                      ))}
                      {customer.properties.length > 2 && (
                        <span
                          style={{
                            display: 'inline-flex',
                            padding: '0.28rem 0.62rem',
                            borderRadius: 999,
                            background: 'rgba(227, 6, 19, 0.08)',
                            color: 'var(--kline-red)',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                          }}
                        >
                          +{customer.properties.length - 2} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {canAccessCallsInbox && (
                    <button
                      style={{
                        background: '#eef4ff',
                        border: '1px solid rgba(13, 110, 253, 0.2)',
                        color: '#0d6efd',
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.8rem',
                      }}
                      onClick={() => loadCustomerCallHistory(customer)}
                    >
                      Calls
                    </button>
                  )}
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
                    onClick={() => setEditingCustomer(customer)}
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
                    onClick={() => setDeletingCustomer(customer)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {filteredCustomers.length === 0 && (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--kline-text-light)' }}>
                {customers.length === 0 ? 'No customers found' : 'No customers match the active filters'}
              </div>
            )}
          </div>
        ) : (
          /* CARDS VIEW */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
            {filteredCustomers.map((customer) => (
              <div key={customer.id} className="kline-card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: '700', color: 'var(--kline-text)', marginBottom: '0.5rem' }}>
                      {customer.fullName}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--kline-text-light)' }}>📧</span>
                      <span style={{ color: 'var(--kline-blue)', fontSize: '0.9rem' }}>{customer.email}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: 'var(--kline-text-light)' }}>📞</span>
                      <span style={{ color: 'var(--kline-text-light)', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                        {formatPhone(customer.phone)}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {canAccessCallsInbox && (
                      <button
                        style={{
                          background: '#eef4ff',
                          border: '1px solid rgba(13, 110, 253, 0.2)',
                          color: '#0d6efd',
                          padding: '0.5rem 1rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '0.8rem',
                        }}
                        onClick={() => loadCustomerCallHistory(customer)}
                      >
                        Calls
                      </button>
                    )}
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
                      onClick={() => setEditingCustomer(customer)}
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
                      onClick={() => setDeletingCustomer(customer)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div style={{ color: 'var(--kline-text-light)', fontSize: '0.8rem' }}>
                  Customer since: {new Date(customer.createdAt).toLocaleDateString()}
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ color: 'var(--kline-text-light)', fontSize: '0.76rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '0.55rem' }}>
                    Linked Properties
                  </div>
                  {customer.properties.length === 0 ? (
                    <div style={{ color: 'var(--kline-text-light)', fontSize: '0.84rem' }}>No properties linked yet</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {customer.properties.slice(0, 3).map((property) => (
                        <span
                          key={property.id}
                          title={formatPropertyLabel(property)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '0.38rem 0.72rem',
                            borderRadius: 999,
                            background: 'rgba(15, 23, 42, 0.05)',
                            color: 'var(--kline-text)',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                          }}
                        >
                          {property.address}
                        </span>
                      ))}
                      {customer.properties.length > 3 && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '0.38rem 0.72rem',
                            borderRadius: 999,
                            background: 'rgba(227, 6, 19, 0.08)',
                            color: 'var(--kline-red)',
                            fontSize: '0.8rem',
                            fontWeight: 800,
                          }}
                        >
                          +{customer.properties.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {filteredCustomers.length === 0 && (
              <div className="kline-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--kline-text-light)', gridColumn: '1 / -1' }}>
                {customers.length === 0 ? 'No customers found' : 'No customers match the active filters'}
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '2rem' }}>
          <div className="kline-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--kline-red)' }}>
              {customers.length}
            </div>
            <div style={{ color: 'var(--kline-text-light)', fontSize: '0.9rem' }}>Total Customers</div>
          </div>
          <div className="kline-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--kline-red)' }}>
              {new Set(customers.map(c => c.email.split('@')[1])).size}
            </div>
            <div style={{ color: 'var(--kline-text-light)', fontSize: '0.9rem' }}>Unique Domains</div>
          </div>
          <div className="kline-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--kline-red)' }}>
              {customers.filter(c => c.phone.replace(/\D/g, '').length === 10).length}
            </div>
            <div style={{ color: 'var(--kline-text-light)', fontSize: '0.9rem' }}>Valid Phones</div>
          </div>
        </div>
      </main>

      {historyCustomer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', display: 'grid', placeItems: 'center', padding: '1rem', zIndex: 1200 }}>
          <div className="kline-card" style={{ width: 'min(980px, 100%)', maxHeight: '85vh', overflow: 'auto', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--kline-text)' }}>Call history · {historyCustomer.fullName}</h3>
                <p style={{ margin: '0.4rem 0 0', color: 'var(--kline-text-light)' }}>Recent calls, callback status and aging tied to this customer.</p>
              </div>
              <button className="ghost-btn" onClick={() => setHistoryCustomer(null)}>
                Close
              </button>
            </div>

            {historyLoading ? (
              <div style={{ padding: '2rem 0', color: 'var(--kline-text-light)' }}>Loading call history…</div>
            ) : historyError ? (
              <div style={{ padding: '1rem 1.2rem', borderLeft: '4px solid #c81e1e', background: '#fff5f5', color: '#c81e1e', borderRadius: 10 }}>{historyError}</div>
            ) : historyRecords.length === 0 ? (
              <div style={{ padding: '2rem 0', color: 'var(--kline-text-light)' }}>No calls linked to this customer yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: '0.9rem' }}>
                {historyRecords.map((record) => (
                  <div key={record.id} style={{ border: '1px solid var(--kline-gray)', borderRadius: 14, padding: '1rem 1.1rem', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--kline-text)' }}>{record.callerNameRaw || 'Unknown caller'}</div>
                        <div style={{ color: 'var(--kline-text-light)', marginTop: 4 }}>
                          {record.phoneNumber || 'No phone'} · {formatCallDate(record.receivedAt)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <span style={{ padding: '0.22rem 0.55rem', borderRadius: 999, background: 'rgba(13, 110, 253, 0.10)', color: '#0d6efd', fontSize: '0.8rem', fontWeight: 800 }}>
                          {formatEnumLabel(record.sourceType)}
                        </span>
                        <span style={{ padding: '0.22rem 0.55rem', borderRadius: 999, background: 'rgba(15, 23, 42, 0.06)', color: 'var(--kline-text)', fontSize: '0.8rem', fontWeight: 800 }}>
                          {formatEnumLabel(record.status)}
                        </span>
                        <span style={{ padding: '0.22rem 0.55rem', borderRadius: 999, background: `${record.isSlaBreached ? 'rgba(200, 30, 30, 0.12)' : record.isSlaWarning ? 'rgba(253, 126, 20, 0.12)' : 'rgba(25, 135, 84, 0.12)'}`, color: record.isSlaBreached ? '#c81e1e' : record.isSlaWarning ? '#fd7e14' : '#198754', fontSize: '0.8rem', fontWeight: 800 }}>
                          Age {record.ageLabel}
                        </span>
                      </div>
                    </div>
                    <div style={{ marginTop: '0.75rem', color: 'var(--kline-text)' }}>{record.summary}</div>
                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', color: 'var(--kline-text-light)', fontSize: '0.9rem' }}>
                      <span>Owner: {record.assignedToUser?.email || 'Unassigned'}</span>
                      {record.property && <span>Property: {record.property.address}</span>}
                      {record.relatedTask?.serviceName && <span>Task: {record.relatedTask.serviceName}</span>}
                      {record.latestNextFollowUpAt && (
                        <span style={{ color: record.isFollowUpOverdue ? '#c81e1e' : record.isFollowUpDueToday ? '#fd7e14' : 'var(--kline-text-light)', fontWeight: record.isFollowUpOverdue || record.isFollowUpDueToday ? 700 : 500 }}>
                          Follow-up: {formatCallDate(record.latestNextFollowUpAt)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Customer Modal */}
      {isCreateModalOpen && (
        <CreateCustomerModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCustomerCreated={fetchCustomers}
        />
      )}

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <EditCustomerModal
          customer={editingCustomer}
          canSendCallSms={canSendCallSms}
          onClose={() => setEditingCustomer(null)}
          onCustomerUpdated={fetchCustomers}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingCustomer && (
        <DeleteCustomerModal
          customer={deletingCustomer}
          onClose={() => setDeletingCustomer(null)}
          onCustomerDeleted={handleDeleteCustomer}
        />
      )}
    </div>
  )
}

// Create Customer Modal Component
function CreateCustomerModal({
  isOpen,
  onClose,
  onCustomerCreated
}: {
  isOpen: boolean
  onClose: () => void
  onCustomerCreated: () => void
}) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: ''
  })

  // 🔹 nueva sección para crear la primera propiedad
  const [createProperty, setCreateProperty] = useState(true)
  const [property, setProperty] = useState({
    address: '',
    city: '',
    state: '',
    zip: ''
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const validateForm = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address')
      return false
    }
    const phoneDigits = formData.phone.replace(/\D/g, '')
    if (phoneDigits.length < 10) {
      setError('Please enter a valid phone number (at least 10 digits)')
      return false
    }

    if (createProperty) {
      if (!property.address.trim() || !property.city.trim() || !property.state.trim() || !property.zip.trim()) {
        setError('Please complete the property address (address, city, state, zip)')
        return false
      }
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!validateForm()) return

    setLoading(true)
    try {
      const payload: {
        fullName: string
        email: string
        phone: string
        property?: {
          address: string
          city: string
          state: string
          zip: string
        }
      } = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.replace(/\D/g, '')
      }

      if (createProperty) {
        payload.property = {
          address: property.address.trim(),
          city: property.city.trim(),
          state: property.state.trim(),
          zip: property.zip.trim()
        }
      }

      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        onCustomerCreated()
        onClose()
        setFormData({ fullName: '', email: '', phone: '' })
        setProperty({ address: '', city: '', state: '', zip: '' })
        setCreateProperty(true)
      } else {
        const data = await response.json()
        setError(data.error || 'Error creating customer')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, '')
    let formatted = value
    if (digits.length <= 3) formatted = digits
    else if (digits.length <= 6) formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    else formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
    setFormData({ ...formData, phone: formatted })
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="kline-card" style={{ width: '90%', maxWidth: 560, padding: '2rem', position: 'relative' }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--kline-text-light)' }}>
          ×
        </button>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--kline-text)' }}>
          Create New Customer
        </h2>

        {error && (
          <div style={{
            background: 'rgba(227,6,19,0.08)', border: '1px solid var(--kline-red)',
            color: 'var(--kline-red)', padding: '0.9rem', borderRadius: 8, marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Customer fields */}
          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: 6, fontWeight: 600 }}>
              Full Name *
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="kline-input"
              placeholder="John Doe"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: 6, fontWeight: 600 }}>
              Email Address *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="kline-input"
              placeholder="john@example.com"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: 6, fontWeight: 600 }}>
              Phone Number *
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              className="kline-input"
              placeholder="(123) 456-7890"
              required
            />
          </div>

          {/* Toggle property */}
          <div style={{ marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={createProperty}
                onChange={(e) => setCreateProperty(e.target.checked)}
              />
              <span style={{ color: 'var(--kline-text)', fontWeight: 600 }}>Create first property now</span>
            </label>
          </div>

          {/* Property fields */}
          {createProperty && (
            <div className="kline-card" style={{ padding: '1rem', border: '1px solid var(--kline-gray)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.9rem' }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: 6, fontWeight: 600 }}>
                    Address *
                  </label>
                  <input
                    type="text"
                    value={property.address}
                    onChange={(e) => setProperty({ ...property, address: e.target.value })}
                    className="kline-input"
                    placeholder="123 Main St"
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', gap: '0.9rem' }}>
                  <div>
                    <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: 6, fontWeight: 600 }}>
                      City *
                    </label>
                    <input
                      type="text"
                      value={property.city}
                      onChange={(e) => setProperty({ ...property, city: e.target.value })}
                      className="kline-input"
                      placeholder="Manahawkin"
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: 6, fontWeight: 600 }}>
                      State *
                    </label>
                    <input
                      type="text"
                      value={property.state}
                      onChange={(e) => setProperty({ ...property, state: e.target.value })}
                      className="kline-input"
                      placeholder="NJ"
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: 6, fontWeight: 600 }}>
                      ZIP *
                    </label>
                    <input
                      type="text"
                      value={property.zip}
                      onChange={(e) => setProperty({ ...property, zip: e.target.value })}
                      className="kline-input"
                      placeholder="08050"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
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
                fontWeight: 600,
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
              {loading ? 'Creating...' : 'Create Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Edit Customer Modal Component
function EditCustomerModal({ customer, canSendCallSms, onClose, onCustomerUpdated }: { 
  customer: Customer | null, 
  canSendCallSms: boolean,
  onClose: () => void, 
  onCustomerUpdated: () => void 
}) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [properties, setProperties] = useState<CustomerPropertySummary[]>([])
  const [propertyForm, setPropertyForm] = useState({
    address: '',
    city: '',
    state: '',
    zip: '',
  })
  const [propertySaving, setPropertySaving] = useState(false)
  const [propertyError, setPropertyError] = useState('')
  const [propertySuccess, setPropertySuccess] = useState('')
  const [smsForm, setSmsForm] = useState({
    phoneNumber: '',
    template: '',
    additionalNote: '',
  })
  const [sendingSms, setSendingSms] = useState(false)
  const [smsError, setSmsError] = useState('')
  const [smsSuccess, setSmsSuccess] = useState('')
  const [smsHistory, setSmsHistory] = useState<CustomerSmsHistoryRecord[]>([])
  const [smsHistoryLoading, setSmsHistoryLoading] = useState(false)
  const [smsHistoryError, setSmsHistoryError] = useState('')

  useEffect(() => {
    if (customer) {
      setFormData({
        fullName: customer.fullName,
        email: customer.email,
        phone: customer.phone
      })
      setProperties(customer.properties || [])
      setPropertyForm({
        address: '',
        city: '',
        state: '',
        zip: '',
      })
      setPropertyError('')
      setPropertySuccess('')
      setSmsForm({
        phoneNumber: customer.phone || '',
        template: '',
        additionalNote: '',
      })
      setSmsError('')
      setSmsSuccess('')
      void loadSmsHistory(customer.id)
    }
  }, [customer])

  const smsPreview = useMemo(
    () => buildCallSmsMessage(smsForm.template, smsForm.additionalNote),
    [smsForm.additionalNote, smsForm.template]
  )

  const validateForm = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address')
      return false
    }

    const phoneDigits = formData.phone.replace(/\D/g, '')
    if (phoneDigits.length < 10) {
      setError('Please enter a valid phone number (at least 10 digits)')
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customer) return

    setError('')

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`/api/customers/${customer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          phone: formData.phone.replace(/\D/g, '')
        })
      })

      if (response.ok) {
        onCustomerUpdated()
        onClose()
      } else {
        const data = await response.json()
        setError(data.error || 'Error updating customer')
      }
    } catch (error) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, '')
    let formatted = value
    
    if (digits.length <= 3) {
      formatted = digits
    } else if (digits.length <= 6) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    } else {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
    }
    
    setFormData({ ...formData, phone: formatted })
  }

  const handleAddProperty = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customer) return

    setPropertyError('')
    setPropertySuccess('')

    if (
      !propertyForm.address.trim() ||
      !propertyForm.city.trim() ||
      !propertyForm.state.trim() ||
      !propertyForm.zip.trim()
    ) {
      setPropertyError('Please complete address, city, state and zip before saving the property.')
      return
    }

    setPropertySaving(true)

    try {
      const response = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...propertyForm,
          customerId: customer.id,
        }),
      })

      const data = (await response.json().catch(() => null)) as
        | (CustomerPropertySummary & { error?: string })
        | { error?: string }
        | null

      if (!response.ok) {
        throw new Error(data && 'error' in data ? data.error || 'Error creating property' : 'Error creating property')
      }

      const createdProperty = data as CustomerPropertySummary
      setProperties((current) => [createdProperty, ...current])
      setPropertyForm({
        address: '',
        city: '',
        state: '',
        zip: '',
      })
      setPropertySuccess('Property added successfully and linked to this customer.')
      onCustomerUpdated()
    } catch (error) {
      setPropertyError(error instanceof Error ? error.message : 'Network error while creating property')
    } finally {
      setPropertySaving(false)
    }
  }

  const handleSendSms = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customer) return

    setSmsError('')
    setSmsSuccess('')

    if (!smsPreview.trim()) {
      setSmsError('Choose a template or write a short custom message first.')
      return
    }

    setSendingSms(true)

    try {
      const response = await fetch(`/api/customers/${customer.id}/send-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smsForm),
      })

      const data = (await response.json().catch(() => null)) as
        | { success?: boolean; phoneNumber?: string; error?: string }
        | null

      if (!response.ok) {
        throw new Error(data?.error || 'Unable to send SMS')
      }

      setSmsSuccess(`SMS sent to ${data?.phoneNumber || smsForm.phoneNumber}.`)
      setSmsForm((current) => ({
        ...current,
        template: '',
        additionalNote: '',
      }))
      await loadSmsHistory(customer.id)
    } catch (error) {
      setSmsError(error instanceof Error ? error.message : 'Unable to send SMS')
    } finally {
      setSendingSms(false)
    }
  }

  const loadSmsHistory = async (customerId: string) => {
    setSmsHistoryLoading(true)
    setSmsHistoryError('')

    try {
      const response = await fetch(`/api/customers/${customerId}/sms-history`, { cache: 'no-store' })
      const data = (await response.json().catch(() => null)) as
        | { records?: CustomerSmsHistoryRecord[]; error?: string }
        | null

      if (!response.ok) {
        throw new Error(data?.error || 'Unable to load SMS history')
      }

      setSmsHistory(data?.records || [])
    } catch (error) {
      setSmsHistoryError(error instanceof Error ? error.message : 'Unable to load SMS history')
    } finally {
      setSmsHistoryLoading(false)
    }
  }

  if (!customer) return null

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
        maxWidth: '960px', 
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
          Edit Customer
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

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(320px, 0.95fr)', gap: '1.5rem', alignItems: 'start' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
                Full Name *
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="kline-input"
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
                Email Address *
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
                Phone Number *
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className="kline-input"
                required
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
                {loading ? 'Updating...' : 'Update Customer'}
              </button>
            </div>
          </form>

          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ border: '1px solid var(--kline-gray)', borderRadius: '16px', padding: '1.1rem', background: 'var(--kline-gray-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.85rem' }}>
              <div>
                <div style={{ color: 'var(--kline-text)', fontWeight: 800 }}>Linked Properties</div>
                <div style={{ color: 'var(--kline-text-light)', fontSize: '0.84rem' }}>
                  {properties.length === 0 ? 'No properties linked yet' : `${properties.length} linked ${properties.length === 1 ? 'property' : 'properties'}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => window.location.href = '/properties'}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--kline-gray)',
                  color: 'var(--kline-text-light)',
                  padding: '0.55rem 0.8rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '0.8rem'
                }}
              >
                Open Properties
              </button>
            </div>

            <div style={{ display: 'grid', gap: '0.6rem', marginBottom: '1rem', maxHeight: '220px', overflowY: 'auto', paddingRight: '0.25rem' }}>
              {properties.length === 0 ? (
                <div style={{ padding: '0.9rem', borderRadius: '12px', background: '#fff', color: 'var(--kline-text-light)', fontSize: '0.86rem' }}>
                  This customer still has no linked properties.
                </div>
              ) : (
                properties.map((property) => (
                  <div key={property.id} style={{ padding: '0.85rem 0.95rem', borderRadius: '12px', background: '#fff', border: '1px solid var(--kline-gray)' }}>
                    <div style={{ fontWeight: 800, color: 'var(--kline-text)' }}>{property.address}</div>
                    <div style={{ marginTop: 4, color: 'var(--kline-text-light)', fontSize: '0.84rem' }}>
                      {property.city}, {property.state} {property.zip}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--kline-gray)', paddingTop: '1rem' }}>
              <div style={{ fontWeight: 800, color: 'var(--kline-text)', marginBottom: '0.2rem' }}>Add Property Here</div>
              <div style={{ color: 'var(--kline-text-light)', fontSize: '0.84rem', marginBottom: '0.9rem' }}>
                Quick add without leaving the customer record.
              </div>

              {propertyError && (
                <div style={{
                  background: 'rgba(227, 6, 19, 0.1)',
                  border: '1px solid var(--kline-red)',
                  color: 'var(--kline-red)',
                  padding: '0.8rem',
                  borderRadius: '10px',
                  marginBottom: '0.85rem',
                  fontSize: '0.86rem'
                }}>
                  {propertyError}
                </div>
              )}

              {propertySuccess && (
                <div style={{
                  background: 'rgba(25, 135, 84, 0.1)',
                  border: '1px solid rgba(25, 135, 84, 0.35)',
                  color: '#198754',
                  padding: '0.8rem',
                  borderRadius: '10px',
                  marginBottom: '0.85rem',
                  fontSize: '0.86rem'
                }}>
                  {propertySuccess}
                </div>
              )}

              <form onSubmit={handleAddProperty} style={{ display: 'grid', gap: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="Address"
                  value={propertyForm.address}
                  onChange={(e) => setPropertyForm((current) => ({ ...current, address: e.target.value }))}
                  className="kline-input"
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px 108px', gap: '0.65rem' }}>
                  <input
                    type="text"
                    placeholder="City"
                    value={propertyForm.city}
                    onChange={(e) => setPropertyForm((current) => ({ ...current, city: e.target.value }))}
                    className="kline-input"
                  />
                  <input
                    type="text"
                    placeholder="State"
                    value={propertyForm.state}
                    onChange={(e) => setPropertyForm((current) => ({ ...current, state: e.target.value }))}
                    className="kline-input"
                  />
                  <input
                    type="text"
                    placeholder="Zip"
                    value={propertyForm.zip}
                    onChange={(e) => setPropertyForm((current) => ({ ...current, zip: e.target.value }))}
                    className="kline-input"
                  />
                </div>
                <button
                  type="submit"
                  disabled={propertySaving}
                  className="kline-btn-primary"
                  style={{ padding: '0.78rem 1rem', fontSize: '0.88rem' }}
                >
                  {propertySaving ? 'Adding Property...' : '+ Add Property'}
                </button>
              </form>
            </div>
          </div>

            <div style={{ border: '1px solid var(--kline-gray)', borderRadius: '16px', padding: '1.1rem', background: '#fff', borderTop: '4px solid #198754' }}>
              <div style={{ fontWeight: 800, color: 'var(--kline-text)', marginBottom: '0.2rem' }}>Send SMS</div>
              <div style={{ color: 'var(--kline-text-light)', fontSize: '0.84rem', marginBottom: '0.9rem' }}>
                Send a quick personalized text to this customer from the same record.
              </div>

              {!canSendCallSms ? (
                <div style={{ color: 'var(--kline-text-light)', fontSize: '0.86rem' }}>
                  This user does not have permission to send customer SMS from the system.
                </div>
              ) : (
                <form onSubmit={handleSendSms} style={{ display: 'grid', gap: '0.8rem' }}>
                  {smsError && (
                    <div style={{
                      background: 'rgba(227, 6, 19, 0.1)',
                      border: '1px solid var(--kline-red)',
                      color: 'var(--kline-red)',
                      padding: '0.8rem',
                      borderRadius: '10px',
                      fontSize: '0.86rem'
                    }}>
                      {smsError}
                    </div>
                  )}

                  {smsSuccess && (
                    <div style={{
                      background: 'rgba(25, 135, 84, 0.1)',
                      border: '1px solid rgba(25, 135, 84, 0.35)',
                      color: '#198754',
                      padding: '0.8rem',
                      borderRadius: '10px',
                      fontSize: '0.86rem'
                    }}>
                      {smsSuccess}
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.45rem', color: 'var(--kline-text)' }}>To</label>
                    <input
                      className="kline-input"
                      value={smsForm.phoneNumber}
                      onChange={(e) => setSmsForm((current) => ({ ...current, phoneNumber: e.target.value }))}
                      placeholder="Customer phone number"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.45rem', color: 'var(--kline-text)' }}>Quick Template</label>
                    <select
                      className="kline-input"
                      value={smsForm.template}
                      onChange={(e) => setSmsForm((current) => ({ ...current, template: e.target.value }))}
                    >
                      <option value="">Manual message only</option>
                      {callSmsTemplates.map((template) => (
                        <option key={template.value} value={template.value}>
                          {template.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.45rem', color: 'var(--kline-text)' }}>Additional Note</label>
                    <textarea
                      className="kline-input"
                      rows={3}
                      value={smsForm.additionalNote}
                      onChange={(e) => setSmsForm((current) => ({ ...current, additionalNote: e.target.value }))}
                      placeholder="Add a short custom note for this customer."
                    />
                  </div>

                  <div>
                    <div style={{ display: 'block', fontWeight: 700, marginBottom: '0.45rem', color: 'var(--kline-text)' }}>Message Preview</div>
                    <div
                      style={{
                        border: '1px solid var(--kline-gray)',
                        borderRadius: 12,
                        padding: '0.95rem',
                        background: 'var(--kline-gray-light)',
                        color: smsPreview ? 'var(--kline-text)' : 'var(--kline-text-light)',
                        lineHeight: 1.5,
                        minHeight: 94,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {smsPreview || 'Choose a template or type a short manual message.'}
                    </div>
                    <div style={{ marginTop: 6, color: 'var(--kline-text-light)', fontSize: '0.8rem' }}>
                      {smsPreview.length}/320 characters
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={sendingSms || !smsPreview.trim()}
                    className="kline-btn-primary"
                    style={{ padding: '0.78rem 1rem', fontSize: '0.88rem' }}
                  >
                    {sendingSms ? 'Sending SMS...' : 'Send SMS'}
                  </button>
                </form>
              )}
            </div>

            <div style={{ border: '1px solid var(--kline-gray)', borderRadius: '16px', padding: '1.1rem', background: '#fff', borderTop: '4px solid #0d6efd' }}>
              <div style={{ fontWeight: 800, color: 'var(--kline-text)', marginBottom: '0.2rem' }}>SMS History</div>
              <div style={{ color: 'var(--kline-text-light)', fontSize: '0.84rem', marginBottom: '0.9rem' }}>
                Recent text messages sent to this customer from the system.
              </div>

              {smsHistoryLoading ? (
                <div style={{ color: 'var(--kline-text-light)', fontSize: '0.86rem' }}>Loading SMS history...</div>
              ) : smsHistoryError ? (
                <div style={{
                  background: 'rgba(227, 6, 19, 0.1)',
                  border: '1px solid var(--kline-red)',
                  color: 'var(--kline-red)',
                  padding: '0.8rem',
                  borderRadius: '10px',
                  fontSize: '0.86rem'
                }}>
                  {smsHistoryError}
                </div>
              ) : smsHistory.length === 0 ? (
                <div style={{ color: 'var(--kline-text-light)', fontSize: '0.86rem' }}>
                  No customer SMS history yet.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '0.7rem', maxHeight: '320px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                  {smsHistory.map((entry) => (
                    <div key={entry.id} style={{ border: '1px solid var(--kline-gray)', borderRadius: '12px', padding: '0.9rem', background: 'var(--kline-gray-light)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 800, color: 'var(--kline-text)' }}>
                          {entry.template || 'Manual message'}
                        </div>
                        <div style={{ color: 'var(--kline-text-light)', fontSize: '0.8rem', fontWeight: 700 }}>
                          {new Date(entry.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <div style={{ marginTop: '0.45rem', color: 'var(--kline-text-light)', fontSize: '0.82rem' }}>
                        To: {entry.phoneNumber || 'Unknown'}{entry.userEmail ? ` · Sent by ${entry.userEmail}` : ''}
                      </div>
                      {entry.additionalNote && (
                        <div style={{ marginTop: '0.45rem', color: '#0d6efd', fontSize: '0.82rem', fontWeight: 700 }}>
                          Note: {entry.additionalNote}
                        </div>
                      )}
                      <div style={{ marginTop: '0.55rem', color: 'var(--kline-text)', fontSize: '0.86rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {entry.message || 'No message content recorded.'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Delete Confirmation Modal
function DeleteCustomerModal({ customer, onClose, onCustomerDeleted }: { 
  customer: Customer | null, 
  onClose: () => void, 
  onCustomerDeleted: (customer: Customer) => void 
}) {
  if (!customer) return null

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
          Are you sure you want to delete customer <strong>&quot;{customer.fullName}&quot;</strong>? This action cannot be undone.
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
            onClick={() => onCustomerDeleted(customer)}
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
            Delete Customer
          </button>
        </div>
      </div>
    </div>
  )
}
