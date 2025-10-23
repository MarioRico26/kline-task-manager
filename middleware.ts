import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const userId = request.cookies.get('user-id')?.value

  console.log('🛡️ MIDDLEWARE FIRING - Path:', pathname, 'Has User:', !!userId)

  // Ruta raíz - siempre redirigir
  if (pathname === '/') {
    const redirectUrl = userId ? '/dashboard' : '/auth/login'
    console.log('🔀 Root redirect to:', redirectUrl)
    return NextResponse.redirect(new URL(redirectUrl, request.url))
  }

  // Rutas protegidas - lista EXPLÍCITA
  const protectedPaths = ['/dashboard', '/tasks', '/customer', '/properties', '/services', '/statuses']
  const isProtected = protectedPaths.some(path => pathname.startsWith(path))

  // Si es ruta protegida y NO hay usuario → BLOQUEAR
  if (isProtected && !userId) {
    console.log('🚫 BLOCKING unprotected access to:', pathname)
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Si está en login PERO ya tiene sesión → redirigir a dashboard
  if (pathname === '/auth/login' && userId) {
    console.log('🔄 Already logged in, redirecting to dashboard')
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  console.log('✅ Allowing access to:', pathname)
  return NextResponse.next()
}

// 🔥 CONFIGURACIÓN MÁS AGRESIVA - capturar TODAS las rutas
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images/ (public images)
     * - api/ (API routes - pero vamos a proteger algunas después)
     */
    '/((?!_next/static|_next/image|favicon.ico|logo.png|images/).*)',
  ],
}