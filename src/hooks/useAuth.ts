import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = () => {
      const userId = document.cookie
        .split('; ')
        .find(row => row.startsWith('user-id='))
        ?.split('=')[1]

      setIsAuthenticated(!!userId)
    }

    checkAuth()
  }, [])

  const logout = () => {
    document.cookie = 'user-id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    setIsAuthenticated(false)
    router.push('/auth/login')
  }

  return { isAuthenticated, logout }
}