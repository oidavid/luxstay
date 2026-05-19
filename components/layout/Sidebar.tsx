'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, BedDouble, CalendarCheck, Users, UtensilsCrossed,
  Sparkles, Wrench, BarChart3, Settings, LogOut, ChevronRight,
  Building2, CreditCard, MessageSquare, UserCog
} from 'lucide-react'

const navItems = [
  {
    group: 'Operations',
    items: [
      { label: 'Overview',       href: '/overview',     icon: LayoutDashboard },
      { label: 'Rooms',          href: '/rooms',        icon: BedDouble },
      { label: 'Reservations',   href: '/reservations', icon: CalendarCheck },
      { label: 'Guests',         href: '/guests',       icon: Users },
    ]
  },
  {
    group: 'Services',
    items: [
      { label: 'Restaurant',     href: '/pos',          icon: UtensilsCrossed },
      { label: 'Housekeeping',   href: '/housekeeping', icon: Sparkles },
      { label: 'Maintenance',    href: '/maintenance',  icon: Wrench },
      { label: 'Messages',       href: '/crm',          icon: MessageSquare },
    ]
  },
  {
    group: 'Management',
    items: [
      { label: 'Reports',        href: '/reports',      icon: BarChart3 },
      { label: 'Staff & HR',     href: '/hr',           icon: UserCog },
      { label: 'Billing',        href: '/billing',      icon: CreditCard },
      { label: 'Settings',       href: '/settings',     icon: Settings },
    ]
  },
]

// Bottom nav shows only the 5 most-used items on mobile
const mobileNav = [
  { label: 'Overview',     href: '/overview',     icon: LayoutDashboard },
  { label: 'Rooms',        href: '/rooms',        icon: BedDouble },
  { label: 'Bookings',     href: '/reservations', icon: CalendarCheck },
  { label: 'Restaurant',   href: '/pos',          icon: UtensilsCrossed },
  { label: 'More',         href: '/settings',     icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside className="lux-sidebar">
        {/* Logo */}
        <div className="lux-sidebar-logo">
          <div className="lux-sidebar-logo-icon">
            <Building2 size={16} color="white" />
          </div>
          <div>
            <span className="lux-sidebar-brand">LuxStay</span>
            <p className="lux-sidebar-tagline">Property OS</p>
          </div>
        </div>

        {/* Nav */}
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
                      <Link
                        href={item.href}
                        className="lux-nav-item"
                        data-active={isActive}
                      >
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

        {/* Bottom */}
        <div className="lux-sidebar-bottom">
          <div className="lux-sidebar-user">
            <div className="lux-sidebar-avatar">H</div>
            <div className="lux-sidebar-user-info">
              <p className="lux-sidebar-user-name">Hotel Name</p>
              <p className="lux-sidebar-user-role">Administrator</p>
            </div>
          </div>
          <button className="lux-signout-btn" onClick={handleSignOut}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom nav ────────────────────────────────────────────── */}
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
        /* ── Desktop sidebar ── */
        .lux-sidebar {
          display: flex;
          flex-direction: column;
          width: 256px;
          flex-shrink: 0;
          height: 100%;
          background: var(--navy-900);
          border-right: 1px solid var(--navy-700);
        }

        @media (max-width: 768px) {
          .lux-sidebar { display: none; }
        }

        .lux-sidebar-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 20px 24px;
          border-bottom: 1px solid var(--navy-700);
        }

        .lux-sidebar-logo-icon {
          width: 32px; height: 32px;
          background: var(--gold-500);
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }

        .lux-sidebar-brand {
          font-family: 'Playfair Display', serif;
          font-size: 18px;
          font-weight: 700;
          color: white;
          display: block;
          line-height: 1;
        }

        .lux-sidebar-tagline {
          font-size: 11px;
          color: var(--slate-400);
          margin-top: 2px;
        }

        .lux-sidebar-nav {
          flex: 1;
          overflow-y: auto;
          padding: 16px 12px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .lux-sidebar-group ul { list-style: none; margin-top: 6px; display: flex; flex-direction: column; gap: 2px; }

        .lux-sidebar-group-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--navy-500);
          padding: 0 12px;
          margin-bottom: 4px;
        }

        .lux-nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 13.5px;
          font-weight: 500;
          color: var(--sidebar-text);
          text-decoration: none;
          transition: all 0.12s;
        }

        .lux-nav-item:hover { background: rgba(255,255,255,0.04); color: white; }
        .lux-nav-item[data-active="true"] { background: var(--navy-700); color: white; }

        .lux-nav-icon { color: var(--slate-400); flex-shrink: 0; }
        .lux-nav-item[data-active="true"] .lux-nav-icon { color: var(--gold-500); }
        .lux-nav-item:hover .lux-nav-icon { color: var(--slate-200); }

        .lux-nav-label { flex: 1; }

        .lux-nav-chevron { color: var(--gold-500); flex-shrink: 0; }

        .lux-sidebar-bottom {
          padding: 12px;
          border-top: 1px solid var(--navy-700);
        }

        .lux-sidebar-user {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 8px;
          background: var(--navy-800);
          margin-bottom: 4px;
        }

        .lux-sidebar-avatar {
          width: 32px; height: 32px;
          border-radius: 50%;
          background: var(--gold-500);
          color: white;
          font-size: 12px;
          font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }

        .lux-sidebar-user-name {
          font-size: 13px;
          font-weight: 600;
          color: white;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .lux-sidebar-user-role {
          font-size: 11px;
          color: var(--slate-400);
        }

        .lux-signout-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 12px;
          border-radius: 8px;
          background: none;
          border: none;
          color: var(--slate-400);
          font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          transition: background 0.12s, color 0.12s;
        }

        .lux-signout-btn:hover { background: rgba(239,68,68,0.1); color: #fca5a5; }

        /* ── Mobile bottom nav ── */
        .lux-bottom-nav {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 50;
          background: var(--navy-900);
          border-top: 1px solid var(--navy-700);
          padding-bottom: env(safe-area-inset-bottom);
        }

        @media (max-width: 768px) {
          .lux-bottom-nav {
            display: flex;
            align-items: center;
            justify-content: space-around;
          }
        }

        .lux-bottom-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          padding: 10px 12px;
          color: var(--slate-400);
          text-decoration: none;
          font-size: 10px;
          font-weight: 500;
          flex: 1;
          transition: color 0.12s;
        }

        .lux-bottom-nav-item[data-active="true"] { color: var(--gold-500); }
        .lux-bottom-nav-item:hover { color: white; }
      `}</style>
    </>
  )
}
