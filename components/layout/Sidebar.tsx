'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, BedDouble, CalendarCheck, Users, UtensilsCrossed,
  Sparkles, Wrench, BarChart3, Settings, LogOut, ChevronRight,
  Building2, CreditCard, MessageSquare, UserCog
} from 'lucide-react'

const navItems = [
  {
    group: 'Operations',
    items: [
      { label: 'Overview',       href: '/overview',      icon: LayoutDashboard },
      { label: 'Rooms',          href: '/rooms',         icon: BedDouble },
      { label: 'Reservations',   href: '/reservations',  icon: CalendarCheck },
      { label: 'Guests',         href: '/guests',        icon: Users },
    ]
  },
  {
    group: 'Services',
    items: [
      { label: 'Restaurant',     href: '/pos',           icon: UtensilsCrossed },
      { label: 'Housekeeping',   href: '/housekeeping',  icon: Sparkles },
      { label: 'Maintenance',    href: '/maintenance',   icon: Wrench },
      { label: 'Guest Messages', href: '/crm',           icon: MessageSquare },
    ]
  },
  {
    group: 'Management',
    items: [
      { label: 'Reports',        href: '/reports',       icon: BarChart3 },
      { label: 'Staff & HR',     href: '/hr',            icon: UserCog },
      { label: 'Billing',        href: '/billing',       icon: CreditCard },
      { label: 'Settings',       href: '/settings',      icon: Settings },
    ]
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="flex flex-col w-64 shrink-0 h-full"
      style={{ background: 'var(--navy-900)', borderRight: '1px solid var(--navy-700)' }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-6 py-5"
        style={{ borderBottom: '1px solid var(--navy-700)' }}
      >
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg"
          style={{ background: 'var(--gold-500)' }}
        >
          <Building2 size={16} color="white" />
        </div>
        <div>
          <span className="font-display font-semibold text-white text-lg leading-none">LuxStay</span>
          <p className="text-xs mt-0.5" style={{ color: 'var(--slate-400)' }}>Property OS</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navItems.map((group) => (
          <div key={group.group}>
            <p
              className="text-xs font-semibold uppercase tracking-widest px-3 mb-2"
              style={{ color: 'var(--navy-500)' }}
            >
              {group.group}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150"
                      style={{
                        color:      isActive ? 'white' : 'var(--sidebar-text)',
                        background: isActive ? 'var(--navy-700)' : 'transparent',
                      }}
                    >
                      <Icon
                        size={16}
                        style={{ color: isActive ? 'var(--gold-500)' : 'var(--slate-400)' }}
                      />
                      <span className="flex-1">{item.label}</span>
                      {isActive && <ChevronRight size={14} style={{ color: 'var(--gold-500)' }} />}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4" style={{ borderTop: '1px solid var(--navy-700)' }}>
        <div
          className="flex items-center gap-3 px-3 py-2 rounded-lg mb-1"
          style={{ background: 'var(--navy-800)' }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white"
            style={{ background: 'var(--gold-500)' }}
          >
            H
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">Hotel Name</p>
            <p className="text-xs truncate" style={{ color: 'var(--slate-400)' }}>Administrator</p>
          </div>
        </div>
        <button
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full transition-all duration-150"
          style={{ color: 'var(--slate-400)' }}
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
