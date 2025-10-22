// app/api/login/route.ts
import { NextResponse } from 'next/server'
import { compare } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { sign } from 'jsonwebtoken'

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ message: 'Email y contraseña requeridos' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })

    if (!user || !(await compare(password, user.password))) {
      return NextResponse.json({ message: 'Credenciales inválidas' }, { status: 401 })
    }

    const token = sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' })

    const response = NextResponse.json({ message: 'Login exitoso' })
    response.cookies.set('token', token, {
      httpOnly: true,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    })

    return response
  } catch (error) {
    console.error('Error en login:', error)
    return NextResponse.json({ message: 'Error del servidor' }, { status: 500 })
  }
}