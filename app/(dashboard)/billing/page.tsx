'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CreditCard, TrendingUp, DollarSign, Download } from 'lucide-react'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n)
}

export default function BillingPage() {
  const supabase = createClient()
  const [hotel, setHotel] = useState<{ name: string; subscription_tier: string; subscription_status: string; trial_ends_at: string | null } | null>(null)
  const [payments, setPayments] = useState<{ id: string; amount: number; method: string; created_at: string; reference: string | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [totalRevenue, setTotalRevenue] = useState(0)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('hotel_id').eq('id', user.id).single()
    if (!profile) return
    const [{ data: h }, { data: p }] = await Promise.all([
      supabase.from('hotels').select('name, subscription_tier, subscription_status, trial_ends_at').eq('id', profile.hotel_id).single(),
      supabase.from('payments').select('id, amount, method, created_at, reference').eq('hotel_id', profile.hotel_id).order('created_at', { ascending: false }).limit(50)
    ])
    setHotel(h)
    setPayments(p ?? [])
    setTotalRevenue(p?.reduce((sum, pay) => sum + pay.amount, 0) ?? 0)
    setLoading(false)
  }

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading billing...</div>

  return (
    <div className="bill-root">
      <div className="bill-header">
        <div>
          <h2 className="bill-title">Billing & Payments</h2>
          <p className="bill-sub">Payment history and revenue summary</p>
        </div>
        <button className="bill-export-btn"><Download size={14} /> Export</button>
      </div>

      <div className="bill-kpis">
        <div className="bill-kpi">
          <DollarSign size={18} style={{ color: '#10b981' }} />
          <div>
            <p className="bill-kpi-val">{formatCurrency(totalRevenue)}</p>
            <p className="bill-kpi-label">Total Revenue Received</p>
          </div>
        </div>
        <div className="bill-kpi">
          <TrendingUp size={18} style={{ color: '#3b82f6' }} />
          <div>
            <p className="bill-kpi-val">{payments.length}</p>
            <p className="bill-kpi-label">Total Transactions</p>
          </div>
        </div>
        <div className="bill-kpi">
          <CreditCard size={18} style={{ color: '#c9a84c' }} />
          <div>
            <p className="bill-kpi-val">{hotel?.subscription_tier?.toUpperCase() ?? '—'}</p>
            <p className="bill-kpi-label">Subscription Plan</p>
          </div>
        </div>
      </div>

      {hotel?.trial_ends_at && (
        <div className="bill-trial-banner">
          <p>🎉 You are on a <strong>60-day free trial</strong>. Trial ends on {new Date(hotel.trial_ends_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
          <button className="bill-upgrade-btn">Upgrade Now</button>
        </div>
      )}

      <div className="bill-section">
        <h3 className="bill-section-title">Payment History</h3>
        {payments.length === 0 ? (
          <div className="bill-empty"><p>No payments recorded yet</p><span>Payments from guest reservations will appear here</span></div>
        ) : (
          <div className="bill-table">
            <div className="bill-table-header">
              <span>Date</span><span>Amount</span><span>Method</span><span>Reference</span>
            </div>
            {payments.map(p => (
              <div key={p.id} className="bill-table-row">
                <span>{new Date(p.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span className="bill-amount">{formatCurrency(p.amount)}</span>
                <span className="bill-method">{p.method.replace('_', ' ')}</span>
                <span className="bill-ref">{p.reference ?? '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .bill-root { max-width: 800px; margin: 0 auto; }
        .bill-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; gap: 16px; flex-wrap: wrap; }
        .bill-title { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .bill-sub { font-size: 13px; color: var(--text-muted); margin: 4px 0 0; }
        .bill-export-btn { display: flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1px solid var(--slate-200); background: white; color: var(--slate-600); cursor: pointer; }
        .bill-kpis { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; margin-bottom: 20px; }
        @media (max-width: 640px) { .bill-kpis { grid-template-columns: 1fr; } }
        .bill-kpi { background: white; border: 1px solid var(--slate-200); border-radius: 14px; padding: 18px; display: flex; gap: 14px; align-items: center; }
        .bill-kpi-val { font-size: 22px; font-weight: 800; color: var(--slate-800); margin: 0; }
        .bill-kpi-label { font-size: 12px; color: var(--text-muted); margin: 2px 0 0; }
        .bill-trial-banner { background: linear-gradient(135deg, var(--navy-900), var(--navy-700)); border-radius: 12px; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
        .bill-trial-banner p { font-size: 13px; color: rgba(255,255,255,0.8); margin: 0; }
        .bill-trial-banner strong { color: white; }
        .bill-upgrade-btn { padding: 8px 18px; background: var(--gold-500); color: white; font-size: 13px; font-weight: 700; font-family: 'DM Sans', sans-serif; border: none; border-radius: 8px; cursor: pointer; white-space: nowrap; }
        .bill-section { background: white; border: 1px solid var(--slate-200); border-radius: 14px; overflow: hidden; }
        .bill-section-title { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 700; color: var(--slate-800); margin: 0; padding: 18px 20px; border-bottom: 1px solid var(--slate-200); }
        .bill-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 60px; text-align: center; }
        .bill-empty p { font-size: 14px; font-weight: 600; color: var(--slate-600); margin: 0; }
        .bill-empty span { font-size: 12px; color: var(--text-muted); }
        .bill-table { }
        .bill-table-header { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; padding: 10px 20px; background: var(--slate-100); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
        .bill-table-row { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; padding: 12px 20px; border-top: 1px solid var(--slate-100); font-size: 13px; color: var(--slate-700); align-items: center; }
        .bill-amount { font-weight: 700; color: var(--slate-800); }
        .bill-method { text-transform: capitalize; }
        .bill-ref { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--text-muted); }
      `}</style>
    </div>
  )
}
