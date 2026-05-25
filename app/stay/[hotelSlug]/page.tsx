'use client'

import { useEffect, useState } from 'react'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import {
  Utensils, Wrench, MessageSquare, Receipt, Info,
  ChevronRight, Plus, Minus, X, Check, ArrowLeft,
  Phone, MapPin, Clock, Send, Banknote, CreditCard,
  BedDouble, Bell
} from 'lucide-react'

type Hotel = {
  id: string
  name: string
  slug: string
  phone: string | null
  whatsapp_number: string | null
  address: string | null
  city: string | null
  country: string | null
  primary_color: string | null
  logo_url: string | null
}

type Reservation = {
  id: string
  confirmation_number: string
  check_in_date: string
  check_out_date: string
  adults: number
  children: number
  rate_per_night: number
  status: string
  special_requests: string | null
  guest: { id: string; full_name: string; phone: string | null; email: string | null } | null
  room: { id: string; number: string; floor: number } | null
  room_type: { name: string; amenities: string[] | null } | null
}

type MenuItem = {
  id: string
  name: string
  category: string
  price: number
  room_service_price: number | null
  description: string | null
  is_available: boolean
  available_room_service: boolean
}

type OrderItem = { menu_item_id: string; name: string; price: number; quantity: number }
type Message = { content: string; direction: string; created_at: string }
type FolioCharge = { description: string; amount: number; quantity: number; created_at: string }

type Screen = 'login' | 'home' | 'room_service' | 'maintenance' | 'messages' | 'folio' | 'info'
type AccessLevel = 'full' | 'checkout_day' | 'folio_only' | 'expired'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n)
}
function nights(ci: string, co: string) {
  return Math.max(1, Math.ceil((new Date(co).getTime() - new Date(ci).getTime()) / 86400000))
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' })
}
function getAccessLevel(reservation: Reservation): AccessLevel {
  const today = new Date().toISOString().split('T')[0]
  const checkout = reservation.check_out_date
  const status = reservation.status

  if (status === 'checked_out' || (checkout < today)) {
    const daysSince = Math.floor((new Date(today).getTime() - new Date(checkout).getTime()) / 86400000)
    if (daysSince > 7) return 'expired'
    return 'folio_only'
  }
  if (checkout === today && status === 'checked_in') return 'checkout_day'
  if (['confirmed', 'checked_in'].includes(status)) return 'full'
  return 'expired'
}

const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function StayPortalPage({ params }: { params: { hotelSlug: string } }) {
  const [hotel, setHotel] = useState<Hotel | null>(null)
  const [hotelLoading, setHotelLoading] = useState(true)
  const [hotelNotFound, setHotelNotFound] = useState(false)

  const [screen, setScreen] = useState<Screen>('login')
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('full')
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [folioCharges, setFolioCharges] = useState<FolioCharge[]>([])
  const [messages, setMessages] = useState<Message[]>([])

  // Login
  const [roomNumber, setRoomNumber] = useState('')
  const [lastName, setLastName] = useState('')
  const [loginError, setLoginError] = useState('')
  const [logging, setLogging] = useState(false)

  // Room service
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState<'folio' | 'card' | 'cash'>('folio')
  const [orderNotes, setOrderNotes] = useState('')
  const [submittingOrder, setSubmittingOrder] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [rsCategory, setRsCategory] = useState('all')

  // Maintenance
  const [issueType, setIssueType] = useState('general')
  const [issueDesc, setIssueDesc] = useState('')
  const [submittingIssue, setSubmittingIssue] = useState(false)
  const [issueSuccess, setIssueSuccess] = useState(false)

  // Messages
  const [newMessage, setNewMessage] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)

  // Late checkout
  const [lateSuccess, setLateSuccess] = useState(false)
  const [requestingLate, setRequestingLate] = useState(false)

  const gold = hotel?.primary_color ?? '#c9a84c'

  useEffect(() => { loadHotel() }, [])

  async function loadHotel() {
    setHotelLoading(true)
    const { data } = await supabase
      .from('hotels')
      .select('id, name, slug, phone, whatsapp_number, address, city, country, primary_color, logo_url')
      .eq('slug', params.hotelSlug)
      .single()

    if (!data) { setHotelNotFound(true); setHotelLoading(false); return }
    setHotel(data)
    setHotelLoading(false)
  }

  async function handleLogin() {
    if (!hotel || !roomNumber || !lastName) return
    setLogging(true)
    setLoginError('')

    const today = new Date().toISOString().split('T')[0]
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

    // Find reservation by room number + last name within this hotel
    const { data: rooms } = await supabase
      .from('rooms')
      .select('id')
      .eq('hotel_id', hotel.id)
      .eq('number', roomNumber.trim())

    if (!rooms || rooms.length === 0) {
      setLoginError('Room not found. Please check your room number.')
      setLogging(false)
      return
    }

    const roomId = rooms[0].id

    // Find active or recent reservation for this room
    const { data: res } = await supabase
      .from('reservations')
      .select(`
        id, confirmation_number, check_in_date, check_out_date,
        adults, children, rate_per_night, status, special_requests,
        guest:guests(id, full_name, phone, email),
        room:rooms(id, number, floor),
        room_type:room_types(name, amenities)
      `)
      .eq('hotel_id', hotel.id)
      .eq('room_id', roomId)
      .gte('check_out_date', sevenDaysAgo)
      .order('check_in_date', { ascending: false })
      .limit(1)
      .single()

    if (!res) {
      setLoginError('No active reservation found for this room.')
      setLogging(false)
      return
    }

    // Verify last name matches (case-insensitive)
    const guestLastName = (res as any).guest?.full_name?.split(' ').pop()?.toLowerCase() ?? ''
    const inputLastName = lastName.trim().toLowerCase()

    if (guestLastName !== inputLastName) {
      setLoginError('Room number and last name do not match. Please try again.')
      setLogging(false)
      return
    }

    const typedRes = res as unknown as Reservation
    const access = getAccessLevel(typedRes)
    setReservation(typedRes)
    setAccessLevel(access)

    // Load menu, folio, messages
    const [{ data: menu }, { data: folio }, { data: msgs }] = await Promise.all([
      supabase.from('menu_items').select('*').eq('hotel_id', hotel.id).eq('is_available', true).eq('available_room_service', true),
      supabase.from('folio_charges').select('description, amount, quantity, created_at').eq('reservation_id', res.id).order('created_at'),
      supabase.from('guest_messages').select('content, direction, created_at').eq('reservation_id', res.id).order('created_at')
    ])

    setMenuItems(menu ?? [])
    setFolioCharges(folio ?? [])
    setMessages(msgs ?? [])
    setScreen(access === 'folio_only' ? 'folio' : 'home')
    setLogging(false)
  }

  function addToOrder(item: MenuItem) {
    const price = item.room_service_price ?? item.price
    setOrderItems(prev => {
      const existing = prev.find(o => o.menu_item_id === item.id)
      if (existing) return prev.map(o => o.menu_item_id === item.id ? { ...o, quantity: o.quantity + 1 } : o)
      return [...prev, { menu_item_id: item.id, name: item.name, price, quantity: 1 }]
    })
  }

  function changeQty(id: string, delta: number) {
    setOrderItems(prev => {
      const item = prev.find(o => o.menu_item_id === id)
      if (!item) return prev
      if (item.quantity + delta <= 0) return prev.filter(o => o.menu_item_id !== id)
      return prev.map(o => o.menu_item_id === id ? { ...o, quantity: o.quantity + delta } : o)
    })
  }

  async function submitOrder() {
    if (!hotel || !reservation || orderItems.length === 0) return
    setSubmittingOrder(true)
    const subtotal = orderItems.reduce((s, i) => s + i.price * i.quantity, 0)
    const vat = subtotal * 0.075
    const total = subtotal + vat

    const { data: order } = await supabase.from('pos_orders').insert({
      hotel_id: hotel.id,
      order_type: 'room_service',
      room_id: reservation.room?.id ?? null,
      status: 'open', subtotal, vat_amount: vat, total,
      notes: `Guest portal — ${paymentMethod}. ${orderNotes}`.trim(),
    }).select().single()

    if (order) {
      await supabase.from('pos_order_items').insert(
        orderItems.map(i => ({ hotel_id: hotel.id, order_id: order.id, menu_item_id: i.menu_item_id, quantity: i.quantity, unit_price: i.price }))
      )
      if (paymentMethod === 'folio') {
        await supabase.from('folio_charges').insert({
          hotel_id: hotel.id, reservation_id: reservation.id, guest_id: reservation.guest?.id ?? null,
          description: `Room service — ${orderItems.map(i => `${i.name} ×${i.quantity}`).join(', ')}`,
          charge_type: 'food_beverage', amount: subtotal, quantity: 1, total, is_paid: false,
        })
      }
      await supabase.from('guest_messages').insert({
        hotel_id: hotel.id, reservation_id: reservation.id, direction: 'inbound', channel: 'portal', is_automated: true,
        content: `🍽 Room service from Room ${reservation.room?.number}: ${orderItems.map(i => `${i.name} ×${i.quantity}`).join(', ')}. Payment: ${paymentMethod}. Total: ${formatCurrency(total)}`,
        status: 'received',
      })
    }

    setOrderItems([]); setOrderNotes('')
    setOrderSuccess(true)
    setTimeout(() => { setOrderSuccess(false); setScreen('home') }, 3000)
    setSubmittingOrder(false)
  }

  async function submitMaintenance() {
    if (!hotel || !reservation || !issueDesc) return
    setSubmittingIssue(true)
    await supabase.from('maintenance_tickets').insert({
      hotel_id: hotel.id, room_id: reservation.room?.id ?? null,
      issue_type: issueType, description: issueDesc, priority: 'medium', status: 'open',
    })
    await supabase.from('guest_messages').insert({
      hotel_id: hotel.id, reservation_id: reservation.id, direction: 'inbound', channel: 'portal', is_automated: true,
      content: `🔧 Maintenance from Room ${reservation.room?.number}: ${issueType} — ${issueDesc}`,
      status: 'received',
    })
    setIssueDesc('')
    setIssueSuccess(true)
    setTimeout(() => { setIssueSuccess(false); setScreen('home') }, 3000)
    setSubmittingIssue(false)
  }

  async function sendMessage() {
    if (!hotel || !reservation || !newMessage.trim()) return
    setSendingMsg(true)
    await supabase.from('guest_messages').insert({
      hotel_id: hotel.id, reservation_id: reservation.id,
      direction: 'inbound', channel: 'portal', is_automated: false,
      content: newMessage, status: 'received',
    })
    setMessages(prev => [...prev, { content: newMessage, direction: 'inbound', created_at: new Date().toISOString() }])
    setNewMessage('')
    setSendingMsg(false)
  }

  async function requestLateCheckout() {
    if (!hotel || !reservation) return
    setRequestingLate(true)
    await supabase.from('guest_messages').insert({
      hotel_id: hotel.id, reservation_id: reservation.id, direction: 'inbound', channel: 'portal', is_automated: true,
      content: `⏰ Late checkout request from Room ${reservation.room?.number} (${reservation.guest?.full_name}). Current checkout: ${formatDate(reservation.check_out_date)}`,
      status: 'received',
    })
    setLateSuccess(true)
    setTimeout(() => setLateSuccess(false), 4000)
    setRequestingLate(false)
  }

  const orderSubtotal = orderItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const orderVat = orderSubtotal * 0.075
  const orderTotal = orderSubtotal + orderVat
  const folioSubtotal = reservation ? reservation.rate_per_night * nights(reservation.check_in_date, reservation.check_out_date) + folioCharges.reduce((s, c) => s + c.amount * c.quantity, 0) : 0
  const folioVat = folioSubtotal * 0.075
  const folioGrand = folioSubtotal + folioVat
  const rsCategories = ['all', ...Array.from(new Set(menuItems.map(m => m.category)))]
  const filteredMenu = menuItems.filter(m => rsCategory === 'all' || m.category === rsCategory)

  // Shared styles
  const css = `
    * { box-sizing: border-box; }
    html, body { background: #080f1a; margin: 0; }
    .gp { min-height: 100vh; background: #080f1a; font-family: 'DM Sans', sans-serif; max-width: 480px; margin: 0 auto; padding-bottom: 48px; }
    .gp-full { display: flex; flex-direction: column; height: 100vh; max-width: 480px; margin: 0 auto; background: #080f1a; font-family: 'DM Sans', sans-serif; }
    .subheader { display: flex; align-items: center; gap: 12px; padding: 48px 20px 20px; background: #0d1829; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }
    .back-btn { width: 36px; height: 36px; border-radius: 10px; background: rgba(255,255,255,0.08); border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .subheader-title { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: white; margin: 0; flex: 1; }
    .success-screen { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 80px 40px; text-align: center; }
    .success-icon { width: 72px; height: 72px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    .success-screen h3 { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: white; margin: 0; }
    .success-screen p { font-size: 14px; color: rgba(255,255,255,0.5); margin: 0; line-height: 1.6; }
    .form-body { padding: 24px 20px; display: flex; flex-direction: column; gap: 18px; }
    .field { display: flex; flex-direction: column; gap: 8px; }
    .field label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: rgba(255,255,255,0.4); }
    .field input, .field select { padding: 12px 14px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; font-size: 15px; font-family: 'DM Sans', sans-serif; color: white; outline: none; }
    .field input:focus { border-color: ${gold}80; }
    .field textarea { padding: 12px 14px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; font-size: 14px; font-family: 'DM Sans', sans-serif; color: white; outline: none; resize: none; width: 100%; }
    .submit-btn { width: 100%; padding: 14px; background: linear-gradient(135deg, ${gold}, ${gold}cc); color: white; font-size: 15px; font-weight: 700; font-family: 'DM Sans', sans-serif; border: none; border-radius: 12px; cursor: pointer; }
    .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .powered { text-align: center; font-size: 11px; color: rgba(255,255,255,0.15); margin: 24px 0 0; }
    .powered span { color: rgba(255,255,255,0.25); font-weight: 600; }
  `

  // ── LOADING ──
  if (hotelLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#080f1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.1)', borderTop: `3px solid ${gold}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── HOTEL NOT FOUND ──
  if (hotelNotFound) {
    return (
      <div style={{ minHeight: '100vh', background: '#080f1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'DM Sans, sans-serif', flexDirection: 'column', gap: 12, textAlign: 'center' }}>
        <BedDouble size={40} color="rgba(255,255,255,0.2)" />
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: 0 }}>Hotel not found. Please check your link.</p>
      </div>
    )
  }

  // ── LOGIN ──
  if (screen === 'login') {
    return (
      <div className="gp">
        <style>{css}</style>
        <div style={{ background: 'linear-gradient(180deg, #0d1829 0%, #080f1a 100%)', padding: '48px 20px 32px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {hotel?.logo_url ? (
            <img src={hotel.logo_url} alt={hotel.name} style={{ height: 56, objectFit: 'contain', marginBottom: 16 }} />
          ) : (
            <div style={{ width: 64, height: 64, background: `linear-gradient(135deg, ${gold}, ${gold}cc)`, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <BedDouble size={28} color="white" />
            </div>
          )}
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 700, color: 'white', margin: '0 0 6px' }}>{hotel?.name}</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Guest Portal</p>
        </div>

        <div className="form-body">
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.6 }}>
            Enter your room number and last name to access your guest services.
          </p>
          <div className="field">
            <label>Room Number</label>
            <input
              value={roomNumber}
              onChange={e => setRoomNumber(e.target.value)}
              placeholder="e.g. 201"
              type="text"
              inputMode="numeric"
              autoFocus
            />
          </div>
          <div className="field">
            <label>Last Name</label>
            <input
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="e.g. David"
              type="text"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>
          {loginError && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#fca5a5' }}>
              {loginError}
            </div>
          )}
          <button className="submit-btn" onClick={handleLogin} disabled={logging || !roomNumber || !lastName}>
            {logging ? 'Checking...' : 'Access My Room Services'}
          </button>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
            Use your room number and the last name on your reservation.
          </p>
        </div>

        <p className="powered">Powered by <span>LuxStay</span></p>
      </div>
    )
  }

  // ── FOLIO ONLY (post checkout) ──
  if (accessLevel === 'folio_only' && screen !== 'folio') {
    setScreen('folio')
  }

  // ── HOME ──
  if (screen === 'home') {
    const n = nights(reservation!.check_in_date, reservation!.check_out_date)
    const isCheckoutDay = accessLevel === 'checkout_day'
    const actions = [
      { icon: Utensils, label: 'Room Service', sub: 'Order food & drinks', screen: 'room_service' as Screen, color: gold, show: accessLevel !== 'folio_only' && menuItems.length > 0 },
      { icon: Wrench, label: 'Maintenance', sub: 'Report an issue', screen: 'maintenance' as Screen, color: '#3b82f6', show: accessLevel !== 'folio_only' },
      { icon: MessageSquare, label: 'Front Desk', sub: 'Chat with us', screen: 'messages' as Screen, color: '#10b981', show: accessLevel !== 'folio_only' },
      { icon: Receipt, label: 'My Bill', sub: 'View charges', screen: 'folio' as Screen, color: '#8b5cf6', show: true },
      { icon: Info, label: 'Hotel Info', sub: 'WiFi, facilities', screen: 'info' as Screen, color: '#f59e0b', show: true },
    ].filter(a => a.show)

    return (
      <div className="gp">
        <style>{css}</style>

        {/* Header */}
        <div style={{ background: 'linear-gradient(180deg, #0d1829 0%, #111f35 100%)', padding: '48px 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: `${gold}90`, margin: '0 0 4px' }}>{hotel?.name}</p>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: '0 0 2px' }}>Welcome back,</p>
              <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 700, color: 'white', margin: 0 }}>
                {reservation!.guest?.full_name?.split(' ')[0]}
              </h1>
            </div>
            <div style={{ textAlign: 'center', background: `${gold}15`, border: `1px solid ${gold}40`, borderRadius: 14, padding: '10px 16px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: `${gold}90`, margin: '0 0 4px' }}>Your Room</p>
              <p style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 800, color: gold, margin: 0 }}>{reservation!.room?.number}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '14px 16px' }}>
            {[
              { label: 'Check-in', val: formatDate(reservation!.check_in_date) },
              null,
              { label: `${n} night${n > 1 ? 's' : ''}`, val: reservation!.room_type?.name ?? '' },
              null,
              { label: 'Check-out', val: formatDate(reservation!.check_out_date), highlight: isCheckoutDay },
            ].map((item, i) =>
              item === null ? (
                <div key={i} style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.1)' }} />
              ) : (
                <div key={i} style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: item.highlight ? '#fcd34d' : 'white', margin: 0 }}>{item.val}{item.highlight ? ' ⚡' : ''}</p>
                </div>
              )
            )}
          </div>

          {isCheckoutDay && (
            <div style={{ marginTop: 14, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#fcd34d', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <span>Today is your checkout day. Checkout by 12:00 noon.</span>
              <button onClick={requestLateCheckout} disabled={requestingLate || lateSuccess} style={{ padding: '6px 12px', background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fcd34d', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' }}>
                {lateSuccess ? '✓ Requested!' : requestingLate ? 'Sending...' : 'Request late checkout'}
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ padding: '24px 20px 0' }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', margin: '0 0 14px' }}>How can we help?</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {actions.map(action => (
              <button key={action.screen} onClick={() => setScreen(action.screen)} style={{ position: 'relative', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'DM Sans, sans-serif' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: action.color + '20', border: `1px solid ${action.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <action.icon size={20} color={action.color} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'white', margin: '0 0 3px' }}>{action.label}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0 }}>{action.sub}</p>
                <ChevronRight size={13} color="rgba(255,255,255,0.2)" style={{ position: 'absolute', top: 12, right: 12 }} />
              </button>
            ))}
          </div>
        </div>

        {/* Amenities */}
        {((reservation!.room_type?.amenities ?? []).length > 0) && (
          <div style={{ padding: '24px 20px 0' }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', margin: '0 0 12px' }}>Your Room Includes</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {reservation!.room_type?.amenities?.map(a => (
                <span key={a} style={{ fontSize: 12, fontWeight: 500, padding: '5px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, color: 'rgba(255,255,255,0.6)' }}>{a}</span>
              ))}
            </div>
          </div>
        )}

        {/* Contact */}
        <div style={{ padding: '24px 20px 0' }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: '0 0 10px' }}>Need immediate assistance?</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {hotel?.phone && (
              <a href={`tel:${hotel.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', textDecoration: 'none', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}>
                <Phone size={15} /> Call Front Desk
              </a>
            )}
            {hotel?.whatsapp_number && (
              <a href={`https://wa.me/${hotel.whatsapp_number.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', textDecoration: 'none', background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.25)', color: '#4ade80' }}>
                <MessageSquare size={15} /> WhatsApp
              </a>
            )}
          </div>
        </div>

        <p className="powered">Powered by <span>LuxStay</span></p>
      </div>
    )
  }

  // ── ROOM SERVICE ──
  if (screen === 'room_service') {
    return (
      <div className="gp">
        <style>{css}</style>
        <div className="subheader">
          <button className="back-btn" onClick={() => setScreen('home')}><ArrowLeft size={18} /></button>
          <h2 className="subheader-title">Room Service</h2>
          {orderItems.length > 0 && <span style={{ background: gold, color: 'white', fontSize: 12, fontWeight: 700, borderRadius: 20, padding: '2px 10px' }}>{orderItems.reduce((s,i) => s+i.quantity, 0)}</span>}
        </div>

        {orderSuccess ? (
          <div className="success-screen">
            <div className="success-icon"><Check size={40} color="white" /></div>
            <h3>Order Placed!</h3>
            <p>Your order is being prepared. Estimated delivery: 20–30 minutes.</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '16px 20px', scrollbarWidth: 'none' }}>
              {rsCategories.map(cat => (
                <button key={cat} onClick={() => setRsCategory(cat)} style={{ padding: '7px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', border: `1px solid ${rsCategory === cat ? gold : 'rgba(255,255,255,0.1)'}`, background: rsCategory === cat ? gold : 'rgba(255,255,255,0.04)', color: rsCategory === cat ? 'white' : 'rgba(255,255,255,0.5)', cursor: 'pointer', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                  {cat}
                </button>
              ))}
            </div>

            <div style={{ padding: '0 20px' }}>
              {filteredMenu.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.3)' }}><Utensils size={32} /><p style={{ margin: '12px 0 0' }}>No items available</p></div>
              ) : (
                filteredMenu.map(item => {
                  const inOrder = orderItems.find(o => o.menu_item_id === item.id)
                  const price = item.room_service_price ?? item.price
                  return (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 15, fontWeight: 600, color: 'white', margin: '0 0 4px' }}>{item.name}</p>
                        {item.description && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '0 0 6px', lineHeight: 1.4 }}>{item.description}</p>}
                        <p style={{ fontSize: 14, fontWeight: 700, color: gold, margin: 0 }}>{formatCurrency(price)}</p>
                      </div>
                      {inOrder ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                          <button onClick={() => changeQty(item.id, -1)} style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={13} /></button>
                          <span style={{ fontSize: 15, fontWeight: 700, color: 'white', minWidth: 20, textAlign: 'center' }}>{inOrder.quantity}</span>
                          <button onClick={() => changeQty(item.id, 1)} style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={13} /></button>
                        </div>
                      ) : (
                        <button onClick={() => addToOrder(item)} style={{ width: 36, height: 36, borderRadius: '50%', background: gold, border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Plus size={16} /></button>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {orderItems.length > 0 && (
              <div style={{ margin: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'white', margin: '0 0 14px' }}>Your Order</p>
                {orderItems.map(item => (
                  <div key={item.menu_item_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
                    <span>{item.name} × {item.quantity}</span>
                    <span>{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}><span>VAT (7.5%)</span><span>{formatCurrency(orderVat)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, color: 'white', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10, marginTop: 6 }}><span>Total</span><span>{formatCurrency(orderTotal)}</span></div>

                <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="Special instructions (allergies, preferences...)" rows={2} style={{ width: '100%', marginTop: 14, padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 13, fontFamily: 'DM Sans, sans-serif', color: 'white', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />

                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.4)', margin: '14px 0 10px' }}>Payment method</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
                  {[
                    { key: 'folio', label: 'Add to bill', icon: Receipt, sub: 'Pay at checkout' },
                    { key: 'card', label: 'Pay now', icon: CreditCard, sub: 'POS to room' },
                    { key: 'cash', label: 'Cash', icon: Banknote, sub: 'Pay on delivery' },
                  ].map(opt => (
                    <button key={opt.key} onClick={() => setPaymentMethod(opt.key as typeof paymentMethod)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '12px 8px', borderRadius: 12, border: `1.5px solid ${paymentMethod === opt.key ? gold : 'rgba(255,255,255,0.1)'}`, background: paymentMethod === opt.key ? `${gold}18` : 'rgba(255,255,255,0.03)', color: paymentMethod === opt.key ? gold : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 600, textAlign: 'center' }}>
                      <opt.icon size={18} />
                      <span>{opt.label}</span>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: 0, fontWeight: 400 }}>{opt.sub}</p>
                    </button>
                  ))}
                </div>

                <button className="submit-btn" onClick={submitOrder} disabled={submittingOrder}>
                  {submittingOrder ? 'Placing order...' : `Place Order — ${formatCurrency(orderTotal)}`}
                </button>
              </div>
            )}
          </>
        )}
        <p className="powered">Powered by <span>LuxStay</span></p>
      </div>
    )
  }

  // ── MAINTENANCE ──
  if (screen === 'maintenance') {
    const issueTypes = ['general', 'electrical', 'plumbing', 'ac', 'furniture', 'tv', 'housekeeping', 'other']
    return (
      <div className="gp">
        <style>{css}</style>
        <div className="subheader">
          <button className="back-btn" onClick={() => setScreen('home')}><ArrowLeft size={18} /></button>
          <h2 className="subheader-title">Report an Issue</h2>
        </div>
        {issueSuccess ? (
          <div className="success-screen">
            <div className="success-icon"><Check size={40} color="white" /></div>
            <h3>Request Received!</h3>
            <p>Our team has been notified and will attend to your room shortly.</p>
          </div>
        ) : (
          <div className="form-body">
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.6 }}>Tell us what needs attention in your room and we&apos;ll send someone right away.</p>
            <div className="field">
              <label>Issue Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {issueTypes.map(type => (
                  <button key={type} onClick={() => setIssueType(type)} style={{ padding: '10px 8px', borderRadius: 10, border: `1px solid ${issueType === type ? '#3b82f6' : 'rgba(255,255,255,0.1)'}`, background: issueType === type ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.04)', color: issueType === type ? '#93c5fd' : 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', textTransform: 'capitalize' }}>{type}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Describe the issue</label>
              <textarea value={issueDesc} onChange={e => setIssueDesc(e.target.value)} placeholder="e.g. The air conditioning is not cooling..." rows={4} />
            </div>
            <button className="submit-btn" onClick={submitMaintenance} disabled={submittingIssue || !issueDesc}>
              {submittingIssue ? 'Sending...' : 'Submit Request'}
            </button>
          </div>
        )}
        <p className="powered">Powered by <span>LuxStay</span></p>
      </div>
    )
  }

  // ── MESSAGES ──
  if (screen === 'messages') {
    return (
      <div className="gp-full">
        <style>{css}</style>
        <div className="subheader">
          <button className="back-btn" onClick={() => setScreen('home')}><ArrowLeft size={18} /></button>
          <h2 className="subheader-title">Front Desk</h2>
          <div style={{ width: 8, height: 8, background: '#10b981', borderRadius: '50%' }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: `${gold}12`, border: `1px solid ${gold}25`, borderRadius: 12, padding: 14, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
            <Bell size={18} color={gold} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0 }}>Hi {reservation!.guest?.full_name?.split(' ')[0]}! Welcome to {hotel?.name}. We typically respond within 5 minutes.</p>
          </div>
          {messages.map((msg, i) => (
            <div key={i} style={{ maxWidth: '80%', alignSelf: msg.direction === 'inbound' ? 'flex-end' : 'flex-start' }}>
              <div style={{ padding: '10px 14px', borderRadius: 14, fontSize: 13, lineHeight: 1.5, background: msg.direction === 'inbound' ? gold : 'rgba(255,255,255,0.08)', color: 'white', borderBottomRightRadius: msg.direction === 'inbound' ? 4 : 14, borderBottomLeftRadius: msg.direction === 'outbound' ? 4 : 14 }}>
                {msg.content}
              </div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', margin: '4px 0 0', textAlign: msg.direction === 'inbound' ? 'right' : 'left' }}>
                {new Date(msg.created_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, padding: 14, borderTop: '1px solid rgba(255,255,255,0.06)', background: '#0d1829', flexShrink: 0 }}>
          <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type your message..." rows={2} style={{ flex: 1, padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 14, fontFamily: 'DM Sans, sans-serif', color: 'white', outline: 'none', resize: 'none' }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }} />
          <button onClick={sendMessage} disabled={sendingMsg || !newMessage.trim()} style={{ width: 44, height: 44, borderRadius: 12, background: gold, border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'flex-end' }}>
            <Send size={18} />
          </button>
        </div>
      </div>
    )
  }

  // ── FOLIO ──
  if (screen === 'folio') {
    const roomTotal = reservation!.rate_per_night * nights(reservation!.check_in_date, reservation!.check_out_date)
    const extrasTotal = folioCharges.reduce((s, c) => s + c.amount * c.quantity, 0)
    const subtotal = roomTotal + extrasTotal
    const vat = subtotal * 0.075
    const grand = subtotal + vat

    return (
      <div className="gp">
        <style>{css}</style>
        <div className="subheader">
          {accessLevel !== 'folio_only' && <button className="back-btn" onClick={() => setScreen('home')}><ArrowLeft size={18} /></button>}
          <h2 className="subheader-title">{accessLevel === 'folio_only' ? 'Your Receipt' : 'My Bill'}</h2>
        </div>

        {accessLevel === 'folio_only' && (
          <div style={{ margin: '16px 20px 0', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#6ee7b7' }}>
            Thank you for staying with us at {hotel?.name}. Here is your final bill summary.
          </div>
        )}

        <div style={{ padding: 20 }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ background: 'linear-gradient(135deg, #0d1829, #111f35)', padding: 20, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 700, color: 'white', margin: '0 0 4px' }}>{hotel?.name}</p>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', margin: '0 0 4px' }}>{reservation!.guest?.full_name}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: 0, fontFamily: 'DM Mono, monospace' }}>Room {reservation!.room?.number} · {reservation!.confirmation_number}</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: `${gold}08` }}>
              <div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: '0 0 3px' }}>{reservation!.room_type?.name} — {nights(reservation!.check_in_date, reservation!.check_out_date)} nights</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: 0 }}>{formatCurrency(reservation!.rate_per_night)}/night</p>
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'white', margin: 0, flexShrink: 0 }}>{formatCurrency(roomTotal)}</p>
            </div>

            {folioCharges.map((charge, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: '0 0 2px' }}>{charge.description}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: 0 }}>{new Date(charge.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}</p>
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'white', margin: 0, flexShrink: 0 }}>{formatCurrency(charge.amount * charge.quantity)}</p>
              </div>
            ))}

            <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}><span>VAT (7.5%)</span><span>{formatCurrency(vat)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, color: 'white', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10, marginTop: 4 }}><span>Total</span><span>{formatCurrency(grand)}</span></div>
            </div>

            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: 0, padding: '0 20px 16px', lineHeight: 1.5 }}>
              {accessLevel === 'folio_only' ? 'This is your final bill. Thank you for your stay.' : 'This is your current bill. Final invoice will be provided at checkout.'}
            </p>
          </div>

          {accessLevel !== 'folio_only' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              <MessageSquare size={15} />
              <p style={{ margin: 0 }}>Questions about your bill? <button onClick={() => setScreen('messages')} style={{ background: 'none', border: 'none', color: gold, cursor: 'pointer', font: 'inherit', fontWeight: 600, padding: 0 }}>Chat with us</button></p>
            </div>
          )}
        </div>
        <p className="powered">Powered by <span>LuxStay</span></p>
      </div>
    )
  }

  // ── INFO ──
  if (screen === 'info') {
    return (
      <div className="gp">
        <style>{css}</style>
        <div className="subheader">
          <button className="back-btn" onClick={() => setScreen('home')}><ArrowLeft size={18} /></button>
          <h2 className="subheader-title">Hotel Information</h2>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 18 }}>
            <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: `${gold}90`, margin: '0 0 14px' }}>{hotel?.name}</p>
            {hotel?.address && <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 10 }}><MapPin size={15} /><span>{hotel.address}{hotel.city ? `, ${hotel.city}` : ''}</span></div>}
            {hotel?.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 10 }}><Phone size={15} /><a href={`tel:${hotel.phone}`} style={{ color: gold, textDecoration: 'none' }}>{hotel.phone}</a></div>}
          </div>

          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 18 }}>
            <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: `${gold}90`, margin: '0 0 14px' }}>Essential Information</p>
            {[
              { label: 'Check-in', value: '2:00 PM' },
              { label: 'Check-out', value: '12:00 Noon' },
              { label: 'Late checkout', value: 'Request via portal' },
              { label: 'Room service', value: '6:00 AM — 11:00 PM' },
              { label: 'Front desk', value: '24 hours' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0 }}>{item.label}</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'white', margin: 0, textAlign: 'right' }}>{item.value}</p>
              </div>
            ))}
          </div>

          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 18 }}>
            <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: `${gold}90`, margin: '0 0 14px' }}>Quick Actions</p>
            {[
              { icon: Utensils, label: 'Order Room Service', action: () => setScreen('room_service'), show: accessLevel !== 'folio_only' },
              { icon: Wrench, label: 'Report an Issue', action: () => setScreen('maintenance'), show: accessLevel !== 'folio_only' },
              { icon: MessageSquare, label: 'Chat with Front Desk', action: () => setScreen('messages'), show: accessLevel !== 'folio_only' },
              { icon: Clock, label: lateSuccess ? '✓ Late checkout requested' : 'Request Late Checkout', action: requestLateCheckout, show: accessLevel === 'checkout_day' },
            ].filter(a => a.show).map(action => (
              <button key={action.label} onClick={action.action} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '13px 0', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', textAlign: 'left' }}>
                <action.icon size={16} color={gold} />
                <span style={{ flex: 1 }}>{action.label}</span>
                <ChevronRight size={14} color="rgba(255,255,255,0.2)" />
              </button>
            ))}
          </div>
        </div>
        <p className="powered">Powered by <span>LuxStay</span></p>
      </div>
    )
  }

  return null
}
