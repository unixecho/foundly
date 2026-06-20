import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Foundly',
  description: 'Privacy-first lost item recovery',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // lang will be overridden per-page for RTL (he/ar) once i18n is wired
    <html lang="he">
      <body>{children}</body>
    </html>
  )
}
