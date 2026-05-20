'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, Building2, Globe, CreditCard, Bell, Shield } from 'lucide-react'

type Hotel = { id: string; name: string; slug: string; email: string | null; phone: string | null; address: string | null; city: string | null; country: string; currency: string; vat_rate: number; timezone: string; whatsapp_number: string | null; subscription_tier: string; subscription_status: string; trial_ends_at: string | null }

const COUNTRIES = [
  { code: 'NG', name: 'Nigeria', currency: 'NGN', vat: 7.5, tz: 'Africa/Lagos' },
  { code: 'US', name: 'United States', currency: 'USD', vat: 0, tz: 'America/New_York' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', vat: 20, tz: 'Europe/London' },
  { code: 'GH', name: 'Ghana', currency: 'GHS', vat: 15, tz: 'Africa/Accra' },
  { code: 'KE', name: 'Kenya', currency: 'KES', vat: 16, tz: 'Africa/Nairobi' },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', vat: 15, tz: 'Africa/Johannesburg' },
]

export default function SettingsPage() {
  const supabase = createClient()
  const [hotel, setHotel] = useState<Hotel | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState('property')

  // Form state
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('NG')
  const [currency, setCurrency] = useState('NGN')
  const [vatRate, setVatRate] = useState(7.5)
  const [timezone, setTimezone] = useState('Africa/Lagos')
  const [whatsapp, setWhatsapp] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('hotel_id').eq('id', user.id).single()
    if (!profile) return
    const { data: h } = await supabase.from('hotels').select('*').eq('id', profile.hotel_id).single()
    if (h) {
      setHotel(h)
      setName(h.name); setEmail(h.email ?? ''); setPhone(h.phone ?? '')
      setAddress(h.address ?? ''); setCity(h.city ?? ''); setCountry(h.country)
      setCurrency(h.currency); setVatRate(h.vat_rate); setTimezone(h.timezone)
      setWhatsapp(h.whatsapp_number ?? '')
    }
    setLoading(false)
  }

  async function saveSettings() {
    if (!hotel) return
    setSaving(true)
    await supabase.from('hotels').update({
      name, email: email || null, phone: phone || null,
      address: address || null, city: city || null, country,
      currency, vat_rate: vatRate, timezone,
      whatsapp_number: whatsapp || null,
    }).eq('id', hotel.id)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    setSaving(false)
  }

  function handleCountryChange(code: string) {
    const c = COUNTRIES.find(c => c.code === code)
    if (c) {
      setCountry(c.code); setCurrency(c.currency); setVatRate(c.vat); setTimezone(c.tz)
    }
  }

  const tabs = [
    { key: 'property', label: 'Property', icon: Building2 },
    { key: 'localisation', label: 'Localisation', icon: Globe },
    { key: 'subscription', label: 'Subscription', icon: CreditCard },
  ]

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading settings...</div>

  return (
    <div className="set-root">
      <div className="set-header">
        <div>
          <h2 className="set-title">Settings</h2>
          <p className="set-sub">Manage your property configuration</p>
        </div>
        <button className="set-save-btn" onClick={saveSettings} disabled={saving}>
          <Save size={14} /> {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="set-tabs">
        {tabs.map(tab => (
          <button key={tab.key} className="set-tab" data-active={activeTab === tab.key} onClick={() => setActiveTab(tab.key)}>
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'property' && (
        <div className="set-card">
          <h3 className="set-card-title">Property Information</h3>
          <div className="set-fields">
            <div className="set-field"><label>Property Name *</label><input value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="set-row2">
              <div className="set-field"><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
              <div className="set-field"><label>Phone</label><input value={phone} onChange={e => setPhone(e.target.value)} /></div>
            </div>
            <div className="set-field"><label>Address</label><input value={address} onChange={e => setAddress(e.target.value)} /></div>
            <div className="set-row2">
              <div className="set-field"><label>City</label><input value={city} onChange={e => setCity(e.target.value)} /></div>
              <div className="set-field"><label>WhatsApp Number</label><input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+234..." /></div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'localisation' && (
        <div className="set-card">
          <h3 className="set-card-title">Localisation & Currency</h3>
          <div className="set-fields">
            <div className="set-field">
              <label>Country</label>
              <select value={country} onChange={e => handleCountryChange(e.target.value)}>
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
            <div className="set-preview">
              <div className="set-preview-row"><span>Currency</span><strong>{currency}</strong></div>
              <div className="set-preview-row"><span>VAT / Tax Rate</span><strong>{vatRate}%</strong></div>
              <div className="set-preview-row"><span>Timezone</span><strong>{timezone}</strong></div>
            </div>
            <p className="set-note">Changing country automatically updates currency, VAT rate, and timezone.</p>
          </div>
        </div>
      )}

      {activeTab === 'subscription' && (
        <div className="set-card">
          <h3 className="set-card-title">Subscription</h3>
          <div className="set-sub-info">
            <div className="set-sub-tier">
              <p className="set-sub-tier-name">{hotel?.subscription_tier?.toUpperCase() ?? 'STARTER'}</p>
              <span className="set-sub-status" data-active={hotel?.subscription_status === 'active' || hotel?.subscription_status === 'trial'}>
                {hotel?.subscription_status}
              </span>
            </div>
            {hotel?.trial_ends_at && (
              <p className="set-sub-trial">
                Trial ends: {new Date(hotel.trial_ends_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
          <div className="set-tiers">
            {[
              { name: 'Starter', price: '₦25,000', rooms: '20 rooms', features: ['PMS Core', 'Booking Engine', 'Guest PWA'] },
              { name: 'Growth', price: '₦55,000', rooms: '60 rooms', features: ['Everything in Starter', 'Restaurant POS', 'Channel Manager', 'CRM'] },
              { name: 'Pro', price: '₦95,000', rooms: '150 rooms', features: ['Everything in Growth', 'HR & Payroll', 'AI Revenue', 'Multi-property'] },
            ].map(tier => (
              <div key={tier.name} className="set-tier-card" data-current={hotel?.subscription_tier === tier.name.toLowerCase()}>
                <p className="set-tier-name">{tier.name}</p>
                <p className="set-tier-price">{tier.price}<span>/month</span></p>
                <p className="set-tier-rooms">{tier.rooms}</p>
                <ul className="set-tier-features">
                  {tier.features.map(f => <li key={f}>{f}</li>)}
                </ul>
                {hotel?.subscription_tier === tier.name.toLowerCase()
                  ? <div className="set-tier-current">Current Plan</div>
                  : <button className="set-tier-upgrade">Upgrade</button>
                }
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .set-root { max-width: 800px; margin: 0 auto; }
        .set-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; gap: 16px; flex-wrap: wrap; }
        .set-title { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .set-sub { font-size: 13px; color: var(--text-muted); margin: 4px 0 0; }
        .set-save-btn { display: flex; align-items: center; gap: 6px; padding: 10px 20px; background: var(--navy-800); color: white; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: none; border-radius: 8px; cursor: pointer; }
        .set-save-btn:disabled { opacity: 0.7; }
        .set-tabs { display: flex; gap: 4px; margin-bottom: 20px; background: var(--slate-100); border-radius: 10px; padding: 4px; }
        .set-tab { display: flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: none; cursor: pointer; color: var(--slate-500); background: transparent; }
        .set-tab[data-active="true"] { background: white; color: var(--slate-800); box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
        .set-card { background: white; border: 1px solid var(--slate-200); border-radius: 14px; padding: 24px; }
        .set-card-title { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 700; color: var(--slate-800); margin: 0 0 20px; }
        .set-fields { display: flex; flex-direction: column; gap: 14px; }
        .set-field { display: flex; flex-direction: column; gap: 6px; }
        .set-field label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--slate-500); }
        .set-field input, .set-field select { padding: 10px 12px; border: 1px solid var(--slate-200); border-radius: 8px; font-size: 14px; font-family: 'DM Sans', sans-serif; color: var(--slate-800); outline: none; }
        .set-field input:focus, .set-field select:focus { border-color: var(--gold-500); box-shadow: 0 0 0 3px rgba(201,168,76,0.1); }
        .set-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .set-preview { background: var(--gold-100); border: 1px solid var(--gold-300); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
        .set-preview-row { display: flex; justify-content: space-between; font-size: 13px; }
        .set-preview-row span { color: var(--slate-500); }
        .set-preview-row strong { color: var(--navy-800); font-weight: 600; }
        .set-note { font-size: 12px; color: var(--text-muted); margin: 0; }
        .set-sub-info { background: var(--slate-100); border-radius: 10px; padding: 16px; margin-bottom: 20px; }
        .set-sub-tier { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .set-sub-tier-name { font-size: 18px; font-weight: 800; color: var(--slate-800); margin: 0; }
        .set-sub-status { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; background: var(--slate-200); color: var(--slate-500); text-transform: uppercase; }
        .set-sub-status[data-active="true"] { background: #d1fae5; color: #065f46; }
        .set-sub-trial { font-size: 13px; color: var(--slate-500); margin: 0; }
        .set-tiers { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; }
        @media (max-width: 640px) { .set-tiers { grid-template-columns: 1fr; } }
        .set-tier-card { border: 1.5px solid var(--slate-200); border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 8px; }
        .set-tier-card[data-current="true"] { border-color: var(--gold-400); background: var(--gold-100); }
        .set-tier-name { font-size: 14px; font-weight: 700; color: var(--slate-800); margin: 0; }
        .set-tier-price { font-size: 20px; font-weight: 800; color: var(--slate-800); margin: 0; }
        .set-tier-price span { font-size: 12px; font-weight: 400; color: var(--text-muted); }
        .set-tier-rooms { font-size: 12px; color: var(--text-muted); margin: 0; }
        .set-tier-features { list-style: none; margin: 4px 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
        .set-tier-features li { font-size: 12px; color: var(--slate-600); }
        .set-tier-features li::before { content: "✓ "; color: #10b981; }
        .set-tier-current { font-size: 12px; font-weight: 700; color: var(--gold-500); text-align: center; padding: 8px; background: white; border-radius: 8px; margin-top: auto; }
        .set-tier-upgrade { padding: 8px; border-radius: 8px; font-size: 12px; font-weight: 600; font-family: 'DM Sans', sans-serif; background: var(--navy-800); color: white; border: none; cursor: pointer; margin-top: auto; }
      `}</style>
    </div>
  )
}
