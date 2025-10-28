//kline-task-manager/src/hooks/useAuth.ts:
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export function useAuth(redirectTo: string = '/auth/login') {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = () => {
      const userId = document.cookie
        .split('; ')
        .find(row => row.startsWith('user-id='))
        ?.split('=')[1]

      if (!userId) {
        console.log('🚫 NO HAY SESIÓN - Redirigiendo a login')
        router.push(redirectTo)
        setIsAuthenticated(false)
        return false
      }
      
      setIsAuthenticated(true)
      return true
    }

    checkAuth()
  }, [router, redirectTo])

  return { isAuthenticated }
}