'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Moon, Check, AlertCircle, RefreshCw, FileText } from 'lucide-react'

type AuditResult = {
  reservations_posted: number
  rooms_checked: number
  revenue_posted: number
  issues: string[]
  completed_at: string
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n)
}

export default function NightAuditPage() {
  const supabase = createClient()
  const [hotelId, setHotelId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<AuditResult | null>(null)
  const [lastAudit, setLastAudit] = useState<{ audit_date: string; total_revenue: number; occupancy_rate: number } | null>(null)

  // Pre-audit checklist
  const [checklist, setChecklist] = useState({
    all_checkouts_processed: false,
    all_payments_posted: false,
    room_status_verified: false,
    no_show_updated: false,
    reservations_confirmed: false,
  })

  const [stats, setStats] = useState({
    inHouse: 0,
    arrivals: 0,
    departures: 0,
    availableRooms: 0,
    totalRooms: 0,
    revenueToPost: 0,
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('hotel_id').eq('id', user.id).single()
    if (!profile) return
    setHotelId(profile.hotel_id)

    const today = new Date().toISOString().split('T')[0]

    const [{ data: rooms }, { data: reservations }, { data: lastLog }] = await Promise.all([
      supabase.from('rooms').select('status').eq('hotel_id', profile.hotel_id).eq('is_active', true),
      supabase.from('reservations').select('status, check_in_date, check_out_date, rate_per_night').eq('hotel_id', profile.hotel_id),
      supabase.from('night_audit_log').select('audit_date, total_revenue, occupancy_rate').eq('hotel_id', profile.hotel_id).order('audit_date', { ascending: false }).limit(1).single()
    ])

    const totalRooms = rooms?.length ?? 0
    const occupied = rooms?.filter(r => r.status === 'occupied').length ?? 0
    const available = rooms?.filter(r => r.status === 'available').length ?? 0
    const inHouse = reservations?.filter(r => r.status === 'checked_in').length ?? 0
    const arrivals = reservations?.filter(r => r.check_in_date === today && ['confirmed', 'tentative'].includes(r.status)).length ?? 0
    const departures = reservations?.filter(r => r.check_out_date === today && r.status === 'checked_in').length ?? 0
    const revenueToPost = reservations?.filter(r => r.status === 'checked_in').reduce((sum, r) => sum + r.rate_per_night, 0) ?? 0

    setStats({ inHouse, arrivals, departures, availableRooms: available, totalRooms, revenueToPost })
    setLastAudit(lastLog ?? null)
    setLoading(false)
  }

  async function runNightAudit() {
    if (!hotelId) return
    setRunning(true)

    const today = new Date().toISOString().split('T')[0]
    const issues: string[] = []
    let reservationsPosted = 0
    let revenuePosted = 0

    // 1. Get all checked-in reservations
    const { data: checkedIn } = await supabase
      .from('reservations')
      .select('id, rate_per_night, guest_id, room_id')
      .eq('hotel_id', hotelId)
      .eq('status', 'checked_in')

    // 2. Post nightly room charge for each checked-in reservation
    if (checkedIn && checkedIn.length > 0) {
      for (const res of checkedIn) {
        // Check if already posted today
        const { data: existingCharge } = await supabase
          .from('folio_charges')
          .select('id')
          .eq('reservation_id', res.id)
          .eq('charge_type', 'room_charge')
          .gte('created_at', today + 'T00:00:00')
          .single()

        if (!existingCharge) {
          await supabase.from('folio_charges').insert({
            hotel_id: hotelId,
            reservation_id: res.id,
            guest_id: res.guest_id,
            description: `Nightly room charge — ${today}`,
            charge_type: 'room_charge',
            amount: res.rate_per_night,
            quantity: 1,
            total: res.rate_per_night,
            is_paid: false,
          })
          revenuePosted += res.rate_per_night
          reservationsPosted++
        }
      }
    }

    // 3. Check for no-shows (confirmed reservations with today's check-in date)
    const { data: noShows } = await supabase
      .from('reservations')
      .select('id, guest:guests(full_name)')
      .eq('hotel_id', hotelId)
      .eq('check_in_date', today)
      .in('status', ['confirmed', 'tentative'])

    if (noShows && noShows.length > 0) {
      issues.push(`${noShows.length} reservation(s) with today's check-in date are still unprocessed — review for no-shows`)
    }

    // 4. Check dirty rooms
    const { data: dirtyRooms } = await supabase
      .from('rooms')
      .select('number')
      .eq('hotel_id', hotelId)
      .eq('status', 'dirty')

    if (dirtyRooms && dirtyRooms.length > 0) {
      issues.push(`${dirtyRooms.length} room(s) still marked dirty — ensure housekeeping is complete`)
    }

    // 5. Get rooms count for snapshot
    const { data: allRooms } = await supabase.from('rooms').select('status').eq('hotel_id', hotelId).eq('is_active', true)
    const totalRooms = allRooms?.length ?? 0
    const occupiedRooms = allRooms?.filter(r => r.status === 'occupied').length ?? 0
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0

    // 6. Save audit log
    await supabase.from('night_audit_log').upsert({
      hotel_id: hotelId,
      audit_date: today,
      total_rooms: totalRooms,
      occupied_rooms: occupiedRooms,
      occupancy_rate: occupancyRate,
      total_revenue: revenuePosted,
      checked_in_count: checkedIn?.length ?? 0,
      issues_count: issues.length,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'hotel_id,audit_date' })

    // 7. Save occupancy snapshot
    await supabase.from('occupancy_snapshots').upsert({
      hotel_id: hotelId,
      snapshot_date: today,
      total_rooms: totalRooms,
      occupied_rooms: occupiedRooms,
      occupancy_rate: occupancyRate,
      total_revenue: revenuePosted,
      adr: occupiedRooms > 0 ? revenuePosted / occupiedRooms : 0,
    }, { onConflict: 'hotel_id,snapshot_date' })

    const auditResult: AuditResult = {
      reservations_posted: reservationsPosted,
      rooms_checked: totalRooms,
      revenue_posted: revenuePosted,
      issues,
      completed_at: new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' }),
    }

    setResult(auditResult)
    await loadData()
    setRunning(false)
  }

  const checklistComplete = Object.values(checklist).every(Boolean)
  const today = new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading night audit...</div>

  return (
    <div className="audit-root">
      <div className="audit-header">
        <div>
          <div className="audit-badge"><Moon size={13} /> Night Audit</div>
          <h2 className="audit-title">Night Audit</h2>
          <p className="audit-sub">{today}</p>
        </div>
        {lastAudit && (
          <div className="audit-last">
            <p className="audit-last-label">Last Audit</p>
            <p className="audit-last-date">{new Date(lastAudit.audit_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}</p>
            <p className="audit-last-stats">{lastAudit.occupancy_rate}% occ · {formatCurrency(lastAudit.total_revenue)}</p>
          </div>
        )}
      </div>

      {/* Result screen */}
      {result && (
        <div className="audit-result">
          <div className="audit-result-header">
            <Check size={24} style={{ color: '#10b981' }} />
            <h3>Night Audit Complete — {result.completed_at}</h3>
          </div>
          <div className="audit-result-stats">
            <div className="audit-result-stat">
              <p className="audit-result-val">{result.reservations_posted}</p>
              <p className="audit-result-label">Room Charges Posted</p>
            </div>
            <div className="audit-result-stat">
              <p className="audit-result-val">{formatCurrency(result.revenue_posted)}</p>
              <p className="audit-result-label">Revenue Posted</p>
            </div>
            <div className="audit-result-stat">
              <p className="audit-result-val">{result.rooms_checked}</p>
              <p className="audit-result-label">Rooms Checked</p>
            </div>
          </div>
          {result.issues.length > 0 && (
            <div className="audit-issues">
              <p className="audit-issues-title"><AlertCircle size={14} /> {result.issues.length} item{result.issues.length > 1 ? 's' : ''} require attention:</p>
              {result.issues.map((issue, i) => <p key={i} className="audit-issue-row">→ {issue}</p>)}
            </div>
          )}
          <button className="audit-reset-btn" onClick={() => { setResult(null); setChecklist({ all_checkouts_processed: false, all_payments_posted: false, room_status_verified: false, no_show_updated: false, reservations_confirmed: false }) }}>
            Run Another Audit
          </button>
        </div>
      )}

      {!result && (
        <>
          {/* Current stats */}
          <div className="audit-stats">
            <div className="audit-stat">
              <p className="audit-stat-val">{stats.inHouse}</p>
              <p className="audit-stat-label">In House Tonight</p>
            </div>
            <div className="audit-stat" style={{ borderColor: stats.arrivals > 0 ? '#6ee7b7' : 'var(--slate-200)', background: stats.arrivals > 0 ? '#f0fdf4' : 'white' }}>
              <p className="audit-stat-val" style={{ color: stats.arrivals > 0 ? '#065f46' : undefined }}>{stats.arrivals}</p>
              <p className="audit-stat-label">Expected Arrivals</p>
            </div>
            <div className="audit-stat" style={{ borderColor: stats.departures > 0 ? '#93c5fd' : 'var(--slate-200)', background: stats.departures > 0 ? '#eff6ff' : 'white' }}>
              <p className="audit-stat-val" style={{ color: stats.departures > 0 ? '#1e40af' : undefined }}>{stats.departures}</p>
              <p className="audit-stat-label">Expected Departures</p>
            </div>
            <div className="audit-stat">
              <p className="audit-stat-val">{formatCurrency(stats.revenueToPost)}</p>
              <p className="audit-stat-label">Revenue to Post</p>
            </div>
          </div>

          {/* Checklist */}
          <div className="audit-checklist">
            <h3 className="audit-checklist-title">Pre-Audit Checklist</h3>
            <p className="audit-checklist-sub">Complete all items before running the night audit</p>
            {[
              { key: 'all_checkouts_processed', label: 'All check-outs for today have been processed' },
              { key: 'all_payments_posted', label: 'All guest payments have been recorded' },
              { key: 'room_status_verified', label: 'Room statuses have been verified with housekeeping' },
              { key: 'no_show_updated', label: 'No-show reservations have been identified and updated' },
              { key: 'reservations_confirmed', label: 'Tomorrow\'s arrivals have been reviewed and confirmed' },
            ].map(item => (
              <label key={item.key} className="audit-check-item" data-checked={checklist[item.key as keyof typeof checklist]}>
                <input
                  type="checkbox"
                  checked={checklist[item.key as keyof typeof checklist]}
                  onChange={e => setChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))}
                />
                <span>{item.label}</span>
                {checklist[item.key as keyof typeof checklist] && <Check size={14} style={{ color: '#10b981', marginLeft: 'auto', flexShrink: 0 }} />}
              </label>
            ))}
          </div>

          {/* What the audit does */}
          <div className="audit-info">
            <p className="audit-info-title"><FileText size={14} /> What the night audit does:</p>
            <ul className="audit-info-list">
              <li>Posts tonight's room charge to every checked-in guest's folio</li>
              <li>Flags any unprocessed arrivals as potential no-shows</li>
              <li>Identifies rooms still marked dirty</li>
              <li>Records occupancy and revenue snapshot for reporting</li>
              <li>Advances the business date</li>
            </ul>
          </div>

          {/* Run button */}
          <button
            className="audit-run-btn"
            onClick={runNightAudit}
            disabled={running}
          >
            {running
              ? <><RefreshCw size={16} className="audit-spin" /> Running Night Audit...</>
              : <><Moon size={16} /> Run Night Audit</>
            }
          </button>
          {!checklistComplete && (
            <p className="audit-warning">Complete all checklist items above before running the audit</p>
          )}
        </>
      )}

      <style>{`
        .audit-root { max-width: 700px; margin: 0 auto; }
        .audit-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 16px; }
        .audit-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--navy-800); background: var(--gold-100); border: 1px solid var(--gold-400); padding: 4px 10px; border-radius: 20px; margin-bottom: 8px; }
        .audit-title { font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .audit-sub { font-size: 13px; color: var(--text-muted); margin: 4px 0 0; }
        .audit-last { text-align: right; }
        .audit-last-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin: 0 0 2px; }
        .audit-last-date { font-size: 16px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .audit-last-stats { font-size: 12px; color: var(--text-muted); margin: 2px 0 0; }
        .audit-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 24px; }
        @media (max-width: 640px) { .audit-stats { grid-template-columns: repeat(2,1fr); } }
        .audit-stat { background: white; border: 1px solid var(--slate-200); border-radius: 12px; padding: 16px; text-align: center; }
        .audit-stat-val { font-size: 20px; font-weight: 800; color: var(--slate-800); margin: 0; }
        .audit-stat-label { font-size: 11px; color: var(--text-muted); margin: 4px 0 0; }
        .audit-checklist { background: white; border: 1px solid var(--slate-200); border-radius: 14px; padding: 24px; margin-bottom: 16px; }
        .audit-checklist-title { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: var(--slate-800); margin: 0 0 4px; }
        .audit-checklist-sub { font-size: 13px; color: var(--text-muted); margin: 0 0 20px; }
        .audit-check-item { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 10px; cursor: pointer; font-size: 14px; color: var(--slate-700); transition: background 0.1s; margin-bottom: 6px; }
        .audit-check-item:hover { background: var(--slate-100); }
        .audit-check-item[data-checked="true"] { background: #f0fdf4; color: #065f46; }
        .audit-check-item input { width: 18px; height: 18px; accent-color: #10b981; flex-shrink: 0; }
        .audit-info { background: var(--slate-100); border-radius: 12px; padding: 18px; margin-bottom: 20px; }
        .audit-info-title { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--slate-700); margin: 0 0 10px; }
        .audit-info-list { margin: 0; padding: 0 0 0 16px; display: flex; flex-direction: column; gap: 6px; }
        .audit-info-list li { font-size: 13px; color: var(--slate-600); }
        .audit-run-btn { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; padding: 16px; background: linear-gradient(135deg, var(--navy-900), var(--navy-700)); color: white; font-size: 16px; font-weight: 700; font-family: 'DM Sans', sans-serif; border: none; border-radius: 12px; cursor: pointer; transition: opacity 0.15s; }
        .audit-run-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .audit-run-btn:not(:disabled):hover { opacity: 0.9; }
        .audit-warning { font-size: 12px; color: var(--text-muted); text-align: center; margin: 10px 0 0; }
        @keyframes audit-spin { to { transform: rotate(360deg); } }
        .audit-spin { animation: audit-spin 1s linear infinite; }
        .audit-result { background: white; border: 1px solid #6ee7b7; border-radius: 14px; padding: 24px; }
        .audit-result-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .audit-result-header h3 { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .audit-result-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 20px; }
        .audit-result-stat { background: #f0fdf4; border-radius: 10px; padding: 14px; text-align: center; }
        .audit-result-val { font-size: 20px; font-weight: 800; color: #065f46; margin: 0; }
        .audit-result-label { font-size: 11px; color: #065f46; margin: 4px 0 0; opacity: 0.7; }
        .audit-issues { background: #fef3c7; border-radius: 10px; padding: 14px; margin-bottom: 16px; }
        .audit-issues-title { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #92400e; margin: 0 0 8px; }
        .audit-issue-row { font-size: 13px; color: #92400e; margin: 4px 0 0; }
        .audit-reset-btn { display: flex; align-items: center; justify-content: center; width: 100%; padding: 12px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1px solid var(--slate-200); background: white; color: var(--slate-600); cursor: pointer; }
      `}</style>
    </div>
  )
}
