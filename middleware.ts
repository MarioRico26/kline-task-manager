import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // 1. Obtener la ruta actual
  const { pathname } = request.nextUrl
  
  // 2. Verificar si el usuario está autenticado
  const userId = request.cookies.get('user-id')?.value
  
  console.log('🛡️ MIDDLEWARE - Path:', pathname, 'User ID:', userId ? 'YES' : 'NO')

  // 3. Si está en la raíz, redirigir
  if (pathname === '/') {
    if (userId) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    } else {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
  }

  // 4. Definir rutas protegidas EXPLÍCITAMENTE
  const protectedRoutes = [
    '/dashboard',
    '/tasks', 
    '/customer',
    '/properties',
    '/services', 
    '/statuses'
  ]

  // 5. Verificar si la ruta actual es protegida
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  )

  // 6. Si es ruta protegida y NO tiene sesión → BLOQUEAR
  if (isProtectedRoute && !userId) {
    console.log('🚫 BLOCKING: No auth for protected route')
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 7. Si está en login y YA tiene sesión → redirigir a dashboard
  if (pathname === '/auth/login' && userId) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

// 8. Configuración MUY IMPORTANTE - proteger TODAS las rutas
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files) 
     * - favicon.ico (favicon file)
     * - images (public images)
     * - api/auth (login API)
     */
    '/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.png$|api/auth).*)',
  ],
}