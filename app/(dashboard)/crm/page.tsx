'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, Send, Search, Phone, Mail } from 'lucide-react'

type Message = { id: string; direction: string; channel: string; content: string; status: string; created_at: string; is_automated: boolean; guest: { full_name: string; phone: string | null } | null }
type Guest = { id: string; full_name: string; phone: string | null; email: string | null }

export default function CRMPage() {
  const supabase = createClient()
  const [hotelId, setHotelId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [search, setSearch] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('hotel_id').eq('id', user.id).single()
    if (!profile) return
    setHotelId(profile.hotel_id)

    const [{ data: m }, { data: g }] = await Promise.all([
      supabase.from('guest_messages').select('id, direction, channel, content, status, created_at, is_automated, guest:guests(full_name, phone)').eq('hotel_id', profile.hotel_id).order('created_at', { ascending: false }).limit(100),
      supabase.from('guests').select('id, full_name, phone, email').eq('hotel_id', profile.hotel_id).order('full_name')
    ])

    setMessages((m as unknown as Message[]) ?? [])
    setGuests(g ?? [])
    setLoading(false)
  }

  async function sendMessage() {
    if (!hotelId || !selectedGuest || !newMessage.trim()) return
    setSending(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('guest_messages').insert({
      hotel_id: hotelId,
      guest_id: selectedGuest.id,
      direction: 'outbound',
      channel: 'whatsapp',
      content: newMessage,
      status: 'sent',
      sent_by: user?.id,
      is_automated: false,
    })
    setNewMessage('')
    await loadData()
    setSending(false)
  }

  const guestMessages = selectedGuest ? messages.filter(m => m.guest?.full_name === selectedGuest.full_name) : []
  const filteredGuests = guests.filter(g => !search || g.full_name.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading messages...</div>

  return (
    <div className="crm-root">
      <div className="crm-header">
        <h2 className="crm-title">Guest Messages</h2>
        <p className="crm-sub">{messages.length} messages · {guests.length} guests</p>
      </div>

      <div className="crm-body">
        {/* Guest list */}
        <div className="crm-guests">
          <div className="crm-search-wrap">
            <Search size={13} style={{ color: 'var(--slate-400)' }} />
            <input className="crm-search" placeholder="Search guests..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="crm-guest-list">
            {filteredGuests.map(g => {
              const lastMsg = messages.find(m => m.guest?.full_name === g.full_name)
              const unread = messages.filter(m => m.guest?.full_name === g.full_name && m.direction === 'inbound').length
              return (
                <button key={g.id} className="crm-guest-row" data-active={selectedGuest?.id === g.id} onClick={() => setSelectedGuest(g)}>
                  <div className="crm-guest-avatar">{g.full_name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}</div>
                  <div className="crm-guest-info">
                    <p className="crm-guest-name">{g.full_name}</p>
                    <p className="crm-guest-preview">{lastMsg?.content.slice(0, 40) ?? g.phone ?? 'No messages yet'}...</p>
                  </div>
                  {unread > 0 && <span className="crm-unread">{unread}</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Message thread */}
        <div className="crm-thread">
          {!selectedGuest ? (
            <div className="crm-empty">
              <MessageSquare size={40} style={{ color: 'var(--slate-300)' }} />
              <p>Select a guest to view messages</p>
            </div>
          ) : (
            <>
              <div className="crm-thread-header">
                <div className="crm-thread-avatar">{selectedGuest.full_name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}</div>
                <div>
                  <p className="crm-thread-name">{selectedGuest.full_name}</p>
                  <div className="crm-thread-contact">
                    {selectedGuest.phone && <span><Phone size={11} /> {selectedGuest.phone}</span>}
                    {selectedGuest.email && <span><Mail size={11} /> {selectedGuest.email}</span>}
                  </div>
                </div>
                {selectedGuest.phone && (
                  <a href={`https://wa.me/${selectedGuest.phone?.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="crm-wa-btn">
                    Open WhatsApp
                  </a>
                )}
              </div>

              <div className="crm-messages">
                {guestMessages.length === 0 ? (
                  <div className="crm-no-messages">No messages with this guest yet. Send the first message below.</div>
                ) : (
                  [...guestMessages].reverse().map(m => (
                    <div key={m.id} className={`crm-msg ${m.direction}`}>
                      <p className="crm-msg-content">{m.content}</p>
                      <p className="crm-msg-meta">
                        {new Date(m.created_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                        {m.is_automated && ' · automated'}
                        {' · '}{m.channel}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="crm-composer">
                <textarea
                  className="crm-input"
                  placeholder="Type a message... (this logs it — to actually send via WhatsApp, use the Open WhatsApp button above)"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  rows={3}
                  onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) sendMessage() }}
                />
                <button className="crm-send-btn" onClick={sendMessage} disabled={sending || !newMessage.trim()}>
                  <Send size={15} /> {sending ? 'Logging...' : 'Log Message'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        .crm-root { max-width: 1100px; margin: 0 auto; height: calc(100vh - 140px); display: flex; flex-direction: column; }
        .crm-header { margin-bottom: 16px; }
        .crm-title { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .crm-sub { font-size: 13px; color: var(--text-muted); margin: 4px 0 0; }
        .crm-body { display: flex; gap: 0; flex: 1; background: white; border: 1px solid var(--slate-200); border-radius: 14px; overflow: hidden; }
        .crm-guests { width: 280px; flex-shrink: 0; border-right: 1px solid var(--slate-200); display: flex; flex-direction: column; }
        .crm-search-wrap { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid var(--slate-200); }
        .crm-search { flex: 1; border: none; outline: none; font-size: 13px; font-family: 'DM Sans', sans-serif; color: var(--slate-800); }
        .crm-guest-list { flex: 1; overflow-y: auto; }
        .crm-guest-row { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--slate-100); background: white; cursor: pointer; width: 100%; text-align: left; transition: background 0.1s; font-family: 'DM Sans', sans-serif; }
        .crm-guest-row:hover { background: var(--slate-100); }
        .crm-guest-row[data-active="true"] { background: var(--gold-100); border-left: 3px solid var(--gold-500); }
        .crm-guest-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--navy-700); color: white; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .crm-guest-info { flex: 1; min-width: 0; }
        .crm-guest-name { font-size: 13px; font-weight: 600; color: var(--slate-800); margin: 0; }
        .crm-guest-preview { font-size: 11px; color: var(--text-muted); margin: 2px 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .crm-unread { background: var(--gold-500); color: white; font-size: 10px; font-weight: 700; border-radius: 20px; padding: 1px 6px; flex-shrink: 0; }
        .crm-thread { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .crm-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; flex: 1; color: var(--text-muted); font-size: 14px; }
        .crm-thread-header { display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-bottom: 1px solid var(--slate-200); }
        .crm-thread-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--navy-700); color: white; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .crm-thread-name { font-size: 14px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .crm-thread-contact { display: flex; gap: 12px; }
        .crm-thread-contact span { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--text-muted); }
        .crm-wa-btn { margin-left: auto; padding: 7px 14px; background: #25D366; color: white; border-radius: 8px; font-size: 12px; font-weight: 600; font-family: 'DM Sans', sans-serif; text-decoration: none; white-space: nowrap; }
        .crm-messages { flex: 1; overflow-y: auto; padding: 16px 18px; display: flex; flex-direction: column; gap: 10px; }
        .crm-no-messages { color: var(--text-muted); font-size: 13px; text-align: center; padding: 40px; }
        .crm-msg { max-width: 70%; display: flex; flex-direction: column; gap: 4px; }
        .crm-msg.outbound { align-self: flex-end; align-items: flex-end; }
        .crm-msg.inbound { align-self: flex-start; }
        .crm-msg-content { padding: 10px 14px; border-radius: 12px; font-size: 13px; line-height: 1.5; margin: 0; }
        .crm-msg.outbound .crm-msg-content { background: var(--navy-800); color: white; border-bottom-right-radius: 4px; }
        .crm-msg.inbound .crm-msg-content { background: var(--slate-100); color: var(--slate-800); border-bottom-left-radius: 4px; }
        .crm-msg-meta { font-size: 10px; color: var(--text-muted); margin: 0; }
        .crm-composer { padding: 14px 18px; border-top: 1px solid var(--slate-200); display: flex; gap: 10px; align-items: flex-end; }
        .crm-input { flex: 1; padding: 10px 12px; border: 1px solid var(--slate-200); border-radius: 10px; font-size: 13px; font-family: 'DM Sans', sans-serif; color: var(--slate-800); outline: none; resize: none; }
        .crm-input:focus { border-color: var(--gold-500); }
        .crm-send-btn { display: flex; align-items: center; gap: 6px; padding: 10px 18px; background: var(--navy-800); color: white; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: none; border-radius: 8px; cursor: pointer; white-space: nowrap; }
        .crm-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  )
}
