'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export function useAuth(redirectTo: string = '/auth/login') {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const router = useRouter()

  useEffect(() => {
    const checkSession = () => {
      const cookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('user-id='))

      if (!cookie) {
        setIsAuthenticated(false)
        router.replace(redirectTo)
      } else {
        setIsAuthenticated(true)
      }
    }

    checkSession()
  }, [redirectTo, router])

  return { isAuthenticated }
}