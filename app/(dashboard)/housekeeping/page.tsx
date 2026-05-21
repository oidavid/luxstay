'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Sparkles, Check, Clock, X, Plus, Pencil, User } from 'lucide-react'

type Task = {
  id: string
  room_id: string
  task_type: string
  status: string
  priority: number
  notes: string | null
  completed_at: string | null
  assigned_to: string | null
  room: { number: string; floor: number } | null
  assignee: { full_name: string } | null
}

type Staff = { id: string; full_name: string }
type Room = { id: string; number: string; floor: number }

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending:     { label: 'Pending',     color: '#92400e', bg: '#fef3c7', icon: Clock },
  in_progress: { label: 'In Progress', color: '#1e40af', bg: '#dbeafe', icon: Clock },
  completed:   { label: 'Completed',   color: '#065f46', bg: '#d1fae5', icon: Check },
  inspected:   { label: 'Inspected',   color: '#475569', bg: '#f1f5f9', icon: Check },
}

const TASK_TYPES = ['checkout_clean', 'stayover_clean', 'deep_clean', 'turndown', 'inspection', 'other']

export default function HousekeepingPage() {
  const supabase = createClient()
  const [hotelId, setHotelId] = useState<string | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [updating, setUpdating] = useState<string | null>(null)

  // Add/Edit task modal
  const [showModal, setShowModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [taskRoomId, setTaskRoomId] = useState('')
  const [taskType, setTaskType] = useState('checkout_clean')
  const [taskPriority, setTaskPriority] = useState(2)
  const [taskNotes, setTaskNotes] = useState('')
  const [taskAssignee, setTaskAssignee] = useState('')
  const [savingTask, setSavingTask] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('hotel_id').eq('id', user.id).single()
    if (!profile) return
    setHotelId(profile.hotel_id)

    const [{ data: t }, { data: s }, { data: r }] = await Promise.all([
      supabase.from('housekeeping_tasks').select(`
        id, room_id, task_type, status, priority, notes, completed_at, assigned_to,
        room:rooms(number, floor),
        assignee:profiles!assigned_to(full_name)
      `).eq('hotel_id', profile.hotel_id).order('priority').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name').eq('hotel_id', profile.hotel_id).eq('is_active', true),
      supabase.from('rooms').select('id, number, floor').eq('hotel_id', profile.hotel_id).eq('is_active', true).order('number')
    ])

    setTasks((t as unknown as Task[]) ?? [])
    setStaff(s ?? [])
    setRooms(r ?? [])
    setLoading(false)
  }

  async function updateStatus(id: string, newStatus: string) {
    setUpdating(id)
    const updates: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'completed') updates.completed_at = new Date().toISOString()

    await supabase.from('housekeeping_tasks').update(updates).eq('id', id)

    const task = tasks.find(t => t.id === id)
    if (task) {
      if (newStatus === 'completed') await supabase.from('rooms').update({ status: 'clean' }).eq('id', task.room_id)
      if (newStatus === 'inspected') await supabase.from('rooms').update({ status: 'available' }).eq('id', task.room_id)
    }

    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t))
    setUpdating(null)
  }

  async function generateCheckoutTasks() {
    if (!hotelId) return
    const { data: dirtyRooms } = await supabase.from('rooms').select('id').eq('hotel_id', hotelId).eq('status', 'dirty').eq('is_active', true)
    if (!dirtyRooms?.length) { alert('No dirty rooms found. Rooms marked dirty after checkout will appear here.'); return }
    await supabase.from('housekeeping_tasks').insert(dirtyRooms.map(r => ({ hotel_id: hotelId, room_id: r.id, task_type: 'checkout_clean', status: 'pending', priority: 1 })))
    await loadData()
  }

  function openAddTask() {
    setEditingTask(null)
    setTaskRoomId(''); setTaskType('checkout_clean'); setTaskPriority(2); setTaskNotes(''); setTaskAssignee('')
    setShowModal(true)
  }

  function openEditTask(task: Task) {
    setEditingTask(task)
    setTaskRoomId(task.room_id)
    setTaskType(task.task_type)
    setTaskPriority(task.priority)
    setTaskNotes(task.notes ?? '')
    setTaskAssignee(task.assigned_to ?? '')
    setShowModal(true)
  }

  async function saveTask() {
    if (!hotelId || !taskRoomId) return
    setSavingTask(true)
    const payload = {
      hotel_id: hotelId,
      room_id: taskRoomId,
      task_type: taskType,
      priority: taskPriority,
      notes: taskNotes || null,
      assigned_to: taskAssignee || null,
      status: editingTask?.status ?? 'pending',
    }

    if (editingTask) {
      await supabase.from('housekeeping_tasks').update(payload).eq('id', editingTask.id)
    } else {
      await supabase.from('housekeeping_tasks').insert(payload)
    }

    setShowModal(false)
    await loadData()
    setSavingTask(false)
  }

  async function deleteTask(id: string) {
    await supabase.from('housekeeping_tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const filtered = tasks.filter(t => statusFilter === 'all' || t.status === statusFilter)

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading housekeeping...</div>

  return (
    <div className="hk-root">
      <div className="hk-header">
        <div>
          <h2 className="hk-title">Housekeeping</h2>
          <p className="hk-sub">
            {tasks.filter(t => t.status === 'pending').length} pending ·
            {tasks.filter(t => t.status === 'in_progress').length} in progress ·
            {tasks.filter(t => t.status === 'completed').length} completed
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="hk-btn-outline" onClick={openAddTask}><Plus size={14} /> Add Task</button>
          <button className="hk-create-btn" onClick={generateCheckoutTasks}><Sparkles size={14} /> Generate Checkout Tasks</button>
        </div>
      </div>

      <div className="hk-stats">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon
          const count = tasks.filter(t => t.status === key).length
          return (
            <div key={key} className="hk-stat" style={{ borderColor: count > 0 ? cfg.color + '60' : 'var(--slate-200)', background: count > 0 ? cfg.bg : 'white' }}>
              <div className="hk-stat-top">
                <Icon size={16} style={{ color: cfg.color }} />
                <span className="hk-stat-num" style={{ color: cfg.color }}>{count}</span>
              </div>
              <p className="hk-stat-label">{cfg.label}</p>
            </div>
          )
        })}
      </div>

      <div className="hk-filters">
        {['all', ...Object.keys(STATUS_CONFIG)].map(s => (
          <button key={s} className="hk-filter-btn" data-active={statusFilter === s} onClick={() => setStatusFilter(s)}>
            {s === 'all' ? 'All Tasks' : STATUS_CONFIG[s]?.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="hk-empty">
          <Sparkles size={40} style={{ color: 'var(--slate-300)' }} />
          <p>No housekeeping tasks</p>
          <span>Generate checkout tasks or add a task manually above</span>
        </div>
      ) : (
        <div className="hk-grid">
          {filtered.map(task => {
            const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending
            const Icon = cfg.icon
            return (
              <div key={task.id} className="hk-card" data-status={task.status}>
                <div className="hk-card-header">
                  <div className="hk-room-badge">Room {task.room?.number ?? '?'}</div>
                  <span className="hk-floor">Floor {task.room?.floor ?? '?'}</span>
                  {task.priority === 1 && <span className="hk-urgent">Priority</span>}
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    <button className="hk-icon-btn" onClick={() => openEditTask(task)} title="Edit task"><Pencil size={11} /></button>
                    <button className="hk-icon-btn danger" onClick={() => deleteTask(task.id)} title="Delete task"><X size={11} /></button>
                  </div>
                </div>
                <p className="hk-task-type">{task.task_type.replace(/_/g, ' ')}</p>
                {task.assignee && (
                  <div className="hk-assignee"><User size={11} /><span>{task.assignee.full_name}</span></div>
                )}
                {task.notes && <p className="hk-notes">{task.notes}</p>}
                <div className="hk-card-footer">
                  <span className="hk-status-badge" style={{ color: cfg.color, background: cfg.bg }}>
                    <Icon size={10} /> {cfg.label}
                  </span>
                  <div className="hk-actions">
                    {task.status === 'pending' && <button className="hk-btn" onClick={() => updateStatus(task.id, 'in_progress')} disabled={updating === task.id}>Start</button>}
                    {task.status === 'in_progress' && <button className="hk-btn primary" onClick={() => updateStatus(task.id, 'completed')} disabled={updating === task.id}>Done</button>}
                    {task.status === 'completed' && <button className="hk-btn primary" onClick={() => updateStatus(task.id, 'inspected')} disabled={updating === task.id}>Inspected ✓</button>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingTask ? 'Edit Task' : 'Add Housekeeping Task'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="modal-field">
                <label>Room *</label>
                <select value={taskRoomId} onChange={e => setTaskRoomId(e.target.value)}>
                  <option value="">Select room...</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>Room {r.number} (Floor {r.floor})</option>)}
                </select>
              </div>
              <div className="modal-field">
                <label>Task Type</label>
                <select value={taskType} onChange={e => setTaskType(e.target.value)}>
                  {TASK_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="modal-field">
                <label>Priority</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 2, 3].map(p => (
                    <button key={p} onClick={() => setTaskPriority(p)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1.5px solid ${taskPriority === p ? 'var(--navy-800)' : 'var(--slate-200)'}`, background: taskPriority === p ? 'var(--navy-800)' : 'white', color: taskPriority === p ? 'white' : 'var(--slate-500)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                      {p === 1 ? 'High' : p === 2 ? 'Normal' : 'Low'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="modal-field">
                <label>Assign To</label>
                <select value={taskAssignee} onChange={e => setTaskAssignee(e.target.value)}>
                  <option value="">Unassigned</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </div>
              <div className="modal-field">
                <label>Notes</label>
                <textarea value={taskNotes} onChange={e => setTaskNotes(e.target.value)} rows={2} placeholder="Special instructions..." style={{ padding: '10px 12px', border: '1px solid var(--slate-200)', borderRadius: 8, fontSize: 14, fontFamily: 'DM Sans, sans-serif', outline: 'none', resize: 'vertical' }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="modal-save" onClick={saveTask} disabled={savingTask || !taskRoomId}>{savingTask ? 'Saving...' : editingTask ? 'Save Changes' : 'Create Task'}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .hk-root { max-width: 1100px; margin: 0 auto; }
        .hk-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; gap: 16px; flex-wrap: wrap; }
        .hk-title { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .hk-sub { font-size: 13px; color: var(--text-muted); margin: 4px 0 0; }
        .hk-create-btn { display: flex; align-items: center; gap: 6px; padding: 10px 18px; background: var(--navy-800); color: white; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: none; border-radius: 8px; cursor: pointer; }
        .hk-btn-outline { display: flex; align-items: center; gap: 6px; padding: 10px 16px; background: white; color: var(--slate-600); font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1px solid var(--slate-200); border-radius: 8px; cursor: pointer; }
        .hk-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 20px; }
        @media (max-width: 640px) { .hk-stats { grid-template-columns: repeat(2,1fr); } }
        .hk-stat { border: 1px solid var(--slate-200); border-radius: 12px; padding: 14px; transition: all 0.15s; }
        .hk-stat-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
        .hk-stat-num { font-size: 24px; font-weight: 800; }
        .hk-stat-label { font-size: 12px; color: var(--slate-600); margin: 0; font-weight: 600; }
        .hk-filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; }
        .hk-filter-btn { padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1px solid var(--slate-200); background: white; color: var(--slate-500); cursor: pointer; }
        .hk-filter-btn[data-active="true"] { background: var(--navy-800); border-color: var(--navy-800); color: white; }
        .hk-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 60px; text-align: center; color: var(--text-muted); }
        .hk-empty p { font-size: 16px; font-weight: 600; margin: 0; }
        .hk-empty span { font-size: 13px; }
        .hk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
        .hk-card { background: white; border: 1px solid var(--slate-200); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
        .hk-card[data-status="completed"] { background: #f0fdf4; border-color: #6ee7b7; }
        .hk-card[data-status="inspected"] { opacity: 0.6; }
        .hk-card-header { display: flex; align-items: center; gap: 8px; }
        .hk-room-badge { font-size: 15px; font-weight: 800; color: var(--slate-800); font-family: 'Playfair Display', serif; }
        .hk-floor { font-size: 11px; color: var(--text-muted); }
        .hk-urgent { font-size: 10px; font-weight: 700; background: #fee2e2; color: #991b1b; padding: 2px 7px; border-radius: 20px; }
        .hk-icon-btn { width: 22px; height: 22px; border-radius: 6px; border: 1px solid var(--slate-200); background: white; color: var(--slate-400); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.12s; }
        .hk-icon-btn:hover { background: var(--slate-100); }
        .hk-icon-btn.danger:hover { background: #fee2e2; color: #991b1b; }
        .hk-task-type { font-size: 13px; font-weight: 600; color: var(--slate-700); margin: 0; text-transform: capitalize; }
        .hk-assignee { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text-muted); }
        .hk-notes { font-size: 12px; color: var(--slate-500); margin: 0; }
        .hk-card-footer { display: flex; align-items: center; justify-content: space-between; margin-top: auto; }
        .hk-status-badge { display: flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 20px; }
        .hk-actions { display: flex; gap: 6px; }
        .hk-btn { padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1px solid var(--slate-200); background: white; color: var(--slate-600); cursor: pointer; }
        .hk-btn.primary { background: var(--navy-800); border-color: var(--navy-800); color: white; }
        .hk-btn:disabled { opacity: 0.5; cursor: not-allowed; }
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
