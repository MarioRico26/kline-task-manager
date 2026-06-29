import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Rutas públicas o con autenticación propia por secret
  const publicPaths = ['/auth/login', '/api/auth/login']
  const secretProtectedPaths = [
    '/api/calls-inbox/imports/comcast-imap-sync',
    '/api/calls-inbox/imports/comcast-email',
  ]

  // Si está en ruta pública o secret-protected, seguir normal
  if (publicPaths.some(path => pathname.startsWith(path)) || secretProtectedPaths.some(path => pathname.startsWith(path))) {
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
  const hasNoTaskAccess = accessScope === 'NONE'
  const canAccessPlanner = req.cookies.get('planner-access')?.value === 'true'
  const canAccessSeasonalPrograms = req.cookies.get('seasonal-programs-access')?.value === 'true'
  const canAccessCallsInbox = req.cookies.get('calls-inbox-access')?.value === 'true'
  const canAccessVoicemailImports = req.cookies.get('voicemail-imports-access')?.value === 'true'

  if (pathname.startsWith('/planner') && !canAccessPlanner) {
    const dashboardUrl = req.nextUrl.clone()
    dashboardUrl.pathname = isPermitsOnly ? '/tasks' : '/dashboard'
    return NextResponse.redirect(dashboardUrl)
  }

  if (pathname.startsWith('/seasonal-programs') && !canAccessSeasonalPrograms) {
    const dashboardUrl = req.nextUrl.clone()
    dashboardUrl.pathname = isPermitsOnly ? '/tasks' : '/dashboard'
    return NextResponse.redirect(dashboardUrl)
  }

  if (pathname.startsWith('/calls-inbox/imports') && (!canAccessCallsInbox || !canAccessVoicemailImports)) {
    const dashboardUrl = req.nextUrl.clone()
    dashboardUrl.pathname = isPermitsOnly ? '/tasks' : canAccessCallsInbox ? '/calls-inbox' : '/dashboard'
    return NextResponse.redirect(dashboardUrl)
  }

  if (pathname.startsWith('/calls-inbox') && !canAccessCallsInbox) {
    const dashboardUrl = req.nextUrl.clone()
    dashboardUrl.pathname = isPermitsOnly ? '/tasks' : '/dashboard'
    return NextResponse.redirect(dashboardUrl)
  }

  if (hasNoTaskAccess) {
    const blocksTaskModule =
      pathname.startsWith('/tasks') ||
      pathname.startsWith('/api/tasks') ||
      pathname.startsWith('/api/services') ||
      pathname.startsWith('/api/statuses')

    if (blocksTaskModule) {
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = canAccessCallsInbox ? '/calls-inbox' : '/dashboard'
      return NextResponse.redirect(redirectUrl)
    }
  }

  if (isPermitsOnly) {
    const allowedUiPaths = ['/tasks', '/customers', '/properties', ...(canAccessPlanner ? ['/planner'] : [])]
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
