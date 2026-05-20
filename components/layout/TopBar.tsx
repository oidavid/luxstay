'use client'

import { Bell, Plus } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

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
  '/settings':          'Settings',
  '/revenue':            'Revenue Intelligence',
  '/rooms/setup':        'Room Setup',
  '/rooms/floor-builder':'Floor Builder',
  '/rooms/setup':        'Room Setup',
  '/rooms/floor-builder':'Floor Builder',
  '/rooms/new':          'Add Room',
}

export function TopBar() {
  const pathname = usePathname()
  const supabase = createClient()
  const title    = pageTitles[pathname] ?? 'LuxStay'
  const today    = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  const [userName,     setUserName]     = useState('')
  const [userInitials, setUserInitials] = useState('U')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()
      if (profile) {
        setUserName(profile.full_name)
        setUserInitials(
          profile.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
        )
      }
    }
    load()
  }, [])

  return (
    <header className="lux-topbar">
      {/* Left */}
      <div className="lux-topbar-left">
        <h1 className="lux-topbar-title font-display">{title}</h1>
        <p className="lux-topbar-date">{today}</p>
      </div>

      {/* Right */}
      <div className="lux-topbar-right">
        <Link href="/reservations/new" className="lux-topbar-new-btn">
          <Plus size={15} />
          <span className="lux-topbar-new-label">New Reservation</span>
        </Link>

        <button className="lux-topbar-bell">
          <Bell size={17} />
          <span className="lux-topbar-bell-dot" />
        </button>

        <div className="lux-topbar-avatar" title={userName}>
          {userInitials}
        </div>
      </div>

      <style>{`
        .lux-topbar {
          display: flex; align-items: center;
          justify-content: space-between;
          padding: 0 24px; height: 64px; flex-shrink: 0;
          background: white;
          border-bottom: 1px solid var(--slate-200);
          position: sticky; top: 0; z-index: 10;
        }
        @media (max-width: 768px) { .lux-topbar { padding: 0 16px; height: 56px; } }

        .lux-topbar-left { display: flex; flex-direction: column; gap: 1px; }
        .lux-topbar-title {
          font-size: 18px; font-weight: 600;
          color: var(--slate-800); margin: 0; line-height: 1.2;
        }
        @media (max-width: 768px) { .lux-topbar-title { font-size: 16px; } }
        .lux-topbar-date { font-size: 11px; color: var(--slate-600); margin: 0; font-weight: 500; }
        @media (max-width: 480px) { .lux-topbar-date { display: none; } }

        .lux-topbar-right { display: flex; align-items: center; gap: 10px; }

        .lux-topbar-new-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 16px;
          background: var(--navy-800); color: white;
          font-size: 13px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          border-radius: 8px; text-decoration: none;
          transition: opacity 0.15s; white-space: nowrap;
        }
        .lux-topbar-new-btn:hover { opacity: 0.85; }
        @media (max-width: 480px) {
          .lux-topbar-new-label { display: none; }
          .lux-topbar-new-btn { padding: 8px 10px; }
        }

        .lux-topbar-bell {
          position: relative; width: 38px; height: 38px;
          display: flex; align-items: center; justify-content: center;
          background: var(--slate-100); border: 1px solid var(--slate-200);
          border-radius: 8px; color: var(--slate-600);
          cursor: pointer; transition: background 0.12s; flex-shrink: 0;
        }
        .lux-topbar-bell:hover { background: var(--slate-200); }
        .lux-topbar-bell-dot {
          position: absolute; top: 8px; right: 8px;
          width: 7px; height: 7px;
          background: var(--gold-500); border-radius: 50%;
          border: 1.5px solid white;
        }

        .lux-topbar-avatar {
          width: 36px; height: 36px; border-radius: 10px;
          background: linear-gradient(135deg, var(--navy-800), var(--navy-600));
          border: 2px solid var(--gold-500);
          color: var(--gold-300);
          font-size: 12px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; cursor: pointer;
          transition: border-color 0.15s;
        }
        .lux-topbar-avatar:hover { border-color: var(--gold-400); }
      `}</style>
    </header>
  )
}



