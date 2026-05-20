'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Minus, Check, UtensilsCrossed, ShoppingCart, Send, Pencil, Trash2, Eye, EyeOff } from 'lucide-react'

type MenuItem = {
  id: string
  name: string
  category: string
  price: number
  description: string | null
  is_available: boolean
  available_room_service: boolean
  room_service_price: number | null
}

type OrderItem = {
  menu_item_id: string
  name: string
  price: number
  quantity: number
}

type Room = { id: string; number: string }

const CATEGORIES = ['all', 'breakfast', 'lunch', 'dinner', 'drinks', 'specials']

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n)
}

// Parse a price string that may contain commas e.g. "5,700" → 5700
function parsePrice(val: string): number {
  return Number(val.replace(/,/g, '').trim())
}

// Format a number for display in input field with commas e.g. 5700 → "5,700"
function displayPrice(val: string): string {
  const stripped = val.replace(/,/g, '').replace(/[^\d]/g, '')
  if (!stripped) return ''
  return Number(stripped).toLocaleString('en-NG')
}

export default function POSPage() {
  const supabase = createClient()
  const [hotelId, setHotelId] = useState<string | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('all')
  const [showUnavailable, setShowUnavailable] = useState(false)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [orderType, setOrderType] = useState<'dine_in' | 'room_service' | 'bar'>('dine_in')
  const [tableNumber, setTableNumber] = useState('')
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Item modal
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [itemName, setItemName] = useState('')
  const [itemCategory, setItemCategory] = useState('lunch')
  const [itemPriceStr, setItemPriceStr] = useState('')
  const [itemDesc, setItemDesc] = useState('')
  const [itemRoomService, setItemRoomService] = useState(true)
  const [itemRoomServicePriceStr, setItemRoomServicePriceStr] = useState('')
  const [savingItem, setSavingItem] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

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

  function openAddItem() {
    setEditingItem(null)
    setItemName(''); setItemCategory('lunch'); setItemPriceStr('')
    setItemDesc(''); setItemRoomService(true); setItemRoomServicePriceStr('')
    setShowItemModal(true)
  }

  function openEditItem(item: MenuItem) {
    setEditingItem(item)
    setItemName(item.name)
    setItemCategory(item.category)
    setItemPriceStr(item.price.toLocaleString('en-NG'))
    setItemDesc(item.description ?? '')
    setItemRoomService(item.available_room_service ?? true)
    setItemRoomServicePriceStr(item.room_service_price ? item.room_service_price.toLocaleString('en-NG') : '')
    setShowItemModal(true)
  }

  function closeItemModal() {
    setShowItemModal(false)
    setEditingItem(null)
  }

  function handlePriceInput(val: string, setter: (v: string) => void) {
    // Allow digits and commas only, auto-format
    const digits = val.replace(/[^\d]/g, '')
    if (!digits) { setter(''); return }
    setter(Number(digits).toLocaleString('en-NG'))
  }

  async function saveItem() {
    if (!hotelId || !itemName || !itemPriceStr) return
    const price = parsePrice(itemPriceStr)
    const rsPrice = itemRoomServicePriceStr ? parsePrice(itemRoomServicePriceStr) : null
    if (isNaN(price) || price <= 0) return

    setSavingItem(true)
    const payload = {
      hotel_id: hotelId,
      name: itemName,
      category: itemCategory,
      price,
      description: itemDesc || null,
      is_available: true,
      available_room_service: itemRoomService,
      room_service_price: rsPrice,
    }

    if (editingItem) {
      await supabase.from('menu_items').update({
        name: payload.name,
        category: payload.category,
        price: payload.price,
        description: payload.description,
        available_room_service: payload.available_room_service,
        room_service_price: payload.room_service_price,
      }).eq('id', editingItem.id)
    } else {
      await supabase.from('menu_items').insert(payload)
    }

    closeItemModal()
    await loadData()
    setSavingItem(false)
  }

  async function deleteItem(id: string) {
    await supabase.from('menu_items').delete().eq('id', id)
    setMenuItems(prev => prev.filter(m => m.id !== id))
    setDeleteConfirmId(null)
  }

  async function toggleAvailability(item: MenuItem) {
    const newVal = !item.is_available
    await supabase.from('menu_items').update({ is_available: newVal }).eq('id', item.id)
    setMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, is_available: newVal } : m))
  }

  function addToOrder(item: MenuItem) {
    if (!item.is_available) return
    const price = orderType === 'room_service' && item.room_service_price ? item.room_service_price : item.price
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
      status: 'open', subtotal, vat_amount: vatAmount, total,
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
    }

    setOrderItems([]); setTableNumber(''); setSelectedRoomId('')
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 3000)
    setSubmitting(false)
  }

  const filtered = menuItems.filter(m => {
    if (!m.is_available && !showUnavailable) return false
    return category === 'all' || m.category === category
  })

  const subtotal = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const vat = subtotal * 0.075
  const total = subtotal + vat
  const itemCount = orderItems.reduce((sum, i) => sum + i.quantity, 0)
  const unavailableCount = menuItems.filter(m => !m.is_available).length

  const priceIsValid = itemPriceStr && parsePrice(itemPriceStr) > 0

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading restaurant...</div>

  return (
    <div className="pos-root">
      <div className="pos-header">
        <div>
          <h2 className="pos-title">Restaurant & Bar</h2>
          <p className="pos-sub">{menuItems.filter(m => m.is_available).length} items available{unavailableCount > 0 ? ` · ${unavailableCount} unavailable` : ''}</p>
        </div>
        <button className="pos-add-btn" onClick={openAddItem}><Plus size={14} /> Add Menu Item</button>
      </div>

      <div className="pos-body">
        <div className="pos-menu">
          <div className="pos-order-type">
            {(['dine_in', 'room_service', 'bar'] as const).map(t => (
              <button key={t} className="pos-type-btn" data-active={orderType === t} onClick={() => setOrderType(t)}>
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="pos-cat-row">
            <div className="pos-categories">
              {CATEGORIES.map(cat => {
                const count = cat === 'all' ? menuItems.length : menuItems.filter(m => m.category === cat).length
                if (count === 0 && cat !== 'all') return null
                return (
                  <button key={cat} className="pos-cat-btn" data-active={category === cat} onClick={() => setCategory(cat)}>
                    {cat}{count > 0 && cat !== 'all' ? ` (${count})` : ''}
                  </button>
                )
              })}
            </div>
            {unavailableCount > 0 && (
              <button className="pos-unavail-toggle" data-active={showUnavailable} onClick={() => setShowUnavailable(!showUnavailable)}>
                {showUnavailable ? <Eye size={12} /> : <EyeOff size={12} />}
                {showUnavailable ? 'Hide unavailable' : `Show unavailable (${unavailableCount})`}
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="pos-empty">
              <UtensilsCrossed size={40} style={{ color: 'var(--slate-300)' }} />
              <p>No items in this category</p>
              <button className="pos-add-btn" onClick={openAddItem}><Plus size={14} /> Add Menu Item</button>
            </div>
          ) : (
            <div className="pos-grid">
              {filtered.map(item => {
                const inOrder = orderItems.find(o => o.menu_item_id === item.id)
                const isUnavail = !item.is_available
                return (
                  <div key={item.id} className="pos-item-wrap" style={{ opacity: isUnavail ? 0.5 : 1 }}>
                    <button className="pos-item" data-in-order={!!inOrder} data-unavail={isUnavail} onClick={() => !isUnavail && addToOrder(item)} disabled={isUnavail}>
                      <div className="pos-item-top">
                        <span className="pos-item-cat">{item.category}</span>
                        {inOrder && <span className="pos-item-qty">{inOrder.quantity}</span>}
                        {isUnavail && <span className="pos-item-unavail-badge">Unavailable</span>}
                      </div>
                      <p className="pos-item-name">{item.name}</p>
                      {item.description && <p className="pos-item-desc">{item.description}</p>}
                      <div className="pos-item-prices">
                        <p className="pos-item-price">{formatCurrency(item.price)}</p>
                        {item.available_room_service && item.room_service_price && (
                          <p className="pos-item-rs-price">RS: {formatCurrency(item.room_service_price)}</p>
                        )}
                        {item.available_room_service && !item.room_service_price && (
                          <p className="pos-item-rs-badge">✓ Room service</p>
                        )}
                      </div>
                    </button>
                    <div className="pos-item-actions">
                      <button className="pos-item-action-btn edit" onClick={() => openEditItem(item)}>
                        <Pencil size={11} /> Edit
                      </button>
                      <button
                        className="pos-item-action-btn avail"
                        data-available={item.is_available}
                        onClick={() => toggleAvailability(item)}
                      >
                        {item.is_available ? '✓ Available — click to 86' : '✗ Unavailable — click to restore'}
                      </button>
                      <button className="pos-item-action-btn del" onClick={() => setDeleteConfirmId(item.id)}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
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
              <input className="pos-table-input" value={tableNumber} onChange={e => setTableNumber(e.target.value)} placeholder="Table number (optional)..." />
            )}
            {orderType === 'room_service' && (
              <select className="pos-table-input" value={selectedRoomId} onChange={e => setSelectedRoomId(e.target.value)}>
                <option value="">Select room...</option>
                {rooms.map(r => <option key={r.id} value={r.id}>Room {r.number}</option>)}
              </select>
            )}
          </div>

          {submitted ? (
            <div className="pos-submitted"><Check size={32} style={{ color: '#10b981' }} /><p>Order sent to kitchen!</p></div>
          ) : orderItems.length === 0 ? (
            <div className="pos-order-empty"><p>Tap any menu item to add it to the order</p></div>
          ) : (
            <>
              <div className="pos-order-items">
                {orderItems.map(item => (
                  <div key={item.menu_item_id} className="pos-order-row">
                    <div className="pos-order-item-info">
                      <p className="pos-order-item-name">{item.name}</p>
                      <p className="pos-order-item-price">{formatCurrency(item.price)} each</p>
                    </div>
                    <div className="pos-qty-controls">
                      <button className="pos-qty-btn" onClick={() => changeQty(item.menu_item_id, -1)}><Minus size={12} /></button>
                      <span className="pos-qty">{item.quantity}</span>
                      <button className="pos-qty-btn" onClick={() => changeQty(item.menu_item_id, 1)}><Plus size={12} /></button>
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

      {/* Add / Edit Modal */}
      {showItemModal && (
        <div className="modal-overlay" onClick={closeItemModal}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingItem ? `Edit: ${editingItem.name}` : 'Add Menu Item'}</h3>
              <button className="modal-close" onClick={closeItemModal}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="modal-field">
                <label>Item Name *</label>
                <input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="e.g. Jollof Rice with Assorted Meat" autoFocus />
              </div>
              <div className="modal-row2">
                <div className="modal-field">
                  <label>Category</label>
                  <select value={itemCategory} onChange={e => setItemCategory(e.target.value)}>
                    {CATEGORIES.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="modal-field">
                  <label>Dine-in / Bar Price (₦)</label>
                  <div className="price-input-wrap">
                    <span className="price-prefix">₦</span>
                    <input
                      className="price-input"
                      value={itemPriceStr}
                      onChange={e => handlePriceInput(e.target.value, setItemPriceStr)}
                      placeholder="5,500"
                    />
                  </div>
                  {itemPriceStr && !priceIsValid && (
                    <p className="field-error">Enter a valid price</p>
                  )}
                </div>
              </div>
              <div className="modal-field">
                <label>Description</label>
                <input value={itemDesc} onChange={e => setItemDesc(e.target.value)} placeholder="Brief description shown on menu" />
              </div>
              <div className="modal-field">
                <label className="checkbox-label">
                  <input type="checkbox" checked={itemRoomService} onChange={e => setItemRoomService(e.target.checked)} />
                  Available for room service
                </label>
              </div>
              {itemRoomService && (
                <div className="modal-field">
                  <label>Room Service Price (₦) — leave blank if same as dine-in</label>
                  <div className="price-input-wrap">
                    <span className="price-prefix">₦</span>
                    <input
                      className="price-input"
                      value={itemRoomServicePriceStr}
                      onChange={e => handlePriceInput(e.target.value, setItemRoomServicePriceStr)}
                      placeholder={itemPriceStr ? `Same as dine-in (₦${itemPriceStr})` : 'Same as dine-in'}
                    />
                  </div>
                </div>
              )}
              {itemPriceStr && priceIsValid && (
                <div className="price-preview">
                  <span>Dine-in: <strong>{formatCurrency(parsePrice(itemPriceStr))}</strong></span>
                  {itemRoomService && (
                    <span>Room service: <strong>{itemRoomServicePriceStr ? formatCurrency(parsePrice(itemRoomServicePriceStr)) : formatCurrency(parsePrice(itemPriceStr))} {!itemRoomServicePriceStr ? '(same)' : ''}</strong></span>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="modal-cancel" onClick={closeItemModal}>Cancel</button>
              <button className="modal-save" onClick={saveItem} disabled={savingItem || !itemName || !priceIsValid}>
                {savingItem ? 'Saving...' : editingItem ? 'Save Changes' : 'Add to Menu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirmId && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmId(null)}>
          <div className="modal-card small" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Menu Item</h3>
              <button className="modal-close" onClick={() => setDeleteConfirmId(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, color: 'var(--slate-600)', margin: 0 }}>
                Permanently remove <strong>{menuItems.find(m => m.id === deleteConfirmId)?.name}</strong> from your menu?
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 0' }}>
                Tip: Use the availability toggle to temporarily hide an item instead of deleting it.
              </p>
            </div>
            <div className="modal-footer">
              <button className="modal-cancel" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
              <button className="modal-delete" onClick={() => deleteItem(deleteConfirmId)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .pos-root { max-width: 1200px; margin: 0 auto; }
        .pos-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; gap: 16px; flex-wrap: wrap; }
        .pos-title { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .pos-sub { font-size: 13px; color: var(--text-muted); margin: 4px 0 0; }
        .pos-add-btn { display: flex; align-items: center; gap: 6px; padding: 9px 16px; background: var(--navy-800); color: white; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: none; border-radius: 8px; cursor: pointer; }
        .pos-body { display: flex; gap: 20px; align-items: flex-start; }
        .pos-menu { flex: 1; min-width: 0; }
        .pos-order-type { display: flex; gap: 6px; margin-bottom: 14px; background: var(--slate-100); border-radius: 10px; padding: 4px; }
        .pos-type-btn { flex: 1; padding: 8px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: none; cursor: pointer; color: var(--slate-500); background: transparent; text-transform: capitalize; }
        .pos-type-btn[data-active="true"] { background: white; color: var(--slate-800); box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
        .pos-cat-row { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
        .pos-categories { display: flex; flex-wrap: wrap; gap: 6px; flex: 1; }
        .pos-cat-btn { padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1px solid var(--slate-200); background: white; color: var(--slate-500); cursor: pointer; text-transform: capitalize; }
        .pos-cat-btn[data-active="true"] { background: var(--navy-800); border-color: var(--navy-800); color: white; }
        .pos-unavail-toggle { display: flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1px solid var(--slate-200); background: white; color: var(--slate-500); cursor: pointer; white-space: nowrap; }
        .pos-unavail-toggle[data-active="true"] { background: var(--slate-200); }
        .pos-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px; color: var(--text-muted); }
        .pos-empty p { font-size: 14px; font-weight: 600; margin: 0; }
        .pos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
        .pos-item-wrap { display: flex; flex-direction: column; border: 1.5px solid var(--slate-200); border-radius: 12px; overflow: hidden; transition: all 0.12s; }
        .pos-item-wrap:hover { border-color: var(--navy-400); box-shadow: 0 4px 12px rgba(0,0,0,0.07); }
        .pos-item { background: white; padding: 14px; text-align: left; cursor: pointer; font-family: 'DM Sans', sans-serif; display: flex; flex-direction: column; gap: 4px; border: none; width: 100%; }
        .pos-item[data-in-order="true"] { background: var(--gold-100); }
        .pos-item[data-unavail="true"] { cursor: default; }
        .pos-item-top { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
        .pos-item-cat { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
        .pos-item-qty { width: 20px; height: 20px; background: var(--gold-500); color: white; border-radius: 50%; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .pos-item-unavail-badge { font-size: 9px; font-weight: 700; background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 20px; }
        .pos-item-name { font-size: 14px; font-weight: 700; color: var(--slate-800); margin: 4px 0 0; }
        .pos-item-desc { font-size: 11px; color: var(--text-muted); margin: 0; line-height: 1.4; }
        .pos-item-prices { display: flex; flex-direction: column; gap: 2px; margin-top: 4px; }
        .pos-item-price { font-size: 13px; font-weight: 700; color: var(--navy-800); margin: 0; }
        .pos-item-rs-price { font-size: 11px; color: #065f46; font-weight: 600; margin: 0; }
        .pos-item-rs-badge { font-size: 10px; color: #065f46; font-weight: 600; margin: 0; }
        .pos-item-actions { display: flex; border-top: 1px solid var(--slate-100); background: var(--slate-50); }
        .pos-item-action-btn { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px 4px; font-size: 10px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: none; cursor: pointer; transition: background 0.1s; flex-shrink: 0; }
        .pos-item-action-btn.edit { background: none; color: var(--slate-500); width: 48px; border-right: 1px solid var(--slate-200); }
        .pos-item-action-btn.edit:hover { background: var(--slate-200); color: var(--slate-700); }
        .pos-item-action-btn.del { background: none; color: var(--slate-400); width: 32px; border-left: 1px solid var(--slate-200); }
        .pos-item-action-btn.del:hover { background: #fee2e2; color: #991b1b; }
        .pos-item-action-btn.avail { flex: 1; background: none; font-size: 10px; text-align: center; }
        .pos-item-action-btn.avail[data-available="true"] { color: #065f46; }
        .pos-item-action-btn.avail[data-available="true"]:hover { background: #fef3c7; color: #92400e; }
        .pos-item-action-btn.avail[data-available="false"] { color: #991b1b; }
        .pos-item-action-btn.avail[data-available="false"]:hover { background: #d1fae5; color: #065f46; }
        .pos-order { width: 300px; flex-shrink: 0; background: white; border: 1px solid var(--slate-200); border-radius: 14px; overflow: hidden; position: sticky; top: 80px; display: flex; flex-direction: column; }
        @media (max-width: 900px) { .pos-body { flex-direction: column; } .pos-order { width: 100%; position: static; } }
        .pos-order-header { padding: 16px; border-bottom: 1px solid var(--slate-200); display: flex; flex-direction: column; gap: 10px; }
        .pos-order-title-row { display: flex; align-items: center; gap: 8px; }
        .pos-order-title { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .pos-order-count { background: var(--gold-500); color: white; font-size: 11px; font-weight: 700; border-radius: 20px; padding: 1px 8px; }
        .pos-table-input { width: 100%; padding: 8px 12px; border: 1px solid var(--slate-200); border-radius: 8px; font-size: 13px; font-family: 'DM Sans', sans-serif; color: var(--slate-800); outline: none; box-sizing: border-box; }
        .pos-submitted { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 40px; color: #065f46; font-size: 14px; font-weight: 600; }
        .pos-order-empty { padding: 40px 20px; text-align: center; color: var(--text-muted); font-size: 13px; line-height: 1.6; }
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
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .modal-card { background: white; border-radius: 16px; width: 100%; max-width: 480px; box-shadow: 0 24px 48px rgba(0,0,0,0.2); overflow: hidden; }
        .modal-card.small { max-width: 380px; }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--slate-200); }
        .modal-header h3 { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .modal-close { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--slate-200); background: white; color: var(--slate-400); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; }
        .modal-field { display: flex; flex-direction: column; gap: 6px; }
        .modal-field label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--slate-500); }
        .modal-field input, .modal-field select { padding: 10px 12px; border: 1px solid var(--slate-200); border-radius: 8px; font-size: 14px; font-family: 'DM Sans', sans-serif; color: var(--slate-800); outline: none; }
        .modal-field input:focus, .modal-field select:focus { border-color: var(--gold-500); box-shadow: 0 0 0 3px rgba(201,168,76,0.1); }
        .modal-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .price-input-wrap { display: flex; align-items: center; border: 1px solid var(--slate-200); border-radius: 8px; overflow: hidden; }
        .price-input-wrap:focus-within { border-color: var(--gold-500); box-shadow: 0 0 0 3px rgba(201,168,76,0.1); }
        .price-prefix { padding: 10px 10px 10px 12px; font-size: 14px; font-weight: 700; color: var(--slate-500); background: var(--slate-100); border-right: 1px solid var(--slate-200); }
        .price-input { flex: 1; padding: 10px 12px; border: none; outline: none; font-size: 14px; font-family: 'DM Sans', sans-serif; color: var(--slate-800); background: white; }
        .field-error { font-size: 11px; color: #ef4444; margin: 0; }
        .price-preview { display: flex; gap: 16px; background: var(--slate-100); border-radius: 8px; padding: 10px 14px; font-size: 12px; color: var(--slate-600); flex-wrap: wrap; }
        .price-preview strong { color: var(--navy-800); }
        .modal-footer { display: flex; gap: 10px; justify-content: flex-end; padding: 16px 24px; border-top: 1px solid var(--slate-200); }
        .modal-cancel { padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1px solid var(--slate-200); background: white; color: var(--slate-600); cursor: pointer; }
        .modal-save { padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; background: var(--navy-800); color: white; border: none; cursor: pointer; }
        .modal-save:disabled { opacity: 0.5; cursor: not-allowed; }
        .modal-delete { padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; background: #ef4444; color: white; border: none; cursor: pointer; }
        .checkbox-label { display: flex !important; flex-direction: row !important; align-items: center !important; gap: 8px !important; font-size: 13px !important; font-weight: 500 !important; color: var(--slate-700) !important; cursor: pointer !important; text-transform: none !important; letter-spacing: 0 !important; }
        .checkbox-label input { width: 16px; height: 16px; accent-color: var(--navy-800); }
      `}</style>
    </div>
  )
}
