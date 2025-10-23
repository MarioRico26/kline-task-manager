import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const userId = request.cookies.get('user-id')?.value

  console.log('🔍 MIDDLEWARE EXECUTING:', {
    pathname,
    hasUserId: !!userId,
    userId: userId
  })

  // Si está en la raíz → redirigir a dashboard o login
  if (pathname === '/') {
    if (userId) {
      console.log('🔄 Redirecting to dashboard')
      return NextResponse.redirect(new URL('/dashboard', request.url))
    } else {
      console.log('🔄 Redirecting to login')
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
  }

  // Rutas protegidas
  const protectedRoutes = ['/dashboard', '/tasks', '/customer', '/properties', '/services', '/statuses']
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))

  if (isProtectedRoute && !userId) {
    console.log('🚫 BLOCKING ACCESS - No user ID')
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  console.log('✅ ALLOWING ACCESS')
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