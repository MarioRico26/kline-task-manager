import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'

export async function auth() {
  const cookieStore = await cookies() // 👈 aquí usamos await
  const userId = cookieStore.get('userId')?.value
  return userId ?? null
}

export async function hashPassword(password: string) {
  return await bcrypt.hash(password, 10)
}

export async function verifyPassword(plain: string, hash: string) {
  return await bcrypt.compare(plain, hash)
}