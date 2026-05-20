'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Check, Layers, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

type RoomType = {
  id: string
  name: string
  base_rate: number
}

type RoomConfig = {
  number: string
  room_type_id: string
  is_exception: boolean
}

export default function FloorBuilderPage() {
  const supabase = createClient()
  const [hotelId, setHotelId] = useState<string|null>(null)
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Floor config
  const [floorNumber, setFloorNumber] = useState<number>(1)
  const [prefix, setPrefix] = useState('')
  const [roomCount, setRoomCount] = useState<number>(10)
  const [startNumber, setStartNumber] = useState<number>(1)
  const [defaultTypeId, setDefaultTypeId] = useState('')
  const [rooms, setRooms] = useState<RoomConfig[]>([])
  const [generated, setGenerated] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('hotel_id').eq('id', user.id).single()
      if (!profile) return
      setHotelId(profile.hotel_id)
      const { data: types } = await supabase.from('room_types').select('id, name, base_rate').eq('hotel_id', profile.hotel_id).eq('is_active', true).order('name')
      setRoomTypes(types ?? [])
      setLoading(false)
    }
    load()
  }, [])

  // Auto-set prefix when floor number changes
  useEffect(() => {
    setPrefix(String(floorNumber))
    setStartNumber(1)
  }, [floorNumber])

  function generateFloor() {
    if (!defaultTypeId) return
    const generated: RoomConfig[] = []
    for (let i = 0; i < roomCount; i++) {
      const num = startNumber + i
      const roomNum = prefix + (num < 10 ? '0' + num : String(num))
      generated.push({ number: roomNum, room_type_id: defaultTypeId, is_exception: false })
    }
    setRooms(generated)
    setGenerated(true)
  }

  function setRoomType(index: number, typeId: string) {
    setRooms(prev => prev.map((r, i) => i === index
      ? { ...r, room_type_id: typeId, is_exception: typeId !== defaultTypeId }
      : r
    ))
  }

  async function saveFloor() {
    if (!hotelId || rooms.length === 0) return
    setSaving(true)
    const payload = rooms.map(r => ({
      hotel_id: hotelId,
      room_type_id: r.room_type_id,
      number: r.number,
      floor: floorNumber,
      status: 'available',
      is_active: true,
    }))
    const { error } = await supabase.from('rooms').insert(payload)
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      setGenerated(false)
      setRooms([])
    }
    setSaving(false)
  }

  const defaultType = roomTypes.find(t => t.id === defaultTypeId)

  if (loading) return <div style={{padding:60,textAlign:'center',color:'var(--text-muted)'}}>Loading...</div>

  return (
    <div className="fb-root">
      {/* Header */}
      <div className="fb-header">
        <Link href="/rooms/setup" className="fb-back">
          <ArrowLeft size={15} /> Back to Room Setup
        </Link>
        <div>
          <h2 className="fb-title">Floor Builder</h2>
          <p className="fb-sub">Create all rooms on a floor in one step</p>
        </div>
      </div>

      {/* Config form */}
      <div className="fb-config-card">
        <div className="fb-config-grid">
          <div className="fb-field">
            <label>Floor Number</label>
            <input
              type="number" min={0} max={200}
              value={floorNumber}
              onChange={e => setFloorNumber(Number(e.target.value))}
            />
          </div>
          <div className="fb-field">
            <label>Room Number Prefix</label>
            <input
              value={prefix}
              onChange={e => setPrefix(e.target.value)}
              placeholder="e.g. 5 → rooms 501, 502..."
            />
          </div>
          <div className="fb-field">
            <label>Starting Room Number</label>
            <input
              type="number" min={1}
              value={startNumber}
              onChange={e => setStartNumber(Number(e.target.value))}
            />
          </div>
          <div className="fb-field">
            <label>Number of Rooms</label>
            <input
              type="number" min={1} max={100}
              value={roomCount}
              onChange={e => setRoomCount(Number(e.target.value))}
            />
          </div>
          <div className="fb-field fb-field-wide">
            <label>Default Room Type (for all rooms)</label>
            <select value={defaultTypeId} onChange={e => setDefaultTypeId(e.target.value)}>
              <option value="">Select default type...</option>
              {roomTypes.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          className="fb-generate-btn"
          onClick={generateFloor}
          disabled={!defaultTypeId || roomCount < 1}
        >
          <Layers size={15} />
          Generate Floor {floorNumber} Preview
        </button>
      </div>

      {/* Preview */}
      {generated && rooms.length > 0 && (
        <div className="fb-preview">
          <div className="fb-preview-header">
            <div>
              <h3 className="fb-preview-title">Floor {floorNumber} — {rooms.length} Rooms</h3>
              <p className="fb-preview-sub">
                Click any room to override its type. Highlighted rooms have custom types.
              </p>
            </div>
            <div className="fb-preview-actions">
              <button className="fb-reset-btn" onClick={() => { setGenerated(false); setRooms([]) }}>
                <X size={13} /> Reset
              </button>
              <button className="fb-save-btn" onClick={saveFloor} disabled={saving || saved}>
                {saved
                  ? <><Check size={13} /> Saved!</>
                  : saving
                  ? 'Saving...'
                  : <><Plus size={13} /> Create {rooms.length} Rooms</>
                }
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="fb-type-summary">
            {roomTypes.map(t => {
              const count = rooms.filter(r => r.room_type_id === t.id).length
              if (count === 0) return null
              return (
                <span key={t.id} className="fb-type-badge">
                  {t.name}: {count} {count === 1 ? 'room' : 'rooms'}
                </span>
              )
            })}
          </div>

          {/* Room grid */}
          <div className="fb-room-grid">
            {rooms.map((room, index) => {
              const type = roomTypes.find(t => t.id === room.room_type_id)
              const isException = room.is_exception
              return (
                <div key={room.number} className="fb-room-cell" data-exception={isException}>
                  <p className="fb-room-num">{room.number}</p>
                  <select
                    className="fb-room-select"
                    value={room.room_type_id}
                    onChange={e => setRoomType(index, e.target.value)}
                  >
                    {roomTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  {isException && (
                    <span className="fb-exception-dot" title="Custom type" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <style>{`
        .fb-root { max-width: 900px; margin: 0 auto; }

        .fb-header { margin-bottom: 24px; }
        .fb-back {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12px; font-weight: 600; color: var(--slate-500);
          text-decoration: none; margin-bottom: 12px;
          transition: color 0.12s;
        }
        .fb-back:hover { color: var(--navy-800); }
        .fb-title { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .fb-sub { font-size: 13px; color: var(--text-muted); margin: 4px 0 0; }

        .fb-config-card {
          background: white; border: 1px solid var(--slate-200);
          border-radius: 16px; padding: 24px; margin-bottom: 24px;
        }
        .fb-config-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px;
        }
        @media (max-width: 640px) { .fb-config-grid { grid-template-columns: 1fr 1fr; } }
        .fb-field { display: flex; flex-direction: column; gap: 6px; }
        .fb-field-wide { grid-column: 1 / -1; }
        .fb-field label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--slate-500); }
        .fb-field input, .fb-field select {
          padding: 10px 12px; border: 1px solid var(--slate-200); border-radius: 8px;
          font-size: 14px; font-family: 'DM Sans', sans-serif; color: var(--slate-800);
          outline: none; transition: border-color 0.15s;
        }
        .fb-field input:focus, .fb-field select:focus { border-color: var(--gold-500); box-shadow: 0 0 0 3px rgba(201,168,76,0.1); }

        .fb-generate-btn {
          display: flex; align-items: center; gap: 8px;
          padding: 11px 24px; background: var(--navy-800); color: white;
          font-size: 14px; font-weight: 600; font-family: 'DM Sans', sans-serif;
          border: none; border-radius: 10px; cursor: pointer; transition: opacity 0.15s;
        }
        .fb-generate-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .fb-generate-btn:not(:disabled):hover { opacity: 0.85; }

        .fb-preview {
          background: white; border: 1px solid var(--slate-200);
          border-radius: 16px; padding: 24px;
        }
        .fb-preview-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          margin-bottom: 16px; gap: 16px; flex-wrap: wrap;
        }
        .fb-preview-title { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .fb-preview-sub { font-size: 12px; color: var(--text-muted); margin: 4px 0 0; }
        .fb-preview-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }

        .fb-reset-btn {
          display: flex; align-items: center; gap: 5px;
          padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          border: 1px solid var(--slate-200); background: white; color: var(--slate-500);
          cursor: pointer;
        }
        .fb-save-btn {
          display: flex; align-items: center; gap: 5px;
          padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 700;
          font-family: 'DM Sans', sans-serif;
          background: linear-gradient(135deg, var(--gold-500), #b8922e);
          color: white; border: none; cursor: pointer; transition: opacity 0.15s;
        }
        .fb-save-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        .fb-type-summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
        .fb-type-badge {
          font-size: 12px; font-weight: 600; padding: 4px 12px;
          background: var(--slate-100); border-radius: 20px; color: var(--slate-600);
        }

        .fb-room-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 10px;
        }
        @media (max-width: 480px) { .fb-room-grid { grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); } }

        .fb-room-cell {
          position: relative;
          background: var(--slate-100); border: 2px solid var(--slate-200);
          border-radius: 10px; padding: 10px 8px 8px;
          transition: border-color 0.15s;
        }
        .fb-room-cell[data-exception="true"] {
          background: var(--gold-100); border-color: var(--gold-400);
        }
        .fb-room-num {
          font-size: 15px; font-weight: 800; color: var(--slate-800);
          font-family: 'Playfair Display', serif; margin: 0 0 6px;
          text-align: center;
        }
        .fb-room-select {
          width: 100%; padding: 4px 6px; border-radius: 6px;
          border: 1px solid var(--slate-300); background: white;
          font-size: 10px; font-family: 'DM Sans', sans-serif;
          color: var(--slate-700); outline: none; cursor: pointer;
        }
        .fb-exception-dot {
          position: absolute; top: 6px; right: 6px;
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--gold-500);
        }
      `}</style>
    </div>
  )
}
