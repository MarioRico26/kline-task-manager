import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies() // 👈 también await aquí
  cookieStore.delete('userId')
  return NextResponse.json({ message: 'Logged out' })
}