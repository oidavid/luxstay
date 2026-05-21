'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Search, X, Check, Pencil, Save,
  CalendarCheck, FileText, DollarSign, Printer
} from 'lucide-react'

type Reservation = {
  id: string
  confirmation_number: string
  status: string
  check_in_date: string
  check_out_date: string
  adults: number
  children: number
  rate_per_night: number
  rate_plan: string
  source: string
  special_requests: string | null
  created_at: string
  guest: { id: string; full_name: string; email: string | null; phone: string | null; vip_flag: boolean } | null
  room: { id: string; number: string } | null
  room_type: { id: string; name: string } | null
}

type FolioCharge = {
  id: string
  description: string
  charge_type: string
  amount: number
  quantity: number
  created_at: string
  is_paid: boolean
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  tentative:   { label: 'Tentative',   color: '#92400e', bg: '#fef3c7' },
  confirmed:   { label: 'Confirmed',   color: '#1e40af', bg: '#dbeafe' },
  checked_in:  { label: 'Checked In',  color: '#065f46', bg: '#d1fae5' },
  checked_out: { label: 'Checked Out', color: '#475569', bg: '#f1f5f9' },
  no_show:     { label: 'No Show',     color: '#92400e', bg: '#fef3c7' },
  cancelled:   { label: 'Cancelled',   color: '#991b1b', bg: '#fee2e2' },
}

const SOURCES = ['direct', 'walk_in', 'booking_com', 'airbnb', 'expedia', 'corporate', 'phone']

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n)
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function nights(ci: string, co: string) {
  return Math.max(1, Math.ceil((new Date(co).getTime() - new Date(ci).getTime()) / 86400000))
}

function genConfNum() {
  return `LUX-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000 + 10000)}`
}

export default function ReservationsPage() {
  const supabase = createClient()
  const [hotelId, setHotelId] = useState<string | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState<Reservation | null>(null)
  const [activePanel, setActivePanel] = useState<'details' | 'folio' | 'edit'>('details')
  const [updating, setUpdating] = useState(false)

  // Folio
  const [folioCharges, setFolioCharges] = useState<FolioCharge[]>([])
  const [loadingFolio, setLoadingFolio] = useState(false)
  const [showAddCharge, setShowAddCharge] = useState(false)
  const [chargeDesc, setChargeDesc] = useState('')
  const [chargeType, setChargeType] = useState('room_charge')
  const [chargeAmount, setChargeAmount] = useState<number | ''>('')
  const [chargeQty, setChargeQty] = useState(1)
  const [savingCharge, setSavingCharge] = useState(false)

  // New/Edit reservation form
  const [showNew, setShowNew] = useState(false)
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)
  const [guests, setGuests] = useState<{ id: string; full_name: string; phone: string | null }[]>([])
  const [roomTypes, setRoomTypes] = useState<{ id: string; name: string; base_rate: number }[]>([])
  const [rooms, setRooms] = useState<{ id: string; number: string; room_type_id: string; status: string }[]>([])
  const [allRooms, setAllRooms] = useState<{ id: string; number: string; room_type_id: string; status: string }[]>([])
  const [guestSearch, setGuestSearch] = useState('')
  const [selectedGuest, setSelectedGuest] = useState<{ id: string; full_name: string; phone: string | null } | null>(null)
  const [showGuestDropdown, setShowGuestDropdown] = useState(false)
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState('')
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [adults, setAdults] = useState(1)
  const [children, setChildren] = useState(0)
  const [ratePlan, setRatePlan] = useState('rack')
  const [rateOverride, setRateOverride] = useState<number | ''>('')
  const [source, setSource] = useState('direct')
  const [specialRequests, setSpecialRequests] = useState('')
  const [saving, setSaving] = useState(false)
  const [newGuestMode, setNewGuestMode] = useState(false)
  const [newGuestName, setNewGuestName] = useState('')
  const [newGuestPhone, setNewGuestPhone] = useState('')
  const [newGuestEmail, setNewGuestEmail] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('hotel_id').eq('id', user.id).single()
    if (!profile) return
    setHotelId(profile.hotel_id)

    const [{ data: res }, { data: g }, { data: rt }, { data: r }] = await Promise.all([
      supabase.from('reservations').select(`
        id, confirmation_number, status, check_in_date, check_out_date,
        adults, children, rate_per_night, rate_plan, source, special_requests, created_at,
        guest:guests(id, full_name, email, phone, vip_flag),
        room:rooms(id, number),
        room_type:room_types(id, name)
      `).eq('hotel_id', profile.hotel_id).order('check_in_date', { ascending: false }).limit(200),
      supabase.from('guests').select('id, full_name, phone').eq('hotel_id', profile.hotel_id).order('full_name'),
      supabase.from('room_types').select('id, name, base_rate').eq('hotel_id', profile.hotel_id).eq('is_active', true),
      supabase.from('rooms').select('id, number, room_type_id, status').eq('hotel_id', profile.hotel_id).eq('is_active', true),
    ])

    setReservations((res as unknown as Reservation[]) ?? [])
    setGuests(g ?? [])
    setRoomTypes(rt ?? [])
    setAllRooms(r ?? [])
    setRooms((r ?? []).filter(rm => rm.status === 'available'))
    setLoading(false)
  }

  async function loadFolio(reservationId: string) {
    setLoadingFolio(true)
    const { data } = await supabase
      .from('folio_charges')
      .select('*')
      .eq('reservation_id', reservationId)
      .order('created_at')
    setFolioCharges((data as FolioCharge[]) ?? [])
    setLoadingFolio(false)
  }

  async function selectReservation(r: Reservation) {
    setSelected(r)
    setActivePanel('details')
    await loadFolio(r.id)
  }

  async function addCharge() {
    if (!hotelId || !selected || !chargeDesc || chargeAmount === '') return
    setSavingCharge(true)
    await supabase.from('folio_charges').insert({
      hotel_id: hotelId,
      reservation_id: selected.id,
      guest_id: selected.guest?.id,
      description: chargeDesc,
      charge_type: chargeType,
      amount: Number(chargeAmount),
      quantity: chargeQty,
      total: Number(chargeAmount) * chargeQty,
      is_paid: false,
    })
    setChargeDesc(''); setChargeAmount(''); setChargeQty(1); setChargeType('room_charge')
    setShowAddCharge(false)
    await loadFolio(selected.id)
    setSavingCharge(false)
  }

  async function postRoomCharges() {
    if (!hotelId || !selected) return
    const n = nights(selected.check_in_date, selected.check_out_date)
    const total = selected.rate_per_night * n
    await supabase.from('folio_charges').insert({
      hotel_id: hotelId,
      reservation_id: selected.id,
      guest_id: selected.guest?.id,
      description: `Room ${selected.room?.number ?? ''} — ${selected.room_type?.name} × ${n} nights`,
      charge_type: 'room_charge',
      amount: selected.rate_per_night,
      quantity: n,
      total,
      is_paid: false,
    })
    await loadFolio(selected.id)
  }

  function printInvoice() {
    if (!selected) return
    const n = nights(selected.check_in_date, selected.check_out_date)
    const roomTotal = selected.rate_per_night * n
    const extraCharges = folioCharges.filter(c => c.charge_type !== 'room_charge')
    const subtotal = roomTotal + extraCharges.reduce((sum, c) => sum + c.amount * c.quantity, 0)
    const vat = subtotal * 0.075
    const total = subtotal + vat

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><head><title>Invoice — ${selected.confirmation_number}</title>
      <style>
        body { font-family: Georgia, serif; max-width: 600px; margin: 40px auto; color: #1e293b; }
        h1 { font-size: 28px; margin: 0; }
        .conf { font-size: 14px; color: #64748b; margin: 4px 0 24px; }
        .section { margin: 20px 0; }
        .label { font-size: 11px; font-weight: bold; text-transform: uppercase; color: #94a3b8; margin-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        th { text-align: left; padding: 8px 12px; background: #f1f5f9; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #64748b; }
        td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .total-row td { font-weight: bold; font-size: 16px; border-top: 2px solid #1e293b; }
        .footer { margin-top: 40px; font-size: 12px; color: #94a3b8; text-align: center; }
      </style></head><body>
      <h1>Invoice</h1>
      <p class="conf">${selected.confirmation_number}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px;">
        <div>
          <p class="label">Guest</p>
          <p style="margin:0;font-size:16px;font-weight:bold;">${selected.guest?.full_name ?? '—'}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#64748b;">${selected.guest?.phone ?? ''}</p>
          <p style="margin:2px 0 0;font-size:13px;color:#64748b;">${selected.guest?.email ?? ''}</p>
        </div>
        <div>
          <p class="label">Stay</p>
          <p style="margin:0;font-size:14px;">${formatDate(selected.check_in_date)} → ${formatDate(selected.check_out_date)}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#64748b;">${n} night${n !== 1 ? 's' : ''} · ${selected.room_type?.name ?? ''} · Room ${selected.room?.number ?? 'TBA'}</p>
        </div>
      </div>
      <table>
        <tr><th>Description</th><th>Qty</th><th>Unit</th><th>Total</th></tr>
        <tr>
          <td>Room charge — ${selected.room_type?.name}</td>
          <td>${n}</td>
          <td>${formatCurrency(selected.rate_per_night)}</td>
          <td>${formatCurrency(roomTotal)}</td>
        </tr>
        ${folioCharges.filter(c => c.charge_type !== 'room_charge').map(c => `
          <tr>
            <td>${c.description}</td>
            <td>${c.quantity}</td>
            <td>${formatCurrency(c.amount)}</td>
            <td>${formatCurrency(c.amount * c.quantity)}</td>
          </tr>
        `).join('')}
        <tr><td colspan="3" style="text-align:right;padding-right:12px;color:#64748b;">Subtotal</td><td>${formatCurrency(subtotal)}</td></tr>
        <tr><td colspan="3" style="text-align:right;padding-right:12px;color:#64748b;">VAT (7.5%)</td><td>${formatCurrency(vat)}</td></tr>
        <tr class="total-row"><td colspan="3" style="text-align:right;padding-right:12px;">Total</td><td>${formatCurrency(total)}</td></tr>
      </table>
      <p class="footer">Thank you for staying with us. This invoice was generated by LuxStay PMS.</p>
      </body></html>
    `)
    win.document.close()
    win.print()
  }

  // Edit reservation
  function openEditReservation(res: Reservation) {
    setEditingReservation(res)
    setSelectedGuest(res.guest ? { id: res.guest.id, full_name: res.guest.full_name, phone: res.guest.phone } : null)
    setSelectedRoomTypeId(res.room_type?.id ?? '')
    setSelectedRoomId(res.room?.id ?? '')
    setCheckIn(res.check_in_date)
    setCheckOut(res.check_out_date)
    setAdults(res.adults)
    setChildren(res.children)
    setRatePlan(res.rate_plan)
    setRateOverride(res.rate_per_night)
    setSource(res.source)
    setSpecialRequests(res.special_requests ?? '')
    setActivePanel('edit')
  }

  async function saveReservation() {
    if (!hotelId || !selectedRoomTypeId || !checkIn || !checkOut) return
    setSaving(true)

    let guestId = selectedGuest?.id ?? null

    if (newGuestMode && newGuestName) {
      const { data: ng } = await supabase.from('guests').insert({
        hotel_id: hotelId, full_name: newGuestName,
        phone: newGuestPhone || null, email: newGuestEmail || null,
        loyalty_tier: 'standard', total_stays: 0, total_spend: 0,
        vip_flag: false, marketing_opt_in: false,
      }).select().single()
      if (ng) guestId = ng.id
    }

    if (!guestId) { setSaving(false); return }

    const roomType = roomTypes.find(rt => rt.id === selectedRoomTypeId)
    const rate = rateOverride !== '' ? Number(rateOverride) : (roomType?.base_rate ?? 0)

    const payload = {
      guest_id: guestId,
      room_id: selectedRoomId || null,
      room_type_id: selectedRoomTypeId,
      check_in_date: checkIn,
      check_out_date: checkOut,
      adults, children,
      rate_plan: ratePlan,
      rate_per_night: rate,
      source,
      special_requests: specialRequests || null,
    }

    if (editingReservation) {
      await supabase.from('reservations').update(payload).eq('id', editingReservation.id)
    } else {
      await supabase.from('reservations').insert({
        ...payload,
        hotel_id: hotelId,
        confirmation_number: genConfNum(),
        status: 'confirmed',
      })
      if (selectedRoomId) {
        await supabase.from('rooms').update({ status: 'occupied' }).eq('id', selectedRoomId)
      }
    }

    setShowNew(false)
    setEditingReservation(null)
    setActivePanel('details')
    resetForm()
    await loadData()
    setSaving(false)
  }

  async function updateStatus(id: string, newStatus: string) {
    setUpdating(true)
    await supabase.from('reservations').update({ status: newStatus }).eq('id', id)

    if (newStatus === 'checked_out' && selected?.room?.id) {
      await supabase.from('rooms').update({ status: 'dirty' }).eq('id', selected.room.id)
    }

    setReservations(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r))
    setSelected(prev => prev?.id === id ? { ...prev, status: newStatus } : prev)
    setUpdating(false)
  }

  function resetForm() {
    setSelectedGuest(null); setGuestSearch(''); setSelectedRoomTypeId('')
    setSelectedRoomId(''); setCheckIn(''); setCheckOut('')
    setAdults(1); setChildren(0); setRatePlan('rack'); setRateOverride('')
    setSource('direct'); setSpecialRequests(''); setNewGuestMode(false)
    setNewGuestName(''); setNewGuestPhone(''); setNewGuestEmail('')
  }

  const filtered = reservations.filter(r => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter
    const matchSearch = !search ||
      r.guest?.full_name.toLowerCase().includes(search.toLowerCase()) ||
      r.confirmation_number.toLowerCase().includes(search.toLowerCase()) ||
      r.room?.number?.includes(search)
    return matchStatus && matchSearch
  })

  const filteredGuests = guests.filter(g =>
    g.full_name.toLowerCase().includes(guestSearch.toLowerCase())
  ).slice(0, 6)

  const availableRooms = allRooms.filter(r =>
    (!selectedRoomTypeId || r.room_type_id === selectedRoomTypeId) &&
    (r.status === 'available' || r.status === 'clean' || r.id === selectedRoomId)
  )

  const selectedRoomType = roomTypes.find(rt => rt.id === selectedRoomTypeId)
  const effectiveRate = rateOverride !== '' ? Number(rateOverride) : (selectedRoomType?.base_rate ?? 0)
  const totalNights = checkIn && checkOut ? nights(checkIn, checkOut) : 0

  const today = new Date().toISOString().split('T')[0]
  const todayArrivals = reservations.filter(r => r.check_in_date === today && ['confirmed', 'tentative'].includes(r.status)).length
  const todayDepartures = reservations.filter(r => r.check_out_date === today && r.status === 'checked_in').length
  const inHouse = reservations.filter(r => r.status === 'checked_in').length

  // Folio totals
  const roomChargeTotal = selected ? selected.rate_per_night * nights(selected.check_in_date, selected.check_out_date) : 0
  const extraChargesTotal = folioCharges.reduce((sum, c) => sum + c.amount * c.quantity, 0)
  const folioSubtotal = roomChargeTotal + extraChargesTotal
  const folioVat = folioSubtotal * 0.075
  const folioTotal = folioSubtotal + folioVat

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading reservations...</div>

  const ReservationForm = () => (
    <>
      <div className="modal-section-title">Guest</div>
      {!newGuestMode ? (
        <div className="modal-field">
          <label>Search existing guest</label>
          <div className="guest-search-wrap">
            <input
              value={selectedGuest ? selectedGuest.full_name : guestSearch}
              onChange={e => { setGuestSearch(e.target.value); setSelectedGuest(null); setShowGuestDropdown(true) }}
              onFocus={() => setShowGuestDropdown(true)}
              placeholder="Type guest name..."
            />
            {showGuestDropdown && guestSearch && filteredGuests.length > 0 && (
              <div className="guest-dropdown">
                {filteredGuests.map(g => (
                  <button key={g.id} className="guest-option" onClick={() => { setSelectedGuest(g); setGuestSearch(''); setShowGuestDropdown(false) }}>
                    <span className="guest-option-name">{g.full_name}</span>
                    <span className="guest-option-phone">{g.phone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedGuest && (
            <div className="selected-guest">
              <Check size={13} style={{ color: '#10b981' }} />
              <span>{selectedGuest.full_name}</span>
              <button onClick={() => setSelectedGuest(null)}><X size={12} /></button>
            </div>
          )}
          <button className="new-guest-link" onClick={() => setNewGuestMode(true)}>+ Create new guest profile</button>
        </div>
      ) : (
        <div className="modal-field-group">
          <div className="modal-field"><label>Full Name *</label><input value={newGuestName} onChange={e => setNewGuestName(e.target.value)} placeholder="John Doe" /></div>
          <div className="modal-row2">
            <div className="modal-field"><label>Phone</label><input value={newGuestPhone} onChange={e => setNewGuestPhone(e.target.value)} placeholder="+234..." /></div>
            <div className="modal-field"><label>Email</label><input value={newGuestEmail} onChange={e => setNewGuestEmail(e.target.value)} placeholder="guest@email.com" /></div>
          </div>
          <button className="new-guest-link" onClick={() => setNewGuestMode(false)}>← Search existing guest instead</button>
        </div>
      )}

      <div className="modal-section-title">Stay</div>
      <div className="modal-row3">
        <div className="modal-field">
          <label>Check-in *</label>
          <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} />
        </div>
        <div className="modal-field">
          <label>Check-out *</label>
          <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} min={checkIn} />
        </div>
        <div className="modal-field">
          <label>Nights</label>
          <div className="nights-display">{totalNights > 0 ? `${totalNights}` : '—'}</div>
        </div>
      </div>
      <div className="modal-row2">
        <div className="modal-field"><label>Adults</label><input type="number" min={1} max={10} value={adults} onChange={e => setAdults(Number(e.target.value))} /></div>
        <div className="modal-field"><label>Children</label><input type="number" min={0} max={10} value={children} onChange={e => setChildren(Number(e.target.value))} /></div>
      </div>

      <div className="modal-section-title">Room</div>
      <div className="modal-row2">
        <div className="modal-field">
          <label>Room Type *</label>
          <select value={selectedRoomTypeId} onChange={e => { setSelectedRoomTypeId(e.target.value); setSelectedRoomId(''); setRateOverride('') }}>
            <option value="">Select type...</option>
            {roomTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name} — {formatCurrency(rt.base_rate)}/night</option>)}
          </select>
        </div>
        <div className="modal-field">
          <label>Assign Room</label>
          <select value={selectedRoomId} onChange={e => setSelectedRoomId(e.target.value)}>
            <option value="">Unassigned</option>
            {availableRooms.map(r => <option key={r.id} value={r.id}>Room {r.number}</option>)}
          </select>
        </div>
      </div>

      <div className="modal-section-title">Rate</div>
      <div className="modal-row2">
        <div className="modal-field">
          <label>Rate Plan</label>
          <select value={ratePlan} onChange={e => setRatePlan(e.target.value)}>
            <option value="rack">Rack Rate</option>
            <option value="corporate">Corporate</option>
            <option value="government">Government</option>
            <option value="promotional">Promotional</option>
            <option value="long_stay">Long Stay</option>
            <option value="weekend">Weekend</option>
          </select>
        </div>
        <div className="modal-field">
          <label>Rate per Night (₦)</label>
          <input type="number" value={rateOverride !== '' ? rateOverride : (selectedRoomType?.base_rate ?? '')} onChange={e => setRateOverride(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Auto from room type" />
        </div>
      </div>

      {totalNights > 0 && effectiveRate > 0 && (
        <div className="rate-summary">
          <span>{formatCurrency(effectiveRate)} × {totalNights} nights</span>
          <span className="rate-total">{formatCurrency(effectiveRate * totalNights)}</span>
        </div>
      )}

      <div className="modal-row2">
        <div className="modal-field">
          <label>Booking Source</label>
          <select value={source} onChange={e => setSource(e.target.value)}>
            {SOURCES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
      </div>
      <div className="modal-field">
        <label>Special Requests</label>
        <textarea value={specialRequests} onChange={e => setSpecialRequests(e.target.value)} rows={2} placeholder="Guest preferences, allergies, accessibility needs..." />
      </div>
    </>
  )

  return (
    <div className="res-root">
      <div className="res-header">
        <div>
          <h2 className="res-title">Reservations</h2>
          <p className="res-sub">{reservations.length} total · {inHouse} in-house · {todayArrivals} arrivals today</p>
        </div>
        <button className="res-new-btn" onClick={() => { resetForm(); setEditingReservation(null); setShowNew(true) }}>
          <Plus size={15} /> New Reservation
        </button>
      </div>

      {/* Today strip */}
      <div className="res-today-strip">
        <div className="res-today-card" style={{ borderColor: '#6ee7b7', background: '#f0fdf4' }}>
          <p className="res-today-num" style={{ color: '#065f46' }}>{todayArrivals}</p>
          <p className="res-today-label">Arrivals Today</p>
        </div>
        <div className="res-today-card" style={{ borderColor: '#93c5fd', background: '#eff6ff' }}>
          <p className="res-today-num" style={{ color: '#1e40af' }}>{todayDepartures}</p>
          <p className="res-today-label">Departures Today</p>
        </div>
        <div className="res-today-card" style={{ borderColor: 'var(--gold-400)', background: 'var(--gold-100)' }}>
          <p className="res-today-num" style={{ color: 'var(--navy-800)' }}>{inHouse}</p>
          <p className="res-today-label">In House</p>
        </div>
        <div className="res-today-card">
          <p className="res-today-num">{reservations.filter(r => r.status === 'confirmed').length}</p>
          <p className="res-today-label">Upcoming</p>
        </div>
      </div>

      {/* Filters */}
      <div className="res-filters">
        <div className="res-search-wrap">
          <Search size={14} style={{ color: 'var(--slate-400)', flexShrink: 0 }} />
          <input className="res-search" placeholder="Search guest, confirmation #, room..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="res-status-filters">
          {['all', ...Object.keys(STATUS_CONFIG)].map(s => (
            <button key={s} className="res-filter-btn" data-active={statusFilter === s} onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label}
            </button>
          ))}
        </div>
      </div>

      <div className="res-body">
        {/* List */}
        <div className="res-list">
          {filtered.length === 0 ? (
            <div className="res-empty"><CalendarCheck size={40} style={{ color: 'var(--slate-300)' }} /><p>No reservations found</p></div>
          ) : (
            filtered.map(r => {
              const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.confirmed
              const n = nights(r.check_in_date, r.check_out_date)
              const isActive = selected?.id === r.id
              return (
                <button key={r.id} className="res-row" data-active={isActive} onClick={() => selectReservation(r)}>
                  <div className="res-row-avatar">
                    {r.guest?.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '??'}
                  </div>
                  <div className="res-row-info">
                    <div className="res-row-top">
                      <span className="res-row-name">{r.guest?.full_name ?? 'Unknown Guest'}</span>
                      {r.guest?.vip_flag && <span className="res-vip">VIP</span>}
                    </div>
                    <p className="res-row-meta">
                      {r.room_type?.name} {r.room && `· Room ${r.room.number}`} · {formatDate(r.check_in_date)} → {formatDate(r.check_out_date)} · {n} night{n !== 1 ? 's' : ''}
                    </p>
                    <p className="res-row-conf">{r.confirmation_number}</p>
                  </div>
                  <div className="res-row-right">
                    <p className="res-row-amount">{formatCurrency(r.rate_per_night * n)}</p>
                    <span className="res-status-badge" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="res-panel">
            {/* Panel tabs */}
            <div className="res-panel-tabs">
              <button className="res-panel-tab" data-active={activePanel === 'details'} onClick={() => setActivePanel('details')}>Details</button>
              <button className="res-panel-tab" data-active={activePanel === 'folio'} onClick={() => setActivePanel('folio')}>
                Folio {folioCharges.length > 0 && <span className="res-panel-tab-badge">{folioCharges.length}</span>}
              </button>
              <button className="res-panel-tab" data-active={activePanel === 'edit'} onClick={() => openEditReservation(selected)}>
                <Pencil size={12} /> Edit
              </button>
              <button className="res-panel-close" onClick={() => setSelected(null)}><X size={15} /></button>
            </div>

            {/* Details panel */}
            {activePanel === 'details' && (
              <>
                <div className="res-panel-guest">
                  <h3 className="res-panel-title">{selected.guest?.full_name}</h3>
                  <p className="res-panel-conf">{selected.confirmation_number}</p>
                </div>

                <div className="res-panel-section">
                  <p className="res-panel-label">Status</p>
                  <div className="res-status-grid">
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                      <button
                        key={key}
                        className="res-status-option"
                        data-active={selected.status === key}
                        disabled={updating}
                        onClick={() => updateStatus(selected.id, key)}
                        style={{ color: cfg.color, background: selected.status === key ? cfg.bg : 'white', borderColor: selected.status === key ? cfg.color : 'var(--slate-200)' }}
                      >
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="res-panel-grid">
                  <div className="res-panel-stat"><p className="res-panel-label">Check-in</p><p className="res-panel-val">{formatDate(selected.check_in_date)}</p></div>
                  <div className="res-panel-stat"><p className="res-panel-label">Check-out</p><p className="res-panel-val">{formatDate(selected.check_out_date)}</p></div>
                  <div className="res-panel-stat"><p className="res-panel-label">Room</p><p className="res-panel-val">{selected.room ? `Room ${selected.room.number}` : 'Unassigned'}</p></div>
                  <div className="res-panel-stat"><p className="res-panel-label">Type</p><p className="res-panel-val">{selected.room_type?.name}</p></div>
                  <div className="res-panel-stat"><p className="res-panel-label">Guests</p><p className="res-panel-val">{selected.adults}A {selected.children > 0 ? `${selected.children}C` : ''}</p></div>
                  <div className="res-panel-stat"><p className="res-panel-label">Source</p><p className="res-panel-val">{selected.source.replace('_', ' ')}</p></div>
                  <div className="res-panel-stat"><p className="res-panel-label">Rate/Night</p><p className="res-panel-val">{formatCurrency(selected.rate_per_night)}</p></div>
                  <div className="res-panel-stat"><p className="res-panel-label">Total</p><p className="res-panel-val" style={{ color: 'var(--navy-800)', fontWeight: 700 }}>{formatCurrency(selected.rate_per_night * nights(selected.check_in_date, selected.check_out_date))}</p></div>
                </div>

                {(selected.guest?.phone || selected.guest?.email) && (
                  <div className="res-panel-section">
                    <p className="res-panel-label">Contact</p>
                    {selected.guest.phone && <p className="res-panel-contact">{selected.guest.phone}</p>}
                    {selected.guest.email && <p className="res-panel-contact">{selected.guest.email}</p>}
                  </div>
                )}

                {selected.special_requests && (
                  <div className="res-panel-section">
                    <p className="res-panel-label">Special Requests</p>
                    <p className="res-panel-note">{selected.special_requests}</p>
                  </div>
                )}

                <div className="res-panel-actions">
                  {selected.status === 'confirmed' && (
                    <button className="res-action-btn primary" onClick={() => updateStatus(selected.id, 'checked_in')}><Check size={14} /> Check In</button>
                  )}
                  {selected.status === 'checked_in' && (
                    <button className="res-action-btn primary" onClick={() => updateStatus(selected.id, 'checked_out')}><Check size={14} /> Check Out</button>
                  )}
                  {['confirmed', 'tentative'].includes(selected.status) && (
                    <button className="res-action-btn danger" onClick={() => updateStatus(selected.id, 'cancelled')}><X size={14} /> Cancel</button>
                  )}
                </div>
              </>
            )}

            {/* Folio panel */}
            {activePanel === 'folio' && (
              <div className="res-folio">
                <div className="res-folio-header">
                  <p className="res-panel-label" style={{ margin: 0 }}>Guest Folio — {selected.guest?.full_name}</p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="res-folio-btn" onClick={postRoomCharges}>Post Room Charges</button>
                    <button className="res-folio-btn" onClick={() => setShowAddCharge(true)}><Plus size={12} /> Add</button>
                    <button className="res-folio-btn" onClick={printInvoice}><Printer size={12} /> Invoice</button>
                  </div>
                </div>

                {/* Room charge summary */}
                <div className="res-folio-row room">
                  <span>Room charge · {nights(selected.check_in_date, selected.check_out_date)} nights × {formatCurrency(selected.rate_per_night)}</span>
                  <span>{formatCurrency(roomChargeTotal)}</span>
                </div>

                {/* Extra charges */}
                {loadingFolio ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>Loading folio...</p>
                ) : (
                  folioCharges.map(c => (
                    <div key={c.id} className="res-folio-row">
                      <div>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--slate-700)' }}>{c.description}</p>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>{c.charge_type.replace('_', ' ')} · qty {c.quantity}</p>
                      </div>
                      <span>{formatCurrency(c.amount * c.quantity)}</span>
                    </div>
                  ))
                )}

                <div className="res-folio-totals">
                  <div className="res-folio-total-row"><span>Subtotal</span><span>{formatCurrency(folioSubtotal)}</span></div>
                  <div className="res-folio-total-row"><span>VAT (7.5%)</span><span>{formatCurrency(folioVat)}</span></div>
                  <div className="res-folio-total-row grand"><span>Total</span><span>{formatCurrency(folioTotal)}</span></div>
                </div>

                {showAddCharge && (
                  <div className="res-folio-add">
                    <p style={{ font: '11px/1 DM Sans', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--slate-500)', margin: '0 0 10px' }}>Add Charge</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input value={chargeDesc} onChange={e => setChargeDesc(e.target.value)} placeholder="Description e.g. Minibar, Laundry" style={{ padding: '8px 10px', border: '1px solid var(--slate-200)', borderRadius: 8, fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none' }} />
                      <select value={chargeType} onChange={e => setChargeType(e.target.value)} style={{ padding: '8px 10px', border: '1px solid var(--slate-200)', borderRadius: 8, fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none' }}>
                        <option value="room_charge">Room Charge</option>
                        <option value="food_beverage">Food & Beverage</option>
                        <option value="minibar">Minibar</option>
                        <option value="laundry">Laundry</option>
                        <option value="transport">Transport</option>
                        <option value="other">Other</option>
                      </select>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8 }}>
                        <input type="number" value={chargeAmount} onChange={e => setChargeAmount(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Amount (₦)" style={{ padding: '8px 10px', border: '1px solid var(--slate-200)', borderRadius: 8, fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none' }} />
                        <input type="number" min={1} value={chargeQty} onChange={e => setChargeQty(Number(e.target.value))} placeholder="Qty" style={{ padding: '8px 10px', border: '1px solid var(--slate-200)', borderRadius: 8, fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setShowAddCharge(false)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid var(--slate-200)', background: 'white', fontSize: 12, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>Cancel</button>
                        <button onClick={addCharge} disabled={savingCharge || !chargeDesc || chargeAmount === ''} style={{ flex: 2, padding: '8px', borderRadius: 8, border: 'none', background: 'var(--navy-800)', color: 'white', fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>Add Charge</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Edit panel — inline */}
            {activePanel === 'edit' && (
              <div className="res-edit-panel">
                <p style={{ font: '13px/1 Playfair Display, serif', fontWeight: 700, color: 'var(--slate-800)', margin: '0 0 16px' }}>
                  Editing: {selected.confirmation_number}
                </p>
                <ReservationForm />
                <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                  <button className="modal-cancel" onClick={() => setActivePanel('details')}>Cancel</button>
                  <button
                    className="modal-save"
                    onClick={saveReservation}
                    disabled={saving || !selectedRoomTypeId || !checkIn || !checkOut}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Save size={13} /> {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Reservation Modal */}
      {showNew && (
        <div className="modal-overlay" onClick={() => { setShowNew(false); resetForm() }}>
          <div className="modal-card large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New Reservation</h3>
              <button className="modal-close" onClick={() => { setShowNew(false); resetForm() }}><X size={16} /></button>
            </div>
            <div className="modal-body"><ReservationForm /></div>
            <div className="modal-footer">
              <button className="modal-cancel" onClick={() => { setShowNew(false); resetForm() }}>Cancel</button>
              <button
                className="modal-save"
                onClick={saveReservation}
                disabled={saving || (!selectedGuest && !newGuestName) || !selectedRoomTypeId || !checkIn || !checkOut}
              >
                {saving ? 'Creating...' : 'Create Reservation'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .res-root { max-width: 1300px; margin: 0 auto; }
        .res-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; gap: 16px; flex-wrap: wrap; }
        .res-title { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .res-sub { font-size: 13px; color: var(--text-muted); margin: 4px 0 0; }
        .res-new-btn { display: flex; align-items: center; gap: 6px; padding: 10px 20px; background: var(--navy-800); color: white; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: none; border-radius: 8px; cursor: pointer; white-space: nowrap; }
        .res-today-strip { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 20px; }
        @media (max-width: 640px) { .res-today-strip { grid-template-columns: repeat(2,1fr); } }
        .res-today-card { background: white; border: 1px solid var(--slate-200); border-radius: 12px; padding: 14px; text-align: center; }
        .res-today-num { font-size: 28px; font-weight: 800; margin: 0; color: var(--slate-800); }
        .res-today-label { font-size: 11px; color: var(--text-muted); margin: 4px 0 0; }
        .res-filters { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
        .res-search-wrap { display: flex; align-items: center; gap: 10px; background: white; border: 1px solid var(--slate-200); border-radius: 10px; padding: 10px 14px; }
        .res-search { flex: 1; border: none; outline: none; font-size: 14px; font-family: 'DM Sans', sans-serif; color: var(--slate-800); background: transparent; }
        .res-status-filters { display: flex; flex-wrap: wrap; gap: 6px; }
        .res-filter-btn { padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1px solid var(--slate-200); background: white; color: var(--slate-500); cursor: pointer; }
        .res-filter-btn[data-active="true"] { background: var(--navy-800); border-color: var(--navy-800); color: white; }
        .res-body { display: flex; gap: 20px; align-items: flex-start; }
        .res-list { flex: 1; min-width: 0; display: flex; flex-direction: column; background: white; border: 1px solid var(--slate-200); border-radius: 14px; overflow: hidden; }
        .res-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 60px; color: var(--text-muted); font-size: 14px; }
        .res-row { display: flex; align-items: center; gap: 14px; padding: 14px 18px; border-bottom: 1px solid var(--slate-100); background: white; cursor: pointer; text-align: left; transition: background 0.1s; font-family: 'DM Sans', sans-serif; width: 100%; }
        .res-row:last-child { border-bottom: none; }
        .res-row:hover { background: var(--slate-100); }
        .res-row[data-active="true"] { background: var(--gold-100); border-left: 3px solid var(--gold-500); }
        .res-row-avatar { width: 38px; height: 38px; border-radius: 50%; background: var(--navy-700); color: white; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .res-row-info { flex: 1; min-width: 0; }
        .res-row-top { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
        .res-row-name { font-size: 14px; font-weight: 600; color: var(--slate-800); }
        .res-vip { font-size: 9px; font-weight: 800; background: var(--gold-500); color: white; padding: 2px 6px; border-radius: 20px; }
        .res-row-meta { font-size: 12px; color: var(--text-muted); margin: 0; }
        .res-row-conf { font-size: 11px; color: var(--slate-400); margin: 2px 0 0; font-family: 'DM Mono', monospace; }
        .res-row-right { text-align: right; flex-shrink: 0; }
        .res-row-amount { font-size: 14px; font-weight: 700; color: var(--slate-800); margin: 0 0 4px; }
        .res-status-badge { font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 20px; }

        /* Panel */
        .res-panel { width: 360px; flex-shrink: 0; background: white; border: 1px solid var(--slate-200); border-radius: 14px; overflow: hidden; position: sticky; top: 80px; max-height: calc(100vh - 120px); overflow-y: auto; }
        @media (max-width: 1000px) { .res-body { flex-direction: column; } .res-panel { width: 100%; position: static; max-height: none; } }
        .res-panel-tabs { display: flex; align-items: center; border-bottom: 1px solid var(--slate-200); padding: 0 4px; background: var(--slate-50); }
        .res-panel-tab { display: flex; align-items: center; gap: 4px; padding: 12px 14px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: none; background: transparent; color: var(--slate-500); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; }
        .res-panel-tab[data-active="true"] { color: var(--navy-800); border-bottom-color: var(--navy-800); }
        .res-panel-tab-badge { background: var(--gold-500); color: white; font-size: 9px; font-weight: 700; border-radius: 20px; padding: 1px 5px; }
        .res-panel-close { width: 28px; height: 28px; border-radius: 8px; background: var(--slate-100); border: none; color: var(--slate-400); cursor: pointer; display: flex; align-items: center; justify-content: center; margin-left: auto; }
        .res-panel-guest { padding: 16px 20px 0; }
        .res-panel-title { font-family: 'Playfair Display', serif; font-size: 17px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .res-panel-conf { font-size: 11px; color: var(--slate-400); font-family: 'DM Mono', monospace; margin: 3px 0 0; }
        .res-panel-section { padding: 0 20px 16px; }
        .res-panel-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin: 0 0 6px; }
        .res-panel-val { font-size: 13px; font-weight: 600; color: var(--slate-800); margin: 0; }
        .res-panel-note { font-size: 13px; color: var(--slate-600); margin: 0; line-height: 1.5; }
        .res-panel-contact { font-size: 13px; color: var(--slate-700); margin: 0 0 4px; }
        .res-panel-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 0 20px 16px; }
        .res-panel-stat { background: var(--slate-100); border-radius: 8px; padding: 10px 12px; }
        .res-status-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .res-status-option { padding: 7px 6px; border-radius: 8px; font-size: 11px; font-weight: 600; font-family: 'DM Sans', sans-serif; cursor: pointer; border: 1.5px solid; text-align: center; transition: all 0.12s; }
        .res-panel-actions { display: flex; gap: 8px; padding: 0 20px 20px; }
        .res-action-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: none; cursor: pointer; }
        .res-action-btn.primary { background: var(--navy-800); color: white; }
        .res-action-btn.danger { background: #fee2e2; color: #991b1b; }

        /* Folio */
        .res-folio { padding: 16px 20px; display: flex; flex-direction: column; gap: 0; }
        .res-folio-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; gap: 8px; flex-wrap: wrap; }
        .res-folio-btn { display: flex; align-items: center; gap: 4px; padding: 5px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1px solid var(--slate-200); background: white; color: var(--slate-600); cursor: pointer; }
        .res-folio-btn:hover { background: var(--slate-100); }
        .res-folio-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--slate-100); font-size: 13px; color: var(--slate-700); }
        .res-folio-row.room { font-weight: 500; color: var(--slate-700); }
        .res-folio-totals { padding: 12px 0 0; display: flex; flex-direction: column; gap: 6px; }
        .res-folio-total-row { display: flex; justify-content: space-between; font-size: 13px; color: var(--slate-500); }
        .res-folio-total-row.grand { font-size: 15px; font-weight: 800; color: var(--slate-800); border-top: 1px solid var(--slate-200); padding-top: 8px; margin-top: 4px; }
        .res-folio-add { background: var(--slate-100); border-radius: 10px; padding: 14px; margin-top: 12px; }

        /* Edit panel */
        .res-edit-panel { padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; }

        /* Modal */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .modal-card { background: white; border-radius: 16px; width: 100%; max-width: 560px; box-shadow: 0 24px 48px rgba(0,0,0,0.2); overflow: hidden; }
        .modal-card.large { max-width: 680px; }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--slate-200); }
        .modal-header h3 { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .modal-close { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--slate-200); background: white; color: var(--slate-400); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; max-height: 70vh; overflow-y: auto; }
        .modal-section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: var(--navy-600); border-bottom: 1px solid var(--slate-200); padding-bottom: 6px; }
        .modal-field { display: flex; flex-direction: column; gap: 6px; }
        .modal-field-group { display: flex; flex-direction: column; gap: 10px; }
        .modal-field label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--slate-500); }
        .modal-field input, .modal-field select, .modal-field textarea { padding: 10px 12px; border: 1px solid var(--slate-200); border-radius: 8px; font-size: 14px; font-family: 'DM Sans', sans-serif; color: var(--slate-800); outline: none; }
        .modal-field input:focus, .modal-field select:focus, .modal-field textarea:focus { border-color: var(--gold-500); box-shadow: 0 0 0 3px rgba(201,168,76,0.1); }
        .modal-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .modal-row3 { display: grid; grid-template-columns: 1fr 1fr 0.5fr; gap: 12px; }
        .modal-footer { display: flex; gap: 10px; justify-content: flex-end; padding: 16px 24px; border-top: 1px solid var(--slate-200); }
        .modal-cancel { padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1px solid var(--slate-200); background: white; color: var(--slate-600); cursor: pointer; }
        .modal-save { padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; background: var(--navy-800); color: white; border: none; cursor: pointer; }
        .modal-save:disabled { opacity: 0.5; cursor: not-allowed; }
        .guest-search-wrap { position: relative; }
        .guest-search-wrap input { width: 100%; box-sizing: border-box; }
        .guest-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid var(--slate-200); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.1); z-index: 10; overflow: hidden; }
        .guest-option { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 10px 14px; background: none; border: none; border-bottom: 1px solid var(--slate-100); cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .guest-option:hover { background: var(--slate-100); }
        .guest-option-name { font-size: 14px; font-weight: 500; color: var(--slate-800); }
        .guest-option-phone { font-size: 12px; color: var(--text-muted); }
        .selected-guest { display: flex; align-items: center; gap: 8px; background: #d1fae5; border-radius: 8px; padding: 8px 12px; font-size: 13px; font-weight: 600; color: #065f46; }
        .selected-guest button { background: none; border: none; cursor: pointer; color: #065f46; display: flex; align-items: center; margin-left: auto; }
        .new-guest-link { background: none; border: none; color: var(--navy-600); font-size: 12px; font-weight: 600; cursor: pointer; padding: 0; font-family: 'DM Sans', sans-serif; text-align: left; }
        .nights-display { padding: 10px 12px; background: var(--slate-100); border-radius: 8px; font-size: 14px; font-weight: 600; color: var(--slate-700); text-align: center; }
        .rate-summary { display: flex; justify-content: space-between; align-items: center; background: var(--gold-100); border: 1px solid var(--gold-300); border-radius: 8px; padding: 10px 14px; font-size: 13px; color: var(--navy-800); }
        .rate-total { font-size: 16px; font-weight: 800; }
      `}</style>
    </div>
  )
}
