'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Plus, X, Star, Phone, Mail, Calendar, TrendingUp } from 'lucide-react'

type Guest = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  nationality: string | null
  id_type: string | null
  id_number: string | null
  date_of_birth: string | null
  vip_flag: boolean
  vip_notes: string | null
  loyalty_tier: string
  total_stays: number
  total_spend: number
  last_stay_at: string | null
  marketing_opt_in: boolean
  created_at: string
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n)
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

const TIER_CONFIG: Record<string, { color: string; bg: string }> = {
  standard: { color: '#475569', bg: '#f1f5f9' },
  silver:   { color: '#475569', bg: '#e2e8f0' },
  gold:     { color: '#92400e', bg: '#fef3c7' },
  platinum: { color: '#1e40af', bg: '#dbeafe' },
}

export default function GuestsPage() {
  const supabase = createClient()
  const [hotelId, setHotelId] = useState<string | null>(null)
  const [guests, setGuests] = useState<Guest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Guest | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [vipFilter, setVipFilter] = useState(false)

  // New guest form
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [nationality, setNationality] = useState('')
  const [idType, setIdType] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [dob, setDob] = useState('')
  const [vip, setVip] = useState(false)
  const [vipNotes, setVipNotes] = useState('')
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('hotel_id').eq('id', user.id).single()
    if (!profile) return
    setHotelId(profile.hotel_id)
    const { data } = await supabase.from('guests').select('*').eq('hotel_id', profile.hotel_id).order('full_name')
    setGuests(data ?? [])
    setLoading(false)
  }

  async function saveGuest() {
    if (!hotelId || !name) return
    setSaving(true)
    await supabase.from('guests').insert({
      hotel_id: hotelId,
      full_name: name, email: email || null, phone: phone || null,
      nationality: nationality || null,
      id_type: idType || null, id_number: idNumber || null,
      date_of_birth: dob || null,
      vip_flag: vip, vip_notes: vipNotes || null,
      loyalty_tier: 'standard',
      total_stays: 0, total_spend: 0,
      marketing_opt_in: marketingOptIn,
    })
    setShowNew(false)
    resetForm()
    await loadData()
    setSaving(false)
  }

  async function toggleVip(id: string, current: boolean) {
    await supabase.from('guests').update({ vip_flag: !current }).eq('id', id)
    setGuests(prev => prev.map(g => g.id === id ? { ...g, vip_flag: !current } : g))
    setSelected(prev => prev?.id === id ? { ...prev, vip_flag: !current } : prev)
  }

  function resetForm() {
    setName(''); setEmail(''); setPhone(''); setNationality('')
    setIdType(''); setIdNumber(''); setDob(''); setVip(false)
    setVipNotes(''); setMarketingOptIn(false)
  }

  const filtered = guests.filter(g => {
    const matchSearch = !search || g.full_name.toLowerCase().includes(search.toLowerCase()) || g.phone?.includes(search) || g.email?.toLowerCase().includes(search.toLowerCase())
    const matchVip = !vipFilter || g.vip_flag
    return matchSearch && matchVip
  })

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading guests...</div>

  return (
    <div className="guests-root">
      <div className="guests-header">
        <div>
          <h2 className="guests-title">Guest Profiles</h2>
          <p className="guests-sub">{guests.length} total guests · {guests.filter(g => g.vip_flag).length} VIP</p>
        </div>
        <button className="guests-new-btn" onClick={() => setShowNew(true)}><Plus size={15} /> New Guest</button>
      </div>

      {/* Stats */}
      <div className="guests-stats">
        <div className="guests-stat">
          <p className="guests-stat-val">{guests.length}</p>
          <p className="guests-stat-label">Total Guests</p>
        </div>
        <div className="guests-stat">
          <p className="guests-stat-val">{guests.filter(g => g.vip_flag).length}</p>
          <p className="guests-stat-label">VIP Guests</p>
        </div>
        <div className="guests-stat">
          <p className="guests-stat-val">{guests.filter(g => g.total_stays >= 3).length}</p>
          <p className="guests-stat-label">Returning (3+ stays)</p>
        </div>
        <div className="guests-stat">
          <p className="guests-stat-val">{guests.filter(g => g.marketing_opt_in).length}</p>
          <p className="guests-stat-label">Marketing Opted In</p>
        </div>
      </div>

      {/* Filters */}
      <div className="guests-filters">
        <div className="guests-search-wrap">
          <Search size={14} style={{ color: 'var(--slate-400)' }} />
          <input className="guests-search" placeholder="Search name, phone, email..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="guests-vip-btn" data-active={vipFilter} onClick={() => setVipFilter(!vipFilter)}>
          <Star size={13} /> VIP Only
        </button>
      </div>

      <div className="guests-body">
        {/* List */}
        <div className="guests-list">
          {filtered.length === 0 ? (
            <div className="guests-empty"><p>No guests found</p></div>
          ) : (
            filtered.map(g => {
              const tier = TIER_CONFIG[g.loyalty_tier] ?? TIER_CONFIG.standard
              return (
                <button key={g.id} className="guests-row" data-active={selected?.id === g.id} onClick={() => setSelected(selected?.id === g.id ? null : g)}>
                  <div className="guests-avatar" data-vip={g.vip_flag}>
                    {g.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="guests-row-info">
                    <div className="guests-row-top">
                      <span className="guests-row-name">{g.full_name}</span>
                      {g.vip_flag && <Star size={12} style={{ color: 'var(--gold-500)', fill: 'var(--gold-500)' }} />}
                    </div>
                    <p className="guests-row-meta">
                      {g.phone ?? g.email ?? 'No contact info'}
                      {g.total_stays > 0 && ` · ${g.total_stays} stay${g.total_stays > 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <div className="guests-row-right">
                    {g.total_spend > 0 && <p className="guests-row-spend">{formatCurrency(g.total_spend)}</p>}
                    <span className="guests-tier" style={{ color: tier.color, background: tier.bg }}>{g.loyalty_tier}</span>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="guests-panel">
            <div className="guests-panel-header">
              <div className="guests-panel-avatar" data-vip={selected.vip_flag}>
                {selected.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className="guests-panel-name">{selected.full_name}</h3>
                <span className="guests-tier" style={{ color: TIER_CONFIG[selected.loyalty_tier]?.color, background: TIER_CONFIG[selected.loyalty_tier]?.bg }}>
                  {selected.loyalty_tier}
                </span>
              </div>
              <button className="guests-panel-close" onClick={() => setSelected(null)}><X size={15} /></button>
            </div>

            <div className="guests-panel-stats">
              <div className="guests-pstat">
                <p className="guests-pstat-val">{selected.total_stays}</p>
                <p className="guests-pstat-label">Stays</p>
              </div>
              <div className="guests-pstat">
                <p className="guests-pstat-val">{formatCurrency(selected.total_spend)}</p>
                <p className="guests-pstat-label">Total Spend</p>
              </div>
            </div>

            <div className="guests-panel-rows">
              {selected.phone && <div className="guests-panel-row"><Phone size={13} /><span>{selected.phone}</span></div>}
              {selected.email && <div className="guests-panel-row"><Mail size={13} /><span>{selected.email}</span></div>}
              {selected.nationality && <div className="guests-panel-row"><span className="guests-panel-label">Nationality</span><span>{selected.nationality}</span></div>}
              {selected.last_stay_at && <div className="guests-panel-row"><Calendar size={13} /><span>Last stay: {formatDate(selected.last_stay_at)}</span></div>}
              {selected.id_type && <div className="guests-panel-row"><span className="guests-panel-label">ID</span><span>{selected.id_type.replace('_',' ')} · {selected.id_number}</span></div>}
              {selected.vip_notes && <div className="guests-panel-row"><Star size={13} style={{color:'var(--gold-500)'}} /><span>{selected.vip_notes}</span></div>}
            </div>

            <button
              className={`guests-vip-toggle ${selected.vip_flag ? 'active' : ''}`}
              onClick={() => toggleVip(selected.id, selected.vip_flag)}
            >
              <Star size={14} />
              {selected.vip_flag ? 'Remove VIP Status' : 'Mark as VIP'}
            </button>
          </div>
        )}
      </div>

      {/* New Guest Modal */}
      {showNew && (
        <div className="modal-overlay" onClick={() => { setShowNew(false); resetForm() }}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New Guest Profile</h3>
              <button className="modal-close" onClick={() => { setShowNew(false); resetForm() }}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="modal-field"><label>Full Name *</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Adaeze Okonkwo" /></div>
              <div className="modal-row2">
                <div className="modal-field"><label>Phone</label><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+234..." /></div>
                <div className="modal-field"><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="guest@email.com" /></div>
              </div>
              <div className="modal-row2">
                <div className="modal-field"><label>Nationality</label><input value={nationality} onChange={e => setNationality(e.target.value)} placeholder="Nigerian" /></div>
                <div className="modal-field"><label>Date of Birth</label><input type="date" value={dob} onChange={e => setDob(e.target.value)} /></div>
              </div>
              <div className="modal-row2">
                <div className="modal-field">
                  <label>ID Type</label>
                  <select value={idType} onChange={e => setIdType(e.target.value)}>
                    <option value="">Select...</option>
                    <option value="passport">Passport</option>
                    <option value="national_id">National ID</option>
                    <option value="drivers_license">Driver's License</option>
                  </select>
                </div>
                <div className="modal-field"><label>ID Number</label><input value={idNumber} onChange={e => setIdNumber(e.target.value)} /></div>
              </div>
              <div className="modal-field">
                <label className="checkbox-label">
                  <input type="checkbox" checked={vip} onChange={e => setVip(e.target.checked)} />
                  Mark as VIP guest
                </label>
              </div>
              {vip && <div className="modal-field"><label>VIP Notes</label><input value={vipNotes} onChange={e => setVipNotes(e.target.value)} placeholder="Allergies, preferences, special requirements..." /></div>}
              <div className="modal-field">
                <label className="checkbox-label">
                  <input type="checkbox" checked={marketingOptIn} onChange={e => setMarketingOptIn(e.target.checked)} />
                  Guest consents to marketing communications (NDPR)
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-cancel" onClick={() => { setShowNew(false); resetForm() }}>Cancel</button>
              <button className="modal-save" onClick={saveGuest} disabled={saving || !name}>{saving ? 'Saving...' : 'Create Guest Profile'}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .guests-root { max-width: 1100px; margin: 0 auto; }
        .guests-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; gap: 16px; flex-wrap: wrap; }
        .guests-title { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .guests-sub { font-size: 13px; color: var(--text-muted); margin: 4px 0 0; }
        .guests-new-btn { display: flex; align-items: center; gap: 6px; padding: 10px 18px; background: var(--navy-800); color: white; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: none; border-radius: 8px; cursor: pointer; }
        .guests-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 20px; }
        @media (max-width: 640px) { .guests-stats { grid-template-columns: repeat(2,1fr); } }
        .guests-stat { background: white; border: 1px solid var(--slate-200); border-radius: 12px; padding: 14px; text-align: center; }
        .guests-stat-val { font-size: 24px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .guests-stat-label { font-size: 11px; color: var(--text-muted); margin: 4px 0 0; }
        .guests-filters { display: flex; gap: 10px; margin-bottom: 16px; align-items: center; }
        .guests-search-wrap { flex: 1; display: flex; align-items: center; gap: 10px; background: white; border: 1px solid var(--slate-200); border-radius: 10px; padding: 10px 14px; }
        .guests-search { flex: 1; border: none; outline: none; font-size: 14px; font-family: 'DM Sans', sans-serif; color: var(--slate-800); background: transparent; }
        .guests-vip-btn { display: flex; align-items: center; gap: 6px; padding: 10px 16px; border-radius: 10px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1px solid var(--slate-200); background: white; color: var(--slate-500); cursor: pointer; white-space: nowrap; }
        .guests-vip-btn[data-active="true"] { background: var(--gold-100); border-color: var(--gold-400); color: var(--navy-800); }
        .guests-body { display: flex; gap: 20px; }
        .guests-list { flex: 1; min-width: 0; background: white; border: 1px solid var(--slate-200); border-radius: 14px; overflow: hidden; }
        .guests-empty { padding: 60px; text-align: center; color: var(--text-muted); }
        .guests-row { display: flex; align-items: center; gap: 14px; padding: 13px 18px; border-bottom: 1px solid var(--slate-100); background: white; cursor: pointer; text-align: left; width: 100%; transition: background 0.1s; font-family: 'DM Sans', sans-serif; }
        .guests-row:hover { background: var(--slate-100); }
        .guests-row[data-active="true"] { background: var(--gold-100); border-left: 3px solid var(--gold-500); }
        .guests-avatar { width: 38px; height: 38px; border-radius: 50%; background: var(--navy-700); color: white; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .guests-avatar[data-vip="true"] { background: linear-gradient(135deg, var(--gold-500), #b8922e); }
        .guests-row-info { flex: 1; min-width: 0; }
        .guests-row-top { display: flex; align-items: center; gap: 6px; }
        .guests-row-name { font-size: 14px; font-weight: 600; color: var(--slate-800); }
        .guests-row-meta { font-size: 12px; color: var(--text-muted); margin: 2px 0 0; }
        .guests-row-right { text-align: right; flex-shrink: 0; }
        .guests-row-spend { font-size: 13px; font-weight: 600; color: var(--slate-700); margin: 0 0 4px; }
        .guests-tier { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 20px; }
        .guests-panel { width: 300px; flex-shrink: 0; background: white; border: 1px solid var(--slate-200); border-radius: 14px; padding: 20px; position: sticky; top: 80px; }
        @media (max-width: 900px) { .guests-body { flex-direction: column; } .guests-panel { width: 100%; position: static; } }
        .guests-panel-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
        .guests-panel-avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--navy-700); color: white; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .guests-panel-avatar[data-vip="true"] { background: linear-gradient(135deg, var(--gold-500), #b8922e); }
        .guests-panel-name { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 700; color: var(--slate-800); margin: 0 0 4px; }
        .guests-panel-close { width: 28px; height: 28px; border-radius: 8px; background: var(--slate-100); border: none; color: var(--slate-400); cursor: pointer; display: flex; align-items: center; justify-content: center; margin-left: auto; }
        .guests-panel-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
        .guests-pstat { background: var(--slate-100); border-radius: 8px; padding: 10px; text-align: center; }
        .guests-pstat-val { font-size: 16px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .guests-pstat-label { font-size: 10px; color: var(--text-muted); margin: 2px 0 0; }
        .guests-panel-rows { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
        .guests-panel-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--slate-700); }
        .guests-panel-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); }
        .guests-vip-toggle { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 9px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1.5px solid var(--gold-400); background: white; color: var(--gold-500); cursor: pointer; }
        .guests-vip-toggle.active { background: var(--gold-100); }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .modal-card { background: white; border-radius: 16px; width: 100%; max-width: 520px; box-shadow: 0 24px 48px rgba(0,0,0,0.2); overflow: hidden; }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--slate-200); }
        .modal-header h3 { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .modal-close { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--slate-200); background: white; color: var(--slate-400); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; max-height: 65vh; overflow-y: auto; }
        .modal-field { display: flex; flex-direction: column; gap: 6px; }
        .modal-field label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--slate-500); }
        .modal-field input, .modal-field select { padding: 10px 12px; border: 1px solid var(--slate-200); border-radius: 8px; font-size: 14px; font-family: 'DM Sans', sans-serif; color: var(--slate-800); outline: none; }
        .modal-field input:focus { border-color: var(--gold-500); }
        .modal-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .modal-footer { display: flex; gap: 10px; justify-content: flex-end; padding: 16px 24px; border-top: 1px solid var(--slate-200); }
        .modal-cancel { padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1px solid var(--slate-200); background: white; color: var(--slate-600); cursor: pointer; }
        .modal-save { padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; background: var(--navy-800); color: white; border: none; cursor: pointer; }
        .modal-save:disabled { opacity: 0.5; cursor: not-allowed; }
        .checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; color: var(--slate-700); cursor: pointer; text-transform: none; letter-spacing: 0; }
        .checkbox-label input { width: 16px; height: 16px; accent-color: var(--navy-800); }
      `}</style>
    </div>
  )
}
