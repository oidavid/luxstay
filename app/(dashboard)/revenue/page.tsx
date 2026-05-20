'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Sparkles, TrendingUp, TrendingDown, Plus, Pencil, Trash2,
  X, Check, Zap, Brain, Calendar, DollarSign, RefreshCw,
  Clock, Share2, MessageSquare, ExternalLink, AlertCircle
} from 'lucide-react'

type RatePlan = {
  id: string
  name: string
  description: string
  plan_type: string
  adjustment_type: string
  adjustment_value: number
  days_of_week: number[]
  date_from: string | null
  date_to: string | null
  min_occupancy_trigger: number | null
  priority: number
  is_active: boolean
  is_ai_generated: boolean
}

type AISuggestion = {
  id: string
  suggestion_date: string
  suggestion_type: string
  title: string
  reasoning: string
  recommended_action: string
  projected_impact: string
  status: string
}

type Hotel = {
  id: string
  name: string
  currency: string
  vat_rate: number
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const PLAN_TYPES = [
  { value: 'manual',     label: 'Manual Rate',   icon: DollarSign, desc: 'Fixed rate you control manually' },
  { value: 'weekend',    label: 'Weekend Rule',  icon: Calendar,   desc: 'Auto-applies on selected days' },
  { value: 'seasonal',   label: 'Seasonal',      icon: Calendar,   desc: 'Active between specific dates' },
  { value: 'smart_rule', label: 'Smart Rule',    icon: Zap,        desc: 'Triggers based on occupancy' },
]

function formatCurrency(amount: number, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount)
}

function adjustedRate(base: number, adjType: string, adjValue: number) {
  if (adjType === 'percentage') return base * (1 + adjValue / 100)
  return base + adjValue
}

const BASE_RATE = 75000

export default function RevenuePage() {
  const supabase = createClient()
  const [hotel, setHotel] = useState<Hotel | null>(null)
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([])
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingAI, setGeneratingAI] = useState(false)
  const [activeTab, setActiveTab] = useState<'advisor' | 'plans' | 'rules'>('advisor')

  // Accept modal state
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [acceptDuration, setAcceptDuration] = useState(7)
  const [acceptNote, setAcceptNote] = useState('')
  const [showPromote, setShowPromote] = useState<AISuggestion | null>(null)

  // Rate plan modal
  const [showModal, setShowModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState<RatePlan | null>(null)
  const [planName, setPlanName] = useState('')
  const [planDesc, setPlanDesc] = useState('')
  const [planType, setPlanType] = useState('manual')
  const [adjType, setAdjType] = useState<'percentage' | 'fixed'>('percentage')
  const [adjValue, setAdjValue] = useState(0)
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [minOccupancy, setMinOccupancy] = useState<number | ''>('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('hotel_id').eq('id', user.id).single()
    if (!profile) return

    const [{ data: hotelData }, { data: plans }, { data: sug }] = await Promise.all([
      supabase.from('hotels').select('id,name,currency,vat_rate').eq('id', profile.hotel_id).single(),
      supabase.from('rate_plans').select('*').eq('hotel_id', profile.hotel_id).order('priority'),
      supabase.from('ai_revenue_suggestions').select('*').eq('hotel_id', profile.hotel_id).order('created_at', { ascending: false }).limit(20)
    ])

    setHotel(hotelData)
    setRatePlans(plans ?? [])
    setSuggestions(sug ?? [])
    setLoading(false)
  }

  async function generateAISuggestions() {
    if (!hotel) return
    setGeneratingAI(true)

    // Delete today's pending suggestions first to avoid duplicates
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('ai_revenue_suggestions')
      .delete()
      .eq('hotel_id', hotel.id)
      .eq('suggestion_date', today)
      .eq('status', 'pending')

    const { data: rooms } = await supabase.from('rooms').select('status').eq('hotel_id', hotel.id).eq('is_active', true)
    const total = rooms?.length ?? 0
    const occupied = rooms?.filter(r => r.status === 'occupied').length ?? 0
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0
    const today2 = new Date()
    const dayName = DAYS[today2.getDay()]
    const isWeekend = today2.getDay() === 5 || today2.getDay() === 6
    const daysUntilWeekend = today2.getDay() <= 4 ? 5 - today2.getDay() : 0

    const prompt = `You are a hotel revenue management AI for ${hotel.name} in Nigeria.

Current data:
- Total rooms: ${total}
- Occupied: ${occupied} (${occupancyRate}% occupancy)
- Today: ${dayName} ${today2.toLocaleDateString('en-NG')}
- Days until weekend: ${daysUntilWeekend}
- Base rate: ${formatCurrency(BASE_RATE, hotel.currency)}/night
- Active rate plans: ${ratePlans.filter(p => p.is_active).map(p => p.name).join(', ')}

Generate exactly 3 specific revenue recommendations. Be highly specific with naira amounts.

Respond ONLY with a valid JSON array:
[
  {
    "suggestion_type": "rate_adjustment",
    "title": "Short title (max 8 words)",
    "reasoning": "2-3 sentences explaining WHY based on exact data above",
    "recommended_action": "Exactly what to do with specific rates and dates",
    "projected_impact": "Specific projected impact e.g. +₦450,000 this weekend"
  }
]`

    try {
      const response = await fetch('/api/ai/revenue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, hotelId: hotel.id })
      })
      const data = await response.json()
      if (data.suggestions) {
        const toInsert = data.suggestions.map((s: Omit<AISuggestion, 'id' | 'suggestion_date' | 'status'>) => ({
          hotel_id: hotel.id,
          suggestion_date: today,
          suggestion_type: s.suggestion_type,
          title: s.title,
          reasoning: s.reasoning,
          recommended_action: s.recommended_action,
          projected_impact: s.projected_impact,
          status: 'pending'
        }))
        await supabase.from('ai_revenue_suggestions').insert(toInsert)
        await loadData()
      }
    } catch (e) {
      console.error('AI generation failed:', e)
    }
    setGeneratingAI(false)
  }

  async function acceptSuggestion(id: string) {
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + acceptDuration)
    await supabase.from('ai_revenue_suggestions').update({
      status: 'accepted',
      accepted_at: new Date().toISOString()
    }).eq('id', id)
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: 'accepted' } : s))
    const accepted = suggestions.find(s => s.id === id)
    if (accepted) setShowPromote(accepted)
    setAcceptingId(null)
  }

  async function dismissSuggestion(id: string) {
    await supabase.from('ai_revenue_suggestions').update({ status: 'dismissed' }).eq('id', id)
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: 'dismissed' } : s))
  }

  function generateWhatsApp(s: AISuggestion) {
    const text = `🏨 *${hotel?.name} — Special Offer*\n\n✨ ${s.title}\n\n${s.recommended_action}\n\n📈 ${s.projected_impact}\n\nBook now: https://luxstay-nu.vercel.app/book`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  function generateSocialPost(s: AISuggestion) {
    const text = `🌟 Special offer at ${hotel?.name}!\n\n${s.title}\n\n${s.recommended_action}\n\n${s.projected_impact}\n\nBook directly and save! Link in bio. #${hotel?.name?.replace(/\s/g, '')} #HotelDeals #Nigeria`
    navigator.clipboard.writeText(text)
    alert('Social media post copied to clipboard!')
  }

  function openAddPlan() {
    setEditingPlan(null)
    setPlanName(''); setPlanDesc(''); setPlanType('manual')
    setAdjType('percentage'); setAdjValue(0)
    setSelectedDays([]); setDateFrom(''); setDateTo(''); setMinOccupancy('')
    setShowModal(true)
  }

  function openEditPlan(plan: RatePlan) {
    setEditingPlan(plan)
    setPlanName(plan.name); setPlanDesc(plan.description ?? ''); setPlanType(plan.plan_type)
    setAdjType(plan.adjustment_type as 'percentage' | 'fixed')
    setAdjValue(plan.adjustment_value)
    setSelectedDays(plan.days_of_week ?? [])
    setDateFrom(plan.date_from ?? ''); setDateTo(plan.date_to ?? '')
    setMinOccupancy(plan.min_occupancy_trigger ?? '')
    setShowModal(true)
  }

  async function savePlan() {
    if (!hotel || !planName) return
    setSaving(true)
    const payload = {
      hotel_id: hotel.id, name: planName, description: planDesc,
      plan_type: planType, adjustment_type: adjType,
      adjustment_value: adjValue, days_of_week: selectedDays,
      date_from: dateFrom || null, date_to: dateTo || null,
      min_occupancy_trigger: minOccupancy === '' ? null : Number(minOccupancy),
      is_active: true
    }
    if (editingPlan) {
      await supabase.from('rate_plans').update(payload).eq('id', editingPlan.id)
    } else {
      await supabase.from('rate_plans').insert(payload)
    }
    setShowModal(false)
    await loadData()
    setSaving(false)
  }

  async function togglePlan(id: string, current: boolean) {
    await supabase.from('rate_plans').update({ is_active: !current }).eq('id', id)
    setRatePlans(prev => prev.map(p => p.id === id ? { ...p, is_active: !current } : p))
  }

  async function deletePlan(id: string) {
    await supabase.from('rate_plans').delete().eq('id', id)
    setRatePlans(prev => prev.filter(p => p.id !== id))
  }

  function toggleDay(day: number) {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  const pendingCount = suggestions.filter(s => s.status === 'pending').length
  const acceptedCount = suggestions.filter(s => s.status === 'accepted').length
  const activePlans = ratePlans.filter(p => p.is_active)
  const weekendPlan = ratePlans.find(p => p.plan_type === 'weekend' && p.is_active)
  const weekendRate = weekendPlan ? adjustedRate(BASE_RATE, weekendPlan.adjustment_type, weekendPlan.adjustment_value) : BASE_RATE

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>

  return (
    <div className="rev-root">

      {/* ── Clean Header ── */}
      <div className="rev-header">
        <div>
          <h2 className="rev-title">Revenue Intelligence</h2>
          <p className="rev-sub">
            {pendingCount > 0
              ? `${pendingCount} AI recommendation${pendingCount > 1 ? 's' : ''} waiting for your review`
              : acceptedCount > 0
              ? `${acceptedCount} recommendation${acceptedCount > 1 ? 's' : ''} accepted and active`
              : 'Generate AI recommendations based on your live occupancy'
            }
          </p>
        </div>
        <button className="rev-generate-btn" onClick={generateAISuggestions} disabled={generatingAI}>
          {generatingAI
            ? <><RefreshCw size={14} className="rev-spin" /> Analysing your hotel...</>
            : <><Sparkles size={14} /> {suggestions.length > 0 ? 'Regenerate' : 'Generate AI Recommendations'}</>
          }
        </button>
      </div>

      {/* ── KPI Strip ── */}
      <div className="rev-kpis">
        <div className="rev-kpi">
          <p className="rev-kpi-value">{activePlans.length}</p>
          <p className="rev-kpi-label">Active Rate Plans</p>
        </div>
        <div className="rev-kpi" data-highlight={pendingCount > 0}>
          <p className="rev-kpi-value" style={{ color: pendingCount > 0 ? 'var(--gold-500)' : undefined }}>{pendingCount}</p>
          <p className="rev-kpi-label">Pending Review</p>
        </div>
        <div className="rev-kpi">
          <p className="rev-kpi-value" style={{ color: acceptedCount > 0 ? '#10b981' : undefined }}>{acceptedCount}</p>
          <p className="rev-kpi-label">Accepted Today</p>
        </div>
        <div className="rev-kpi">
          <p className="rev-kpi-value">{formatCurrency(weekendRate)}</p>
          <p className="rev-kpi-label">Weekend Rate</p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="rev-tabs">
        {[
          { key: 'advisor', label: 'AI Advisor',  icon: Brain,       badge: pendingCount },
          { key: 'plans',   label: 'Rate Plans',  icon: DollarSign },
          { key: 'rules',   label: 'Smart Rules', icon: Zap },
        ].map(tab => (
          <button key={tab.key} className="rev-tab" data-active={activeTab === tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)}>
            <tab.icon size={14} />
            {tab.label}
            {tab.badge ? <span className="rev-tab-badge">{tab.badge}</span> : null}
          </button>
        ))}
      </div>

      {/* ── AI ADVISOR ── */}
      {activeTab === 'advisor' && (
        <div>
          {suggestions.length === 0 ? (
            <div className="rev-empty">
              <Brain size={48} style={{ color: 'var(--slate-300)' }} />
              <h3>Ready to analyse your hotel</h3>
              <p>Click Generate above. The AI will read your live occupancy, day of week, and active rate plans to find specific revenue opportunities right now.</p>
              <button className="rev-generate-btn" onClick={generateAISuggestions} disabled={generatingAI}>
                <Sparkles size={14} /> {generatingAI ? 'Analysing...' : 'Generate Recommendations'}
              </button>
            </div>
          ) : (
            <div className="rev-suggestions">
              {suggestions.map(s => (
                <div key={s.id} className="rev-card" data-status={s.status}>
                  <div className="rev-card-header">
                    <span className="rev-type-badge">{s.suggestion_type.replace('_', ' ')}</span>
                    <span className="rev-card-date">{new Date(s.suggestion_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}</span>
                    {s.status !== 'pending' && (
                      <span className="rev-status-chip" data-status={s.status}>
                        {s.status === 'accepted' ? <><Check size={10} /> Accepted</> : <><X size={10} /> Dismissed</>}
                      </span>
                    )}
                  </div>

                  <h3 className="rev-card-title">{s.title}</h3>
                  <p className="rev-card-reasoning">{s.reasoning}</p>

                  <div className="rev-card-action">
                    <Zap size={13} style={{ color: 'var(--gold-500)', flexShrink: 0 }} />
                    <p>{s.recommended_action}</p>
                  </div>

                  {s.projected_impact && (
                    <div className="rev-card-impact">
                      <TrendingUp size={13} style={{ color: '#10b981', flexShrink: 0 }} />
                      <p>{s.projected_impact}</p>
                    </div>
                  )}

                  {s.status === 'pending' && (
                    <div className="rev-card-footer">
                      <button className="rev-accept-btn" onClick={() => setAcceptingId(s.id)}>
                        <Check size={13} /> Accept
                      </button>
                      <button className="rev-dismiss-btn" onClick={() => dismissSuggestion(s.id)}>
                        <X size={13} /> Dismiss
                      </button>
                    </div>
                  )}

                  {s.status === 'accepted' && (
                    <div className="rev-card-footer">
                      <button className="rev-promote-btn" onClick={() => setShowPromote(s)}>
                        <Share2 size={13} /> Promote This Offer
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── RATE PLANS ── */}
      {activeTab === 'plans' && (
        <div>
          <div className="rev-section-header">
            <div>
              <h3 className="rev-section-title">Rate Plans</h3>
              <p className="rev-section-sub">Pricing tiers available at your property. Select a plan when creating reservations.</p>
            </div>
            <button className="rev-add-btn" onClick={openAddPlan}><Plus size={14} /> Add Plan</button>
          </div>
          <div className="rev-plans-list">
            {ratePlans.map(plan => (
              <div key={plan.id} className="rev-plan-row" data-active={plan.is_active}>
                <div className="rev-plan-dot" data-active={plan.is_active} />
                <div className="rev-plan-info">
                  <div className="rev-plan-name-row">
                    <span className="rev-plan-name">{plan.name}</span>
                    <span className="rev-plan-type">{plan.plan_type.replace('_', ' ')}</span>
                  </div>
                  <p className="rev-plan-desc">{plan.description}</p>
                  <div className="rev-plan-chips">
                    {plan.adjustment_value > 0
                      ? <span className="rev-chip up"><TrendingUp size={10} />+{plan.adjustment_value}{plan.adjustment_type === 'percentage' ? '%' : ''}</span>
                      : plan.adjustment_value < 0
                      ? <span className="rev-chip down"><TrendingDown size={10} />{plan.adjustment_value}{plan.adjustment_type === 'percentage' ? '%' : ''}</span>
                      : <span className="rev-chip neutral">Base rate</span>
                    }
                    {plan.days_of_week?.length > 0 && <span className="rev-chip neutral">{plan.days_of_week.map(d => DAYS[d]).join(', ')}</span>}
                    {plan.min_occupancy_trigger && <span className="rev-chip neutral"><Zap size={10} /> at {plan.min_occupancy_trigger}% occupancy</span>}
                  </div>
                </div>
                <div className="rev-plan-rate">
                  <p className="rev-rate-value">{formatCurrency(adjustedRate(BASE_RATE, plan.adjustment_type, plan.adjustment_value))}</p>
                  <p className="rev-rate-base">on ₦75K base</p>
                </div>
                <div className="rev-plan-actions">
                  <button className="rev-toggle" data-active={plan.is_active} onClick={() => togglePlan(plan.id, plan.is_active)}>
                    {plan.is_active ? 'On' : 'Off'}
                  </button>
                  <button className="rev-icon-btn" onClick={() => openEditPlan(plan)}><Pencil size={13} /></button>
                  <button className="rev-icon-btn danger" onClick={() => deletePlan(plan.id)}><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SMART RULES ── */}
      {activeTab === 'rules' && (
        <div>
          <div className="rev-section-header">
            <div>
              <h3 className="rev-section-title">Smart Rules</h3>
              <p className="rev-section-sub">Set once, runs automatically every day. No manual work needed.</p>
            </div>
            <button className="rev-add-btn" onClick={() => { openAddPlan(); setPlanType('smart_rule') }}><Plus size={14} /> Add Rule</button>
          </div>
          <div className="rev-rules-explainer">
            {[
              { label: 'Every Fri + Sat', result: '+25% Weekend rate', color: '#3b82f6' },
              { label: 'Occupancy > 80%', result: '+20% High demand', color: '#10b981' },
              { label: 'Book 30+ days ahead', result: '-10% Early bird', color: '#8b5cf6' },
              { label: 'Room empty 3+ days', result: '-15% Fill rate',  color: '#f59e0b' },
            ].map(e => (
              <div key={e.label} className="rev-rule-chip">
                <p className="rev-rule-if">IF {e.label}</p>
                <p className="rev-rule-then" style={{ color: e.color }}>→ {e.result}</p>
              </div>
            ))}
          </div>
          <div className="rev-plans-list">
            {ratePlans.filter(p => ['smart_rule','weekend','seasonal'].includes(p.plan_type)).map(plan => (
              <div key={plan.id} className="rev-plan-row" data-active={plan.is_active}>
                <div className="rev-plan-dot" data-active={plan.is_active} />
                <div className="rev-plan-info">
                  <div className="rev-plan-name-row">
                    <span className="rev-plan-name">{plan.name}</span>
                    <span className="rev-plan-type">{plan.plan_type.replace('_',' ')}</span>
                  </div>
                  <p className="rev-plan-desc">{plan.description}</p>
                </div>
                <div className="rev-plan-actions">
                  <button className="rev-toggle" data-active={plan.is_active} onClick={() => togglePlan(plan.id, plan.is_active)}>
                    {plan.is_active ? 'On' : 'Off'}
                  </button>
                  <button className="rev-icon-btn" onClick={() => openEditPlan(plan)}><Pencil size={13} /></button>
                  <button className="rev-icon-btn danger" onClick={() => deletePlan(plan.id)}><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ACCEPT MODAL ── */}
      {acceptingId && (
        <div className="modal-overlay" onClick={() => setAcceptingId(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Accept Recommendation</h3>
              <button className="modal-close" onClick={() => setAcceptingId(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="accept-preview">
                <Check size={16} style={{ color: '#10b981' }} />
                <p>{suggestions.find(s => s.id === acceptingId)?.recommended_action}</p>
              </div>
              <div className="modal-field">
                <label>Run this promotion for how many days?</label>
                <div className="duration-btns">
                  {[3, 7, 14, 30].map(d => (
                    <button key={d} className="duration-btn" data-active={acceptDuration === d} onClick={() => setAcceptDuration(d)}>
                      {d} days
                    </button>
                  ))}
                </div>
                <p className="duration-note">
                  Active until {new Date(Date.now() + acceptDuration * 86400000).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
              <div className="modal-field">
                <label>Internal note (optional)</label>
                <input value={acceptNote} onChange={e => setAcceptNote(e.target.value)} placeholder="e.g. Targeting corporate guests" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-cancel" onClick={() => setAcceptingId(null)}>Cancel</button>
              <button className="modal-save" onClick={() => acceptSuggestion(acceptingId)}>
                <Check size={13} /> Accept & Activate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PROMOTE MODAL ── */}
      {showPromote && (
        <div className="modal-overlay" onClick={() => setShowPromote(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Promote This Offer</h3>
              <button className="modal-close" onClick={() => setShowPromote(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="promote-preview">
                <p className="promote-title">{showPromote.title}</p>
                <p className="promote-action">{showPromote.recommended_action}</p>
                <p className="promote-impact">{showPromote.projected_impact}</p>
              </div>
              <p className="promote-note">Share this offer through your channels to maximise bookings:</p>
              <div className="promote-channels">
                <button className="promote-channel-btn whatsapp" onClick={() => generateWhatsApp(showPromote)}>
                  <MessageSquare size={18} />
                  <span>WhatsApp</span>
                  <p>Send to contacts & groups</p>
                </button>
                <button className="promote-channel-btn social" onClick={() => generateSocialPost(showPromote)}>
                  <Share2 size={18} />
                  <span>Social Media</span>
                  <p>Copy post for Facebook / Instagram</p>
                </button>
                <button className="promote-channel-btn booking" onClick={() => window.open(`/book`, '_blank')}>
                  <ExternalLink size={18} />
                  <span>Booking Link</span>
                  <p>Share direct booking page</p>
                </button>
              </div>
              <div className="promote-info">
                <AlertCircle size={13} />
                <p>Full social media scheduling, banner generation, and ad creation are coming in the next update.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── RATE PLAN MODAL ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingPlan ? 'Edit Rate Plan' : 'New Rate Plan'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="modal-field">
                <label>Plan Type</label>
                <div className="plan-type-grid">
                  {PLAN_TYPES.map(pt => (
                    <button key={pt.value} className="plan-type-option" data-active={planType === pt.value} onClick={() => setPlanType(pt.value)}>
                      <pt.icon size={16} />
                      <span className="plan-type-label">{pt.label}</span>
                      <span className="plan-type-desc">{pt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="modal-field">
                <label>Plan Name *</label>
                <input value={planName} onChange={e => setPlanName(e.target.value)} placeholder="e.g. Black Friday Special" />
              </div>
              <div className="modal-field">
                <label>Description</label>
                <input value={planDesc} onChange={e => setPlanDesc(e.target.value)} placeholder="Brief description" />
              </div>
              <div className="modal-field">
                <label>Price Adjustment</label>
                <div className="adj-row">
                  <div className="adj-type-btns">
                    <button className="adj-type-btn" data-active={adjType === 'percentage'} onClick={() => setAdjType('percentage')}>% Percentage</button>
                    <button className="adj-type-btn" data-active={adjType === 'fixed'} onClick={() => setAdjType('fixed')}>Fixed Amount</button>
                  </div>
                  <div className="adj-value-row">
                    <input type="number" value={adjValue} onChange={e => setAdjValue(Number(e.target.value))} style={{ flex: 1 }} />
                    <span className="adj-unit">{adjType === 'percentage' ? '%' : hotel?.currency}</span>
                  </div>
                  <p className="adj-hint">
                    Preview: ₦75,000 base → {formatCurrency(adjustedRate(75000, adjType, adjValue))}
                  </p>
                </div>
              </div>
              {(planType === 'weekend' || planType === 'smart_rule') && (
                <div className="modal-field">
                  <label>Apply on days</label>
                  <div className="days-row">
                    {DAYS.map((day, i) => (
                      <button key={day} className="day-btn" data-active={selectedDays.includes(i)} onClick={() => toggleDay(i)}>{day}</button>
                    ))}
                  </div>
                </div>
              )}
              {planType === 'seasonal' && (
                <div className="modal-row2">
                  <div className="modal-field">
                    <label>From</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                  </div>
                  <div className="modal-field">
                    <label>To</label>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                  </div>
                </div>
              )}
              {planType === 'smart_rule' && (
                <div className="modal-field">
                  <label>Trigger when occupancy exceeds (%)</label>
                  <input type="number" min={0} max={100} value={minOccupancy} onChange={e => setMinOccupancy(e.target.value === '' ? '' : Number(e.target.value))} placeholder="e.g. 80" />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="modal-save" onClick={savePlan} disabled={saving}>{saving ? 'Saving...' : editingPlan ? 'Save Changes' : 'Create Plan'}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .rev-root { max-width: 900px; margin: 0 auto; }

        /* Header */
        .rev-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; gap: 16px; flex-wrap: wrap; }
        .rev-title { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .rev-sub { font-size: 13px; color: var(--text-muted); margin: 4px 0 0; }
        .rev-generate-btn { display: flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 700; font-family: 'DM Sans', sans-serif; background: linear-gradient(135deg, var(--navy-800), var(--navy-600)); color: white; border: none; cursor: pointer; transition: opacity 0.15s; white-space: nowrap; flex-shrink: 0; }
        .rev-generate-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .rev-generate-btn:not(:disabled):hover { opacity: 0.85; }
        @keyframes rev-spin { to { transform: rotate(360deg); } }
        .rev-spin { animation: rev-spin 1s linear infinite; }

        /* KPIs */
        .rev-kpis { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 20px; }
        @media (max-width: 640px) { .rev-kpis { grid-template-columns: repeat(2,1fr); } }
        .rev-kpi { background: white; border: 1px solid var(--slate-200); border-radius: 12px; padding: 16px; text-align: center; transition: border-color 0.15s; }
        .rev-kpi[data-highlight="true"] { border-color: var(--gold-400); background: var(--gold-100); }
        .rev-kpi-value { font-size: 20px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .rev-kpi-label { font-size: 11px; color: var(--text-muted); margin: 4px 0 0; }

        /* Tabs */
        .rev-tabs { display: flex; gap: 4px; margin-bottom: 20px; background: var(--slate-100); border-radius: 10px; padding: 4px; }
        .rev-tab { display: flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: none; cursor: pointer; color: var(--slate-500); background: transparent; transition: all 0.12s; }
        .rev-tab[data-active="true"] { background: white; color: var(--slate-800); box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
        .rev-tab-badge { background: var(--gold-500); color: white; font-size: 10px; font-weight: 700; border-radius: 20px; padding: 1px 6px; }

        /* Suggestion cards */
        .rev-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px; text-align: center; }
        .rev-empty h3 { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .rev-empty p { font-size: 14px; color: var(--text-muted); max-width: 400px; margin: 0; line-height: 1.6; }
        .rev-suggestions { display: flex; flex-direction: column; gap: 14px; }
        .rev-card { background: white; border: 1px solid var(--slate-200); border-radius: 14px; padding: 20px; transition: all 0.15s; }
        .rev-card[data-status="accepted"] { border-color: #6ee7b7; background: #f0fdf4; }
        .rev-card[data-status="dismissed"] { opacity: 0.45; }
        .rev-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
        .rev-type-badge { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--navy-800); background: var(--gold-100); border: 1px solid var(--gold-300); padding: 3px 10px; border-radius: 20px; }
        .rev-card-date { font-size: 12px; color: var(--text-muted); margin-left: auto; }
        .rev-status-chip { display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 20px; }
        .rev-status-chip[data-status="accepted"] { background: #d1fae5; color: #065f46; }
        .rev-status-chip[data-status="dismissed"] { background: var(--slate-200); color: var(--slate-500); }
        .rev-card-title { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: var(--slate-800); margin: 0 0 6px; }
        .rev-card-reasoning { font-size: 13px; color: var(--slate-600); margin: 0 0 12px; line-height: 1.6; }
        .rev-card-action { display: flex; align-items: flex-start; gap: 8px; background: var(--gold-100); border: 1px solid var(--gold-300); border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; font-size: 13px; color: var(--navy-800); font-weight: 500; }
        .rev-card-action p { margin: 0; line-height: 1.5; }
        .rev-card-impact { display: flex; align-items: center; gap: 8px; background: #d1fae5; border-radius: 8px; padding: 8px 12px; margin-bottom: 14px; font-size: 13px; color: #065f46; font-weight: 600; }
        .rev-card-impact p { margin: 0; }
        .rev-card-footer { display: flex; gap: 8px; }
        .rev-accept-btn { display: flex; align-items: center; gap: 6px; padding: 9px 20px; background: var(--navy-800); color: white; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: none; border-radius: 8px; cursor: pointer; }
        .rev-dismiss-btn { display: flex; align-items: center; gap: 6px; padding: 9px 16px; background: white; color: var(--slate-500); font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1px solid var(--slate-200); border-radius: 8px; cursor: pointer; }
        .rev-promote-btn { display: flex; align-items: center; gap: 6px; padding: 9px 20px; background: linear-gradient(135deg, var(--gold-500), #b8922e); color: white; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: none; border-radius: 8px; cursor: pointer; }

        /* Rate plans */
        .rev-section-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; gap: 16px; flex-wrap: wrap; }
        .rev-section-title { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .rev-section-sub { font-size: 13px; color: var(--text-muted); margin: 4px 0 0; }
        .rev-add-btn { display: flex; align-items: center; gap: 6px; padding: 9px 16px; background: var(--navy-800); color: white; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: none; border-radius: 8px; cursor: pointer; white-space: nowrap; }
        .rev-plans-list { display: flex; flex-direction: column; gap: 8px; }
        .rev-plan-row { background: white; border: 1px solid var(--slate-200); border-radius: 12px; padding: 14px 18px; display: flex; align-items: center; gap: 14px; transition: opacity 0.15s; }
        .rev-plan-row[data-active="false"] { opacity: 0.5; }
        .rev-plan-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; background: var(--slate-300); }
        .rev-plan-dot[data-active="true"] { background: #10b981; }
        .rev-plan-info { flex: 1; min-width: 0; }
        .rev-plan-name-row { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
        .rev-plan-name { font-size: 14px; font-weight: 700; color: var(--slate-800); }
        .rev-plan-type { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; background: var(--slate-100); color: var(--slate-500); padding: 2px 8px; border-radius: 20px; }
        .rev-plan-desc { font-size: 12px; color: var(--text-muted); margin: 0 0 6px; }
        .rev-plan-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .rev-chip { display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 20px; }
        .rev-chip.up { background: #d1fae5; color: #065f46; }
        .rev-chip.down { background: #fef3c7; color: #92400e; }
        .rev-chip.neutral { background: var(--slate-100); color: var(--slate-600); }
        .rev-plan-rate { text-align: right; flex-shrink: 0; }
        .rev-rate-value { font-size: 14px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .rev-rate-base { font-size: 10px; color: var(--text-muted); margin: 2px 0 0; }
        .rev-plan-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .rev-toggle { padding: 5px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; font-family: 'DM Sans', sans-serif; cursor: pointer; border: 1.5px solid var(--slate-200); background: white; color: var(--slate-400); transition: all 0.12s; }
        .rev-toggle[data-active="true"] { background: #d1fae5; border-color: #6ee7b7; color: #065f46; }
        .rev-icon-btn { width: 30px; height: 30px; border-radius: 6px; border: 1px solid var(--slate-200); background: white; color: var(--slate-400); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.12s; }
        .rev-icon-btn:hover { background: var(--slate-100); color: var(--slate-700); }
        .rev-icon-btn.danger:hover { background: #fee2e2; border-color: #fca5a5; color: #991b1b; }

        /* Smart rules explainer */
        .rev-rules-explainer { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 20px; }
        @media (max-width: 640px) { .rev-rules-explainer { grid-template-columns: repeat(2,1fr); } }
        .rev-rule-chip { background: linear-gradient(135deg, var(--navy-900), var(--navy-700)); border-radius: 10px; padding: 14px; }
        .rev-rule-if { font-size: 11px; color: rgba(255,255,255,0.4); margin: 0 0 4px; }
        .rev-rule-then { font-size: 13px; font-weight: 700; margin: 0; }

        /* Accept modal */
        .accept-preview { display: flex; align-items: flex-start; gap: 10px; background: #d1fae5; border-radius: 10px; padding: 12px; margin-bottom: 4px; font-size: 13px; color: #065f46; font-weight: 500; }
        .accept-preview p { margin: 0; line-height: 1.5; }
        .duration-btns { display: flex; gap: 8px; }
        .duration-btn { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1.5px solid var(--slate-200); background: white; color: var(--slate-500); cursor: pointer; }
        .duration-btn[data-active="true"] { border-color: var(--navy-800); background: var(--navy-800); color: white; }
        .duration-note { font-size: 12px; color: var(--text-muted); margin: 6px 0 0; }

        /* Promote modal */
        .promote-preview { background: var(--gold-100); border: 1px solid var(--gold-300); border-radius: 10px; padding: 16px; margin-bottom: 16px; }
        .promote-title { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 700; color: var(--slate-800); margin: 0 0 6px; }
        .promote-action { font-size: 13px; color: var(--slate-600); margin: 0 0 8px; line-height: 1.5; }
        .promote-impact { font-size: 13px; font-weight: 700; color: #065f46; margin: 0; }
        .promote-note { font-size: 13px; color: var(--slate-600); margin: 0 0 16px; }
        .promote-channels { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-bottom: 16px; }
        .promote-channel-btn { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 16px 10px; border-radius: 12px; border: 1.5px solid var(--slate-200); background: white; cursor: pointer; text-align: center; transition: all 0.15s; font-family: 'DM Sans', sans-serif; }
        .promote-channel-btn:hover { border-color: var(--navy-600); background: var(--slate-100); }
        .promote-channel-btn.whatsapp:hover { border-color: #25D366; background: #f0fdf4; }
        .promote-channel-btn span { font-size: 13px; font-weight: 700; color: var(--slate-800); }
        .promote-channel-btn p { font-size: 11px; color: var(--text-muted); margin: 0; }
        .promote-info { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: var(--text-muted); background: var(--slate-100); border-radius: 8px; padding: 10px 12px; }
        .promote-info p { margin: 0; line-height: 1.5; }

        /* Modal shared */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .modal-card { background: white; border-radius: 16px; width: 100%; max-width: 520px; box-shadow: 0 24px 48px rgba(0,0,0,0.2); overflow: hidden; }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--slate-200); }
        .modal-header h3 { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .modal-close { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--slate-200); background: white; color: var(--slate-400); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; max-height: 65vh; overflow-y: auto; }
        .modal-field { display: flex; flex-direction: column; gap: 6px; }
        .modal-field label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--slate-500); }
        .modal-field input { padding: 10px 12px; border: 1px solid var(--slate-200); border-radius: 8px; font-size: 14px; font-family: 'DM Sans', sans-serif; color: var(--slate-800); outline: none; }
        .modal-field input:focus { border-color: var(--gold-500); box-shadow: 0 0 0 3px rgba(201,168,76,0.1); }
        .modal-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .modal-footer { display: flex; gap: 10px; justify-content: flex-end; padding: 16px 24px; border-top: 1px solid var(--slate-200); }
        .modal-cancel { padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1px solid var(--slate-200); background: white; color: var(--slate-600); cursor: pointer; }
        .modal-save { display: flex; align-items: center; gap: 6px; padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; background: var(--navy-800); color: white; border: none; cursor: pointer; }
        .modal-save:disabled { opacity: 0.6; cursor: not-allowed; }

        /* Plan type grid */
        .plan-type-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 8px; }
        .plan-type-option { display: flex; flex-direction: column; gap: 4px; padding: 12px; border-radius: 10px; border: 1.5px solid var(--slate-200); background: white; cursor: pointer; text-align: left; transition: all 0.12s; }
        .plan-type-option[data-active="true"] { border-color: var(--gold-500); background: var(--gold-100); }
        .plan-type-label { font-size: 13px; font-weight: 700; color: var(--slate-800); }
        .plan-type-desc { font-size: 11px; color: var(--text-muted); }
        .adj-row { display: flex; flex-direction: column; gap: 8px; }
        .adj-type-btns { display: flex; gap: 6px; }
        .adj-type-btn { padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1.5px solid var(--slate-200); background: white; color: var(--slate-500); cursor: pointer; }
        .adj-type-btn[data-active="true"] { border-color: var(--navy-800); background: var(--navy-800); color: white; }
        .adj-value-row { display: flex; align-items: center; gap: 8px; }
        .adj-unit { font-size: 14px; font-weight: 700; color: var(--slate-500); }
        .adj-hint { font-size: 12px; color: var(--text-muted); margin: 0; }
        .days-row { display: flex; gap: 6px; flex-wrap: wrap; }
        .day-btn { width: 44px; height: 36px; border-radius: 8px; font-size: 12px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1.5px solid var(--slate-200); background: white; color: var(--slate-500); cursor: pointer; transition: all 0.12s; }
        .day-btn[data-active="true"] { border-color: var(--navy-800); background: var(--navy-800); color: white; }
      `}</style>
    </div>
  )
}
