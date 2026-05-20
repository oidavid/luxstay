'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, X, Check, BedDouble, ChevronDown, ChevronUp } from 'lucide-react'

type RoomType = {
  id: string
  name: string
  description: string
  max_occupancy: number
  base_rate: number
  amenities: string[]
  is_active: boolean
  rooms?: Room[]
}

type Room = {
  id: string
  number: string
  floor: number
  status: string
  notes: string | null
  room_type_id: string
}

const AMENITY_OPTIONS = [
  'WiFi','AC','TV','Hot Water','Mini Bar','City View',
  'Ocean View','Balcony','Kitchen','Washing Machine',
  'Safe','Hair Dryer','Iron','Bathtub','Shower',
  'Butler Service','Lounge Area','Extra Beds','Breakfast Included'
]

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n)
}

export default function RoomSetupPage() {
  const supabase = createClient()
  const [hotelId, setHotelId] = useState<string|null>(null)
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedType, setExpandedType] = useState<string|null>(null)

  // Room type modal
  const [showTypeModal, setShowTypeModal] = useState(false)
  const [editingType, setEditingType] = useState<RoomType|null>(null)
  const [typeName, setTypeName] = useState('')
  const [typeDesc, setTypeDesc] = useState('')
  const [typeOccupancy, setTypeOccupancy] = useState(2)
  const [typeRate, setTypeRate] = useState(0)
  const [typeAmenities, setTypeAmenities] = useState<string[]>([])
  const [savingType, setSavingType] = useState(false)

  // Room modal
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room|null>(null)
  const [selectedTypeId, setSelectedTypeId] = useState('')
  const [roomNumber, setRoomNumber] = useState('')
  const [roomFloor, setRoomFloor] = useState(1)
  const [roomNotes, setRoomNotes] = useState('')
  const [savingRoom, setSavingRoom] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState<{type:'room'|'roomtype', id:string}|null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('hotel_id').eq('id', user.id).single()
      if (!profile) return
      setHotelId(profile.hotel_id)
      await fetchData(profile.hotel_id)
    }
    load()
  }, [])

  async function fetchData(hid: string) {
    setLoading(true)
    const { data: types } = await supabase
      .from('room_types')
      .select('*, rooms(*)')
      .eq('hotel_id', hid)
      .order('name')
    setRoomTypes((types as RoomType[]) ?? [])
    setLoading(false)
  }

  // ── Room Type handlers ──
  function openAddType() {
    setEditingType(null)
    setTypeName(''); setTypeDesc(''); setTypeOccupancy(2); setTypeRate(0); setTypeAmenities([])
    setShowTypeModal(true)
  }

  function openEditType(rt: RoomType) {
    setEditingType(rt)
    setTypeName(rt.name); setTypeDesc(rt.description ?? ''); setTypeOccupancy(rt.max_occupancy); setTypeRate(rt.base_rate); setTypeAmenities(rt.amenities ?? [])
    setShowTypeModal(true)
  }

  async function saveRoomType() {
    if (!hotelId || !typeName) return
    setSavingType(true)
    const payload = { hotel_id: hotelId, name: typeName, description: typeDesc, max_occupancy: typeOccupancy, base_rate: typeRate, amenities: typeAmenities, is_active: true }
    if (editingType) {
      await supabase.from('room_types').update(payload).eq('id', editingType.id)
    } else {
      await supabase.from('room_types').insert(payload)
    }
    setShowTypeModal(false)
    await fetchData(hotelId)
    setSavingType(false)
  }

  async function deleteRoomType(id: string) {
    if (!hotelId) return
    await supabase.from('room_types').update({ is_active: false }).eq('id', id)
    setDeleteConfirm(null)
    await fetchData(hotelId)
  }

  // ── Room handlers ──
  function openAddRoom(typeId: string) {
    setEditingRoom(null)
    setSelectedTypeId(typeId); setRoomNumber(''); setRoomFloor(1); setRoomNotes('')
    setShowRoomModal(true)
  }

  function openEditRoom(room: Room) {
    setEditingRoom(room)
    setSelectedTypeId(room.room_type_id); setRoomNumber(room.number); setRoomFloor(room.floor); setRoomNotes(room.notes ?? '')
    setShowRoomModal(true)
  }

  async function saveRoom() {
    if (!hotelId || !roomNumber || !selectedTypeId) return
    setSavingRoom(true)
    const payload = { hotel_id: hotelId, room_type_id: selectedTypeId, number: roomNumber, floor: roomFloor, notes: roomNotes, is_active: true, status: 'available' }
    if (editingRoom) {
      await supabase.from('rooms').update({ room_type_id: selectedTypeId, number: roomNumber, floor: roomFloor, notes: roomNotes }).eq('id', editingRoom.id)
    } else {
      await supabase.from('rooms').insert(payload)
    }
    setShowRoomModal(false)
    await fetchData(hotelId!)
    setSavingRoom(false)
  }

  async function deleteRoom(id: string) {
    if (!hotelId) return
    await supabase.from('rooms').update({ is_active: false }).eq('id', id)
    setDeleteConfirm(null)
    await fetchData(hotelId)
  }

  function toggleAmenity(a: string) {
    setTypeAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])
  }

  if (loading) return <div className="setup-loading">Loading room setup...</div>

  return (
    <div className="setup-root">
      {/* Header */}
      <div className="setup-header">
        <div>
          <h2 className="setup-title">Room Setup</h2>
          <p className="setup-sub">Manage room types, individual rooms, rates and amenities</p>
        </div>
        <button className="setup-add-btn" onClick={openAddType}>
          <Plus size={15} /> Add Room Type
        </button>
      </div>

      {/* Summary */}
      <div className="setup-summary">
        <div className="setup-stat">
          <p className="setup-stat-value">{roomTypes.length}</p>
          <p className="setup-stat-label">Room Types</p>
        </div>
        <div className="setup-stat">
          <p className="setup-stat-value">{roomTypes.reduce((sum, rt) => sum + (rt.rooms?.length ?? 0), 0)}</p>
          <p className="setup-stat-label">Total Rooms</p>
        </div>
        <div className="setup-stat">
          <p className="setup-stat-value">
            {roomTypes.length > 0
              ? formatCurrency(Math.min(...roomTypes.map(rt => rt.base_rate)))
              : '—'}
          </p>
          <p className="setup-stat-label">Starting Rate</p>
        </div>
        <div className="setup-stat">
          <p className="setup-stat-value">
            {roomTypes.length > 0
              ? formatCurrency(Math.max(...roomTypes.map(rt => rt.base_rate)))
              : '—'}
          </p>
          <p className="setup-stat-label">Top Rate</p>
        </div>
      </div>

      {/* Room types list */}
      <div className="setup-types">
        {roomTypes.map(rt => (
          <div key={rt.id} className="setup-type-card">
            {/* Type header */}
            <div className="setup-type-header">
              <button className="setup-type-expand" onClick={() => setExpandedType(expandedType === rt.id ? null : rt.id)}>
                <div className="setup-type-avatar">
                  <BedDouble size={18} color="white" />
                </div>
                <div className="setup-type-info">
                  <h3 className="setup-type-name">{rt.name}</h3>
                  <p className="setup-type-meta">
                    {rt.rooms?.length ?? 0} rooms · Up to {rt.max_occupancy} guests · {formatCurrency(rt.base_rate)}/night
                  </p>
                </div>
                {expandedType === rt.id ? <ChevronUp size={16} style={{color:'var(--slate-400)',marginLeft:'auto'}} /> : <ChevronDown size={16} style={{color:'var(--slate-400)',marginLeft:'auto'}} />}
              </button>
              <div className="setup-type-actions">
                <button className="setup-action-btn" onClick={() => openEditType(rt)} title="Edit room type">
                  <Pencil size={14} />
                </button>
                <button className="setup-action-btn danger" onClick={() => setDeleteConfirm({type:'roomtype',id:rt.id})} title="Delete room type">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Amenities preview */}
            {rt.amenities?.length > 0 && (
              <div className="setup-amenities">
                {rt.amenities.map(a => (
                  <span key={a} className="setup-amenity">{a}</span>
                ))}
              </div>
            )}

            {/* Expanded rooms list */}
            {expandedType === rt.id && (
              <div className="setup-rooms">
                <div className="setup-rooms-header">
                  <span>Rooms in this type</span>
                  <button className="setup-add-room-btn" onClick={() => openAddRoom(rt.id)}>
                    <Plus size={12} /> Add Room
                  </button>
                </div>
                {!rt.rooms?.length ? (
                  <p className="setup-no-rooms">No rooms yet. Click Add Room to create the first one.</p>
                ) : (
                  <div className="setup-rooms-grid">
                    {rt.rooms.map(room => (
                      <div key={room.id} className="setup-room-chip">
                        <span className="setup-room-num">Room {room.number}</span>
                        <span className="setup-room-floor">Floor {room.floor}</span>
                        <div className="setup-room-chip-actions">
                          <button onClick={() => openEditRoom(room)} title="Edit"><Pencil size={11} /></button>
                          <button onClick={() => setDeleteConfirm({type:'room',id:room.id})} title="Delete" className="danger"><Trash2 size={11} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {roomTypes.length === 0 && (
          <div className="setup-empty">
            <BedDouble size={48} style={{color:'var(--slate-300)'}} />
            <p>No room types yet</p>
            <button className="setup-add-btn" onClick={openAddType}><Plus size={14} /> Add your first room type</button>
          </div>
        )}
      </div>

      {/* ── Room Type Modal ── */}
      {showTypeModal && (
        <div className="modal-overlay" onClick={() => setShowTypeModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingType ? 'Edit Room Type' : 'Add Room Type'}</h3>
              <button className="modal-close" onClick={() => setShowTypeModal(false)}><X size={16} /></button>
            </div>

            <div className="modal-body">
              <div className="modal-field">
                <label>Room Type Name *</label>
                <input value={typeName} onChange={e => setTypeName(e.target.value)} placeholder="e.g. Deluxe Suite" />
              </div>
              <div className="modal-field">
                <label>Description</label>
                <textarea value={typeDesc} onChange={e => setTypeDesc(e.target.value)} placeholder="Brief description shown on booking page" rows={2} />
              </div>
              <div className="modal-row2">
                <div className="modal-field">
                  <label>Max Occupancy</label>
                  <input type="number" min={1} max={20} value={typeOccupancy} onChange={e => setTypeOccupancy(Number(e.target.value))} />
                </div>
                <div className="modal-field">
                  <label>Base Rate (NGN/night)</label>
                  <input type="number" min={0} value={typeRate} onChange={e => setTypeRate(Number(e.target.value))} placeholder="75000" />
                </div>
              </div>
              <div className="modal-field">
                <label>Amenities</label>
                <div className="modal-amenities">
                  {AMENITY_OPTIONS.map(a => (
                    <button
                      key={a}
                      type="button"
                      className="modal-amenity-chip"
                      data-selected={typeAmenities.includes(a)}
                      onClick={() => toggleAmenity(a)}
                    >
                      {typeAmenities.includes(a) && <Check size={10} />} {a}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="modal-cancel" onClick={() => setShowTypeModal(false)}>Cancel</button>
              <button className="modal-save" onClick={saveRoomType} disabled={savingType}>
                {savingType ? 'Saving...' : editingType ? 'Save Changes' : 'Create Room Type'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Room Modal ── */}
      {showRoomModal && (
        <div className="modal-overlay" onClick={() => setShowRoomModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingRoom ? 'Edit Room' : 'Add Room'}</h3>
              <button className="modal-close" onClick={() => setShowRoomModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="modal-field">
                <label>Room Type *</label>
                <select value={selectedTypeId} onChange={e => setSelectedTypeId(e.target.value)}>
                  <option value="">Select room type...</option>
                  {roomTypes.map(rt => (
                    <option key={rt.id} value={rt.id}>{rt.name}</option>
                  ))}
                </select>
              </div>
              <div className="modal-row2">
                <div className="modal-field">
                  <label>Room Number *</label>
                  <input value={roomNumber} onChange={e => setRoomNumber(e.target.value)} placeholder="e.g. 201, Suite A" />
                </div>
                <div className="modal-field">
                  <label>Floor</label>
                  <input type="number" min={0} max={99} value={roomFloor} onChange={e => setRoomFloor(Number(e.target.value))} />
                </div>
              </div>
              <div className="modal-field">
                <label>Notes (optional)</label>
                <textarea value={roomNotes} onChange={e => setRoomNotes(e.target.value)} placeholder="e.g. Corner room, extra quiet" rows={2} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-cancel" onClick={() => setShowRoomModal(false)}>Cancel</button>
              <button className="modal-save" onClick={saveRoom} disabled={savingRoom}>
                {savingRoom ? 'Saving...' : editingRoom ? 'Save Changes' : 'Add Room'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-card small" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirm Delete</h3>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{fontSize:14,color:'var(--slate-600)',margin:0}}>
                {deleteConfirm.type === 'room'
                  ? 'This room will be removed from your inventory. This cannot be undone.'
                  : 'This room type and all its rooms will be deactivated. This cannot be undone.'
                }
              </p>
            </div>
            <div className="modal-footer">
              <button className="modal-cancel" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button
                className="modal-delete"
                onClick={() => deleteConfirm.type === 'room' ? deleteRoom(deleteConfirm.id) : deleteRoomType(deleteConfirm.id)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .setup-root { max-width: 900px; margin: 0 auto; }
        .setup-loading { padding: 60px; text-align: center; color: var(--text-muted); }

        .setup-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          margin-bottom: 24px; gap: 16px; flex-wrap: wrap;
        }
        .setup-title { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .setup-sub { font-size: 13px; color: var(--text-muted); margin: 4px 0 0; }
        .setup-add-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 9px 18px; background: var(--navy-800); color: white;
          font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif;
          border: none; border-radius: 8px; cursor: pointer; transition: opacity 0.15s;
        }
        .setup-add-btn:hover { opacity: 0.85; }

        .setup-summary {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;
        }
        @media (max-width: 640px) { .setup-summary { grid-template-columns: repeat(2,1fr); } }
        .setup-stat {
          background: white; border: 1px solid var(--slate-200);
          border-radius: 12px; padding: 16px; text-align: center;
        }
        .setup-stat-value { font-size: 22px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .setup-stat-label { font-size: 11px; color: var(--text-muted); margin: 4px 0 0; }

        .setup-types { display: flex; flex-direction: column; gap: 12px; }

        .setup-type-card {
          background: white; border: 1px solid var(--slate-200);
          border-radius: 14px; overflow: hidden;
        }
        .setup-type-header {
          display: flex; align-items: center; gap: 0;
          padding: 16px 20px;
        }
        .setup-type-expand {
          display: flex; align-items: center; gap: 14px;
          flex: 1; background: none; border: none; cursor: pointer;
          text-align: left; font-family: 'DM Sans', sans-serif; padding: 0;
        }
        .setup-type-avatar {
          width: 40px; height: 40px; border-radius: 10px;
          background: linear-gradient(135deg, var(--navy-800), var(--navy-600));
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .setup-type-name { font-size: 15px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .setup-type-meta { font-size: 12px; color: var(--text-muted); margin: 2px 0 0; }
        .setup-type-actions { display: flex; gap: 6px; margin-left: 12px; }
        .setup-action-btn {
          width: 32px; height: 32px; border-radius: 8px;
          border: 1px solid var(--slate-200); background: white;
          color: var(--slate-400); cursor: pointer; display: flex;
          align-items: center; justify-content: center; transition: all 0.12s;
        }
        .setup-action-btn:hover { background: var(--slate-100); color: var(--slate-700); }
        .setup-action-btn.danger:hover { background: #fee2e2; border-color: #fca5a5; color: #991b1b; }

        .setup-amenities {
          display: flex; flex-wrap: wrap; gap: 6px;
          padding: 0 20px 16px;
        }
        .setup-amenity {
          font-size: 11px; font-weight: 500; padding: 3px 10px;
          background: var(--slate-100); border-radius: 20px; color: var(--slate-600);
        }

        .setup-rooms {
          border-top: 1px solid var(--slate-200);
          padding: 16px 20px; background: var(--slate-100);
        }
        .setup-rooms-header {
          display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;
          font-size: 12px; font-weight: 600; color: var(--slate-600); text-transform: uppercase; letter-spacing: 0.06em;
        }
        .setup-add-room-btn {
          display: flex; align-items: center; gap: 4px;
          padding: 5px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          background: var(--navy-800); color: white; border: none; cursor: pointer;
        }
        .setup-no-rooms { font-size: 13px; color: var(--text-muted); margin: 0; }
        .setup-rooms-grid { display: flex; flex-wrap: wrap; gap: 8px; }
        .setup-room-chip {
          display: flex; align-items: center; gap: 8px;
          background: white; border: 1px solid var(--slate-200);
          border-radius: 8px; padding: 8px 12px;
        }
        .setup-room-num { font-size: 13px; font-weight: 700; color: var(--slate-800); }
        .setup-room-floor { font-size: 11px; color: var(--text-muted); }
        .setup-room-chip-actions { display: flex; gap: 4px; }
        .setup-room-chip-actions button {
          width: 22px; height: 22px; border-radius: 5px; border: none;
          background: var(--slate-100); color: var(--slate-400);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.12s;
        }
        .setup-room-chip-actions button:hover { background: var(--slate-200); color: var(--slate-700); }
        .setup-room-chip-actions button.danger:hover { background: #fee2e2; color: #991b1b; }

        .setup-empty {
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          padding: 60px; color: var(--text-muted); font-size: 14px;
        }

        /* Modal */
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px); z-index: 100;
          display: flex; align-items: center; justify-content: center; padding: 20px;
        }
        .modal-card {
          background: white; border-radius: 16px; width: 100%; max-width: 540px;
          box-shadow: 0 24px 48px rgba(0,0,0,0.2); overflow: hidden;
        }
        .modal-card.small { max-width: 380px; }
        .modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 24px; border-bottom: 1px solid var(--slate-200);
        }
        .modal-header h3 { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .modal-close {
          width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--slate-200);
          background: white; color: var(--slate-400); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        .modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; max-height: 60vh; overflow-y: auto; }
        .modal-field { display: flex; flex-direction: column; gap: 6px; }
        .modal-field label { font-size: 12px; font-weight: 600; color: var(--slate-600); text-transform: uppercase; letter-spacing: 0.05em; }
        .modal-field input, .modal-field textarea, .modal-field select {
          padding: 10px 12px; border: 1px solid var(--slate-200); border-radius: 8px;
          font-size: 14px; font-family: 'DM Sans', sans-serif; color: var(--slate-800);
          outline: none; transition: border-color 0.15s;
        }
        .modal-field input:focus, .modal-field textarea:focus, .modal-field select:focus { border-color: var(--gold-500); box-shadow: 0 0 0 3px rgba(201,168,76,0.1); }
        .modal-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .modal-amenities { display: flex; flex-wrap: wrap; gap: 8px; }
        .modal-amenity-chip {
          padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          border: 1.5px solid var(--slate-200); background: white; color: var(--slate-600);
          cursor: pointer; transition: all 0.12s;
          display: flex; align-items: center; gap: 4px;
        }
        .modal-amenity-chip[data-selected="true"] {
          background: var(--gold-100); border-color: var(--gold-500); color: var(--navy-800); font-weight: 600;
        }
        .modal-footer {
          display: flex; gap: 10px; justify-content: flex-end;
          padding: 16px 24px; border-top: 1px solid var(--slate-200);
        }
        .modal-cancel {
          padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          border: 1px solid var(--slate-200); background: white; color: var(--slate-600); cursor: pointer;
        }
        .modal-save {
          padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          background: var(--navy-800); color: white; border: none; cursor: pointer; transition: opacity 0.15s;
        }
        .modal-save:disabled { opacity: 0.6; cursor: not-allowed; }
        .modal-delete {
          padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          background: #ef4444; color: white; border: none; cursor: pointer;
        }
      `}</style>
    </div>
  )
}
