'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Wrench, Plus, X, Pencil } from 'lucide-react'

type Ticket = {
  id: string
  room_id: string | null
  issue_type: string
  description: string
  priority: string
  status: string
  resolved_at: string | null
  resolution_notes: string | null
  created_at: string
  room: { number: string } | null
  reporter: { full_name: string } | null
  assignee: { full_name: string } | null
  assigned_to: string | null
}

type Staff = { id: string; full_name: string }
type Room = { id: string; number: string }

const PRIORITY_CONFIG: Record<string, { color: string; bg: string }> = {
  low:    { color: '#475569', bg: '#f1f5f9' },
  medium: { color: '#92400e', bg: '#fef3c7' },
  urgent: { color: '#991b1b', bg: '#fee2e2' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open:        { label: 'Open',        color: '#991b1b', bg: '#fee2e2' },
  in_progress: { label: 'In Progress', color: '#1e40af', bg: '#dbeafe' },
  resolved:    { label: 'Resolved',    color: '#065f46', bg: '#d1fae5' },
  verified:    { label: 'Verified',    color: '#475569', bg: '#f1f5f9' },
}

const ISSUE_TYPES = ['electrical', 'plumbing', 'ac', 'furniture', 'structural', 'appliance', 'internet', 'other']

export default function MaintenancePage() {
  const supabase = createClient()
  const [hotelId, setHotelId] = useState<string | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null)
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')

  const [issueType, setIssueType] = useState('electrical')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [roomId, setRoomId] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('hotel_id, id').eq('id', user.id).single()
    if (!profile) return
    setHotelId(profile.hotel_id)

    const [{ data: t }, { data: r }, { data: s }] = await Promise.all([
      supabase.from('maintenance_tickets').select(`
        id, room_id, issue_type, description, priority, status,
        resolved_at, resolution_notes, created_at, assigned_to,
        room:rooms(number),
        reporter:profiles!reported_by(full_name),
        assignee:profiles!assigned_to(full_name)
      `).eq('hotel_id', profile.hotel_id).order('created_at', { ascending: false }),
      supabase.from('rooms').select('id, number').eq('hotel_id', profile.hotel_id).eq('is_active', true).order('number'),
      supabase.from('profiles').select('id, full_name').eq('hotel_id', profile.hotel_id).eq('is_active', true)
    ])

    setTickets((t as unknown as Ticket[]) ?? [])
    setRooms(r ?? [])
    setStaff(s ?? [])
    setLoading(false)
  }

  function openAdd() {
    setEditingTicket(null)
    setIssueType('electrical'); setDescription(''); setPriority('medium')
    setRoomId(''); setAssignedTo(''); setResolutionNotes('')
    setShowModal(true)
  }

  function openEdit(ticket: Ticket) {
    setEditingTicket(ticket)
    setIssueType(ticket.issue_type); setDescription(ticket.description)
    setPriority(ticket.priority); setRoomId(ticket.room_id ?? '')
    setAssignedTo(ticket.assigned_to ?? ''); setResolutionNotes(ticket.resolution_notes ?? '')
    setShowModal(true)
  }

  async function saveTicket() {
    if (!hotelId || !description) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    const payload = {
      hotel_id: hotelId,
      room_id: roomId || null,
      issue_type: issueType,
      description,
      priority,
      assigned_to: assignedTo || null,
      resolution_notes: resolutionNotes || null,
    }

    if (editingTicket) {
      await supabase.from('maintenance_tickets').update(payload).eq('id', editingTicket.id)
    } else {
      await supabase.from('maintenance_tickets').insert({ ...payload, status: 'open', reported_by: user?.id })
    }

    setShowModal(false)
    await loadData()
    setSaving(false)
  }

  async function updateStatus(id: string, newStatus: string) {
    const updates: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'resolved') updates.resolved_at = new Date().toISOString()
    await supabase.from('maintenance_tickets').update(updates).eq('id', id)
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t))
    setSelected(prev => prev?.id === id ? { ...prev, status: newStatus } : prev)
  }

  async function deleteTicket(id: string) {
    await supabase.from('maintenance_tickets').delete().eq('id', id)
    setTickets(prev => prev.filter(t => t.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  const filtered = tickets.filter(t => statusFilter === 'all' || t.status === statusFilter)

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>

  return (
    <div className="mt-root">
      <div className="mt-header">
        <div>
          <h2 className="mt-title">Maintenance</h2>
          <p className="mt-sub">{tickets.filter(t => t.status === 'open').length} open · {tickets.filter(t => t.status === 'in_progress').length} in progress</p>
        </div>
        <button className="mt-new-btn" onClick={openAdd}><Plus size={15} /> Log Issue</button>
      </div>

      <div className="mt-stats">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className="mt-stat">
            <p className="mt-stat-num" style={{ color: cfg.color }}>{tickets.filter(t => t.status === key).length}</p>
            <p className="mt-stat-label">{cfg.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-filters">
        {['all', ...Object.keys(STATUS_CONFIG)].map(s => (
          <button key={s} className="mt-filter-btn" data-active={statusFilter === s} onClick={() => setStatusFilter(s)}>
            {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label}
          </button>
        ))}
      </div>

      <div className="mt-body">
        <div className="mt-list">
          {filtered.length === 0 ? (
            <div className="mt-empty"><Wrench size={40} style={{ color: 'var(--slate-300)' }} /><p>No maintenance tickets</p></div>
          ) : (
            filtered.map(t => {
              const pcfg = PRIORITY_CONFIG[t.priority] ?? PRIORITY_CONFIG.medium
              const scfg = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.open
              return (
                <button key={t.id} className="mt-row" data-active={selected?.id === t.id} onClick={() => setSelected(selected?.id === t.id ? null : t)}>
                  <div className="mt-row-left">
                    <div className="mt-row-top">
                      <span className="mt-issue-type">{t.issue_type.replace('_', ' ')}</span>
                      <span className="mt-priority" style={{ color: pcfg.color, background: pcfg.bg }}>{t.priority}</span>
                    </div>
                    <p className="mt-desc">{t.description}</p>
                    <p className="mt-meta">
                      {t.room ? `Room ${t.room.number}` : 'General'} · {new Date(t.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                      {t.assignee && ` · ${t.assignee.full_name}`}
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                    <span className="mt-status" style={{ color: scfg.color, background: scfg.bg }}>{scfg.label}</span>
                    <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                      <button className="mt-icon-btn" onClick={() => openEdit(t)}><Pencil size={11} /></button>
                      <button className="mt-icon-btn danger" onClick={() => deleteTicket(t.id)}><X size={11} /></button>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {selected && (
          <div className="mt-panel">
            <div className="mt-panel-header">
              <h3 className="mt-panel-title">{selected.issue_type.replace('_', ' ')}</h3>
              <button className="mt-panel-close" onClick={() => setSelected(null)}><X size={15} /></button>
            </div>
            <p className="mt-panel-desc">{selected.description}</p>
            {selected.resolution_notes && (
              <div style={{ background: '#d1fae5', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#065f46', margin: '0 0 4px' }}>Resolution Notes</p>
                <p style={{ fontSize: 13, color: '#065f46', margin: 0 }}>{selected.resolution_notes}</p>
              </div>
            )}
            <div className="mt-panel-meta">
              {selected.room && <p>Room {selected.room.number}</p>}
              {selected.reporter && <p>Reported by: {selected.reporter.full_name}</p>}
              {selected.assignee && <p>Assigned to: {selected.assignee.full_name}</p>}
              <p>Priority: <span style={{ color: PRIORITY_CONFIG[selected.priority]?.color, fontWeight: 600 }}>{selected.priority}</span></p>
              <p>Created: {new Date(selected.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            </div>
            <p className="mt-panel-label">Update Status</p>
            <div className="mt-status-grid">
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <button key={key} className="mt-status-btn" data-active={selected.status === key}
                  style={{ color: cfg.color, background: selected.status === key ? cfg.bg : 'white', borderColor: selected.status === key ? cfg.color : 'var(--slate-200)' }}
                  onClick={() => updateStatus(selected.id, key)}>
                  {cfg.label}
                </button>
              ))}
            </div>
            <button className="mt-edit-btn" onClick={() => openEdit(selected)}>
              <Pencil size={13} /> Edit Ticket
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingTicket ? 'Edit Ticket' : 'Log Maintenance Issue'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="modal-field">
                <label>Issue Type</label>
                <select value={issueType} onChange={e => setIssueType(e.target.value)}>
                  {ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="modal-field">
                <label>Room (optional)</label>
                <select value={roomId} onChange={e => setRoomId(e.target.value)}>
                  <option value="">General / Not room-specific</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>Room {r.number}</option>)}
                </select>
              </div>
              <div className="modal-field">
                <label>Description *</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Describe the issue in detail..." style={{ padding: '10px 12px', border: '1px solid var(--slate-200)', borderRadius: 8, fontSize: 14, fontFamily: 'DM Sans, sans-serif', outline: 'none', resize: 'vertical' }} />
              </div>
              <div className="modal-field">
                <label>Priority</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['low', 'medium', 'urgent'].map(p => (
                    <button key={p} onClick={() => setPriority(p)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1.5px solid ${priority === p ? PRIORITY_CONFIG[p].color : 'var(--slate-200)'}`, background: priority === p ? PRIORITY_CONFIG[p].bg : 'white', color: priority === p ? PRIORITY_CONFIG[p].color : 'var(--slate-500)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', textTransform: 'capitalize' }}>{p}</button>
                  ))}
                </div>
              </div>
              <div className="modal-field">
                <label>Assign To</label>
                <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                  <option value="">Unassigned</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </div>
              {editingTicket && (
                <div className="modal-field">
                  <label>Resolution Notes</label>
                  <textarea value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} rows={2} placeholder="What was done to resolve this issue..." style={{ padding: '10px 12px', border: '1px solid var(--slate-200)', borderRadius: 8, fontSize: 14, fontFamily: 'DM Sans, sans-serif', outline: 'none', resize: 'vertical' }} />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="modal-save" onClick={saveTicket} disabled={saving || !description}>{saving ? 'Saving...' : editingTicket ? 'Save Changes' : 'Log Issue'}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .mt-root { max-width: 1100px; margin: 0 auto; }
        .mt-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; gap: 16px; flex-wrap: wrap; }
        .mt-title { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .mt-sub { font-size: 13px; color: var(--text-muted); margin: 4px 0 0; }
        .mt-new-btn { display: flex; align-items: center; gap: 6px; padding: 10px 18px; background: var(--navy-800); color: white; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: none; border-radius: 8px; cursor: pointer; }
        .mt-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 20px; }
        .mt-stat { background: white; border: 1px solid var(--slate-200); border-radius: 12px; padding: 14px; text-align: center; }
        .mt-stat-num { font-size: 24px; font-weight: 800; margin: 0; }
        .mt-stat-label { font-size: 11px; color: var(--text-muted); margin: 4px 0 0; }
        .mt-filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
        .mt-filter-btn { padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1px solid var(--slate-200); background: white; color: var(--slate-500); cursor: pointer; }
        .mt-filter-btn[data-active="true"] { background: var(--navy-800); border-color: var(--navy-800); color: white; }
        .mt-body { display: flex; gap: 20px; }
        .mt-list { flex: 1; min-width: 0; background: white; border: 1px solid var(--slate-200); border-radius: 14px; overflow: hidden; }
        .mt-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 60px; color: var(--text-muted); }
        .mt-empty p { font-size: 14px; font-weight: 600; margin: 0; }
        .mt-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 18px; border-bottom: 1px solid var(--slate-100); background: white; cursor: pointer; text-align: left; width: 100%; transition: background 0.1s; font-family: 'DM Sans', sans-serif; }
        .mt-row:hover { background: var(--slate-100); }
        .mt-row[data-active="true"] { background: var(--gold-100); border-left: 3px solid var(--gold-500); }
        .mt-row-left { flex: 1; min-width: 0; }
        .mt-row-top { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .mt-issue-type { font-size: 14px; font-weight: 600; color: var(--slate-800); text-transform: capitalize; }
        .mt-priority { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; }
        .mt-desc { font-size: 13px; color: var(--slate-600); margin: 0 0 4px; }
        .mt-meta { font-size: 11px; color: var(--text-muted); margin: 0; }
        .mt-status { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; flex-shrink: 0; }
        .mt-icon-btn { width: 24px; height: 24px; border-radius: 6px; border: 1px solid var(--slate-200); background: white; color: var(--slate-400); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .mt-icon-btn:hover { background: var(--slate-100); }
        .mt-icon-btn.danger:hover { background: #fee2e2; color: #991b1b; }
        .mt-panel { width: 300px; flex-shrink: 0; background: white; border: 1px solid var(--slate-200); border-radius: 14px; padding: 20px; position: sticky; top: 80px; }
        @media (max-width: 900px) { .mt-body { flex-direction: column; } .mt-panel { width: 100%; position: static; } }
        .mt-panel-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
        .mt-panel-title { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 700; color: var(--slate-800); margin: 0; text-transform: capitalize; }
        .mt-panel-close { width: 28px; height: 28px; border-radius: 8px; background: var(--slate-100); border: none; color: var(--slate-400); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .mt-panel-desc { font-size: 13px; color: var(--slate-600); margin: 0 0 12px; line-height: 1.5; }
        .mt-panel-meta { display: flex; flex-direction: column; gap: 4px; margin-bottom: 16px; font-size: 12px; color: var(--slate-500); }
        .mt-panel-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin: 0 0 8px; }
        .mt-status-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 12px; }
        .mt-status-btn { padding: 8px; border-radius: 8px; font-size: 11px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1.5px solid; cursor: pointer; }
        .mt-edit-btn { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 9px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1px solid var(--slate-200); background: white; color: var(--slate-600); cursor: pointer; }
        .mt-edit-btn:hover { background: var(--slate-100); }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .modal-card { background: white; border-radius: 16px; width: 100%; max-width: 480px; box-shadow: 0 24px 48px rgba(0,0,0,0.2); overflow: hidden; }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--slate-200); }
        .modal-header h3 { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .modal-close { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--slate-200); background: white; color: var(--slate-400); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; max-height: 60vh; overflow-y: auto; }
        .modal-field { display: flex; flex-direction: column; gap: 6px; }
        .modal-field label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--slate-500); }
        .modal-field input, .modal-field select { padding: 10px 12px; border: 1px solid var(--slate-200); border-radius: 8px; font-size: 14px; font-family: 'DM Sans', sans-serif; color: var(--slate-800); outline: none; }
        .modal-footer { display: flex; gap: 10px; justify-content: flex-end; padding: 16px 24px; border-top: 1px solid var(--slate-200); }
        .modal-cancel { padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1px solid var(--slate-200); background: white; color: var(--slate-600); cursor: pointer; }
        .modal-save { padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; background: var(--navy-800); color: white; border: none; cursor: pointer; }
        .modal-save:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  )
}
