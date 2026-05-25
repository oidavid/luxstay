'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Wifi, Coffee, Wrench, MessageSquare, CreditCard,
  Clock, Star, ChevronRight, Plus, Minus, X, Check,
  BedDouble, Phone, MapPin, Utensils, Moon, Send,
  Wallet, Banknote, Receipt, ArrowLeft, Info, Bell
} from 'lucide-react'

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
  guest: { full_name: string; phone: string | null; email: string | null } | null
  room: { id: string; number: string; floor: number } | null
  room_type: { name: string; amenities: string[] } | null
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

type OrderItem = {
  menu_item_id: string
  name: string
  price: number
  quantity: number
}

type Hotel = {
  id: string
  name: string
  phone: string | null
  whatsapp_number: string | null
  address: string | null
  city: string | null
  wifi_password?: string | null
}

type Screen = 'login' | 'home' | 'room_service' | 'maintenance' | 'messages' | 'folio' | 'info'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n)
}

function nights(ci: string, co: string) {
  return Math.max(1, Math.ceil((new Date(co).getTime() - new Date(ci).getTime()) / 86400000))
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function GuestPortalPage({ params }: { params: { token: string } }) {
  const supabase = createClient()
  const [screen, setScreen] = useState<Screen>('login')
  const [hotelId, setHotelId] = useState<string | null>(null)
  const [hotel, setHotel] = useState<Hotel | null>(null)
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [folioCharges, setFolioCharges] = useState<{ description: string; amount: number; quantity: number; created_at: string }[]>([])

  // Login
  const [confNumber, setConfNumber] = useState(params?.token ? params.token.toUpperCase() : '')
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
  const [messages, setMessages] = useState<{ content: string; direction: string; created_at: string }[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)

  // Late checkout
  const [requestingLate, setRequestingLate] = useState(false)
  const [lateSuccess, setLateSuccess] = useState(false)

  // Auto-login if token matches confirmation number
  useEffect(() => {
    if (params?.token && params.token.startsWith('LUX-')) {
      handleLogin(params.token.toUpperCase())
    }
  }, [])

  async function handleLogin(overrideConf?: string) {
    const conf = overrideConf ?? confNumber.toUpperCase().trim()
    if (!conf) return
    setLogging(true)
    setLoginError('')

    const { data: res } = await supabase
      .from('reservations')
      .select(`
        id, confirmation_number, check_in_date, check_out_date,
        adults, children, rate_per_night, status, special_requests,
        guest:guests(full_name, phone, email),
        room:rooms(id, number, floor),
        room_type:room_types(name, amenities),
        hotel_id
      `)
      .eq('confirmation_number', conf)
      .in('status', ['confirmed', 'checked_in'])
      .single()

    if (!res) {
      setLoginError('Reservation not found. Please check your confirmation number.')
      setLogging(false)
      return
    }

    const hid = (res as any).hotel_id
    setHotelId(hid)
    setReservation(res as unknown as Reservation)

    // Load hotel info
    const { data: h } = await supabase.from('hotels').select('id, name, phone, whatsapp_number, address, city').eq('id', hid).single()
    setHotel(h)

    // Load menu items available for room service
    const { data: menu } = await supabase.from('menu_items').select('*').eq('hotel_id', hid).eq('is_available', true).eq('available_room_service', true)
    setMenuItems(menu ?? [])

    // Load folio
    const { data: folio } = await supabase.from('folio_charges').select('description, amount, quantity, created_at').eq('reservation_id', res.id).order('created_at')
    setFolioCharges(folio ?? [])

    // Load messages
    const { data: msgs } = await supabase.from('guest_messages').select('content, direction, created_at').eq('reservation_id', res.id).order('created_at')
    setMessages(msgs ?? [])

    setScreen('home')
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
    if (!hotelId || !reservation || orderItems.length === 0) return
    setSubmittingOrder(true)

    const subtotal = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
    const vat = subtotal * 0.075
    const total = subtotal + vat

    // Create POS order
    const { data: order } = await supabase.from('pos_orders').insert({
      hotel_id: hotelId,
      order_type: 'room_service',
      room_id: reservation.room?.id ?? null,
      status: 'open',
      subtotal, vat_amount: vat, total,
      notes: `Guest portal order — ${paymentMethod} payment. ${orderNotes}`.trim(),
    }).select().single()

    if (order) {
      await supabase.from('pos_order_items').insert(
        orderItems.map(item => ({
          hotel_id: hotelId,
          order_id: order.id,
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
          unit_price: item.price,
        }))
      )

      // If charge to folio, post to folio_charges
      if (paymentMethod === 'folio') {
        await supabase.from('folio_charges').insert({
          hotel_id: hotelId,
          reservation_id: reservation.id,
          guest_id: null,
          description: `Room service — ${orderItems.map(i => `${i.name} x${i.quantity}`).join(', ')}`,
          charge_type: 'food_beverage',
          amount: subtotal,
          quantity: 1,
          total,
          is_paid: false,
        })
      }

      // Log message to front desk
      await supabase.from('guest_messages').insert({
        hotel_id: hotelId,
        guest_id: null,
        reservation_id: reservation.id,
        direction: 'inbound',
        channel: 'portal',
        content: `🍽 Room service order from Room ${reservation.room?.number}: ${orderItems.map(i => `${i.name} x${i.quantity}`).join(', ')}. Payment: ${paymentMethod}. Total: ${formatCurrency(total)}`,
        status: 'received',
        is_automated: true,
      })
    }

    setOrderItems([])
    setOrderNotes('')
    setOrderSuccess(true)
    setTimeout(() => { setOrderSuccess(false); setScreen('home') }, 3000)
    setSubmittingOrder(false)
  }

  async function submitMaintenance() {
    if (!hotelId || !reservation || !issueDesc) return
    setSubmittingIssue(true)

    await supabase.from('maintenance_tickets').insert({
      hotel_id: hotelId,
      room_id: reservation.room?.id ?? null,
      issue_type: issueType,
      description: issueDesc,
      priority: 'medium',
      status: 'open',
    })

    await supabase.from('guest_messages').insert({
      hotel_id: hotelId,
      guest_id: null,
      reservation_id: reservation.id,
      direction: 'inbound',
      channel: 'portal',
      content: `🔧 Maintenance request from Room ${reservation.room?.number}: ${issueType} — ${issueDesc}`,
      status: 'received',
      is_automated: true,
    })

    setIssueDesc('')
    setIssueSuccess(true)
    setTimeout(() => { setIssueSuccess(false); setScreen('home') }, 3000)
    setSubmittingIssue(false)
  }

  async function sendMessage() {
    if (!hotelId || !reservation || !newMessage.trim()) return
    setSendingMsg(true)

    await supabase.from('guest_messages').insert({
      hotel_id: hotelId,
      guest_id: null,
      reservation_id: reservation.id,
      direction: 'inbound',
      channel: 'portal',
      content: newMessage,
      status: 'received',
      is_automated: false,
    })

    setMessages(prev => [...prev, { content: newMessage, direction: 'inbound', created_at: new Date().toISOString() }])
    setNewMessage('')
    setSendingMsg(false)
  }

  async function requestLateCheckout() {
    if (!hotelId || !reservation) return
    setRequestingLate(true)

    await supabase.from('guest_messages').insert({
      hotel_id: hotelId,
      guest_id: null,
      reservation_id: reservation.id,
      direction: 'inbound',
      channel: 'portal',
      content: `⏰ Late checkout request from Room ${reservation.room?.number} (${reservation.guest?.full_name}). Current checkout: ${formatDate(reservation.check_out_date)}`,
      status: 'received',
      is_automated: true,
    })

    setLateSuccess(true)
    setTimeout(() => setLateSuccess(false), 4000)
    setRequestingLate(false)
  }

  const orderTotal = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const orderVat = orderTotal * 0.075
  const orderGrandTotal = orderTotal + orderVat
  const folioTotal = folioCharges.reduce((sum, c) => sum + c.amount * c.quantity, 0)
  const roomTotal = reservation ? reservation.rate_per_night * nights(reservation.check_in_date, reservation.check_out_date) : 0
  const rsCategories = ['all', ...Array.from(new Set(menuItems.map(m => m.category)))]
  const filteredMenu = menuItems.filter(m => rsCategory === 'all' || m.category === rsCategory)

  // ── LOGIN SCREEN ──
  if (screen === 'login') {
    return (
      <div className="gp-login">
        <div className="gp-login-bg" />
        <div className="gp-login-card">
          <div className="gp-login-logo">
            <BedDouble size={28} color="white" />
          </div>
          <h1 className="gp-login-hotel">{hotel?.name ?? 'Welcome'}</h1>
          <p className="gp-login-sub">Enter your confirmation number to access your guest portal</p>

          <div className="gp-login-field">
            <input
              value={confNumber}
              onChange={e => setConfNumber(e.target.value.toUpperCase())}
              placeholder="e.g. LUX-2026-12345"
              className="gp-login-input"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>

          {loginError && <p className="gp-login-error">{loginError}</p>}

          <button className="gp-login-btn" onClick={() => handleLogin()} disabled={logging || !confNumber}>
            {logging ? 'Checking...' : 'Access My Portal'}
          </button>

          <p className="gp-login-help">Your confirmation number is on your booking email or reservation card in your room.</p>
        </div>

        <style>{`
          .gp-login { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; position: relative; font-family: 'DM Sans', sans-serif; }
          .gp-login-bg { position: fixed; inset: 0; background: linear-gradient(135deg, #080f1a 0%, #0d1829 50%, #1a2840 100%); z-index: 0; }
          .gp-login-card { position: relative; z-index: 1; width: 100%; max-width: 380px; background: rgba(255,255,255,0.05); border: 1px solid rgba(201,168,76,0.2); border-radius: 20px; padding: 40px 28px; text-align: center; backdrop-filter: blur(20px); }
          .gp-login-logo { width: 64px; height: 64px; background: linear-gradient(135deg, #c9a84c, #b8922e); border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
          .gp-login-hotel { font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 700; color: white; margin: 0 0 8px; }
          .gp-login-sub { font-size: 14px; color: rgba(255,255,255,0.5); margin: 0 0 28px; line-height: 1.5; }
          .gp-login-field { margin-bottom: 16px; }
          .gp-login-input { width: 100%; padding: 14px 16px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; font-size: 16px; font-family: 'DM Mono', monospace; color: white; outline: none; text-align: center; letter-spacing: 0.1em; box-sizing: border-box; }
          .gp-login-input::placeholder { color: rgba(255,255,255,0.25); font-family: 'DM Sans', sans-serif; letter-spacing: 0; }
          .gp-login-input:focus { border-color: rgba(201,168,76,0.5); }
          .gp-login-error { font-size: 13px; color: #fca5a5; margin: 0 0 12px; }
          .gp-login-btn { width: 100%; padding: 14px; background: linear-gradient(135deg, #c9a84c, #b8922e); color: white; font-size: 15px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: none; border-radius: 12px; cursor: pointer; margin-bottom: 20px; }
          .gp-login-btn:disabled { opacity: 0.5; cursor: not-allowed; }
          .gp-login-help { font-size: 12px; color: rgba(255,255,255,0.3); line-height: 1.5; margin: 0; }
        `}</style>
      </div>
    )
  }

  // ── HOME SCREEN ──
  if (screen === 'home') {
    const n = nights(reservation!.check_in_date, reservation!.check_out_date)
    const today = new Date().toISOString().split('T')[0]
    const isCheckoutToday = reservation!.check_out_date === today

    return (
      <div className="gp-root">
        {/* Header */}
        <div className="gp-header">
          <div className="gp-header-top">
            <div>
              <p className="gp-welcome">Welcome back,</p>
              <h1 className="gp-guest-name">{reservation!.guest?.full_name?.split(' ')[0] ?? 'Guest'}</h1>
            </div>
            <div className="gp-room-badge">
              <p className="gp-room-label">Your Room</p>
              <p className="gp-room-number">{reservation!.room?.number ?? '—'}</p>
            </div>
          </div>
          <div className="gp-stay-info">
            <div className="gp-stay-item">
              <p className="gp-stay-label">Check-in</p>
              <p className="gp-stay-val">{formatDate(reservation!.check_in_date)}</p>
            </div>
            <div className="gp-stay-divider" />
            <div className="gp-stay-item">
              <p className="gp-stay-label">{n} night{n > 1 ? 's' : ''}</p>
              <p className="gp-stay-val">{reservation!.room_type?.name}</p>
            </div>
            <div className="gp-stay-divider" />
            <div className="gp-stay-item">
              <p className="gp-stay-label">Check-out</p>
              <p className="gp-stay-val" style={{ color: isCheckoutToday ? '#fcd34d' : 'white' }}>
                {formatDate(reservation!.check_out_date)}
                {isCheckoutToday && ' ⚡'}
              </p>
            </div>
          </div>
          {isCheckoutToday && (
            <div className="gp-checkout-banner">
              Today is your checkout day. Checkout time is 12:00 noon.
              <button className="gp-late-btn" onClick={requestLateCheckout} disabled={requestingLate}>
                {lateSuccess ? '✓ Request sent!' : requestingLate ? 'Sending...' : 'Request late checkout'}
              </button>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="gp-actions">
          <h2 className="gp-section-title">How can we help?</h2>
          <div className="gp-action-grid">
            {[
              { icon: Utensils, label: 'Room Service', sub: 'Order food & drinks', screen: 'room_service', color: '#c9a84c', available: menuItems.length > 0 },
              { icon: Wrench, label: 'Maintenance', sub: 'Report an issue', screen: 'maintenance', color: '#3b82f6', available: true },
              { icon: MessageSquare, label: 'Front Desk', sub: 'Chat with us', screen: 'messages', color: '#10b981', available: true },
              { icon: Receipt, label: 'My Bill', sub: 'View charges', screen: 'folio', color: '#8b5cf6', available: true },
              { icon: Info, label: 'Hotel Info', sub: 'WiFi, facilities', screen: 'info', color: '#f59e0b', available: true },
            ].map(action => (
              <button
                key={action.screen}
                className="gp-action-card"
                onClick={() => action.available && setScreen(action.screen as Screen)}
                data-available={action.available}
              >
                <div className="gp-action-icon" style={{ background: action.color + '20', border: `1px solid ${action.color}40` }}>
                  <action.icon size={22} color={action.color} />
                </div>
                <p className="gp-action-label">{action.label}</p>
                <p className="gp-action-sub">{action.sub}</p>
                <ChevronRight size={14} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', top: 12, right: 12 }} />
              </button>
            ))}
          </div>
        </div>

        {/* Amenities */}
        {reservation!.room_type?.amenities?.length > 0 && (
          <div className="gp-amenities">
            <h2 className="gp-section-title">Your Room Includes</h2>
            <div className="gp-amenity-list">
              {reservation!.room_type.amenities.map(a => (
                <span key={a} className="gp-amenity-chip">{a}</span>
              ))}
            </div>
          </div>
        )}

        {/* Contact */}
        <div className="gp-contact">
          <p className="gp-contact-label">Need immediate assistance?</p>
          <div className="gp-contact-btns">
            {hotel?.phone && (
              <a href={`tel:${hotel.phone}`} className="gp-contact-btn">
                <Phone size={16} /> Call Front Desk
              </a>
            )}
            {hotel?.whatsapp_number && (
              <a href={`https://wa.me/${hotel.whatsapp_number?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="gp-contact-btn whatsapp">
                <MessageSquare size={16} /> WhatsApp
              </a>
            )}
          </div>
        </div>

        <p className="gp-conf">Confirmation: {reservation!.confirmation_number}</p>

        <style>{`
          * { box-sizing: border-box; }
          body { background: #080f1a; margin: 0; }
          .gp-root { min-height: 100vh; background: #080f1a; font-family: 'DM Sans', sans-serif; padding-bottom: 40px; max-width: 480px; margin: 0 auto; }
          .gp-header { background: linear-gradient(180deg, #0d1829 0%, #111f35 100%); padding: 48px 20px 24px; border-bottom: 1px solid rgba(201,168,76,0.15); }
          .gp-header-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
          .gp-welcome { font-size: 13px; color: rgba(255,255,255,0.4); margin: 0 0 4px; }
          .gp-guest-name { font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 700; color: white; margin: 0; }
          .gp-room-badge { text-align: center; background: rgba(201,168,76,0.1); border: 1px solid rgba(201,168,76,0.3); border-radius: 14px; padding: 10px 16px; }
          .gp-room-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(201,168,76,0.7); margin: 0 0 4px; }
          .gp-room-number { font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 800; color: #c9a84c; margin: 0; }
          .gp-stay-info { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; align-items: center; background: rgba(255,255,255,0.04); border-radius: 12px; padding: 14px 16px; }
          .gp-stay-item { text-align: center; }
          .gp-stay-label { font-size: 10px; color: rgba(255,255,255,0.4); margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.06em; }
          .gp-stay-val { font-size: 13px; font-weight: 600; color: white; margin: 0; }
          .gp-stay-divider { width: 1px; height: 32px; background: rgba(255,255,255,0.1); }
          .gp-checkout-banner { margin-top: 14px; background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.3); border-radius: 10px; padding: 12px 14px; font-size: 13px; color: #fcd34d; display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
          .gp-late-btn { padding: 6px 12px; background: rgba(251,191,36,0.2); border: 1px solid rgba(251,191,36,0.4); border-radius: 8px; font-size: 12px; font-weight: 600; color: #fcd34d; cursor: pointer; font-family: 'DM Sans', sans-serif; white-space: nowrap; }
          .gp-actions { padding: 24px 20px 0; }
          .gp-section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.4); margin: 0 0 14px; }
          .gp-action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .gp-action-card { position: relative; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 16px; text-align: left; cursor: pointer; transition: all 0.15s; font-family: 'DM Sans', sans-serif; }
          .gp-action-card:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); }
          .gp-action-card[data-available="false"] { opacity: 0.4; cursor: not-allowed; }
          .gp-action-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }
          .gp-action-label { font-size: 14px; font-weight: 700; color: white; margin: 0 0 3px; }
          .gp-action-sub { font-size: 11px; color: rgba(255,255,255,0.4); margin: 0; }
          .gp-amenities { padding: 24px 20px 0; }
          .gp-amenity-list { display: flex; flex-wrap: wrap; gap: 8px; }
          .gp-amenity-chip { font-size: 12px; font-weight: 500; padding: 5px 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; color: rgba(255,255,255,0.6); }
          .gp-contact { padding: 24px 20px 0; }
          .gp-contact-label { font-size: 12px; color: rgba(255,255,255,0.4); margin: 0 0 10px; }
          .gp-contact-btns { display: flex; gap: 10px; }
          .gp-contact-btn { display: flex; align-items: center; gap: 6px; padding: 10px 16px; border-radius: 10px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; text-decoration: none; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: white; }
          .gp-contact-btn.whatsapp { background: rgba(37,211,102,0.1); border-color: rgba(37,211,102,0.3); color: #4ade80; }
          .gp-conf { text-align: center; font-size: 11px; color: rgba(255,255,255,0.15); font-family: 'DM Mono', monospace; margin: 24px 0 0; padding: 0 20px; }
        `}</style>
      </div>
    )
  }

  // ── ROOM SERVICE SCREEN ──
  if (screen === 'room_service') {
    return (
      <div className="gp-root">
        <div className="gp-subheader">
          <button className="gp-back" onClick={() => setScreen('home')}><ArrowLeft size={18} /></button>
          <h2 className="gp-subheader-title">Room Service</h2>
          {orderItems.length > 0 && <span className="gp-cart-badge">{orderItems.reduce((s,i) => s+i.quantity, 0)}</span>}
        </div>

        {orderSuccess ? (
          <div className="gp-success-screen">
            <div className="gp-success-icon"><Check size={40} color="white" /></div>
            <h3>Order Placed!</h3>
            <p>Your order is being prepared. Estimated delivery: 20-30 minutes.</p>
          </div>
        ) : (
          <>
            {/* Category filter */}
            <div className="gp-cat-scroll">
              {rsCategories.map(cat => (
                <button key={cat} className="gp-cat-btn" data-active={rsCategory === cat} onClick={() => setRsCategory(cat)}>
                  {cat}
                </button>
              ))}
            </div>

            {/* Menu */}
            <div className="gp-menu-list">
              {filteredMenu.length === 0 ? (
                <div className="gp-empty"><Utensils size={32} /><p>No items available</p></div>
              ) : (
                filteredMenu.map(item => {
                  const inOrder = orderItems.find(o => o.menu_item_id === item.id)
                  const price = item.room_service_price ?? item.price
                  return (
                    <div key={item.id} className="gp-menu-item">
                      <div className="gp-menu-item-info">
                        <p className="gp-menu-item-name">{item.name}</p>
                        {item.description && <p className="gp-menu-item-desc">{item.description}</p>}
                        <p className="gp-menu-item-price">{formatCurrency(price)}</p>
                      </div>
                      {inOrder ? (
                        <div className="gp-qty-controls">
                          <button className="gp-qty-btn" onClick={() => changeQty(item.id, -1)}><Minus size={14} /></button>
                          <span className="gp-qty">{inOrder.quantity}</span>
                          <button className="gp-qty-btn" onClick={() => changeQty(item.id, 1)}><Plus size={14} /></button>
                        </div>
                      ) : (
                        <button className="gp-add-btn" onClick={() => addToOrder(item)}><Plus size={16} /></button>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* Order summary */}
            {orderItems.length > 0 && (
              <div className="gp-order-panel">
                <h3 className="gp-order-title">Your Order</h3>
                {orderItems.map(item => (
                  <div key={item.menu_item_id} className="gp-order-row">
                    <span>{item.name} × {item.quantity}</span>
                    <span>{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))}
                <div className="gp-order-row muted"><span>VAT (7.5%)</span><span>{formatCurrency(orderVat)}</span></div>
                <div className="gp-order-row total"><span>Total</span><span>{formatCurrency(orderGrandTotal)}</span></div>

                {/* Notes */}
                <textarea
                  value={orderNotes}
                  onChange={e => setOrderNotes(e.target.value)}
                  placeholder="Special instructions (allergies, preferences...)"
                  className="gp-order-notes"
                  rows={2}
                />

                {/* Payment method */}
                <p className="gp-payment-label">Payment method</p>
                <div className="gp-payment-options">
                  {[
                    { key: 'folio', label: 'Add to bill', icon: Receipt, sub: 'Pay at checkout' },
                    { key: 'card', label: 'Pay now', icon: CreditCard, sub: 'Card payment' },
                    { key: 'cash', label: 'Cash', icon: Banknote, sub: 'Pay on delivery' },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      className="gp-payment-opt"
                      data-active={paymentMethod === opt.key}
                      onClick={() => setPaymentMethod(opt.key as typeof paymentMethod)}
                    >
                      <opt.icon size={18} />
                      <span>{opt.label}</span>
                      <p>{opt.sub}</p>
                    </button>
                  ))}
                </div>

                {paymentMethod === 'card' && (
                  <div className="gp-card-note">
                    Card payment will be processed at delivery. Our staff will bring a POS terminal to your room.
                  </div>
                )}

                <button className="gp-submit-btn" onClick={submitOrder} disabled={submittingOrder}>
                  {submittingOrder ? 'Placing order...' : `Place Order — ${formatCurrency(orderGrandTotal)}`}
                </button>
              </div>
            )}
          </>
        )}

        <style>{`
          * { box-sizing: border-box; }
          body { background: #080f1a; margin: 0; }
          .gp-root { min-height: 100vh; background: #080f1a; font-family: 'DM Sans', sans-serif; padding-bottom: 40px; max-width: 480px; margin: 0 auto; }
          .gp-subheader { display: flex; align-items: center; gap: 12px; padding: 48px 20px 20px; background: #0d1829; border-bottom: 1px solid rgba(255,255,255,0.06); }
          .gp-back { width: 36px; height: 36px; border-radius: 10px; background: rgba(255,255,255,0.08); border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; }
          .gp-subheader-title { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: white; margin: 0; flex: 1; }
          .gp-cart-badge { background: #c9a84c; color: white; font-size: 12px; font-weight: 700; border-radius: 20px; padding: 2px 10px; }
          .gp-success-screen { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 80px 40px; text-align: center; }
          .gp-success-icon { width: 72px; height: 72px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
          .gp-success-screen h3 { font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 700; color: white; margin: 0; }
          .gp-success-screen p { font-size: 14px; color: rgba(255,255,255,0.5); margin: 0; line-height: 1.6; }
          .gp-cat-scroll { display: flex; gap: 8px; overflow-x: auto; padding: 16px 20px; scrollbar-width: none; }
          .gp-cat-scroll::-webkit-scrollbar { display: none; }
          .gp-cat-btn { padding: 7px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.5); cursor: pointer; white-space: nowrap; text-transform: capitalize; }
          .gp-cat-btn[data-active="true"] { background: #c9a84c; border-color: #c9a84c; color: white; }
          .gp-menu-list { padding: 0 20px; display: flex; flex-direction: column; gap: 0; }
          .gp-menu-item { display: flex; align-items: center; gap: 14px; padding: 16px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
          .gp-menu-item-info { flex: 1; }
          .gp-menu-item-name { font-size: 15px; font-weight: 600; color: white; margin: 0 0 4px; }
          .gp-menu-item-desc { font-size: 12px; color: rgba(255,255,255,0.4); margin: 0 0 6px; line-height: 1.4; }
          .gp-menu-item-price { font-size: 14px; font-weight: 700; color: #c9a84c; margin: 0; }
          .gp-add-btn { width: 36px; height: 36px; border-radius: 50%; background: #c9a84c; border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
          .gp-qty-controls { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
          .gp-qty-btn { width: 30px; height: 30px; border-radius: 50%; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; }
          .gp-qty { font-size: 15px; font-weight: 700; color: white; min-width: 20px; text-align: center; }
          .gp-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 60px; color: rgba(255,255,255,0.3); font-size: 14px; }
          .gp-order-panel { margin: 20px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 20px; }
          .gp-order-title { font-size: 14px; font-weight: 700; color: white; margin: 0 0 14px; }
          .gp-order-row { display: flex; justify-content: space-between; font-size: 13px; color: rgba(255,255,255,0.7); margin-bottom: 8px; }
          .gp-order-row.muted { color: rgba(255,255,255,0.4); }
          .gp-order-row.total { font-size: 16px; font-weight: 800; color: white; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px; margin-top: 6px; }
          .gp-order-notes { width: 100%; padding: 10px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; font-size: 13px; font-family: 'DM Sans', sans-serif; color: white; outline: none; resize: none; margin: 14px 0; }
          .gp-payment-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: rgba(255,255,255,0.4); margin: 0 0 10px; }
          .gp-payment-options { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; margin-bottom: 14px; }
          .gp-payment-opt { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 8px; border-radius: 12px; border: 1.5px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.6); cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 600; text-align: center; transition: all 0.15s; }
          .gp-payment-opt p { font-size: 10px; font-weight: 400; color: rgba(255,255,255,0.3); margin: 0; }
          .gp-payment-opt[data-active="true"] { border-color: #c9a84c; background: rgba(201,168,76,0.1); color: #c9a84c; }
          .gp-card-note { background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.2); border-radius: 8px; padding: 10px 12px; font-size: 12px; color: rgba(147,197,253,0.8); margin-bottom: 14px; line-height: 1.5; }
          .gp-submit-btn { width: 100%; padding: 14px; background: linear-gradient(135deg, #c9a84c, #b8922e); color: white; font-size: 15px; font-weight: 700; font-family: 'DM Sans', sans-serif; border: none; border-radius: 12px; cursor: pointer; }
          .gp-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        `}</style>
      </div>
    )
  }

  // ── MAINTENANCE SCREEN ──
  if (screen === 'maintenance') {
    const issueTypes = ['general', 'electrical', 'plumbing', 'ac', 'furniture', 'tv', 'housekeeping', 'other']
    return (
      <div className="gp-root">
        <div className="gp-subheader">
          <button className="gp-back" onClick={() => setScreen('home')}><ArrowLeft size={18} /></button>
          <h2 className="gp-subheader-title">Report an Issue</h2>
        </div>

        {issueSuccess ? (
          <div className="gp-success-screen">
            <div className="gp-success-icon"><Check size={40} color="white" /></div>
            <h3>Request Received!</h3>
            <p>Our team has been notified and will attend to your room shortly.</p>
          </div>
        ) : (
          <div className="gp-form-body">
            <p className="gp-form-sub">Tell us what needs attention in your room and we&apos;ll send someone right away.</p>

            <div className="gp-form-field">
              <label>Issue Type</label>
              <div className="gp-issue-grid">
                {issueTypes.map(type => (
                  <button key={type} className="gp-issue-btn" data-active={issueType === type} onClick={() => setIssueType(type)}>
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="gp-form-field">
              <label>Describe the issue</label>
              <textarea
                value={issueDesc}
                onChange={e => setIssueDesc(e.target.value)}
                placeholder="e.g. The air conditioning is not cooling, the TV remote is missing..."
                rows={4}
                className="gp-textarea"
              />
            </div>

            <button className="gp-submit-btn" onClick={submitMaintenance} disabled={submittingIssue || !issueDesc}>
              {submittingIssue ? 'Sending...' : 'Submit Request'}
            </button>
          </div>
        )}

        <style>{`
          * { box-sizing: border-box; }
          body { background: #080f1a; margin: 0; }
          .gp-root { min-height: 100vh; background: #080f1a; font-family: 'DM Sans', sans-serif; padding-bottom: 40px; max-width: 480px; margin: 0 auto; }
          .gp-subheader { display: flex; align-items: center; gap: 12px; padding: 48px 20px 20px; background: #0d1829; border-bottom: 1px solid rgba(255,255,255,0.06); }
          .gp-back { width: 36px; height: 36px; border-radius: 10px; background: rgba(255,255,255,0.08); border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; }
          .gp-subheader-title { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: white; margin: 0; flex: 1; }
          .gp-success-screen { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 80px 40px; text-align: center; }
          .gp-success-icon { width: 72px; height: 72px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
          .gp-success-screen h3 { font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 700; color: white; margin: 0; }
          .gp-success-screen p { font-size: 14px; color: rgba(255,255,255,0.5); margin: 0; line-height: 1.6; }
          .gp-form-body { padding: 24px 20px; display: flex; flex-direction: column; gap: 20px; }
          .gp-form-sub { font-size: 14px; color: rgba(255,255,255,0.5); margin: 0; line-height: 1.6; }
          .gp-form-field { display: flex; flex-direction: column; gap: 10px; }
          .gp-form-field label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: rgba(255,255,255,0.4); }
          .gp-issue-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; }
          .gp-issue-btn { padding: 10px 8px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.5); font-size: 12px; font-weight: 600; font-family: 'DM Sans', sans-serif; cursor: pointer; text-transform: capitalize; }
          .gp-issue-btn[data-active="true"] { border-color: #3b82f6; background: rgba(59,130,246,0.1); color: #93c5fd; }
          .gp-textarea { width: 100%; padding: 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; font-size: 14px; font-family: 'DM Sans', sans-serif; color: white; outline: none; resize: none; }
          .gp-textarea:focus { border-color: rgba(59,130,246,0.4); }
          .gp-submit-btn { width: 100%; padding: 14px; background: linear-gradient(135deg, #c9a84c, #b8922e); color: white; font-size: 15px; font-weight: 700; font-family: 'DM Sans', sans-serif; border: none; border-radius: 12px; cursor: pointer; }
          .gp-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        `}</style>
      </div>
    )
  }

  // ── MESSAGES SCREEN ──
  if (screen === 'messages') {
    return (
      <div className="gp-root">
        <div className="gp-subheader">
          <button className="gp-back" onClick={() => setScreen('home')}><ArrowLeft size={18} /></button>
          <h2 className="gp-subheader-title">Front Desk</h2>
          <div className="gp-online-dot" />
        </div>

        <div className="gp-messages">
          <div className="gp-msg-welcome">
            <Bell size={20} color="#c9a84c" />
            <p>Hi {reservation!.guest?.full_name?.split(' ')[0]}! How can we help you today? We typically respond within 5 minutes.</p>
          </div>
          {messages.map((msg, i) => (
            <div key={i} className="gp-msg" data-dir={msg.direction}>
              <p className="gp-msg-content">{msg.content}</p>
              <p className="gp-msg-time">{new Date(msg.created_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          ))}
        </div>

        <div className="gp-msg-composer">
          <textarea
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            rows={2}
            className="gp-msg-input"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          />
          <button className="gp-msg-send" onClick={sendMessage} disabled={sendingMsg || !newMessage.trim()}>
            <Send size={18} />
          </button>
        </div>

        <style>{`
          * { box-sizing: border-box; }
          body { background: #080f1a; margin: 0; }
          .gp-root { height: 100vh; background: #080f1a; font-family: 'DM Sans', sans-serif; display: flex; flex-direction: column; max-width: 480px; margin: 0 auto; }
          .gp-subheader { display: flex; align-items: center; gap: 12px; padding: 48px 20px 20px; background: #0d1829; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }
          .gp-back { width: 36px; height: 36px; border-radius: 10px; background: rgba(255,255,255,0.08); border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; }
          .gp-subheader-title { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: white; margin: 0; flex: 1; }
          .gp-online-dot { width: 8px; height: 8px; background: #10b981; border-radius: 50%; }
          .gp-messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; }
          .gp-msg-welcome { display: flex; align-items: flex-start; gap: 10px; background: rgba(201,168,76,0.08); border: 1px solid rgba(201,168,76,0.15); border-radius: 12px; padding: 14px; font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.5; }
          .gp-msg-welcome p { margin: 0; }
          .gp-msg { max-width: 80%; }
          .gp-msg[data-dir="inbound"] { align-self: flex-end; }
          .gp-msg[data-dir="outbound"] { align-self: flex-start; }
          .gp-msg-content { padding: 10px 14px; border-radius: 14px; font-size: 13px; line-height: 1.5; margin: 0 0 4px; }
          .gp-msg[data-dir="inbound"] .gp-msg-content { background: #c9a84c; color: white; border-bottom-right-radius: 4px; }
          .gp-msg[data-dir="outbound"] .gp-msg-content { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.8); border-bottom-left-radius: 4px; }
          .gp-msg-time { font-size: 10px; color: rgba(255,255,255,0.3); margin: 0; }
          .gp-msg[data-dir="inbound"] .gp-msg-time { text-align: right; }
          .gp-msg-composer { display: flex; gap: 10px; padding: 14px 20px; border-top: 1px solid rgba(255,255,255,0.06); background: #0d1829; flex-shrink: 0; }
          .gp-msg-input { flex: 1; padding: 10px 14px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; font-size: 14px; font-family: 'DM Sans', sans-serif; color: white; outline: none; resize: none; }
          .gp-msg-send { width: 44px; height: 44px; border-radius: 12px; background: #c9a84c; border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
          .gp-msg-send:disabled { opacity: 0.5; cursor: not-allowed; }
        `}</style>
      </div>
    )
  }

  // ── FOLIO SCREEN ──
  if (screen === 'folio') {
    const grandTotal = roomTotal + folioTotal
    const vat = grandTotal * 0.075
    const totalWithVat = grandTotal + vat

    return (
      <div className="gp-root">
        <div className="gp-subheader">
          <button className="gp-back" onClick={() => setScreen('home')}><ArrowLeft size={18} /></button>
          <h2 className="gp-subheader-title">My Bill</h2>
        </div>

        <div className="gp-folio-body">
          <div className="gp-folio-card">
            <div className="gp-folio-header">
              <p className="gp-folio-hotel">{hotel?.name}</p>
              <p className="gp-folio-guest">{reservation!.guest?.full_name}</p>
              <p className="gp-folio-room">Room {reservation!.room?.number} · {reservation!.confirmation_number}</p>
            </div>

            <div className="gp-folio-row room-charge">
              <div>
                <p className="gp-folio-desc">{reservation!.room_type?.name} — {nights(reservation!.check_in_date, reservation!.check_out_date)} nights</p>
                <p className="gp-folio-sub">{formatCurrency(reservation!.rate_per_night)}/night</p>
              </div>
              <p className="gp-folio-amount">{formatCurrency(roomTotal)}</p>
            </div>

            {folioCharges.map((charge, i) => (
              <div key={i} className="gp-folio-row">
                <div>
                  <p className="gp-folio-desc">{charge.description}</p>
                  <p className="gp-folio-sub">{new Date(charge.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}</p>
                </div>
                <p className="gp-folio-amount">{formatCurrency(charge.amount * charge.quantity)}</p>
              </div>
            ))}

            <div className="gp-folio-totals">
              <div className="gp-folio-total-row"><span>Subtotal</span><span>{formatCurrency(grandTotal)}</span></div>
              <div className="gp-folio-total-row"><span>VAT (7.5%)</span><span>{formatCurrency(vat)}</span></div>
              <div className="gp-folio-total-row grand"><span>Total</span><span>{formatCurrency(totalWithVat)}</span></div>
            </div>

            <p className="gp-folio-note">This is your current bill summary. Final invoice will be provided at checkout.</p>
          </div>

          <div className="gp-folio-help">
            <MessageSquare size={16} color="rgba(255,255,255,0.4)" />
            <p>Questions about your bill? <button onClick={() => setScreen('messages')} style={{ background: 'none', border: 'none', color: '#c9a84c', cursor: 'pointer', font: 'inherit', fontWeight: 600 }}>Chat with us</button></p>
          </div>
        </div>

        <style>{`
          * { box-sizing: border-box; }
          body { background: #080f1a; margin: 0; }
          .gp-root { min-height: 100vh; background: #080f1a; font-family: 'DM Sans', sans-serif; padding-bottom: 40px; max-width: 480px; margin: 0 auto; }
          .gp-subheader { display: flex; align-items: center; gap: 12px; padding: 48px 20px 20px; background: #0d1829; border-bottom: 1px solid rgba(255,255,255,0.06); }
          .gp-back { width: 36px; height: 36px; border-radius: 10px; background: rgba(255,255,255,0.08); border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; }
          .gp-subheader-title { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: white; margin: 0; flex: 1; }
          .gp-folio-body { padding: 20px; }
          .gp-folio-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; overflow: hidden; margin-bottom: 16px; }
          .gp-folio-header { background: linear-gradient(135deg, #0d1829, #111f35); padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.06); }
          .gp-folio-hotel { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 700; color: white; margin: 0 0 4px; }
          .gp-folio-guest { font-size: 14px; color: rgba(255,255,255,0.7); margin: 0 0 4px; }
          .gp-folio-room { font-size: 12px; color: rgba(255,255,255,0.4); margin: 0; font-family: 'DM Mono', monospace; }
          .gp-folio-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); }
          .gp-folio-row.room-charge { background: rgba(201,168,76,0.05); }
          .gp-folio-desc { font-size: 13px; color: rgba(255,255,255,0.7); margin: 0 0 3px; }
          .gp-folio-sub { font-size: 11px; color: rgba(255,255,255,0.3); margin: 0; }
          .gp-folio-amount { font-size: 14px; font-weight: 700; color: white; margin: 0; flex-shrink: 0; }
          .gp-folio-totals { padding: 14px 20px; display: flex; flex-direction: column; gap: 8px; }
          .gp-folio-total-row { display: flex; justify-content: space-between; font-size: 13px; color: rgba(255,255,255,0.5); }
          .gp-folio-total-row.grand { font-size: 17px; font-weight: 800; color: white; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px; margin-top: 4px; }
          .gp-folio-note { font-size: 12px; color: rgba(255,255,255,0.3); margin: 0; padding: 0 20px 16px; line-height: 1.5; }
          .gp-folio-help { display: flex; align-items: center; gap: 8px; font-size: 13px; color: rgba(255,255,255,0.4); }
        `}</style>
      </div>
    )
  }

  // ── INFO SCREEN ──
  if (screen === 'info') {
    return (
      <div className="gp-root">
        <div className="gp-subheader">
          <button className="gp-back" onClick={() => setScreen('home')}><ArrowLeft size={18} /></button>
          <h2 className="gp-subheader-title">Hotel Information</h2>
        </div>

        <div className="gp-info-body">
          <div className="gp-info-card">
            <h3 className="gp-info-section">Hotel Details</h3>
            <div className="gp-info-row"><MapPin size={16} /><span>{hotel?.address}{hotel?.city ? `, ${hotel.city}` : ''}</span></div>
            {hotel?.phone && <div className="gp-info-row"><Phone size={16} /><a href={`tel:${hotel.phone}`} style={{ color: '#c9a84c', textDecoration: 'none' }}>{hotel.phone}</a></div>}
          </div>

          <div className="gp-info-card">
            <h3 className="gp-info-section">Essential Information</h3>
            {[
              { label: 'Check-in time', value: '2:00 PM' },
              { label: 'Check-out time', value: '12:00 Noon' },
              { label: 'Late checkout', value: 'Request via portal (subject to availability)' },
              { label: 'Room service hours', value: '6:00 AM — 11:00 PM' },
              { label: 'Front desk', value: '24 hours' },
            ].map(item => (
              <div key={item.label} className="gp-info-kv">
                <p className="gp-info-key">{item.label}</p>
                <p className="gp-info-val">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="gp-info-card">
            <h3 className="gp-info-section">Quick Actions</h3>
            <button className="gp-info-action" onClick={() => setScreen('room_service')}><Utensils size={16} /> Order Room Service <ChevronRight size={14} style={{ marginLeft: 'auto' }} /></button>
            <button className="gp-info-action" onClick={() => setScreen('maintenance')}><Wrench size={16} /> Report an Issue <ChevronRight size={14} style={{ marginLeft: 'auto' }} /></button>
            <button className="gp-info-action" onClick={() => setScreen('messages')}><MessageSquare size={16} /> Chat with Front Desk <ChevronRight size={14} style={{ marginLeft: 'auto' }} /></button>
            <button className="gp-info-action" onClick={requestLateCheckout} disabled={requestingLate}>
              <Clock size={16} /> {lateSuccess ? '✓ Late checkout requested' : 'Request Late Checkout'} <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
            </button>
          </div>
        </div>

        <style>{`
          * { box-sizing: border-box; }
          body { background: #080f1a; margin: 0; }
          .gp-root { min-height: 100vh; background: #080f1a; font-family: 'DM Sans', sans-serif; padding-bottom: 40px; max-width: 480px; margin: 0 auto; }
          .gp-subheader { display: flex; align-items: center; gap: 12px; padding: 48px 20px 20px; background: #0d1829; border-bottom: 1px solid rgba(255,255,255,0.06); }
          .gp-back { width: 36px; height: 36px; border-radius: 10px; background: rgba(255,255,255,0.08); border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; }
          .gp-subheader-title { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: white; margin: 0; flex: 1; }
          .gp-info-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
          .gp-info-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 18px; }
          .gp-info-section { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(201,168,76,0.7); margin: 0 0 14px; }
          .gp-info-row { display: flex; align-items: center; gap: 10px; font-size: 14px; color: rgba(255,255,255,0.7); margin-bottom: 10px; }
          .gp-info-kv { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
          .gp-info-kv:last-child { border-bottom: none; }
          .gp-info-key { font-size: 12px; color: rgba(255,255,255,0.4); margin: 0; }
          .gp-info-val { font-size: 13px; font-weight: 600; color: white; margin: 0; text-align: right; }
          .gp-info-action { display: flex; align-items: center; gap: 10px; width: 100%; padding: 13px 0; background: none; border: none; border-bottom: 1px solid rgba(255,255,255,0.05); color: rgba(255,255,255,0.7); font-size: 14px; font-family: 'DM Sans', sans-serif; cursor: pointer; text-align: left; }
          .gp-info-action:last-child { border-bottom: none; }
          .gp-info-action:hover { color: white; }
          .gp-info-action:disabled { opacity: 0.5; cursor: not-allowed; }
        `}</style>
      </div>
    )
  }

  return null
}
