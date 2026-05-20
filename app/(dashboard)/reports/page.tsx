'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart3, TrendingUp, BedDouble, Users, DollarSign, Download } from 'lucide-react'

type Snapshot = { date: string; occupancy: number; revenue: number; rooms: number }

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n)
}

export default function ReportsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalRooms: 0, occupied: 0, totalRevenue: 0, totalReservations: 0, totalGuests: 0, avgRate: 0, occupancyRate: 0, checkedInToday: 0, arrivals: 0, departures: 0 })
  const [reservationsBySource, setReservationsBySource] = useState<{ source: string; count: number }[]>([])
  const [recentRevenue, setRecentRevenue] = useState<Snapshot[]>([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('hotel_id').eq('id', user.id).single()
    if (!profile) return

    const today = new Date().toISOString().split('T')[0]

    const [
      { data: rooms },
      { data: reservations },
      { data: guests },
      { data: payments },
    ] = await Promise.all([
      supabase.from('rooms').select('status').eq('hotel_id', profile.hotel_id).eq('is_active', true),
      supabase.from('reservations').select('status, source, rate_per_night, check_in_date, check_out_date').eq('hotel_id', profile.hotel_id),
      supabase.from('guests').select('id').eq('hotel_id', profile.hotel_id),
      supabase.from('payments').select('amount').eq('hotel_id', profile.hotel_id),
    ])

    const totalRooms = rooms?.length ?? 0
    const occupied = rooms?.filter(r => r.status === 'occupied').length ?? 0
    const occupancyRate = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0
    const totalRevenue = payments?.reduce((sum, p) => sum + p.amount, 0) ?? 0
    const checkedIn = reservations?.filter(r => r.status === 'checked_in') ?? []
    const avgRate = checkedIn.length > 0 ? checkedIn.reduce((sum, r) => sum + r.rate_per_night, 0) / checkedIn.length : 0

    const todayArrivals = reservations?.filter(r => r.check_in_date === today && ['confirmed','tentative'].includes(r.status)).length ?? 0
    const todayDepartures = reservations?.filter(r => r.check_out_date === today && r.status === 'checked_in').length ?? 0

    // Group by source
    const sourceMap: Record<string, number> = {}
    reservations?.forEach(r => { sourceMap[r.source] = (sourceMap[r.source] ?? 0) + 1 })
    const bySource = Object.entries(sourceMap).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count)

    setStats({ totalRooms, occupied, totalRevenue, totalReservations: reservations?.length ?? 0, totalGuests: guests?.length ?? 0, avgRate, occupancyRate, checkedInToday: checkedIn.length, arrivals: todayArrivals, departures: todayDepartures })
    setReservationsBySource(bySource)
    setLoading(false)
  }

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading reports...</div>

  return (
    <div className="rpt-root">
      <div className="rpt-header">
        <div>
          <h2 className="rpt-title">Reports & Analytics</h2>
          <p className="rpt-sub">Live performance data for your property</p>
        </div>
        <button className="rpt-export-btn"><Download size={14} /> Export CSV</button>
      </div>

      {/* Main KPIs */}
      <div className="rpt-kpis">
        {[
          { label: 'Occupancy Rate', value: `${stats.occupancyRate}%`, sub: `${stats.occupied} of ${stats.totalRooms} rooms`, icon: BedDouble, color: '#c9a84c', bg: '#faf5e8' },
          { label: 'Total Revenue', value: formatCurrency(stats.totalRevenue), sub: 'All payments received', icon: DollarSign, color: '#10b981', bg: '#d1fae5' },
          { label: 'Avg Daily Rate', value: formatCurrency(stats.avgRate), sub: 'Current in-house rate', icon: TrendingUp, color: '#3b82f6', bg: '#dbeafe' },
          { label: 'Total Guests', value: stats.totalGuests.toString(), sub: 'In guest database', icon: Users, color: '#8b5cf6', bg: '#ede9fe' },
        ].map(k => (
          <div key={k.label} className="rpt-kpi">
            <div className="rpt-kpi-icon" style={{ background: k.bg }}>
              <k.icon size={18} style={{ color: k.color }} />
            </div>
            <div>
              <p className="rpt-kpi-value">{k.value}</p>
              <p className="rpt-kpi-label">{k.label}</p>
              <p className="rpt-kpi-sub">{k.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Today */}
      <div className="rpt-section">
        <h3 className="rpt-section-title">Today&apos;s Activity</h3>
        <div className="rpt-today-grid">
          <div className="rpt-today-item">
            <p className="rpt-today-num" style={{ color: '#10b981' }}>{stats.arrivals}</p>
            <p className="rpt-today-label">Expected Arrivals</p>
          </div>
          <div className="rpt-today-item">
            <p className="rpt-today-num" style={{ color: '#3b82f6' }}>{stats.departures}</p>
            <p className="rpt-today-label">Expected Departures</p>
          </div>
          <div className="rpt-today-item">
            <p className="rpt-today-num" style={{ color: '#c9a84c' }}>{stats.checkedInToday}</p>
            <p className="rpt-today-label">Currently In-House</p>
          </div>
          <div className="rpt-today-item">
            <p className="rpt-today-num">{stats.totalRooms - stats.occupied}</p>
            <p className="rpt-today-label">Available Rooms</p>
          </div>
        </div>
      </div>

      {/* Source breakdown */}
      <div className="rpt-section">
        <h3 className="rpt-section-title">Reservations by Source</h3>
        <div className="rpt-source-list">
          {reservationsBySource.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No reservations yet</p>
          ) : (
            reservationsBySource.map(s => {
              const pct = stats.totalReservations > 0 ? Math.round((s.count / stats.totalReservations) * 100) : 0
              return (
                <div key={s.source} className="rpt-source-row">
                  <span className="rpt-source-name">{s.source.replace('_', ' ')}</span>
                  <div className="rpt-source-bar-wrap">
                    <div className="rpt-source-bar" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="rpt-source-count">{s.count} ({pct}%)</span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Room status breakdown */}
      <div className="rpt-section">
        <h3 className="rpt-section-title">Room Status Summary</h3>
        <div className="rpt-room-grid">
          {[
            { label: 'Available',    color: '#10b981', bg: '#d1fae5', status: 'available' },
            { label: 'Occupied',     color: '#3b82f6', bg: '#dbeafe', status: 'occupied' },
            { label: 'Dirty',        color: '#f59e0b', bg: '#fef3c7', status: 'dirty' },
            { label: 'Maintenance',  color: '#ef4444', bg: '#fee2e2', status: 'maintenance' },
          ].map(r => (
            <div key={r.label} className="rpt-room-card" style={{ borderColor: r.color, background: r.bg }}>
              <p className="rpt-room-num" style={{ color: r.color }}>{stats.occupied}</p>
              <p className="rpt-room-label">{r.label}</p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .rpt-root { max-width: 1000px; margin: 0 auto; }
        .rpt-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 16px; flex-wrap: wrap; }
        .rpt-title { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .rpt-sub { font-size: 13px; color: var(--text-muted); margin: 4px 0 0; }
        .rpt-export-btn { display: flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1px solid var(--slate-200); background: white; color: var(--slate-600); cursor: pointer; }
        .rpt-kpis { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin-bottom: 28px; }
        @media (max-width: 640px) { .rpt-kpis { grid-template-columns: repeat(2,1fr); } }
        .rpt-kpi { background: white; border: 1px solid var(--slate-200); border-radius: 14px; padding: 18px; display: flex; gap: 14px; align-items: flex-start; }
        .rpt-kpi-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .rpt-kpi-value { font-size: 20px; font-weight: 800; color: var(--slate-800); margin: 0; }
        .rpt-kpi-label { font-size: 12px; font-weight: 600; color: var(--slate-600); margin: 2px 0 0; }
        .rpt-kpi-sub { font-size: 11px; color: var(--text-muted); margin: 2px 0 0; }
        .rpt-section { background: white; border: 1px solid var(--slate-200); border-radius: 14px; padding: 20px; margin-bottom: 16px; }
        .rpt-section-title { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 700; color: var(--slate-800); margin: 0 0 16px; }
        .rpt-today-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; }
        @media (max-width: 640px) { .rpt-today-grid { grid-template-columns: repeat(2,1fr); } }
        .rpt-today-item { background: var(--slate-100); border-radius: 10px; padding: 14px; text-align: center; }
        .rpt-today-num { font-size: 28px; font-weight: 800; margin: 0; color: var(--slate-800); }
        .rpt-today-label { font-size: 11px; color: var(--text-muted); margin: 4px 0 0; }
        .rpt-source-list { display: flex; flex-direction: column; gap: 10px; }
        .rpt-source-row { display: flex; align-items: center; gap: 12px; }
        .rpt-source-name { font-size: 13px; font-weight: 600; color: var(--slate-700); width: 120px; flex-shrink: 0; text-transform: capitalize; }
        .rpt-source-bar-wrap { flex: 1; height: 8px; background: var(--slate-100); border-radius: 20px; overflow: hidden; }
        .rpt-source-bar { height: 100%; background: var(--navy-700); border-radius: 20px; transition: width 0.5s; min-width: 4px; }
        .rpt-source-count { font-size: 12px; color: var(--text-muted); width: 80px; text-align: right; flex-shrink: 0; }
        .rpt-room-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; }
        @media (max-width: 640px) { .rpt-room-grid { grid-template-columns: repeat(2,1fr); } }
        .rpt-room-card { border: 1.5px solid; border-radius: 10px; padding: 14px; text-align: center; }
        .rpt-room-num { font-size: 28px; font-weight: 800; margin: 0; }
        .rpt-room-label { font-size: 12px; font-weight: 600; margin: 4px 0 0; }
      `}</style>
    </div>
  )
}
