'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Minus, Check, UtensilsCrossed, ShoppingCart, Send } from 'lucide-react'

type MenuItem = {
  id: string
  name: string
  category: string
  price: number
  is_available: boolean
  description: string | null
}

type OrderItem = {
  menu_item_id: string
  name: string
  price: number
  quantity: number
  notes: string
}

type Room = { id: string; number: string }

const CATEGORIES = ['all', 'breakfast', 'lunch', 'dinner', 'drinks', 'specials', 'room service']

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n)
}

export default function POSPage() {
  const supabase = createClient()
  const [hotelId, setHotelId] = useState<string | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('all')
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [orderType, setOrderType] = useState<'dine_in' | 'room_service' | 'bar'>('dine_in')
  const [tableNumber, setTableNumber] = useState('')
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)

  // Add menu item form
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('lunch')
  const [newPrice, setNewPrice] = useState<number | ''>('')
  const [newDesc, setNewDesc] = useState('')
  const [savingItem, setSavingItem] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('hotel_id').eq('id', user.id).single()
    if (!profile) return
    setHotelId(profile.hotel_id)

    const [{ data: items }, { data: r }] = await Promise.all([
      supabase.from('menu_items').select('*').eq('hotel_id', profile.hotel_id).order('category').order('name'),
      supabase.from('rooms').select('id, number').eq('hotel_id', profile.hotel_id).eq('status', 'occupied').order('number')
    ])

    setMenuItems(items ?? [])
    setRooms(r ?? [])
    setLoading(false)
  }

  async function addMenuItem() {
    if (!hotelId || !newName || newPrice === '') return
    setSavingItem(true)
    await supabase.from('menu_items').insert({
      hotel_id: hotelId,
      name: newName,
      category: newCategory,
      price: Number(newPrice),
      description: newDesc || null,
      is_available: true,
    })
    setNewName(''); setNewCategory('lunch'); setNewPrice(''); setNewDesc('')
    setShowAddItem(false)
    await loadData()
    setSavingItem(false)
  }

  function addToOrder(item: MenuItem) {
    setOrderItems(prev => {
      const existing = prev.find(o => o.menu_item_id === item.id)
      if (existing) {
        return prev.map(o => o.menu_item_id === item.id ? { ...o, quantity: o.quantity + 1 } : o)
      }
      return [...prev, { menu_item_id: item.id, name: item.name, price: item.price, quantity: 1, notes: '' }]
    })
  }

  function removeFromOrder(id: string) {
    setOrderItems(prev => {
      const existing = prev.find(o => o.menu_item_id === id)
      if (existing && existing.quantity > 1) {
        return prev.map(o => o.menu_item_id === id ? { ...o, quantity: o.quantity - 1 } : o)
      }
      return prev.filter(o => o.menu_item_id !== id)
    })
  }

  async function submitOrder() {
    if (!hotelId || orderItems.length === 0) return
    setSubmitting(true)

    const subtotal = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
    const vatAmount = subtotal * 0.075
    const total = subtotal + vatAmount

    const { data: order } = await supabase.from('pos_orders').insert({
      hotel_id: hotelId,
      order_type: orderType,
      table_number: orderType === 'dine_in' ? tableNumber : null,
      room_id: orderType === 'room_service' ? selectedRoomId || null : null,
      status: 'open',
      subtotal, vat_amount: vatAmount, total,
    }).select().single()

    if (order) {
      await supabase.from('pos_order_items').insert(
        orderItems.map(item => ({
          hotel_id: hotelId,
          order_id: order.id,
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
          unit_price: item.price,
          notes: item.notes || null,
        }))
      )
    }

    setOrderItems([])
    setTableNumber('')
    setSelectedRoomId('')
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 3000)
    setSubmitting(false)
  }

  const filtered = menuItems.filter(m => {
    if (!m.is_available) return false
    return category === 'all' || m.category === category
  })

  const categoryCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = cat === 'all' ? menuItems.filter(m => m.is_available).length : menuItems.filter(m => m.category === cat && m.is_available).length
    return acc
  }, {} as Record<string, number>)

  const subtotal = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const vat = subtotal * 0.075
  const total = subtotal + vat
  const itemCount = orderItems.reduce((sum, i) => sum + i.quantity, 0)

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading restaurant...</div>

  return (
    <div className="pos-root">
      <div className="pos-header">
        <div>
          <h2 className="pos-title">Restaurant & Bar</h2>
          <p className="pos-sub">{menuItems.filter(m => m.is_available).length} items on menu</p>
        </div>
        <button className="pos-add-item-btn" onClick={() => setShowAddItem(true)}>
          <Plus size={14} /> Add Menu Item
        </button>
      </div>

      <div className="pos-body">
        {/* Menu */}
        <div className="pos-menu">
          {/* Order type */}
          <div className="pos-order-type">
            {(['dine_in', 'room_service', 'bar'] as const).map(t => (
              <button key={t} className="pos-type-btn" data-active={orderType === t} onClick={() => setOrderType(t)}>
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <div className="pos-categories">
            {CATEGORIES.filter(c => c === 'all' || categoryCounts[c] > 0).map(cat => (
              <button key={cat} className="pos-cat-btn" data-active={category === cat} onClick={() => setCategory(cat)}>
                {cat} {categoryCounts[cat] > 0 && cat !== 'all' && `(${categoryCounts[cat]})`}
              </button>
            ))}
          </div>

          {/* Menu items grid */}
          {filtered.length === 0 ? (
            <div className="pos-empty">
              <UtensilsCrossed size={40} style={{ color: 'var(--slate-300)' }} />
              <p>No items in this category</p>
              <button className="pos-add-item-btn" onClick={() => setShowAddItem(true)}><Plus size={14} /> Add Menu Item</button>
            </div>
          ) : (
            <div className="pos-grid">
              {filtered.map(item => {
                const inOrder = orderItems.find(o => o.menu_item_id === item.id)
                return (
                  <button key={item.id} className="pos-item" data-in-order={!!inOrder} onClick={() => addToOrder(item)}>
                    <div className="pos-item-top">
                      <span className="pos-item-cat">{item.category}</span>
                      {inOrder && <span className="pos-item-qty">{inOrder.quantity}</span>}
                    </div>
                    <p className="pos-item-name">{item.name}</p>
                    {item.description && <p className="pos-item-desc">{item.description}</p>}
                    <p className="pos-item-price">{formatCurrency(item.price)}</p>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Order panel */}
        <div className="pos-order">
          <div className="pos-order-header">
            <div className="pos-order-title-row">
              <ShoppingCart size={16} style={{ color: 'var(--gold-500)' }} />
              <h3 className="pos-order-title">Current Order</h3>
              {itemCount > 0 && <span className="pos-order-count">{itemCount}</span>}
            </div>
            {orderType === 'dine_in' && (
              <input className="pos-table-input" value={tableNumber} onChange={e => setTableNumber(e.target.value)} placeholder="Table number..." />
            )}
            {orderType === 'room_service' && (
              <select className="pos-table-input" value={selectedRoomId} onChange={e => setSelectedRoomId(e.target.value)}>
                <option value="">Select occupied room...</option>
                {rooms.map(r => <option key={r.id} value={r.id}>Room {r.number}</option>)}
              </select>
            )}
          </div>

          {submitted ? (
            <div className="pos-submitted">
              <Check size={32} style={{ color: '#10b981' }} />
              <p>Order sent to kitchen!</p>
            </div>
          ) : orderItems.length === 0 ? (
            <div className="pos-order-empty">
              <p>Tap menu items to add to order</p>
            </div>
          ) : (
            <>
              <div className="pos-order-items">
                {orderItems.map(item => (
                  <div key={item.menu_item_id} className="pos-order-row">
                    <div className="pos-order-item-info">
                      <p className="pos-order-item-name">{item.name}</p>
                      <p className="pos-order-item-price">{formatCurrency(item.price)}</p>
                    </div>
                    <div className="pos-qty-controls">
                      <button className="pos-qty-btn" onClick={() => removeFromOrder(item.menu_item_id)}><Minus size={12} /></button>
                      <span className="pos-qty">{item.quantity}</span>
                      <button className="pos-qty-btn" onClick={() => addToOrder({ id: item.menu_item_id, name: item.name, price: item.price, is_available: true, category: '', description: null })}><Plus size={12} /></button>
                    </div>
                    <p className="pos-order-item-total">{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                ))}
              </div>

              <div className="pos-order-summary">
                <div className="pos-summary-row"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                <div className="pos-summary-row"><span>VAT (7.5%)</span><span>{formatCurrency(vat)}</span></div>
                <div className="pos-summary-row total"><span>Total</span><span>{formatCurrency(total)}</span></div>
              </div>

              <div className="pos-order-actions">
                <button className="pos-clear-btn" onClick={() => setOrderItems([])}><X size={14} /> Clear</button>
                <button className="pos-submit-btn" onClick={submitOrder} disabled={submitting}>
                  <Send size={14} /> {submitting ? 'Sending...' : 'Send to Kitchen'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add Menu Item Modal */}
      {showAddItem && (
        <div className="modal-overlay" onClick={() => setShowAddItem(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Menu Item</h3>
              <button className="modal-close" onClick={() => setShowAddItem(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="modal-field"><label>Item Name *</label><input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Jollof Rice" /></div>
              <div className="modal-row2">
                <div className="modal-field">
                  <label>Category</label>
                  <select value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                    {CATEGORIES.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="modal-field"><label>Price (NGN) *</label><input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value === '' ? '' : Number(e.target.value))} placeholder="2500" /></div>
              </div>
              <div className="modal-field"><label>Description</label><input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Brief description (optional)" /></div>
            </div>
            <div className="modal-footer">
              <button className="modal-cancel" onClick={() => setShowAddItem(false)}>Cancel</button>
              <button className="modal-save" onClick={addMenuItem} disabled={savingItem || !newName || newPrice === ''}>{savingItem ? 'Saving...' : 'Add to Menu'}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .pos-root { max-width: 1200px; margin: 0 auto; }
        .pos-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; gap: 16px; flex-wrap: wrap; }
        .pos-title { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .pos-sub { font-size: 13px; color: var(--text-muted); margin: 4px 0 0; }
        .pos-add-item-btn { display: flex; align-items: center; gap: 6px; padding: 9px 16px; background: var(--navy-800); color: white; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: none; border-radius: 8px; cursor: pointer; }
        .pos-body { display: flex; gap: 20px; align-items: flex-start; }
        .pos-menu { flex: 1; min-width: 0; }
        .pos-order-type { display: flex; gap: 6px; margin-bottom: 14px; background: var(--slate-100); border-radius: 10px; padding: 4px; }
        .pos-type-btn { flex: 1; padding: 8px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: none; cursor: pointer; color: var(--slate-500); background: transparent; text-transform: capitalize; }
        .pos-type-btn[data-active="true"] { background: white; color: var(--slate-800); box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
        .pos-categories { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
        .pos-cat-btn { padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1px solid var(--slate-200); background: white; color: var(--slate-500); cursor: pointer; text-transform: capitalize; }
        .pos-cat-btn[data-active="true"] { background: var(--navy-800); border-color: var(--navy-800); color: white; }
        .pos-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px; color: var(--text-muted); }
        .pos-empty p { font-size: 14px; font-weight: 600; margin: 0; }
        .pos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
        .pos-item { background: white; border: 1.5px solid var(--slate-200); border-radius: 12px; padding: 14px; text-align: left; cursor: pointer; transition: all 0.12s; font-family: 'DM Sans', sans-serif; display: flex; flex-direction: column; gap: 4px; }
        .pos-item:hover { border-color: var(--navy-600); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .pos-item[data-in-order="true"] { border-color: var(--gold-400); background: var(--gold-100); }
        .pos-item-top { display: flex; align-items: center; justify-content: space-between; }
        .pos-item-cat { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
        .pos-item-qty { width: 20px; height: 20px; background: var(--gold-500); color: white; border-radius: 50%; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
        .pos-item-name { font-size: 14px; font-weight: 700; color: var(--slate-800); margin: 4px 0 0; }
        .pos-item-desc { font-size: 11px; color: var(--text-muted); margin: 0; line-height: 1.4; }
        .pos-item-price { font-size: 13px; font-weight: 700; color: var(--navy-800); margin: 4px 0 0; }

        /* Order panel */
        .pos-order { width: 300px; flex-shrink: 0; background: white; border: 1px solid var(--slate-200); border-radius: 14px; overflow: hidden; position: sticky; top: 80px; display: flex; flex-direction: column; }
        @media (max-width: 900px) { .pos-body { flex-direction: column; } .pos-order { width: 100%; position: static; } }
        .pos-order-header { padding: 16px; border-bottom: 1px solid var(--slate-200); display: flex; flex-direction: column; gap: 10px; }
        .pos-order-title-row { display: flex; align-items: center; gap: 8px; }
        .pos-order-title { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .pos-order-count { background: var(--gold-500); color: white; font-size: 11px; font-weight: 700; border-radius: 20px; padding: 1px 8px; }
        .pos-table-input { width: 100%; padding: 8px 12px; border: 1px solid var(--slate-200); border-radius: 8px; font-size: 13px; font-family: 'DM Sans', sans-serif; color: var(--slate-800); outline: none; }
        .pos-table-input:focus { border-color: var(--gold-500); }
        .pos-submitted { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 40px; color: var(--slate-700); font-size: 14px; font-weight: 600; }
        .pos-order-empty { padding: 40px; text-align: center; color: var(--text-muted); font-size: 13px; }
        .pos-order-items { flex: 1; overflow-y: auto; max-height: 350px; }
        .pos-order-row { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-bottom: 1px solid var(--slate-100); }
        .pos-order-item-info { flex: 1; min-width: 0; }
        .pos-order-item-name { font-size: 13px; font-weight: 600; color: var(--slate-800); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pos-order-item-price { font-size: 11px; color: var(--text-muted); margin: 1px 0 0; }
        .pos-qty-controls { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .pos-qty-btn { width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--slate-200); background: white; color: var(--slate-600); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .pos-qty { font-size: 13px; font-weight: 700; color: var(--slate-800); min-width: 16px; text-align: center; }
        .pos-order-item-total { font-size: 13px; font-weight: 700; color: var(--slate-800); flex-shrink: 0; }
        .pos-order-summary { padding: 12px 16px; border-top: 1px solid var(--slate-200); display: flex; flex-direction: column; gap: 6px; }
        .pos-summary-row { display: flex; justify-content: space-between; font-size: 13px; color: var(--slate-600); }
        .pos-summary-row.total { font-size: 15px; font-weight: 800; color: var(--slate-800); border-top: 1px solid var(--slate-200); padding-top: 8px; margin-top: 2px; }
        .pos-order-actions { padding: 12px 16px; display: flex; gap: 8px; border-top: 1px solid var(--slate-200); }
        .pos-clear-btn { display: flex; align-items: center; gap: 6px; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1px solid var(--slate-200); background: white; color: var(--slate-500); cursor: pointer; }
        .pos-submit-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; border-radius: 8px; font-size: 13px; font-weight: 700; font-family: 'DM Sans', sans-serif; background: var(--navy-800); color: white; border: none; cursor: pointer; }
        .pos-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        /* Modal */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .modal-card { background: white; border-radius: 16px; width: 100%; max-width: 480px; box-shadow: 0 24px 48px rgba(0,0,0,0.2); overflow: hidden; }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--slate-200); }
        .modal-header h3 { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .modal-close { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--slate-200); background: white; color: var(--slate-400); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; }
        .modal-field { display: flex; flex-direction: column; gap: 6px; }
        .modal-field label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--slate-500); }
        .modal-field input, .modal-field select { padding: 10px 12px; border: 1px solid var(--slate-200); border-radius: 8px; font-size: 14px; font-family: 'DM Sans', sans-serif; color: var(--slate-800); outline: none; }
        .modal-field input:focus { border-color: var(--gold-500); }
        .modal-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .modal-footer { display: flex; gap: 10px; justify-content: flex-end; padding: 16px 24px; border-top: 1px solid var(--slate-200); }
        .modal-cancel { padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1px solid var(--slate-200); background: white; color: var(--slate-600); cursor: pointer; }
        .modal-save { padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; background: var(--navy-800); color: white; border: none; cursor: pointer; }
        .modal-save:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  )
}
