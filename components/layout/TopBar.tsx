'use client'

import { Bell, Search, Plus } from 'lucide-react'
import { usePathname } from 'next/navigation'

const pageTitles: Record<string, string> = {
  '/overview':     'Overview',
  '/rooms':        'Room Management',
  '/reservations': 'Reservations',
  '/guests':       'Guest Profiles',
  '/pos':          'Restaurant & Bar',
  '/housekeeping': 'Housekeeping',
  '/maintenance':  'Maintenance',
  '/crm':          'Guest Messages',
  '/reports':      'Reports & Analytics',
  '/hr':           'Staff & HR',
  '/billing':      'Billing',
  '/settings':     'Settings',
}

export function TopBar() {
  const pathname = usePathname()
  const title = pageTitles[pathname] ?? 'LuxStay'

  return (
    <header
      className="flex items-center justify-between px-6 h-16 shrink-0"
      style={{ background: 'white', borderBottom: '1px solid var(--slate-200)' }}
    >
      {/* Left */}
      <div>
        <h1 className="font-display font-semibold text-lg" style={{ color: 'var(--slate-800)' }}>
          {title}
        </h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {new Date().toLocaleDateString('en-NG', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          })}
        </p>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all"
          style={{
            background: 'var(--slate-100)',
            color: 'var(--text-muted)',
            border: '1px solid var(--slate-200)'
          }}
        >
          <Search size={14} />
          <span>Search...</span>
          <kbd
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: 'var(--slate-200)', color: 'var(--slate-600)' }}
          >
            ⌘K
          </kbd>
        </button>

        <button
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all"
          style={{ background: 'var(--navy-800)' }}
        >
          <Plus size={14} />
          New Reservation
        </button>

        <button
          className="relative w-9 h-9 flex items-center justify-center rounded-lg transition-all"
          style={{ background: 'var(--slate-100)', border: '1px solid var(--slate-200)' }}
        >
          <Bell size={16} style={{ color: 'var(--slate-600)' }} />
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ background: 'var(--gold-500)' }}
          />
        </button>
      </div>
    </header>
  )
}
