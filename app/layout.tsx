import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LuxStay — Hospitality Operating System',
  description: 'Run every room. Own every guest. Grow every day.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
