import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Rutas públicas
  const publicPaths = ['/auth/login', '/api/auth/login']

  // Si está en ruta pública, seguir normal
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Verificar cookie de sesión HttpOnly
  const userId = req.cookies.get('user-id')?.value

  if (!userId) {
    // No hay sesión → redirigir a login
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/auth/login'
    return NextResponse.redirect(loginUrl)
  }

  const accessScope = req.cookies.get('access-scope')?.value
  const isPermitsOnly = accessScope === 'PERMITS_ONLY'

  if (isPermitsOnly) {
    const allowedUiPaths = ['/tasks', '/customers', '/properties']
    const allowedApiPaths = [
      '/api/auth',
      '/api/tasks',
      '/api/customers',
      '/api/properties',
      '/api/services',
      '/api/statuses',
    ]

    const allowsPath =
      pathname.startsWith('/auth/login') ||
      allowedUiPaths.some((path) => pathname.startsWith(path)) ||
      allowedApiPaths.some((path) => pathname.startsWith(path))

    if (!allowsPath) {
      const tasksUrl = req.nextUrl.clone()
      tasksUrl.pathname = '/tasks'
      return NextResponse.redirect(tasksUrl)
    }
  }

  // ✅ Tiene sesión → permitir
  return NextResponse.next()
}

// Definir qué rutas protege el middleware
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
