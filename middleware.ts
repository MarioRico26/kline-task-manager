import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Rutas que requieren autenticación
const protectedRoutes = [
  '/dashboard',
  '/tasks',
  '/customer',
  '/properties', 
  '/services',
  '/statuses'
]

// Rutas públicas (acceso sin login)
const publicRoutes = [
  '/auth/login',
  '/auth/register'
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const userId = request.cookies.get('user-id')?.value

  // Verificar si la ruta actual es protegida
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  )

  // Verificar si la ruta actual es pública
  const isPublicRoute = publicRoutes.some(route => 
    pathname === route
  )

  // Si no está logueado y quiere acceder a ruta protegida → redirigir a login
  if (isProtectedRoute && !userId) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Si está logueado y quiere acceder a login/register → redirigir a dashboard
  if (isPublicRoute && userId) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|logo.png|.*\\.png$).*)',
  ],
}