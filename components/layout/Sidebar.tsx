'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, BedDouble, CalendarCheck, Users, UtensilsCrossed,
  Sparkles, Wrench, BarChart3, Settings, LogOut, ChevronRight,
  CreditCard, MessageSquare, UserCog
} from 'lucide-react'

const navItems = [
  {
    group: 'Operations',
    items: [
      { label: 'Overview',     href: '/overview',     icon: LayoutDashboard },
      { label: 'Rooms',        href: '/rooms',        icon: BedDouble },
      { label: 'Reservations', href: '/reservations', icon: CalendarCheck },
      { label: 'Guests',       href: '/guests',       icon: Users },
    ]
  },
  {
    group: 'Services',
    items: [
      { label: 'Restaurant',   href: '/pos',          icon: UtensilsCrossed },
      { label: 'Housekeeping', href: '/housekeeping', icon: Sparkles },
      { label: 'Maintenance',  href: '/maintenance',  icon: Wrench },
      { label: 'Messages',     href: '/crm',          icon: MessageSquare },
    ]
  },
  {
    group: 'Management',
    items: [
      { label: 'Reports',      href: '/reports',      icon: BarChart3 },
      { label: 'Staff & HR',   href: '/hr',           icon: UserCog },
      { label: 'Billing',      href: '/billing',      icon: CreditCard },
      { label: 'Settings',     href: '/settings',     icon: Settings },
    ]
  },
]

const mobileNav = [
  { label: 'Overview',   href: '/overview',     icon: LayoutDashboard },
  { label: 'Rooms',      href: '/rooms',        icon: BedDouble },
  { label: 'Bookings',   href: '/reservations', icon: CalendarCheck },
  { label: 'Restaurant', href: '/pos',          icon: UtensilsCrossed },
  { label: 'More',       href: '/settings',     icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  const [hotelName, setHotelName] = useState('Your Hotel')
  const [hotelCity, setHotelCity] = useState('')
  const [userName,  setUserName]  = useState('...')
  const [userRole,  setUserRole]  = useState('hotel owner')
  const [initials,  setInitials]  = useState('H')
  const [userInitials, setUserInitials] = useState('U')

  useEffect(() => {
    async function loadUserData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, role, hotel_id')
        .eq('id', user.id)
        .single()
      if (profile) {
        setUserName(profile.full_name)
        setUserRole(profile.role.replace('_', ' '))
        setUserInitials(profile.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase())
        const { data: hotel } = await supabase
          .from('hotels')
          .select('name, city')
          .eq('id', profile.hotel_id)
          .single()
        if (hotel) {
          setHotelName(hotel.name)
          setHotelCity(hotel.city ?? '')
          setInitials(hotel.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase())
        }
      }
    }
    loadUserData()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <aside className="lux-sidebar">

        {/* ── Platform brand — small and subtle ── */}
        <div className="lux-platform-bar">
          <span className="lux-platform-name">LuxStay</span>
          <span className="lux-platform-tag">Property OS</span>
        </div>

        {/* ── Hotel identity — large and proud ── */}
        <div className="lux-hotel-identity">
          <div className="lux-hotel-avatar">{initials}</div>
          <div className="lux-hotel-details">
            <p className="lux-hotel-name">{hotelName}</p>
            {hotelCity && <p className="lux-hotel-city">{hotelCity}</p>}
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav className="lux-sidebar-nav">
          {navItems.map((group) => (
            <div key={group.group} className="lux-sidebar-group">
              <p className="lux-sidebar-group-label">{group.group}</p>
              <ul>
                {group.items.map((item) => {
                  const Icon     = item.icon
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <li key={item.href}>
                      <Link href={item.href} className="lux-nav-item" data-active={isActive}>
                        <Icon size={16} className="lux-nav-icon" data-active={isActive} />
                        <span className="lux-nav-label">{item.label}</span>
                        {isActive && <ChevronRight size={14} className="lux-nav-chevron" />}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* ── User + sign out ── */}
        <div className="lux-sidebar-bottom">
          <div className="lux-sidebar-user">
            <div className="lux-sidebar-avatar">{userInitials}</div>
            <div className="lux-sidebar-user-info">
              <p className="lux-sidebar-user-name">{userName}</p>
              <p className="lux-sidebar-user-role">{userRole}</p>
            </div>
          </div>
          <button className="lux-signout-btn" onClick={handleSignOut}>
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom nav ── */}
      <nav className="lux-bottom-nav">
        {mobileNav.map((item) => {
          const Icon     = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href} className="lux-bottom-nav-item" data-active={isActive}>
              <Icon size={22} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <style>{`
        /* ── Sidebar shell ── */
        .lux-sidebar {
          display: flex; flex-direction: column;
          width: 260px; flex-shrink: 0; height: 100%;
          background: var(--navy-900);
          border-right: 1px solid var(--navy-700);
        }
        @media (max-width: 768px) { .lux-sidebar { display: none; } }

        /* ── Platform bar ── */
        .lux-platform-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px 10px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .lux-platform-name {
          font-family: 'Playfair Display', serif;
          font-size: 15px;
          font-weight: 700;
          color: rgba(255,255,255,0.85);
          letter-spacing: 0.02em;
        }
        .lux-platform-tag {
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: rgba(255,255,255,0.5);
          background: rgba(255,255,255,0.08);
          padding: 2px 7px;
          border-radius: 20px;
        }

        /* ── Hotel identity block ── */
        .lux-hotel-identity {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 20px 20px 18px;
          border-bottom: 1px solid var(--navy-700);
          background: linear-gradient(135deg, rgba(201,168,76,0.08) 0%, rgba(201,168,76,0.02) 100%);
        }
        .lux-hotel-avatar {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, var(--gold-500), #a8781e);
          color: white;
          font-size: 16px;
          font-weight: 800;
          font-family: 'Playfair Display', serif;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(201,168,76,0.3);
        }
        .lux-hotel-details { flex: 1; min-width: 0; }
        .lux-hotel-name {
          font-family: 'Playfair Display', serif;
          font-size: 16px;
          font-weight: 700;
          color: white;
          margin: 0;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .lux-hotel-city {
          font-size: 11px;
          color: var(--gold-400);
          margin: 3px 0 0;
          font-weight: 500;
          letter-spacing: 0.04em;
        }

        /* ── Navigation ── */
        .lux-sidebar-nav {
          flex: 1; overflow-y: auto; padding: 16px 12px;
          display: flex; flex-direction: column; gap: 20px;
        }
        .lux-sidebar-group ul {
          list-style: none; margin-top: 6px;
          display: flex; flex-direction: column; gap: 2px;
        }
        .lux-sidebar-group-label {
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: rgba(255,255,255,0.2);
          padding: 0 12px; margin-bottom: 4px;
        }
        .lux-nav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 12px; border-radius: 8px;
          font-size: 13.5px; font-weight: 500;
          color: var(--sidebar-text); text-decoration: none;
          transition: all 0.12s;
        }
        .lux-nav-item:hover { background: rgba(255,255,255,0.04); color: white; }
        .lux-nav-item[data-active="true"] { background: var(--navy-700); color: white; }
        .lux-nav-icon { color: var(--slate-400); flex-shrink: 0; }
        .lux-nav-item[data-active="true"] .lux-nav-icon { color: var(--gold-500); }
        .lux-nav-item:hover .lux-nav-icon { color: var(--slate-200); }
        .lux-nav-label { flex: 1; }
        .lux-nav-chevron { color: var(--gold-500); flex-shrink: 0; }

        /* ── Bottom user area ── */
        .lux-sidebar-bottom {
          padding: 12px;
          border-top: 1px solid var(--navy-700);
        }
        .lux-sidebar-user {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 8px;
          background: var(--navy-800); margin-bottom: 4px;
        }
        .lux-sidebar-avatar {
          width: 30px; height: 30px; border-radius: 8px;
          background: var(--navy-600);
          border: 1px solid rgba(255,255,255,0.1);
          color: white; font-size: 11px; font-weight: 700;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .lux-sidebar-user-name {
          font-size: 12px; font-weight: 600; color: white;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .lux-sidebar-user-role {
          font-size: 11px; color: var(--slate-400);
          text-transform: capitalize;
        }
        .lux-signout-btn {
          display: flex; align-items: center; gap: 8px;
          width: 100%; padding: 7px 12px; border-radius: 8px;
          background: none; border: none; color: var(--slate-400);
          font-size: 12px; font-family: 'DM Sans', sans-serif;
          cursor: pointer; transition: background 0.12s, color 0.12s;
        }
        .lux-signout-btn:hover { background: rgba(239,68,68,0.1); color: #fca5a5; }

        /* ── Mobile bottom nav ── */
        .lux-bottom-nav {
          display: none; position: fixed;
          bottom: 0; left: 0; right: 0; z-index: 50;
          background: var(--navy-900);
          border-top: 1px solid var(--navy-700);
          padding-bottom: env(safe-area-inset-bottom);
        }
        @media (max-width: 768px) {
          .lux-bottom-nav { display: flex; align-items: center; justify-content: space-around; }
        }
        .lux-bottom-nav-item {
          display: flex; flex-direction: column; align-items: center; gap: 3px;
          padding: 10px 12px; color: var(--slate-400); text-decoration: none;
          font-size: 10px; font-weight: 500; flex: 1; transition: color 0.12s;
        }
        .lux-bottom-nav-item[data-active="true"] { color: var(--gold-500); }
        .lux-bottom-nav-item:hover { color: white; }
      `}</style>
    </>
  )
}


