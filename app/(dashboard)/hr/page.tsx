'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, Plus, X, Shield } from 'lucide-react'

type Staff = { id: string; full_name: string; role: string; phone: string | null; is_active: boolean; last_login_at: string | null }

const ROLES = ['hotel_owner','general_manager','front_desk','housekeeping','accountant','restaurant_staff','maintenance']
const ROLE_LABELS: Record<string, string> = { hotel_owner: 'Hotel Owner', general_manager: 'General Manager', front_desk: 'Front Desk', housekeeping: 'Housekeeping', accountant: 'Accountant', restaurant_staff: 'Restaurant Staff', maintenance: 'Maintenance' }
const ROLE_COLORS: Record<string, { color: string; bg: string }> = {
  hotel_owner: { color: '#92400e', bg: '#fef3c7' },
  general_manager: { color: '#1e40af', bg: '#dbeafe' },
  front_desk: { color: '#065f46', bg: '#d1fae5' },
  housekeeping: { color: '#5b21b6', bg: '#ede9fe' },
  accountant: { color: '#1e40af', bg: '#e0f2fe' },
  restaurant_staff: { color: '#9a3412', bg: '#ffedd5' },
  maintenance: { color: '#374151', bg: '#f3f4f6' },
}

export default function HRPage() {
  const supabase = createClient()
  const [hotelId, setHotelId] = useState<string | null>(null)
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('front_desk')
  const [invitePhone, setInvitePhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [roleFilter, setRoleFilter] = useState('all')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('hotel_id').eq('id', user.id).single()
    if (!profile) return
    setHotelId(profile.hotel_id)
    const { data } = await supabase.from('profiles').select('id, full_name, role, phone, is_active, last_login_at').eq('hotel_id', profile.hotel_id).order('full_name')
    setStaff(data ?? [])
    setLoading(false)
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('profiles').update({ is_active: !current }).eq('id', id)
    setStaff(prev => prev.map(s => s.id === id ? { ...s, is_active: !current } : s))
  }

  const filtered = staff.filter(s => roleFilter === 'all' || s.role === roleFilter)

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading staff...</div>

  return (
    <div className="hr-root">
      <div className="hr-header">
        <div>
          <h2 className="hr-title">Staff & HR</h2>
          <p className="hr-sub">{staff.length} team members · {staff.filter(s => s.is_active).length} active</p>
        </div>
        <button className="hr-invite-btn" onClick={() => setShowInvite(true)}><Plus size={15} /> Add Staff Member</button>
      </div>

      <div className="hr-stats">
        {ROLES.map(role => {
          const count = staff.filter(s => s.role === role).length
          if (count === 0) return null
          const cfg = ROLE_COLORS[role] ?? { color: '#475569', bg: '#f1f5f9' }
          return (
            <div key={role} className="hr-stat" style={{ borderColor: cfg.color + '40', background: cfg.bg }}>
              <p className="hr-stat-num" style={{ color: cfg.color }}>{count}</p>
              <p className="hr-stat-label">{ROLE_LABELS[role]}</p>
            </div>
          )
        })}
      </div>

      <div className="hr-filters">
        <button className="hr-filter-btn" data-active={roleFilter === 'all'} onClick={() => setRoleFilter('all')}>All</button>
        {ROLES.filter(r => staff.some(s => s.role === r)).map(role => (
          <button key={role} className="hr-filter-btn" data-active={roleFilter === role} onClick={() => setRoleFilter(role)}>
            {ROLE_LABELS[role]}
          </button>
        ))}
      </div>

      <div className="hr-list">
        {filtered.map(s => {
          const cfg = ROLE_COLORS[s.role] ?? { color: '#475569', bg: '#f1f5f9' }
          return (
            <div key={s.id} className="hr-row" data-inactive={!s.is_active}>
              <div className="hr-avatar">{s.full_name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}</div>
              <div className="hr-info">
                <p className="hr-name">{s.full_name}</p>
                <div className="hr-meta">
                  <span className="hr-role" style={{ color: cfg.color, background: cfg.bg }}>{ROLE_LABELS[s.role]}</span>
                  {s.phone && <span className="hr-phone">{s.phone}</span>}
                </div>
              </div>
              <div className="hr-right">
                {s.last_login_at && <p className="hr-last-login">Last login: {new Date(s.last_login_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}</p>}
                <button className="hr-toggle" data-active={s.is_active} onClick={() => toggleActive(s.id, s.is_active)}>
                  {s.is_active ? 'Active' : 'Inactive'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {showInvite && (
        <div className="modal-overlay" onClick={() => setShowInvite(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Staff Member</h3>
              <button className="modal-close" onClick={() => setShowInvite(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="hr-invite-note">
                <Shield size={14} style={{ color: 'var(--navy-600)', flexShrink: 0 }} />
                <p>The staff member will receive a login invitation. They will only see data permitted by their role.</p>
              </div>
              <div className="modal-field"><label>Full Name *</label><input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Jane Smith" /></div>
              <div className="modal-field"><label>Email Address *</label><input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="staff@hotel.com" /></div>
              <div className="modal-field"><label>Phone</label><input value={invitePhone} onChange={e => setInvitePhone(e.target.value)} placeholder="+234..." /></div>
              <div className="modal-field">
                <label>Role *</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                  {ROLES.filter(r => r !== 'hotel_owner').map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-cancel" onClick={() => setShowInvite(false)}>Cancel</button>
              <button className="modal-save" disabled={!inviteName || !inviteEmail} onClick={async () => {
                if (!hotelId) return
                setSaving(true)
                // Create auth user via Supabase admin — in production use edge function
                // For now, create profile placeholder
                alert(`In production, this sends an invitation email to ${inviteEmail}. The staff member creates their own password. This requires a Supabase Edge Function for the invitation flow — noted for next build session.`)
                setShowInvite(false)
                setSaving(false)
              }}>
                {saving ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .hr-root { max-width: 900px; margin: 0 auto; }
        .hr-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; gap: 16px; flex-wrap: wrap; }
        .hr-title { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .hr-sub { font-size: 13px; color: var(--text-muted); margin: 4px 0 0; }
        .hr-invite-btn { display: flex; align-items: center; gap: 6px; padding: 10px 18px; background: var(--navy-800); color: white; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: none; border-radius: 8px; cursor: pointer; }
        .hr-stats { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
        .hr-stat { border: 1.5px solid; border-radius: 10px; padding: 12px 16px; text-align: center; min-width: 100px; }
        .hr-stat-num { font-size: 20px; font-weight: 800; margin: 0; }
        .hr-stat-label { font-size: 11px; font-weight: 600; margin: 3px 0 0; color: var(--slate-600); }
        .hr-filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
        .hr-filter-btn { padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1px solid var(--slate-200); background: white; color: var(--slate-500); cursor: pointer; }
        .hr-filter-btn[data-active="true"] { background: var(--navy-800); border-color: var(--navy-800); color: white; }
        .hr-list { display: flex; flex-direction: column; gap: 8px; }
        .hr-row { display: flex; align-items: center; gap: 14px; background: white; border: 1px solid var(--slate-200); border-radius: 12px; padding: 14px 18px; }
        .hr-row[data-inactive="true"] { opacity: 0.5; }
        .hr-avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--navy-700); color: white; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .hr-info { flex: 1; min-width: 0; }
        .hr-name { font-size: 14px; font-weight: 600; color: var(--slate-800); margin: 0 0 4px; }
        .hr-meta { display: flex; align-items: center; gap: 10px; }
        .hr-role { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 20px; }
        .hr-phone { font-size: 12px; color: var(--text-muted); }
        .hr-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
        .hr-last-login { font-size: 11px; color: var(--text-muted); margin: 0; }
        .hr-toggle { padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; font-family: 'DM Sans', sans-serif; border: 1.5px solid var(--slate-200); background: white; color: var(--slate-400); cursor: pointer; }
        .hr-toggle[data-active="true"] { background: #d1fae5; border-color: #6ee7b7; color: #065f46; }
        .hr-invite-note { display: flex; align-items: flex-start; gap: 8px; background: var(--slate-100); border-radius: 8px; padding: 10px 12px; font-size: 12px; color: var(--slate-600); }
        .hr-invite-note p { margin: 0; line-height: 1.5; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .modal-card { background: white; border-radius: 16px; width: 100%; max-width: 480px; box-shadow: 0 24px 48px rgba(0,0,0,0.2); overflow: hidden; }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--slate-200); }
        .modal-header h3 { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .modal-close { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--slate-200); background: white; color: var(--slate-400); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; }
        .modal-field { display: flex; flex-direction: column; gap: 6px; }
        .modal-field label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--slate-500); }
        .modal-field input, .modal-field select { padding: 10px 12px; border: 1px solid var(--slate-200); border-radius: 8px; font-size: 14px; font-family: 'DM Sans', sans-serif; color: var(--slate-800); outline: none; }
        .modal-footer { display: flex; gap: 10px; justify-content: flex-end; padding: 16px 24px; border-top: 1px solid var(--slate-200); }
        .modal-cancel { padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1px solid var(--slate-200); background: white; color: var(--slate-600); cursor: pointer; }
        .modal-save { padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; background: var(--navy-800); color: white; border: none; cursor: pointer; }
        .modal-save:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  )
}
