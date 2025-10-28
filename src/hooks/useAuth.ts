'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export function useAuth(redirectTo: string = '/auth/login') {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const cookieExists = document.cookie
      .split('; ')
      .some(row => row.startsWith('user-id='))

    if (!cookieExists) {
      router.replace(redirectTo)
    } else {
      setIsAuthenticated(true)
    }

    setLoading(false)
  }, [redirectTo, router])

  return { isAuthenticated, loading }
}