import {
  BedDouble, TrendingUp, Users, UtensilsCrossed,
  CalendarCheck, AlertCircle, Sparkles, ArrowRight
} from 'lucide-react'
import { KpiCard } from '@/components/ui/cards/KpiCard'

const recentReservations = [
  { id: 'LUX-2026-00142', guest: 'Adaeze Okonkwo',  room: '204',    type: 'Deluxe',   checkIn: 'Today',  checkOut: '23 May', status: 'checked_in',  amount: '₦85,000'  },
  { id: 'LUX-2026-00141', guest: 'Emeka Nwosu',     room: '101',    type: 'Standard', checkIn: 'Today',  checkOut: '21 May', status: 'confirmed',   amount: '₦45,000'  },
  { id: 'LUX-2026-00140', guest: 'Fatima Al-Hassan',room: 'Suite A',type: 'Suite',    checkIn: '20 May', checkOut: '25 May', status: 'confirmed',   amount: '₦210,000' },
  { id: 'LUX-2026-00139', guest: 'Chidi Obi',       room: '312',    type: 'Standard', checkIn: '18 May', checkOut: 'Today',  status: 'checked_out', amount: '₦90,000'  },
  { id: 'LUX-2026-00138', guest: 'Ngozi Eze',       room: '205',    type: 'Deluxe',   checkIn: '17 May', checkOut: 'Today',  status: 'no_show',     amount: '₦85,000'  },
]

const roomActivity = [
  { room: '101',  status: 'dirty',       task: 'Awaiting housekeeping', time: '10 min ago' },
  { room: '204',  status: 'occupied',    task: 'Guest checked in',      time: '32 min ago' },
  { room: '312',  status: 'available',   task: 'Room cleared',          time: '1 hr ago'   },
  { room: '105',  status: 'maintenance', task: 'AC repair in progress', time: '2 hr ago'   },
]

const alerts = [
  { label: 'Outstanding balances',    value: '3 folios',  color: '#ef4444' },
  { label: 'Rooms pending clean',     value: '6 rooms',   color: '#f59e0b' },
  { label: 'Open maintenance tickets',value: '2 tickets', color: '#f59e0b' },
  { label: 'Pending check-outs',      value: '8 guests',  color: '#3b82f6' },
]

export default function OverviewPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* AI Morning Briefing */}
      <div
        className="rounded-xl px-5 py-4 flex items-start gap-4"
        style={{
          background: 'linear-gradient(135deg, var(--navy-900) 0%, var(--navy-700) 100%)',
          border: '1px solid var(--navy-600)'
        }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: 'var(--gold-500)' }}
        >
          <span className="text-white text-sm font-bold">AI</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-white mb-1">Morning Briefing</p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--slate-400)' }}>
            Last night your occupancy was{' '}
            <span className="text-white font-medium">78%</span> — up from 61% the same day last week.
            Your best channel was{' '}
            <span className="text-white font-medium">direct bookings (34%)</span>.
            You have{' '}
            <span className="text-white font-medium">8 check-outs and 11 check-ins today</span>.
            Consider confirming room readiness for the 3 VIP arrivals before noon.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Occupancy Rate"
          value="78%"
          subvalue="42 of 54 rooms occupied"
          trend={17}
          icon={BedDouble}
          iconColor="#c9a84c"
          iconBg="#faf5e8"
        />
        <KpiCard
          label="Today's Revenue"
          value="₦1.24M"
          subvalue="Rooms + F&B combined"
          trend={8}
          icon={TrendingUp}
          iconColor="#10b981"
          iconBg="#d1fae5"
        />
        <KpiCard
          label="Arrivals Today"
          value="11"
          subvalue="3 VIP guests"
          icon={Users}
          iconColor="#3b82f6"
          iconBg="#dbeafe"
        />
        <KpiCard
          label="F&B Revenue"
          value="₦184,000"
          subvalue="Restaurant + bar"
          trend={-3}
          icon={UtensilsCrossed}
          iconColor="#8b5cf6"
          iconBg="#ede9fe"
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent Reservations */}
        <div
          className="lg:col-span-2 rounded-xl overflow-hidden"
          style={{
            background:  'var(--card-bg)',
            border:      '1px solid var(--card-border)',
            boxShadow:   '0 1px 3px rgba(0,0,0,0.04)'
          }}
        >
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--slate-200)' }}
          >
            <div className="flex items-center gap-2">
              <CalendarCheck size={16} style={{ color: 'var(--gold-500)' }} />
              <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                Recent Reservations
              </h2>
            </div>
            <button className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--navy-600)' }}>
              View all <ArrowRight size={12} />
            </button>
          </div>

          <div className="divide-y" style={{ borderColor: 'var(--slate-200)' }}>
            {recentReservations.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white"
                  style={{ background: 'var(--navy-700)' }}
                >
                  {r.guest.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {r.guest}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    Room {r.room} · {r.type} · {r.checkIn} → {r.checkOut}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{r.amount}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full status-${r.status}`}>
                    {r.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Alerts */}
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: 'var(--card-bg)',
              border:     '1px solid var(--card-border)',
              boxShadow:  '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            <div
              className="flex items-center gap-2 px-5 py-4"
              style={{ borderBottom: '1px solid var(--slate-200)' }}
            >
              <AlertCircle size={16} style={{ color: '#ef4444' }} />
              <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                Needs Attention
              </h2>
            </div>
            <div className="p-4 space-y-3">
              {alerts.map((a) => (
                <div key={a.label} className="flex items-center justify-between">
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{a.label}</p>
                  <span className="text-sm font-semibold" style={{ color: a.color }}>{a.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Room Activity */}
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: 'var(--card-bg)',
              border:     '1px solid var(--card-border)',
              boxShadow:  '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            <div
              className="flex items-center gap-2 px-5 py-4"
              style={{ borderBottom: '1px solid var(--slate-200)' }}
            >
              <Sparkles size={16} style={{ color: 'var(--gold-500)' }} />
              <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                Room Activity
              </h2>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--slate-200)' }}>
              {roomActivity.map((a) => (
                <div key={a.room} className="flex items-center gap-3 px-5 py-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: 'var(--slate-100)', color: 'var(--text-secondary)' }}
                  >
                    {a.room}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {a.task}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.time}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full status-${a.status}`}>
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
