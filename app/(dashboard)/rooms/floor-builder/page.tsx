'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Check, Layers, ArrowLeft, Copy, AlertTriangle, CheckCircle } from 'lucide-react'
import Link from 'next/link'

type RoomType = { id: string; name: string; base_rate: number }
type RoomConfig = { number: string; room_type_id: string; is_exception: boolean }
type SaveResult = { floor: number; created: number; skipped: number }

export default function FloorBuilderPage() {
  const supabase = createClient()
  const [hotelId, setHotelId] = useState<string|null>(null)
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [results, setResults] = useState<SaveResult[]>([])

  const [floorNumber, setFloorNumber] = useState(1)
  const [prefix, setPrefix] = useState('1')
  const [roomCount, setRoomCount] = useState(10)
  const [startNumber, setStartNumber] = useState(1)
  const [defaultTypeId, setDefaultTypeId] = useState('')
  const [rooms, setRooms] = useState<RoomConfig[]>([])
  const [generated, setGenerated] = useState(false)

  // Replicate floors
  const [replicateFloors, setReplicateFloors] = useState(false)
  const [floorFrom, setFloorFrom] = useState(2)
  const [floorTo, setFloorTo] = useState(5)
  const [autoPrefix, setAutoPrefix] = useState(true)

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

  useEffect(() => {
    setPrefix(String(floorNumber))
    setFloorFrom(floorNumber + 1)
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
    setResults([])
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
    setResults([])

    const floorsToCreate: number[] = [floorNumber]
    if (replicateFloors && floorTo >= floorFrom) {
      for (let f = floorFrom; f <= floorTo; f++) floorsToCreate.push(f)
    }

    const allResults: SaveResult[] = []

    for (const floor of floorsToCreate) {
      // Check for existing rooms on this floor
      const { data: existing } = await supabase
        .from('rooms')
        .select('id')
        .eq('hotel_id', hotelId)
        .eq('floor', floor)
        .eq('is_active', true)

      if (existing && existing.length > 0) {
        allResults.push({ floor, created: 0, skipped: existing.length })
        continue
      }

      // Build room numbers for this floor
      const payload = rooms.map((r, i) => {
        let roomNum = r.number
        if (floor !== floorNumber && autoPrefix) {
          const num = startNumber + i
          roomNum = String(floor) + (num < 10 ? '0' + num : String(num))
        }
        return {
          hotel_id: hotelId,
          room_type_id: r.room_type_id,
          number: roomNum,
          floor,
          status: 'available',
          is_active: true,
        }
      })

      const { error } = await supabase.from('rooms').insert(payload)
      allResults.push({ floor, created: error ? 0 : payload.length, skipped: 0 })
    }

    setResults(allResults)
    setSaving(false)
    setGenerated(false)
    setRooms([])
  }

  const totalCreated = results.reduce((sum, r) => sum + r.created, 0)
  const totalSkipped = results.filter(r => r.skipped > 0).length

  if (loading) return <div style={{padding:60,textAlign:'center',color:'var(--text-muted)'}}>Loading...</div>

  return (
    <div className="fb-root">
      <div className="fb-header">
        <Link href="/rooms/setup" className="fb-back">
          <ArrowLeft size={15} /> Back to Room Setup
        </Link>
        <h2 className="fb-title">Floor Builder</h2>
        <p className="fb-sub">Design an entire floor and optionally replicate it across multiple floors in one step</p>
      </div>

      {/* Success / error results */}
      {results.length > 0 && (
        <div className="fb-results">
          <div className="fb-results-header">
            {totalCreated > 0
              ? <><CheckCircle size={18} style={{color:'#10b981'}} /> <strong>{totalCreated} rooms created successfully</strong></>
              : <><AlertTriangle size={18} style={{color:'#f59e0b'}} /> <strong>No new rooms created</strong></>
            }
          </div>
          <div className="fb-results-list">
            {results.map(r => (
              <div key={r.floor} className="fb-result-row" data-status={r.skipped > 0 ? 'skipped' : 'created'}>
                {r.skipped > 0
                  ? <><AlertTriangle size={13} /> Floor {r.floor} — skipped ({r.skipped} rooms already exist)</>
                  : <><Check size={13} /> Floor {r.floor} — {r.created} rooms created</>
                }
              </div>
            ))}
          </div>
          <div className="fb-results-actions">
            <Link href="/rooms" className="fb-view-rooms-btn">View Room Grid →</Link>
            <button className="fb-build-another-btn" onClick={() => { setResults([]); setGenerated(false); }}>
              Build Another Floor
            </button>
          </div>
        </div>
      )}

      {/* Config */}
      {results.length === 0 && (
        <>
          <div className="fb-config-card">
            <h3 className="fb-section-title">Floor Configuration</h3>
            <div className="fb-config-grid">
              <div className="fb-field">
                <label>Floor Number</label>
                <input type="number" min={0} max={200} value={floorNumber} onChange={e => setFloorNumber(Number(e.target.value))} />
              </div>
              <div className="fb-field">
                <label>Room Number Prefix</label>
                <input value={prefix} onChange={e => setPrefix(e.target.value)} placeholder="e.g. 5 → 501, 502..." />
              </div>
              <div className="fb-field">
                <label>Starting Room Number</label>
                <input type="number" min={1} value={startNumber} onChange={e => setStartNumber(Number(e.target.value))} />
              </div>
              <div className="fb-field">
                <label>Number of Rooms</label>
                <input type="number" min={1} max={200} value={roomCount} onChange={e => setRoomCount(Number(e.target.value))} />
              </div>
              <div className="fb-field fb-field-wide">
                <label>Default Room Type (for all rooms on this floor)</label>
                <select value={defaultTypeId} onChange={e => setDefaultTypeId(e.target.value)}>
                  <option value="">Select default type...</option>
                  {roomTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>

            {/* Replicate toggle */}
            <div className="fb-replicate-section">
              <label className="fb-replicate-toggle">
                <input type="checkbox" checked={replicateFloors} onChange={e => setReplicateFloors(e.target.checked)} />
                <Copy size={14} />
                <span>Replicate this floor layout to additional floors</span>
              </label>

              {replicateFloors && (
                <div className="fb-replicate-config">
                  <div className="fb-field">
                    <label>From Floor</label>
                    <input type="number" min={floorNumber + 1} max={200} value={floorFrom} onChange={e => setFloorFrom(Number(e.target.value))} />
                  </div>
                  <div className="fb-field">
                    <label>To Floor</label>
                    <input type="number" min={floorFrom} max={200} value={floorTo} onChange={e => setFloorTo(Number(e.target.value))} />
                  </div>
                  <div className="fb-replicate-note">
                    <input type="checkbox" checked={autoPrefix} onChange={e => setAutoPrefix(e.target.checked)} id="autoprefix" />
                    <label htmlFor="autoprefix">Auto-number rooms per floor (e.g. Floor 6 → 601, 602...)</label>
                  </div>
                  <div className="fb-replicate-preview">
                    Will create Floor {floorNumber}{replicateFloors ? ` + Floors ${floorFrom}–${floorTo}` : ''} = <strong>{(replicateFloors ? (floorTo - floorFrom + 2) : 1) * roomCount} total rooms</strong>
                  </div>
                </div>
              )}
            </div>

            <button className="fb-generate-btn" onClick={generateFloor} disabled={!defaultTypeId}>
              <Layers size={15} />
              Preview Floor {floorNumber} Layout
            </button>
          </div>

          {/* Preview */}
          {generated && rooms.length > 0 && (
            <div className="fb-preview">
              <div className="fb-preview-header">
                <div>
                  <h3 className="fb-preview-title">Floor {floorNumber} — {rooms.length} Rooms</h3>
                  <p className="fb-preview-sub">
                    Click any room dropdown to change its type. Gold rooms have custom types.
                    {replicateFloors && ` This layout will also be applied to Floors ${floorFrom}–${floorTo}.`}
                  </p>
                </div>
                <div className="fb-preview-actions">
                  <button className="fb-reset-btn" onClick={() => { setGenerated(false); setRooms([]) }}>
                    <X size={13} /> Reset
                  </button>
                  <button className="fb-save-btn" onClick={saveFloor} disabled={saving}>
                    {saving
                      ? 'Creating rooms...'
                      : <><Plus size={13} /> Create {replicateFloors ? (floorTo - floorFrom + 2) * rooms.length : rooms.length} Rooms</>
                    }
                  </button>
                </div>
              </div>

              <div className="fb-type-summary">
                {roomTypes.map(t => {
                  const count = rooms.filter(r => r.room_type_id === t.id).length
                  if (!count) return null
                  return <span key={t.id} className="fb-type-badge">{t.name}: {count}</span>
                })}
              </div>

              <div className="fb-room-grid">
                {rooms.map((room, index) => (
                  <div key={room.number} className="fb-room-cell" data-exception={room.is_exception}>
                    <p className="fb-room-num">{room.number}</p>
                    <select className="fb-room-select" value={room.room_type_id} onChange={e => setRoomType(index, e.target.value)}>
                      {roomTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    {room.is_exception && <span className="fb-exception-dot" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        .fb-root { max-width: 900px; margin: 0 auto; }
        .fb-header { margin-bottom: 24px; }
        .fb-back {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12px; font-weight: 600; color: var(--slate-500);
          text-decoration: none; margin-bottom: 12px; transition: color 0.12s;
        }
        .fb-back:hover { color: var(--navy-800); }
        .fb-title { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .fb-sub { font-size: 13px; color: var(--text-muted); margin: 4px 0 0; line-height: 1.5; }

        /* Results */
        .fb-results {
          background: white; border: 1px solid var(--slate-200); border-radius: 16px;
          padding: 24px; margin-bottom: 24px;
        }
        .fb-results-header {
          display: flex; align-items: center; gap: 10px;
          font-size: 16px; color: var(--slate-800); margin-bottom: 16px;
        }
        .fb-results-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
        .fb-result-row {
          display: flex; align-items: center; gap: 8px;
          font-size: 13px; padding: 8px 12px; border-radius: 8px;
        }
        .fb-result-row[data-status="created"] { background: #d1fae5; color: #065f46; }
        .fb-result-row[data-status="skipped"] { background: #fef3c7; color: #92400e; }
        .fb-results-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .fb-view-rooms-btn {
          padding: 10px 20px; background: var(--navy-800); color: white;
          border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
        }
        .fb-build-another-btn {
          padding: 10px 20px; background: white; color: var(--slate-600);
          border: 1px solid var(--slate-200); border-radius: 8px;
          font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; cursor: pointer;
        }

        /* Config */
        .fb-config-card {
          background: white; border: 1px solid var(--slate-200);
          border-radius: 16px; padding: 24px; margin-bottom: 20px;
        }
        .fb-section-title { font-size: 14px; font-weight: 700; color: var(--slate-700); margin: 0 0 16px; }
        .fb-config-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
        @media (max-width: 640px) { .fb-config-grid { grid-template-columns: 1fr 1fr; } }
        .fb-field { display: flex; flex-direction: column; gap: 6px; }
        .fb-field-wide { grid-column: 1 / -1; }
        .fb-field label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--slate-500); }
        .fb-field input, .fb-field select {
          padding: 10px 12px; border: 1px solid var(--slate-200); border-radius: 8px;
          font-size: 14px; font-family: 'DM Sans', sans-serif; color: var(--slate-800); outline: none;
        }
        .fb-field input:focus, .fb-field select:focus { border-color: var(--gold-500); box-shadow: 0 0 0 3px rgba(201,168,76,0.1); }

        /* Replicate */
        .fb-replicate-section { margin-bottom: 20px; }
        .fb-replicate-toggle {
          display: flex; align-items: center; gap: 8px; cursor: pointer;
          font-size: 14px; font-weight: 600; color: var(--slate-700);
        }
        .fb-replicate-toggle input { width: 16px; height: 16px; accent-color: var(--navy-800); }
        .fb-replicate-config {
          margin-top: 16px; padding: 16px; background: var(--slate-100);
          border-radius: 10px; display: flex; flex-direction: column; gap: 12px;
        }
        .fb-replicate-note { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--slate-600); }
        .fb-replicate-note input { accent-color: var(--navy-800); }
        .fb-replicate-preview {
          font-size: 13px; color: var(--navy-800);
          background: var(--gold-100); border: 1px solid var(--gold-400);
          border-radius: 8px; padding: 10px 14px;
        }

        .fb-generate-btn {
          display: flex; align-items: center; gap: 8px;
          padding: 11px 24px; background: var(--navy-800); color: white;
          font-size: 14px; font-weight: 600; font-family: 'DM Sans', sans-serif;
          border: none; border-radius: 10px; cursor: pointer; transition: opacity 0.15s;
        }
        .fb-generate-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .fb-generate-btn:not(:disabled):hover { opacity: 0.85; }

        /* Preview */
        .fb-preview { background: white; border: 1px solid var(--slate-200); border-radius: 16px; padding: 24px; }
        .fb-preview-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; gap: 16px; flex-wrap: wrap; }
        .fb-preview-title { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .fb-preview-sub { font-size: 12px; color: var(--text-muted); margin: 4px 0 0; line-height: 1.5; }
        .fb-preview-actions { display: flex; gap: 8px; flex-shrink: 0; }
        .fb-reset-btn {
          display: flex; align-items: center; gap: 5px; padding: 8px 14px; border-radius: 8px;
          font-size: 12px; font-weight: 600; font-family: 'DM Sans', sans-serif;
          border: 1px solid var(--slate-200); background: white; color: var(--slate-500); cursor: pointer;
        }
        .fb-save-btn {
          display: flex; align-items: center; gap: 5px; padding: 9px 20px; border-radius: 8px;
          font-size: 13px; font-weight: 700; font-family: 'DM Sans', sans-serif;
          background: linear-gradient(135deg, var(--gold-500), #b8922e); color: white; border: none; cursor: pointer;
        }
        .fb-save-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .fb-type-summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
        .fb-type-badge { font-size: 12px; font-weight: 600; padding: 4px 12px; background: var(--slate-100); border-radius: 20px; color: var(--slate-600); }
        .fb-room-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px; }
        .fb-room-cell {
          position: relative; background: var(--slate-100); border: 2px solid var(--slate-200);
          border-radius: 10px; padding: 10px 8px 8px; transition: border-color 0.15s;
        }
        .fb-room-cell[data-exception="true"] { background: var(--gold-100); border-color: var(--gold-400); }
        .fb-room-num { font-size: 15px; font-weight: 800; color: var(--slate-800); font-family: 'Playfair Display', serif; margin: 0 0 6px; text-align: center; }
        .fb-room-select { width: 100%; padding: 4px 6px; border-radius: 6px; border: 1px solid var(--slate-300); background: white; font-size: 10px; font-family: 'DM Sans', sans-serif; color: var(--slate-700); outline: none; }
        .fb-exception-dot { position: absolute; top: 6px; right: 6px; width: 7px; height: 7px; border-radius: 50%; background: var(--gold-500); }
      `}</style>
    </div>
  )
}
