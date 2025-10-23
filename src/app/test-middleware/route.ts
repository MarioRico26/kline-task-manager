import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ 
    message: 'Si puedes ver esto, el middleware NO está bloqueando',
    timestamp: new Date().toISOString()
  })
}