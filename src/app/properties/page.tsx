'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Property {
  id: string
  address: string
  city: string
  state: string
  zip: string
  customerId: string
  customer: {
    id: string
    fullName: string
    email: string
  }
  createdAt: string
}

interface Customer {
  id: string
  fullName: string
  email: string
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [customerFilter, setCustomerFilter] = useState('ALL')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingProperty, setEditingProperty] = useState<Property | null>(null)
  const [deletingProperty, setDeletingProperty] = useState<Property | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [propertiesRes, customersRes] = await Promise.all([
        fetch('/api/properties'),
        fetch('/api/customers')
      ])

      if (propertiesRes.ok && customersRes.ok) {
        const propertiesData = await propertiesRes.json()
        const customersData = await customersRes.json()
        setProperties(propertiesData)
        setCustomers(customersData)
      } else {
        console.error('Error fetching data')
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    document.cookie = 'user-id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    // ✅ Esto SÍ funciona - recarga todo el contexto
    window.location.href = '/auth/login'
  }

  const handleBack = () => {
    router.back()
  }

  const handleDashboard = () => {
    router.push('/dashboard')
  }

  const handleDeleteProperty = async (property: Property) => {
    try {
      const response = await fetch(`/api/properties/${property.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchData()
        setDeletingProperty(null)
      } else {
        alert('Error deleting property')
      }
    } catch (error) {
      alert('Network error')
    }
  }

  const filteredProperties = properties.filter(property => {
    const matchesSearch = 
      property.address.toLowerCase().includes(filter.toLowerCase()) ||
      property.city.toLowerCase().includes(filter.toLowerCase()) ||
      property.customer.fullName.toLowerCase().includes(filter.toLowerCase())
    
    const matchesCustomer = customerFilter === 'ALL' || property.customerId === customerFilter
    
    return matchesSearch && matchesCustomer
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
                Property <span className="kline-accent">Management</span>
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
                  placeholder="Search properties..."
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

              {/* Customer Filter */}
              <select 
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                className="kline-input"
                style={{ width: '200px', padding: '0.8rem 1rem' }}
              >
                <option value="ALL">All Customers</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.fullName}
                  </option>
                ))}
              </select>
            </div>

            {/* Add Property Button */}
            <button 
              className="kline-btn-primary"
              style={{ padding: '0.8rem 1.5rem', fontSize: '0.9rem' }}
              onClick={() => setIsCreateModalOpen(true)}
              disabled={customers.length === 0}
            >
              {customers.length === 0 ? 'No Customers' : '+ New Property'}
            </button>
          </div>
        </div>

        {/* Properties Table - Compact View */}
        {loading ? (
          <div className="kline-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--kline-text-light)' }}>
            Loading properties...
          </div>
        ) : customers.length === 0 ? (
          <div className="kline-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--kline-text-light)' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--kline-text)' }}>No Customers Found</h3>
            <p>You need to create customers before adding properties.</p>
            <button 
              className="kline-btn-primary"
              style={{ marginTop: '1rem', padding: '0.8rem 1.5rem' }}
              onClick={() => router.push('/customers')}
            >
              Go to Customers
            </button>
          </div>
        ) : (
          <div className="kline-card" style={{ overflow: 'hidden' }}>
            {/* Table Header */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '2fr 1.5fr 1fr 1fr auto',
              padding: '1rem 1.5rem',
              background: 'var(--kline-gray-light)',
              borderBottom: '2px solid var(--kline-gray)',
              fontWeight: '600',
              color: 'var(--kline-text)',
              fontSize: '0.85rem'
            }}>
              <div>Address & Customer</div>
              <div>City</div>
              <div>State</div>
              <div>ZIP</div>
              <div>Actions</div>
            </div>

            {/* Table Rows */}
            {filteredProperties.map((property) => (
              <div 
                key={property.id}
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '2fr 1.5fr 1fr 1fr auto',
                  padding: '1rem 1.5rem',
                  borderBottom: '1px solid var(--kline-gray)',
                  alignItems: 'center',
                  fontSize: '0.85rem',
                  transition: 'background 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'var(--kline-gray-light)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                {/* Address & Customer Column */}
                <div>
                  <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                    {property.address}
                  </div>
                  <div style={{ 
                    color: 'var(--kline-blue)', 
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span style={{ 
                      background: 'var(--kline-blue)', 
                      color: 'white', 
                      padding: '0.2rem 0.5rem', 
                      borderRadius: '12px', 
                      fontSize: '0.7rem'
                    }}>
                      Owner
                    </span>
                    {property.customer.fullName}
                  </div>
                </div>

                {/* City Column */}
                <div style={{ color: 'var(--kline-text)' }}>
                  {property.city}
                </div>

                {/* State Column */}
                <div>
                  <span style={{ 
                    background: 'rgba(30, 58, 95, 0.1)',
                    color: 'var(--kline-blue)',
                    padding: '0.3rem 0.6rem',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}>
                    {property.state}
                  </span>
                </div>

                {/* ZIP Column */}
                <div style={{ 
                  color: 'var(--kline-text-light)', 
                  fontFamily: 'monospace',
                  fontSize: '0.8rem'
                }}>
                  {property.zip}
                </div>

                {/* Actions Column */}
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button 
                    style={{ 
                      background: 'var(--kline-yellow)',
                      border: 'none',
                      color: 'var(--kline-text)',
                      padding: '0.4rem 0.8rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '0.75rem',
                      transition: 'all 0.2s ease',
                      minWidth: '60px'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'var(--kline-yellow-light)'
                      e.currentTarget.style.transform = 'translateY(-1px)'
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'var(--kline-yellow)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                    onClick={() => setEditingProperty(property)}
                  >
                    Edit
                  </button>
                  <button 
                    style={{ 
                      padding: '0.4rem 0.8rem', 
                      fontSize: '0.75rem',
                      background: 'transparent',
                      border: '1px solid var(--kline-red)',
                      color: 'var(--kline-red)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      transition: 'all 0.2s ease',
                      minWidth: '60px'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'var(--kline-red)'
                      e.currentTarget.style.color = 'white'
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'var(--kline-red)'
                    }}
                    onClick={() => setDeletingProperty(property)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {filteredProperties.length === 0 && (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--kline-text-light)' }}>
                {properties.length === 0 ? 'No properties found' : 'No properties match your search'}
              </div>
            )}
          </div>
        )}

        {/* Compact Stats */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
          gap: '0.75rem', 
          marginTop: '1.5rem' 
        }}>
          <div className="kline-card" style={{ 
            padding: '1rem', 
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--kline-red)' }}>
              {properties.length}
            </div>
            <div style={{ 
              color: 'var(--kline-text-light)', 
              fontSize: '0.8rem',
              fontWeight: '600'
            }}>
              Total Properties
            </div>
          </div>
          <div className="kline-card" style={{ 
            padding: '1rem', 
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--kline-red)' }}>
              {new Set(properties.map(p => p.customerId)).size}
            </div>
            <div style={{ 
              color: 'var(--kline-text-light)', 
              fontSize: '0.8rem',
              fontWeight: '600'
            }}>
              Active Customers
            </div>
          </div>
          <div className="kline-card" style={{ 
            padding: '1rem', 
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--kline-red)' }}>
              {Math.round(properties.length / Math.max(new Set(properties.map(p => p.customerId)).size, 1))}
            </div>
            <div style={{ 
              color: 'var(--kline-text-light)', 
              fontSize: '0.8rem',
              fontWeight: '600'
            }}>
              Avg per Customer
            </div>
          </div>
        </div>
      </main>

      {/* Create Property Modal */}
      <CreatePropertyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onPropertyCreated={fetchData}
        customers={customers}
      />

      {/* Edit Property Modal */}
      <EditPropertyModal
        property={editingProperty}
        onClose={() => setEditingProperty(null)}
        onPropertyUpdated={fetchData}
        customers={customers}
      />

      {/* Delete Confirmation Modal */}
      <DeletePropertyModal
        property={deletingProperty}
        onClose={() => setDeletingProperty(null)}
        onPropertyDeleted={handleDeleteProperty}
      />
    </div>
  )
}

// Create Property Modal Component
function CreatePropertyModal({ isOpen, onClose, onPropertyCreated, customers }: { 
  isOpen: boolean, 
  onClose: () => void, 
  onPropertyCreated: () => void,
  customers: Customer[]
}) {
  const [formData, setFormData] = useState({
    address: '',
    city: '',
    state: '',
    zip: '',
    customerId: customers[0]?.id || ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        onPropertyCreated()
        onClose()
        setFormData({
          address: '',
          city: '',
          state: '',
          zip: '',
          customerId: customers[0]?.id || ''
        })
      } else {
        const data = await response.json()
        setError(data.error || 'Error creating property')
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
          Create New Property
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
              Customer *
            </label>
            <select 
              value={formData.customerId}
              onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
              className="kline-input"
              required
            >
              <option value="">Select a customer</option>
              {customers.map(customer => (
                <option key={customer.id} value={customer.id}>
                  {customer.fullName} ({customer.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
              Address *
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="kline-input"
              placeholder="123 Main Street"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
                City *
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="kline-input"
                placeholder="City"
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
                State *
              </label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="kline-input"
                placeholder="State"
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
              ZIP Code *
            </label>
            <input
              type="text"
              value={formData.zip}
              onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
              className="kline-input"
              placeholder="12345"
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
              {loading ? 'Creating...' : 'Create Property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Edit Property Modal Component
function EditPropertyModal({ property, onClose, onPropertyUpdated, customers }: { 
  property: Property | null, 
  onClose: () => void, 
  onPropertyUpdated: () => void,
  customers: Customer[]
}) {
  const [formData, setFormData] = useState({
    address: '',
    city: '',
    state: '',
    zip: '',
    customerId: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (property) {
      setFormData({
        address: property.address,
        city: property.city,
        state: property.state,
        zip: property.zip,
        customerId: property.customerId
      })
    }
  }, [property])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!property) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/properties/${property.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        onPropertyUpdated()
        onClose()
      } else {
        const data = await response.json()
        setError(data.error || 'Error updating property')
      }
    } catch (error) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (!property) return null

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
          Edit Property
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
              Customer *
            </label>
            <select 
              value={formData.customerId}
              onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
              className="kline-input"
              required
            >
              {customers.map(customer => (
                <option key={customer.id} value={customer.id}>
                  {customer.fullName} ({customer.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
              Address *
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="kline-input"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
                City *
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="kline-input"
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
                State *
              </label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="kline-input"
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', color: 'var(--kline-text)', marginBottom: '0.5rem', fontWeight: '600' }}>
              ZIP Code *
            </label>
            <input
              type="text"
              value={formData.zip}
              onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
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
              {loading ? 'Updating...' : 'Update Property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Delete Confirmation Modal
function DeletePropertyModal({ property, onClose, onPropertyDeleted }: { 
  property: Property | null, 
  onClose: () => void, 
  onPropertyDeleted: (property: Property) => void 
}) {
  if (!property) return null

  const formatAddress = (property: Property) => {
    return `${property.address}, ${property.city}, ${property.state} ${property.zip}`
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

        <p style={{ marginBottom: '1rem', color: 'var(--kline-text)', lineHeight: '1.5' }}>
          Are you sure you want to delete the property at:
        </p>
        
        <div style={{ 
          background: 'var(--kline-gray-light)', 
          padding: '1rem', 
          borderRadius: '8px',
          marginBottom: '2rem'
        }}>
          <strong>{formatAddress(property)}</strong>
          <div style={{ color: 'var(--kline-text-light)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Owner: {property.customer.fullName}
          </div>
        </div>

        <p style={{ color: 'var(--kline-red)', fontWeight: '600', marginBottom: '2rem' }}>
          ⚠️ This action cannot be undone.
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
            onClick={() => onPropertyDeleted(property)}
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
            Delete Property
          </button>
        </div>
      </div>
    </div>
  )
}