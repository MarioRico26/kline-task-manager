import './globals.css'

export const metadata = {
  title: 'Kline Task Manager',
  description: 'Sistema de gestión de tareas para clientes y propiedades',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-100">{children}</body>
    </html>
  )
}