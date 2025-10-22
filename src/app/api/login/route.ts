import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyPassword } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  const { email, password } = await req.json()

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return new NextResponse('Invalid credentials', { status: 401 })

  const isValid = await verifyPassword(password, user.password)
  if (!isValid) return new NextResponse('Invalid credentials', { status: 401 })

  // ✅ Aquí agregamos await porque cookies() devuelve una promesa
  const cookieStore = await cookies()
  cookieStore.set('userId', user.id, {
    httpOnly: true,
    path: '/',
  })

  return NextResponse.json({ message: 'Logged in successfully' })
}