'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Sparkles, TrendingUp, TrendingDown, Plus, Pencil, Trash2,
  X, Check, ChevronRight, AlertTriangle, Zap, Brain,
  Calendar, Percent, DollarSign, RefreshCw, Clock
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
  ai_reasoning: string | null
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
  { value: 'manual',      label: 'Manual Rate',    icon: DollarSign, desc: 'Fixed rate you control manually' },
  { value: 'weekend',     label: 'Weekend Rule',   icon: Calendar,   desc: 'Auto-applies on selected days' },
  { value: 'seasonal',    label: 'Seasonal',       icon: Calendar,   desc: 'Active between specific dates' },
  { value: 'smart_rule',  label: 'Smart Rule',     icon: Zap,        desc: 'Triggers based on occupancy level' },
]

function formatCurrency(amount: number, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount)
}

function adjustedRate(base: number, plan: RatePlan) {
  if (plan.adjustment_type === 'percentage') {
    return base * (1 + plan.adjustment_value / 100)
  }
  return base + plan.adjustment_value
}

export default function RevenuePage() {
  const supabase = createClient()
  const [hotel, setHotel] = useState<Hotel | null>(null)
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([])
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingAI, setGeneratingAI] = useState(false)
  const [activeTab, setActiveTab] = useState<'advisor' | 'plans' | 'rules'>('advisor')

  // Modal state
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

  // Base rate for preview
  const BASE_RATE = 75000

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
      supabase.from('ai_revenue_suggestions').select('*').eq('hotel_id', profile.hotel_id).order('created_at', { ascending: false }).limit(10)
    ])

    setHotel(hotelData)
    setRatePlans(plans ?? [])
    setSuggestions(sug ?? [])
    setLoading(false)
  }

  async function generateAISuggestions() {
    if (!hotel) return
    setGeneratingAI(true)

    // Get current occupancy data
    const { data: rooms } = await supabase
      .from('rooms')
      .select('status')
      .eq('hotel_id', hotel.id)
      .eq('is_active', true)

    const total = rooms?.length ?? 0
    const occupied = rooms?.filter(r => r.status === 'occupied').length ?? 0
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0

    const today = new Date()
    const dayOfWeek = today.getDay()
    const dayName = DAYS[dayOfWeek]
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6
    const daysUntilWeekend = dayOfWeek <= 4 ? 5 - dayOfWeek : 0

    const prompt = `You are a hotel revenue management AI advisor for ${hotel.name}.

Current hotel data:
- Total rooms: ${total}
- Occupied rooms: ${occupied}
- Current occupancy rate: ${occupancyRate}%
- Today is: ${dayName}, ${today.toLocaleDateString('en-NG')}
- Days until weekend: ${daysUntilWeekend}
- Base room rate: ${formatCurrency(BASE_RATE, hotel.currency)}/night
- Currency: ${hotel.currency}
- Active rate plans: ${ratePlans.filter(p => p.is_active).map(p => p.name).join(', ')}

Generate exactly 3 specific, actionable revenue recommendations for this hotel right now.
Each recommendation must be highly specific with exact numbers and amounts.

Respond ONLY with a valid JSON array, no other text, no markdown:
[
  {
    "suggestion_type": "rate_adjustment",
    "title": "Short punchy title (max 8 words)",
    "reasoning": "2-3 sentences explaining WHY based on the data above. Be specific about the numbers.",
    "recommended_action": "Exactly what to do â€” specific rate, specific days, specific amount",
    "projected_impact": "Specific projected revenue impact with numbers e.g. +â‚¦450,000 this weekend"
  }
]

Make recommendations relevant to ${hotel.currency} market. Use Nigerian Naira amounts if currency is NGN.
Focus on: occupancy optimization, weekend pricing, demand forecasting, and revenue per room.`

    try {
      const response = await fetch('/api/ai/revenue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, hotelId: hotel.id })
      })

      const data = await response.json()

      if (data.suggestions) {
        // Save suggestions to DB
        const toInsert = data.suggestions.map((s: Omit<AISuggestion, 'id' | 'suggestion_date' | 'status'>) => ({
          hotel_id: hotel.id,
          suggestion_date: new Date().toISOString().split('T')[0],
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

  async function updateSuggestionStatus(id: string, status: string) {
    await supabase.from('ai_revenue_suggestions').update({ status, accepted_at: status === 'accepted' ? new Date().toISOString() : null }).eq('id', id)
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status } : s))
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
      hotel_id: hotel.id,
      name: planName, description: planDesc,
      plan_type: planType, adjustment_type: adjType,
      adjustment_value: adjValue,
      days_of_week: selectedDays,
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

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending')
  const activePlans = ratePlans.filter(p => p.is_active)
  const smartRules = ratePlans.filter(p => p.plan_type === 'smart_rule' || p.plan_type === 'weekend')

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading revenue intelligence...</div>

  return (
    <div className="rev-root">

      {/* Header */}
      <div className="rev-header">
        <div>
          <div className="rev-header-badge">
            <Brain size={13} />
            <span>AI Revenue Intelligence</span>
          </div>
          <h2 className="rev-title">Revenue Management</h2>
          <p className="rev-sub">AI-powered pricing that maximises your revenue automatically</p>
        </div>
        <button className="rev-generate-btn" onClick={generateAISuggestions} disabled={generatingAI}>
          {generatingAI
            ? <><RefreshCw size={14} className="rev-spin" /> Analysing your hotel...</>
            : <><Sparkles size={14} /> Generate AI Recommendations</>
          }
        </button>
      </div>

      {/* KPI strip */}
      <div className="rev-kpis">
        <div className="rev-kpi">
          <p className="rev-kpi-value">{activePlans.length}</p>
          <p className="rev-kpi-label">Active Rate Plans</p>
        </div>
        <div className="rev-kpi">
          <p className="rev-kpi-value">{pendingSuggestions.length}</p>
          <p className="rev-kpi-label">AI Recommendations</p>
        </div>
        <div className="rev-kpi">
          <p className="rev-kpi-value">{smartRules.length}</p>
          <p className="rev-kpi-label">Smart Rules Active</p>
        </div>
        <div className="rev-kpi">
          <p className="rev-kpi-value">
            {formatCurrency(BASE_RATE * (1 + (ratePlans.find(p => p.plan_type === 'weekend' && p.is_active)?.adjustment_value ?? 0) / 100))}
          </p>
          <p className="rev-kpi-label">Weekend Rate</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="rev-tabs">
        {[
          { key: 'advisor', label: 'AI Advisor', icon: Brain, badge: pendingSuggestions.length },
          { key: 'plans',   label: 'Rate Plans', icon: DollarSign },
          { key: 'rules',   label: 'Smart Rules', icon: Zap },
        ].map(tab => (
          <button
            key={tab.key}
            className="rev-tab"
            data-active={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
          >
            <tab.icon size={14} />
            {tab.label}
            {tab.badge ? <span className="rev-tab-badge">{tab.badge}</span> : null}
          </button>
        ))}
      </div>

      {/* â”€â”€ AI ADVISOR TAB â”€â”€ */}
      {activeTab === 'advisor' && (
        <div className="rev-section">
          {suggestions.length === 0 ? (
            <div className="rev-empty">
              <Brain size={48} style={{ color: 'var(--slate-300)' }} />
              <h3>No recommendations yet</h3>
              <p>Click "Generate AI Recommendations" above and the AI will analyse your hotel's current occupancy, day of week, and pricing to generate specific revenue opportunities.</p>
              <button className="rev-generate-btn" onClick={generateAISuggestions} disabled={generatingAI}>
                {generatingAI ? 'Analysing...' : <><Sparkles size={14} /> Generate Now</>}
              </button>
            </div>
          ) : (
            <div className="rev-suggestions">
              {suggestions.map(s => (
                <div key={s.id} className="rev-suggestion-card" data-status={s.status}>
                  <div className="rev-suggestion-header">
                    <div className="rev-suggestion-type-badge">
                      {s.suggestion_type === 'rate_adjustment' && <TrendingUp size={12} />}
                      {s.suggestion_type === 'forecast_alert' && <AlertTriangle size={12} />}
                      {s.suggestion_type === 'promotion' && <Percent size={12} />}
                      {s.suggestion_type.replace('_', ' ')}
                    </div>
                    <span className="rev-suggestion-date">
                      {new Date(s.suggestion_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                    </span>
                    {s.status !== 'pending' && (
                      <span className="rev-suggestion-status" data-status={s.status}>
                        {s.status === 'accepted' ? <><Check size={10} /> Accepted</> : s.status === 'dismissed' ? <><X size={10} /> Dismissed</> : s.status}
                      </span>
                    )}
                  </div>

                  <h3 className="rev-suggestion-title">{s.title}</h3>
                  <p className="rev-suggestion-reasoning">{s.reasoning}</p>

                  <div className="rev-suggestion-action">
                    <Zap size={13} style={{ color: 'var(--gold-500)', flexShrink: 0 }} />
                    <p>{s.recommended_action}</p>
                  </div>

                  {s.projected_impact && (
                    <div className="rev-suggestion-impact">
                      <TrendingUp size={13} style={{ color: '#10b981', flexShrink: 0 }} />
                      <p>{s.projected_impact}</p>
                    </div>
                  )}

                  {s.status === 'pending' && (
                    <div className="rev-suggestion-actions">
                      <button
                        className="rev-accept-btn"
                        onClick={() => updateSuggestionStatus(s.id, 'accepted')}
                      >
                        <Check size={13} /> Accept Recommendation
                      </button>
                      <button
                        className="rev-dismiss-btn"
                        onClick={() => updateSuggestionStatus(s.id, 'dismissed')}
                      >
                        <X size={13} /> Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* â”€â”€ RATE PLANS TAB â”€â”€ */}
      {activeTab === 'plans' && (
        <div className="rev-section">
          <div className="rev-section-header">
            <div>
              <h3 className="rev-section-title">Rate Plans</h3>
              <p className="rev-section-sub">Define the pricing tiers available at your property. These apply when creating reservations.</p>
            </div>
            <button className="rev-add-btn" onClick={openAddPlan}>
              <Plus size={14} /> Add Rate Plan
            </button>
          </div>

          <div className="rev-plans-list">
            {ratePlans.map(plan => {
              const preview = adjustedRate(BASE_RATE, plan)
              const isUp = plan.adjustment_value > 0
              const isDown = plan.adjustment_value < 0
              return (
                <div key={plan.id} className="rev-plan-card" data-active={plan.is_active}>
                  <div className="rev-plan-left">
                    <div className="rev-plan-indicator" data-active={plan.is_active} />
                    <div>
                      <div className="rev-plan-name-row">
                        <h4 className="rev-plan-name">{plan.name}</h4>
                        {plan.is_ai_generated && (
                          <span className="rev-ai-badge"><Sparkles size={10} /> AI</span>
                        )}
                        <span className="rev-plan-type-badge">{plan.plan_type.replace('_', ' ')}</span>
                      </div>
                      <p className="rev-plan-desc">{plan.description}</p>
                      <div className="rev-plan-meta">
                        {plan.adjustment_value === 0 && (
                          <span className="rev-plan-chip neutral">Base rate</span>
                        )}
                        {isUp && (
                          <span className="rev-plan-chip up">
                            <TrendingUp size={11} />
                            +{plan.adjustment_value}{plan.adjustment_type === 'percentage' ? '%' : ` ${hotel?.currency}`} markup
                          </span>
                        )}
                        {isDown && (
                          <span className="rev-plan-chip down">
                            <TrendingDown size={11} />
                            {plan.adjustment_value}{plan.adjustment_type === 'percentage' ? '%' : ` ${hotel?.currency}`} discount
                          </span>
                        )}
                        {plan.days_of_week?.length > 0 && (
                          <span className="rev-plan-chip neutral">
                            {plan.days_of_week.map(d => DAYS[d]).join(', ')}
                          </span>
                        )}
                        {plan.date_from && plan.date_to && (
                          <span className="rev-plan-chip neutral">
                            {new Date(plan.date_from).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })} â†’ {new Date(plan.date_to).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                        {plan.min_occupancy_trigger && (
                          <span className="rev-plan-chip neutral">
                            <Zap size={10} /> Triggers at {plan.min_occupancy_trigger}% occupancy
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="rev-plan-right">
                    <div className="rev-plan-rate-preview">
                      <p className="rev-plan-rate">{formatCurrency(preview, hotel?.currency)}</p>
                      <p className="rev-plan-rate-label">on â‚¦75K base</p>
                    </div>
                    <div className="rev-plan-actions">
                      <button
                        className="rev-toggle-btn"
                        data-active={plan.is_active}
                        onClick={() => togglePlan(plan.id, plan.is_active)}
                        title={plan.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {plan.is_active ? 'Active' : 'Off'}
                      </button>
                      <button className="rev-icon-btn" onClick={() => openEditPlan(plan)}>
                        <Pencil size={13} />
                      </button>
                      <button className="rev-icon-btn danger" onClick={() => deletePlan(plan.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* â”€â”€ SMART RULES TAB â”€â”€ */}
      {activeTab === 'rules' && (
        <div className="rev-section">
          <div className="rev-section-header">
            <div>
              <h3 className="rev-section-title">Smart Rules</h3>
              <p className="rev-section-sub">Set rules once and LuxStay automatically applies the right rate every day â€” no manual work needed.</p>
            </div>
            <button className="rev-add-btn" onClick={() => { openAddPlan(); setPlanType('smart_rule') }}>
              <Plus size={14} /> Add Smart Rule
            </button>
          </div>

          {/* Rule examples */}
          <div className="rev-rule-examples">
            <p className="rev-rule-examples-title">How smart rules work</p>
            <div className="rev-rule-examples-grid">
              {[
                { icon: Calendar, rule: 'Every Friday + Saturday', result: '+25% Weekend Premium', color: '#3b82f6' },
                { icon: TrendingUp, rule: 'When occupancy > 80%', result: '+20% High Demand rate', color: '#10b981' },
                { icon: TrendingDown, rule: 'Room empty 3+ days', result: '-15% to fill the room', color: '#f59e0b' },
                { icon: Clock, rule: 'Book 30+ days ahead', result: '-10% Early Bird rate', color: '#8b5cf6' },
              ].map(e => (
                <div key={e.rule} className="rev-rule-example">
                  <e.icon size={16} style={{ color: e.color, flexShrink: 0 }} />
                  <div>
                    <p className="rev-rule-if">IF: {e.rule}</p>
                    <p className="rev-rule-then">THEN: {e.result}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active smart rules */}
          <div className="rev-plans-list">
            {ratePlans.filter(p => ['smart_rule', 'weekend', 'seasonal'].includes(p.plan_type)).map(plan => (
              <div key={plan.id} className="rev-plan-card" data-active={plan.is_active}>
                <div className="rev-plan-left">
                  <div className="rev-plan-indicator" data-active={plan.is_active} />
                  <div>
                    <div className="rev-plan-name-row">
                      <h4 className="rev-plan-name">{plan.name}</h4>
                      <span className="rev-plan-type-badge">{plan.plan_type.replace('_', ' ')}</span>
                    </div>
                    <p className="rev-plan-desc">{plan.description}</p>
                    <div className="rev-plan-meta">
                      {plan.adjustment_value > 0
                        ? <span className="rev-plan-chip up"><TrendingUp size={11} />+{plan.adjustment_value}{plan.adjustment_type === 'percentage' ? '%' : ''} markup</span>
                        : <span className="rev-plan-chip down"><TrendingDown size={11} />{plan.adjustment_value}{plan.adjustment_type === 'percentage' ? '%' : ''} discount</span>
                      }
                      {plan.days_of_week?.length > 0 && (
                        <span className="rev-plan-chip neutral">{plan.days_of_week.map(d => DAYS[d]).join(', ')}</span>
                      )}
                      {plan.min_occupancy_trigger && (
                        <span className="rev-plan-chip neutral"><Zap size={10} /> Triggers at {plan.min_occupancy_trigger}% occupancy</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="rev-plan-right">
                  <div className="rev-plan-actions">
                    <button className="rev-toggle-btn" data-active={plan.is_active} onClick={() => togglePlan(plan.id, plan.is_active)}>
                      {plan.is_active ? 'Active' : 'Off'}
                    </button>
                    <button className="rev-icon-btn" onClick={() => openEditPlan(plan)}><Pencil size={13} /></button>
                    <button className="rev-icon-btn danger" onClick={() => deletePlan(plan.id)}><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* â”€â”€ MODAL â”€â”€ */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingPlan ? 'Edit Rate Plan' : 'New Rate Plan'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>

            <div className="modal-body">
              {/* Plan type selector */}
              <div className="modal-field">
                <label>Plan Type</label>
                <div className="plan-type-grid">
                  {PLAN_TYPES.map(pt => (
                    <button
                      key={pt.value}
                      className="plan-type-option"
                      data-active={planType === pt.value}
                      onClick={() => setPlanType(pt.value)}
                    >
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
                <input value={planDesc} onChange={e => setPlanDesc(e.target.value)} placeholder="Brief description for your team" />
              </div>

              {/* Adjustment */}
              <div className="modal-field">
                <label>Price Adjustment</label>
                <div className="adj-row">
                  <div className="adj-type-btns">
                    <button
                      className="adj-type-btn"
                      data-active={adjType === 'percentage'}
                      onClick={() => setAdjType('percentage')}
                    >% Percentage</button>
                    <button
                      className="adj-type-btn"
                      data-active={adjType === 'fixed'}
                      onClick={() => setAdjType('fixed')}
                    >Fixed Amount</button>
                  </div>
                  <div className="adj-value-row">
                    <input
                      type="number"
                      value={adjValue}
                      onChange={e => setAdjValue(Number(e.target.value))}
                      placeholder="0"
                      style={{ flex: 1 }}
                    />
                    <span className="adj-unit">{adjType === 'percentage' ? '%' : hotel?.currency}</span>
                  </div>
                  <p className="adj-hint">
                    {adjValue > 0
                      ? `Positive = markup. â‚¦75,000 base â†’ ${formatCurrency(adjustedRate(75000, { adjustment_type: adjType, adjustment_value: adjValue } as RatePlan))}`
                      : adjValue < 0
                      ? `Negative = discount. â‚¦75,000 base â†’ ${formatCurrency(adjustedRate(75000, { adjustment_type: adjType, adjustment_value: adjValue } as RatePlan))}`
                      : 'Enter a positive number for markup, negative for discount'
                    }
                  </p>
                </div>
              </div>

              {/* Days of week â€” for weekend/smart rules */}
              {(planType === 'weekend' || planType === 'smart_rule') && (
                <div className="modal-field">
                  <label>Apply on days</label>
                  <div className="days-row">
                    {DAYS.map((day, i) => (
                      <button
                        key={day}
                        className="day-btn"
                        data-active={selectedDays.includes(i)}
                        onClick={() => toggleDay(i)}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Date range â€” for seasonal */}
              {planType === 'seasonal' && (
                <div className="modal-row2">
                  <div className="modal-field">
                    <label>From Date</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                  </div>
                  <div className="modal-field">
                    <label>To Date</label>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                  </div>
                </div>
              )}

              {/* Occupancy trigger â€” for smart rules */}
              {planType === 'smart_rule' && (
                <div className="modal-field">
                  <label>Activate when occupancy exceeds (%)</label>
                  <input
                    type="number" min={0} max={100}
                    value={minOccupancy}
                    onChange={e => setMinOccupancy(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 80 â€” activates when hotel is 80%+ full"
                  />
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="modal-save" onClick={savePlan} disabled={saving}>
                {saving ? 'Saving...' : editingPlan ? 'Save Changes' : 'Create Rate Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .rev-root { max-width: 1000px; margin: 0 auto; }

        .rev-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; gap: 16px; flex-wrap: wrap; }
        .rev-header-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--navy-800); background: var(--gold-100); border: 1.5px solid var(--gold-400); padding: 4px 10px; border-radius: 20px; margin-bottom: 10px; }
        .rev-title { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .rev-sub { font-size: 13px; color: var(--text-muted); margin: 4px 0 0; }

        .rev-generate-btn {
          display: flex; align-items: center; gap: 8px;
          padding: 11px 20px; border-radius: 10px; font-size: 13px; font-weight: 700;
          font-family: 'DM Sans', sans-serif;
          background: linear-gradient(135deg, var(--navy-800), var(--navy-600));
          color: white; border: none; cursor: pointer; transition: opacity 0.15s;
          white-space: nowrap; flex-shrink: 0;
        }
        .rev-generate-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .rev-generate-btn:not(:disabled):hover { opacity: 0.85; }

        @keyframes rev-spin { to { transform: rotate(360deg); } }
        .rev-spin { animation: rev-spin 1s linear infinite; }

        .rev-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
        @media (max-width: 640px) { .rev-kpis { grid-template-columns: repeat(2,1fr); } }
        .rev-kpi { background: white; border: 1px solid var(--slate-200); border-radius: 12px; padding: 16px; text-align: center; }
        .rev-kpi-value { font-size: 20px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .rev-kpi-label { font-size: 11px; color: var(--text-muted); margin: 4px 0 0; }

        .rev-tabs { display: flex; gap: 4px; margin-bottom: 20px; background: var(--slate-100); border-radius: 10px; padding: 4px; }
        .rev-tab {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
          font-family: 'DM Sans', sans-serif; border: none; cursor: pointer;
          color: var(--slate-500); background: transparent; transition: all 0.12s;
          position: relative;
        }
        .rev-tab[data-active="true"] { background: white; color: var(--slate-800); box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
        .rev-tab-badge { background: var(--gold-500); color: white; font-size: 10px; font-weight: 700; border-radius: 20px; padding: 1px 6px; }

        .rev-section { }
        .rev-section-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; gap: 16px; flex-wrap: wrap; }
        .rev-section-title { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .rev-section-sub { font-size: 13px; color: var(--text-muted); margin: 4px 0 0; }
        .rev-add-btn { display: flex; align-items: center; gap: 6px; padding: 9px 16px; background: var(--navy-800); color: white; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: none; border-radius: 8px; cursor: pointer; white-space: nowrap; }

        /* AI Suggestions */
        .rev-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px; text-align: center; }
        .rev-empty h3 { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .rev-empty p { font-size: 14px; color: var(--text-muted); max-width: 400px; margin: 0; line-height: 1.6; }

        .rev-suggestions { display: flex; flex-direction: column; gap: 16px; }
        .rev-suggestion-card {
          background: white; border: 1px solid var(--slate-200); border-radius: 14px;
          padding: 20px; transition: border-color 0.15s;
        }
        .rev-suggestion-card[data-status="accepted"] { border-color: #6ee7b7; background: #f0fdf4; }
        .rev-suggestion-card[data-status="dismissed"] { opacity: 0.5; }

        .rev-suggestion-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .rev-suggestion-type-badge {
          display: flex; align-items: center; gap: 4px;
          font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
          color: var(--navy-800); background: var(--gold-100); border: 1px solid var(--gold-300);
          padding: 3px 10px; border-radius: 20px;
        }
        .rev-suggestion-date { font-size: 12px; color: var(--text-muted); margin-left: auto; }
        .rev-suggestion-status { display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 20px; }
        .rev-suggestion-status[data-status="accepted"] { background: #d1fae5; color: #065f46; }
        .rev-suggestion-status[data-status="dismissed"] { background: var(--slate-200); color: var(--slate-500); }

        .rev-suggestion-title { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: var(--slate-800); margin: 0 0 8px; }
        .rev-suggestion-reasoning { font-size: 14px; color: var(--slate-600); margin: 0 0 12px; line-height: 1.6; }

        .rev-suggestion-action {
          display: flex; align-items: flex-start; gap: 8px;
          background: var(--gold-100); border: 1px solid var(--gold-300);
          border-radius: 8px; padding: 10px 12px; margin-bottom: 8px;
          font-size: 13px; color: var(--navy-800); font-weight: 500;
        }
        .rev-suggestion-action p { margin: 0; line-height: 1.5; }

        .rev-suggestion-impact {
          display: flex; align-items: center; gap: 8px;
          background: #d1fae5; border-radius: 8px; padding: 8px 12px; margin-bottom: 16px;
          font-size: 13px; color: #065f46; font-weight: 600;
        }
        .rev-suggestion-impact p { margin: 0; }

        .rev-suggestion-actions { display: flex; gap: 8px; }
        .rev-accept-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 9px 20px; background: var(--navy-800); color: white;
          font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif;
          border: none; border-radius: 8px; cursor: pointer;
        }
        .rev-dismiss-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 9px 16px; background: white; color: var(--slate-500);
          font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif;
          border: 1px solid var(--slate-200); border-radius: 8px; cursor: pointer;
        }

        /* Rate plans */
        .rev-plans-list { display: flex; flex-direction: column; gap: 10px; }
        .rev-plan-card {
          background: white; border: 1px solid var(--slate-200); border-radius: 12px;
          padding: 16px 20px; display: flex; align-items: center; gap: 16px;
          transition: all 0.12s;
        }
        .rev-plan-card[data-active="false"] { opacity: 0.55; }
        .rev-plan-left { display: flex; align-items: flex-start; gap: 12px; flex: 1; min-width: 0; }
        .rev-plan-indicator { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 6px; background: var(--slate-300); }
        .rev-plan-indicator[data-active="true"] { background: #10b981; }
        .rev-plan-name-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 2px; }
        .rev-plan-name { font-size: 14px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .rev-ai-badge { display: flex; align-items: center; gap: 3px; font-size: 10px; font-weight: 700; background: var(--gold-100); color: var(--gold-500); border: 1px solid var(--gold-300); padding: 2px 7px; border-radius: 20px; }
        .rev-plan-type-badge { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; background: var(--slate-100); color: var(--slate-500); padding: 2px 8px; border-radius: 20px; }
        .rev-plan-desc { font-size: 12px; color: var(--text-muted); margin: 0 0 8px; }
        .rev-plan-meta { display: flex; flex-wrap: wrap; gap: 6px; }
        .rev-plan-chip { display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; }
        .rev-plan-chip.up { background: #d1fae5; color: #065f46; }
        .rev-plan-chip.down { background: #fef3c7; color: #92400e; }
        .rev-plan-chip.neutral { background: var(--slate-100); color: var(--slate-600); }
        .rev-plan-right { display: flex; align-items: center; gap: 16px; flex-shrink: 0; }
        .rev-plan-rate-preview { text-align: right; }
        .rev-plan-rate { font-size: 15px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .rev-plan-rate-label { font-size: 10px; color: var(--text-muted); margin: 2px 0 0; }
        .rev-plan-actions { display: flex; align-items: center; gap: 6px; }
        .rev-toggle-btn {
          padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 700;
          font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all 0.12s;
          border: 1.5px solid var(--slate-200); background: white; color: var(--slate-400);
        }
        .rev-toggle-btn[data-active="true"] { background: #d1fae5; border-color: #6ee7b7; color: #065f46; }
        .rev-icon-btn { width: 30px; height: 30px; border-radius: 6px; border: 1px solid var(--slate-200); background: white; color: var(--slate-400); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.12s; }
        .rev-icon-btn:hover { background: var(--slate-100); color: var(--slate-700); }
        .rev-icon-btn.danger:hover { background: #fee2e2; border-color: #fca5a5; color: #991b1b; }

        /* Smart rules */
        .rev-rule-examples { background: linear-gradient(135deg, var(--navy-900), var(--navy-700)); border-radius: 14px; padding: 20px; margin-bottom: 20px; }
        .rev-rule-examples-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.4); margin: 0 0 14px; }
        .rev-rule-examples-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 12px; }
        @media (max-width: 640px) { .rev-rule-examples-grid { grid-template-columns: 1fr; } }
        .rev-rule-example { display: flex; align-items: flex-start; gap: 10px; background: rgba(255,255,255,0.06); border-radius: 10px; padding: 12px; }
        .rev-rule-if { font-size: 12px; color: rgba(255,255,255,0.5); margin: 0 0 2px; }
        .rev-rule-then { font-size: 13px; font-weight: 600; color: white; margin: 0; }

        /* Modal */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .modal-card { background: white; border-radius: 16px; width: 100%; max-width: 560px; box-shadow: 0 24px 48px rgba(0,0,0,0.2); overflow: hidden; }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--slate-200); }
        .modal-header h3 { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .modal-close { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--slate-200); background: white; color: var(--slate-400); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; max-height: 65vh; overflow-y: auto; }
        .modal-field { display: flex; flex-direction: column; gap: 6px; }
        .modal-field label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--slate-500); }
        .modal-field input, .modal-field select { padding: 10px 12px; border: 1px solid var(--slate-200); border-radius: 8px; font-size: 14px; font-family: 'DM Sans', sans-serif; color: var(--slate-800); outline: none; }
        .modal-field input:focus, .modal-field select:focus { border-color: var(--gold-500); box-shadow: 0 0 0 3px rgba(201,168,76,0.1); }
        .modal-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .modal-footer { display: flex; gap: 10px; justify-content: flex-end; padding: 16px 24px; border-top: 1px solid var(--slate-200); }
        .modal-cancel { padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1px solid var(--slate-200); background: white; color: var(--slate-600); cursor: pointer; }
        .modal-save { padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; background: var(--navy-800); color: white; border: none; cursor: pointer; }
        .modal-save:disabled { opacity: 0.6; cursor: not-allowed; }

        /* Plan type grid */
        .plan-type-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 8px; }
        .plan-type-option { display: flex; flex-direction: column; gap: 4px; padding: 12px; border-radius: 10px; border: 1.5px solid var(--slate-200); background: white; cursor: pointer; text-align: left; transition: all 0.12s; }
        .plan-type-option[data-active="true"] { border-color: var(--gold-500); background: var(--gold-100); }
        .plan-type-label { font-size: 13px; font-weight: 700; color: var(--slate-800); }
        .plan-type-desc { font-size: 11px; color: var(--text-muted); }

        /* Adjustment */
        .adj-row { display: flex; flex-direction: column; gap: 8px; }
        .adj-type-btns { display: flex; gap: 6px; }
        .adj-type-btn { padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1.5px solid var(--slate-200); background: white; color: var(--slate-500); cursor: pointer; }
        .adj-type-btn[data-active="true"] { border-color: var(--navy-800); background: var(--navy-800); color: white; }
        .adj-value-row { display: flex; align-items: center; gap: 8px; }
        .adj-unit { font-size: 14px; font-weight: 700; color: var(--slate-500); }
        .adj-hint { font-size: 12px; color: var(--text-muted); margin: 0; }

        /* Days */
        .days-row { display: flex; gap: 6px; flex-wrap: wrap; }
        .day-btn { width: 44px; height: 36px; border-radius: 8px; font-size: 12px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1.5px solid var(--slate-200); background: white; color: var(--slate-500); cursor: pointer; transition: all 0.12s; }
        .day-btn[data-active="true"] { border-color: var(--navy-800); background: var(--navy-800); color: white; }
      `}</style>
    </div>
  )
}

