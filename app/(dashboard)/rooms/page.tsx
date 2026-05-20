'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BedDouble, Plus, Filter, LayoutGrid, List,
  Wifi, Wind, Tv, Coffee, Eye, Wrench,
  CheckCircle, Clock, XCircle, AlertTriangle
} from 'lucide-react'

type RoomStatus = 'available' | 'occupied' | 'dirty' | 'clean' | 'maintenance' | 'out_of_order' | 'blocked'

type Room = {
  id: string
  number: string
  floor: number
  status: RoomStatus
  notes: string | null
  room_type: {
    id: string
    name: string
    base_rate: number
    max_occupancy: number
    amenities: string[]
  }
}

const STATUS_CONFIG: Record<RoomStatus, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  available:    { label: 'Available',    color: '#065f46', bg: '#d1fae5', border: '#6ee7b7', icon: CheckCircle },
  occupied:     { label: 'Occupied',     color: '#1e40af', bg: '#dbeafe', border: '#93c5fd', icon: BedDouble   },
  dirty:        { label: 'Dirty',        color: '#92400e', bg: '#fef3c7', border: '#fcd34d', icon: Clock       },
  clean:        { label: 'Clean',        color: '#065f46', bg: '#d1fae5', border: '#6ee7b7', icon: CheckCircle },
  maintenance:  { label: 'Maintenance',  color: '#991b1b', bg: '#fee2e2', border: '#fca5a5', icon: Wrench      },
  out_of_order: { label: 'Out of Order', color: '#6b21a8', bg: '#f3e8ff', border: '#d8b4fe', icon: XCircle    },
  blocked:      { label: 'Blocked',      color: '#374151', bg: '#f3f4f6', border: '#d1d5db', icon: AlertTriangle },
}

const ALL_STATUSES = Object.keys(STATUS_CONFIG) as RoomStatus[]

const AMENITY_ICONS: Record<string, React.ElementType> = {
  'WiFi': Wifi, 'AC': Wind, 'TV': Tv, 'Mini Bar': Coffee,
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount)
}

export default function RoomsPage() {
  const supabase = createClient()

  const [rooms,          setRooms]          = useState<Room[]>([])
  const [loading,        setLoading]        = useState(true)
  const [hotelId,        setHotelId]        = useState<string | null>(null)
  const [filterStatus,   setFilterStatus]   = useState<RoomStatus | 'all'>('all')
  const [filterFloor,    setFilterFloor]    = useState<number | 'all'>('all')
  const [viewMode,       setViewMode]       = useState<'grid' | 'list'>('grid')
  const [selectedRoom,   setSelectedRoom]   = useState<Room | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles').select('hotel_id').eq('id', user.id).single()
      if (!profile) return
      setHotelId(profile.hotel_id)
      await fetchRooms(profile.hotel_id)
    }
    load()
  }, [])

  async function fetchRooms(hid: string) {
    setLoading(true)
    const { data } = await supabase
      .from('rooms')
      .select(`id, number, floor, status, notes, room_type:room_types(id, name, base_rate, max_occupancy, amenities)`)
      .eq('hotel_id', hid)
      .eq('is_active', true)
      .order('floor')
      .order('number')
    setRooms((data as unknown as Room[]) ?? [])
    setLoading(false)
  }

  async function updateRoomStatus(roomId: string, newStatus: RoomStatus) {
    if (!hotelId) return
    setUpdatingStatus(true)
    await supabase.from('rooms').update({ status: newStatus }).eq('id', roomId)
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, status: newStatus } : r))
    if (selectedRoom?.id === roomId) setSelectedRoom(prev => prev ? { ...prev, status: newStatus } : null)
    setUpdatingStatus(false)
  }

  const floors   = [...new Set(rooms.map(r => r.floor))].sort()
  const filtered = rooms.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false
    if (filterFloor  !== 'all' && r.floor  !== filterFloor)  return false
    return true
  })

  // Stats
  const stats = ALL_STATUSES.map(s => ({
    status: s,
    count:  rooms.filter(r => r.status === s).length,
    ...STATUS_CONFIG[s]
  })).filter(s => s.count > 0)

  const occupancyRate = rooms.length > 0
    ? Math.round((rooms.filter(r => r.status === 'occupied').length / rooms.length) * 100)
    : 0

  return (
    <div className="rooms-root">

      {/* ── Header ── */}
      <div className="rooms-header">
        <div>
          <h2 className="rooms-title">Room Grid</h2>
          <p className="rooms-sub">{rooms.length} rooms · {occupancyRate}% occupied</p>
        </div>
        <div className="rooms-header-actions">
          <button
            className="rooms-view-btn"
            data-active={viewMode === 'grid'}
            onClick={() => setViewMode('grid')}
          ><LayoutGrid size={15} /></button>
          <button
            className="rooms-view-btn"
            data-active={viewMode === 'list'}
            onClick={() => setViewMode('list')}
          ><List size={15} /></button>
          <button className="rooms-add-btn">
            <Plus size={15} /> Add Room
          </button>
        </div>
      </div>

      {/* ── Status summary strip ── */}
      <div className="rooms-stats">
        <button
          className="rooms-stat-pill"
          data-active={filterStatus === 'all'}
          onClick={() => setFilterStatus('all')}
          style={{ '--pill-color': '#1e293b', '--pill-bg': '#f1f4f8', '--pill-border': '#e2e8f0' } as React.CSSProperties}
        >
          All <strong>{rooms.length}</strong>
        </button>
        {stats.map(s => (
          <button
            key={s.status}
            className="rooms-stat-pill"
            data-active={filterStatus === s.status}
            onClick={() => setFilterStatus(s.status as RoomStatus)}
            style={{ '--pill-color': s.color, '--pill-bg': s.bg, '--pill-border': s.border } as React.CSSProperties}
          >
            {s.label} <strong>{s.count}</strong>
          </button>
        ))}
      </div>

      {/* ── Floor filter ── */}
      {floors.length > 1 && (
        <div className="rooms-floor-filter">
          <Filter size={13} style={{ color: 'var(--slate-400)' }} />
          <button
            className="rooms-floor-btn"
            data-active={filterFloor === 'all'}
            onClick={() => setFilterFloor('all')}
          >All floors</button>
          {floors.map(f => (
            <button
              key={f}
              className="rooms-floor-btn"
              data-active={filterFloor === f}
              onClick={() => setFilterFloor(f)}
            >Floor {f}</button>
          ))}
        </div>
      )}

      {/* ── Main content ── */}
      <div className="rooms-body">

        {/* Room grid / list */}
        <div className="rooms-grid-wrap">
          {loading ? (
            <div className="rooms-loading">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 120, borderRadius: 12 }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rooms-empty">
              <BedDouble size={40} style={{ color: 'var(--slate-300)' }} />
              <p>No rooms match this filter</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="rooms-grid">
              {filtered.map(room => {
                const cfg = STATUS_CONFIG[room.status]
                const Icon = cfg.icon
                return (
                  <button
                    key={room.id}
                    className="room-tile"
                    onClick={() => setSelectedRoom(room)}
                    data-active={selectedRoom?.id === room.id}
                    style={{
                      '--tile-border': cfg.border,
                      '--tile-bg':     selectedRoom?.id === room.id ? cfg.bg : 'white',
                    } as React.CSSProperties}
                  >
                    <div className="room-tile-top">
                      <span className="room-tile-number">{room.number}</span>
                      <Icon size={14} style={{ color: cfg.color }} />
                    </div>
                    <p className="room-tile-type">{room.room_type.name}</p>
                    <p className="room-tile-rate">{formatCurrency(room.room_type.base_rate)}<span>/night</span></p>
                    <span className="room-tile-status" style={{ color: cfg.color, background: cfg.bg }}>
                      {cfg.label}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="rooms-list">
              <div className="rooms-list-header">
                <span>Room</span><span>Type</span><span>Floor</span><span>Rate</span><span>Status</span>
              </div>
              {filtered.map(room => {
                const cfg = STATUS_CONFIG[room.status]
                return (
                  <button
                    key={room.id}
                    className="rooms-list-row"
                    onClick={() => setSelectedRoom(room)}
                    data-active={selectedRoom?.id === room.id}
                  >
                    <span className="rooms-list-num">{room.number}</span>
                    <span>{room.room_type.name}</span>
                    <span>Floor {room.floor}</span>
                    <span>{formatCurrency(room.room_type.base_rate)}</span>
                    <span className="room-tile-status" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Room detail panel ── */}
        {selectedRoom && (
          <div className="room-panel">
            <div className="room-panel-header">
              <div>
                <h3 className="room-panel-title">Room {selectedRoom.number}</h3>
                <p className="room-panel-type">{selectedRoom.room_type.name} · Floor {selectedRoom.floor}</p>
              </div>
              <button className="room-panel-close" onClick={() => setSelectedRoom(null)}>✕</button>
            </div>

            {/* Current status */}
            <div className="room-panel-section">
              <p className="room-panel-label">Current Status</p>
              <span
                className="room-panel-status-badge"
                style={{
                  color:      STATUS_CONFIG[selectedRoom.status].color,
                  background: STATUS_CONFIG[selectedRoom.status].bg,
                  border:     `1px solid ${STATUS_CONFIG[selectedRoom.status].border}`
                }}
              >
                {STATUS_CONFIG[selectedRoom.status].label}
              </span>
            </div>

            {/* Rate + occupancy */}
            <div className="room-panel-row2">
              <div className="room-panel-stat">
                <p className="room-panel-label">Nightly Rate</p>
                <p className="room-panel-value">{formatCurrency(selectedRoom.room_type.base_rate)}</p>
              </div>
              <div className="room-panel-stat">
                <p className="room-panel-label">Max Guests</p>
                <p className="room-panel-value">{selectedRoom.room_type.max_occupancy}</p>
              </div>
            </div>

            {/* Amenities */}
            {selectedRoom.room_type.amenities?.length > 0 && (
              <div className="room-panel-section">
                <p className="room-panel-label">Amenities</p>
                <div className="room-panel-amenities">
                  {selectedRoom.room_type.amenities.map((a: string) => {
                    const AIcon = AMENITY_ICONS[a]
                    return (
                      <span key={a} className="room-panel-amenity">
                        {AIcon && <AIcon size={12} />} {a}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Notes */}
            {selectedRoom.notes && (
              <div className="room-panel-section">
                <p className="room-panel-label">Notes</p>
                <p className="room-panel-notes">{selectedRoom.notes}</p>
              </div>
            )}

            {/* Update status */}
            <div className="room-panel-section">
              <p className="room-panel-label">Update Status</p>
              <div className="room-panel-status-grid">
                {ALL_STATUSES.map(s => {
                  const cfg = STATUS_CONFIG[s]
                  const isActive = selectedRoom.status === s
                  return (
                    <button
                      key={s}
                      className="room-status-option"
                      data-active={isActive}
                      disabled={updatingStatus}
                      onClick={() => updateRoomStatus(selectedRoom.id, s)}
                      style={{
                        color:      cfg.color,
                        background: isActive ? cfg.bg : 'white',
                        border:     `1.5px solid ${isActive ? cfg.border : 'var(--slate-200)'}`,
                        opacity:    updatingStatus ? 0.6 : 1,
                      }}
                    >
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="room-panel-actions">
              <button className="room-panel-btn-outline">
                <Eye size={14} /> View History
              </button>
              <button className="room-panel-btn-outline">
                <Wrench size={14} /> Log Issue
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .rooms-root { max-width: 1400px; margin: 0 auto; }

        .rooms-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          margin-bottom: 20px; gap: 16px; flex-wrap: wrap;
        }
        .rooms-title {
          font-family: 'Playfair Display', serif;
          font-size: 20px; font-weight: 700;
          color: var(--slate-800); margin: 0;
        }
        .rooms-sub { font-size: 13px; color: var(--text-muted); margin: 4px 0 0; }
        .rooms-header-actions { display: flex; align-items: center; gap: 8px; }
        .rooms-view-btn {
          width: 36px; height: 36px; border-radius: 8px;
          border: 1px solid var(--slate-200);
          background: white; color: var(--slate-400);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.12s;
        }
        .rooms-view-btn[data-active="true"] {
          background: var(--navy-800); color: white; border-color: var(--navy-800);
        }
        .rooms-add-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 16px; border-radius: 8px;
          background: var(--navy-800); color: white;
          font-size: 13px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          border: none; cursor: pointer; transition: opacity 0.15s;
        }
        .rooms-add-btn:hover { opacity: 0.85; }

        /* Stats strip */
        .rooms-stats {
          display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;
        }
        .rooms-stat-pill {
          display: flex; align-items: center; gap: 6px;
          padding: 6px 12px; border-radius: 20px;
          font-size: 12px; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          color: var(--pill-color, #1e293b);
          background: var(--pill-bg, #f1f4f8);
          border: 1.5px solid var(--pill-border, #e2e8f0);
          cursor: pointer; transition: all 0.12s;
        }
        .rooms-stat-pill strong { font-weight: 700; }
        .rooms-stat-pill[data-active="true"] {
          box-shadow: 0 0 0 2px var(--pill-border, #e2e8f0);
        }

        /* Floor filter */
        .rooms-floor-filter {
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 20px; flex-wrap: wrap;
        }
        .rooms-floor-btn {
          padding: 5px 12px; border-radius: 6px; font-size: 12px;
          font-family: 'DM Sans', sans-serif; font-weight: 500;
          background: white; color: var(--slate-600);
          border: 1px solid var(--slate-200); cursor: pointer; transition: all 0.12s;
        }
        .rooms-floor-btn[data-active="true"] {
          background: var(--navy-800); color: white; border-color: var(--navy-800);
        }

        /* Body layout */
        .rooms-body {
          display: flex; gap: 20px; align-items: flex-start;
        }
        .rooms-grid-wrap { flex: 1; min-width: 0; }

        /* Grid */
        .rooms-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 12px;
        }
        @media (max-width: 640px) {
          .rooms-grid { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
        }

        .room-tile {
          background: var(--tile-bg, white);
          border: 1.5px solid var(--tile-border, var(--slate-200));
          border-radius: 12px; padding: 14px 12px;
          text-align: left; cursor: pointer;
          transition: all 0.15s; font-family: 'DM Sans', sans-serif;
          display: flex; flex-direction: column; gap: 6px;
        }
        .room-tile:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .room-tile[data-active="true"] { box-shadow: 0 0 0 2px var(--tile-border); }

        .room-tile-top { display: flex; align-items: center; justify-content: space-between; }
        .room-tile-number { font-size: 18px; font-weight: 800; color: var(--slate-800); font-family: 'Playfair Display', serif; }
        .room-tile-type { font-size: 11px; color: var(--text-muted); font-weight: 500; }
        .room-tile-rate { font-size: 12px; font-weight: 600; color: var(--slate-700); }
        .room-tile-rate span { font-size: 10px; font-weight: 400; color: var(--text-muted); }
        .room-tile-status {
          font-size: 10px; font-weight: 600; padding: 3px 8px;
          border-radius: 20px; width: fit-content;
        }

        /* List view */
        .rooms-list { display: flex; flex-direction: column; gap: 0; border-radius: 12px; overflow: hidden; border: 1px solid var(--slate-200); background: white; }
        .rooms-list-header {
          display: grid; grid-template-columns: 80px 1fr 100px 120px 120px;
          padding: 10px 16px; background: var(--slate-100);
          font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.06em; color: var(--text-muted);
        }
        .rooms-list-row {
          display: grid; grid-template-columns: 80px 1fr 100px 120px 120px;
          padding: 12px 16px; border-top: 1px solid var(--slate-200);
          font-size: 13px; color: var(--slate-700);
          background: white; text-align: left; cursor: pointer;
          transition: background 0.1s; font-family: 'DM Sans', sans-serif;
          align-items: center;
        }
        .rooms-list-row:hover { background: var(--slate-100); }
        .rooms-list-row[data-active="true"] { background: var(--gold-100); }
        .rooms-list-num { font-weight: 700; color: var(--slate-800); }

        /* Loading / empty */
        .rooms-loading { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
        .rooms-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 60px; color: var(--text-muted); font-size: 14px; }

        /* Detail panel */
        .room-panel {
          width: 280px; flex-shrink: 0;
          background: white; border: 1px solid var(--slate-200);
          border-radius: 16px; padding: 20px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.06);
          position: sticky; top: 80px;
        }
        @media (max-width: 900px) {
          .rooms-body { flex-direction: column; }
          .room-panel { width: 100%; position: static; }
        }

        .room-panel-header {
          display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px;
        }
        .room-panel-title { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .room-panel-type { font-size: 12px; color: var(--text-muted); margin: 3px 0 0; }
        .room-panel-close {
          width: 28px; height: 28px; border-radius: 8px;
          background: var(--slate-100); border: none;
          color: var(--slate-400); cursor: pointer; font-size: 13px;
          display: flex; align-items: center; justify-content: center;
        }

        .room-panel-section { margin-bottom: 16px; }
        .room-panel-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin: 0 0 8px; }
        .room-panel-status-badge { display: inline-block; font-size: 13px; font-weight: 600; padding: 4px 12px; border-radius: 20px; }
        .room-panel-notes { font-size: 13px; color: var(--slate-600); margin: 0; line-height: 1.5; }

        .room-panel-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
        .room-panel-stat { background: var(--slate-100); border-radius: 10px; padding: 12px; }
        .room-panel-value { font-size: 16px; font-weight: 700; color: var(--slate-800); margin: 4px 0 0; }

        .room-panel-amenities { display: flex; flex-wrap: wrap; gap: 6px; }
        .room-panel-amenity {
          display: flex; align-items: center; gap: 4px;
          font-size: 11px; font-weight: 500; padding: 4px 10px;
          background: var(--slate-100); border-radius: 6px; color: var(--slate-600);
        }

        .room-panel-status-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .room-status-option {
          padding: 7px 6px; border-radius: 8px; font-size: 11px; font-weight: 600;
          font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all 0.12s;
          text-align: center;
        }
        .room-status-option:hover { filter: brightness(0.95); }

        .room-panel-actions { display: flex; gap: 8px; margin-top: 16px; }
        .room-panel-btn-outline {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: 9px; border-radius: 8px; font-size: 12px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          background: white; border: 1px solid var(--slate-200); color: var(--slate-600);
          cursor: pointer; transition: all 0.12s;
        }
        .room-panel-btn-outline:hover { background: var(--slate-100); border-color: var(--slate-300); }
      `}</style>
    </div>
  )
}
