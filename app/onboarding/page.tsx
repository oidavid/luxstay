'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Building2, Loader2, ChevronRight, ChevronLeft, Check } from 'lucide-react'

const COUNTRIES = [
  { code: 'NG', name: 'Nigeria',        currency: 'NGN', symbol: '₦',  tz: 'Africa/Lagos',    vat: 7.5  },
  { code: 'US', name: 'United States',  currency: 'USD', symbol: '$',  tz: 'America/New_York', vat: 0    },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', symbol: '£',  tz: 'Europe/London',   vat: 20   },
  { code: 'GH', name: 'Ghana',          currency: 'GHS', symbol: 'GH₵',tz: 'Africa/Accra',    vat: 15   },
  { code: 'KE', name: 'Kenya',          currency: 'KES', symbol: 'KSh',tz: 'Africa/Nairobi',  vat: 16   },
  { code: 'ZA', name: 'South Africa',   currency: 'ZAR', symbol: 'R',  tz: 'Africa/Johannesburg', vat: 15 },
  { code: 'AE', name: 'UAE',            currency: 'AED', symbol: 'AED',tz: 'Asia/Dubai',       vat: 5    },
  { code: 'EU', name: 'European Union', currency: 'EUR', symbol: '€',  tz: 'Europe/Paris',    vat: 20   },
  { code: 'CA', name: 'Canada',         currency: 'CAD', symbol: 'CA$',tz: 'America/Toronto',  vat: 5    },
  { code: 'AU', name: 'Australia',      currency: 'AUD', symbol: 'A$', tz: 'Australia/Sydney', vat: 10   },
]

const STEPS = ['Account', 'Property', 'Location', 'Done']

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 0 — Account
  const [fullName, setFullName]   = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')

  // Step 1 — Property
  const [hotelName, setHotelName] = useState('')
  const [hotelEmail, setHotelEmail] = useState('')
  const [hotelPhone, setHotelPhone] = useState('')
  const [address, setAddress]     = useState('')
  const [city, setCity]           = useState('')

  // Step 2 — Location
  const [countryCode, setCountryCode] = useState('NG')

  const country = COUNTRIES.find(c => c.code === countryCode) ?? COUNTRIES[0]

  function slug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')

    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } }
      })

      if (authError) throw new Error(authError.message)
      if (!authData.user) throw new Error('Could not create account.')

      const userId = authData.user.id

      // 2. Create hotel record
      const { data: hotel, error: hotelError } = await supabase
        .from('hotels')
        .insert({
          name:                hotelName,
          slug:                slug(hotelName),
          email:               hotelEmail || email,
          phone:               hotelPhone,
          address,
          city,
          country:             countryCode,
          currency:            country.currency,
          vat_rate:            country.vat,
          timezone:            country.tz,
          subscription_status: 'trial',
          subscription_tier:   'starter',
          trial_ends_at:       new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single()

      if (hotelError) throw new Error(hotelError.message)

      // 3. Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id:        userId,
          hotel_id:  hotel.id,
          full_name: fullName,
          role:      'hotel_owner',
          is_active: true,
        })

      if (profileError) throw new Error(profileError.message)

      setStep(3)

      setTimeout(() => router.push('/overview'), 2000)

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="lux-ob-root">
      <div className="lux-ob-bg" />

      <div className="lux-ob-card">

        {/* Logo */}
        <div className="lux-ob-logo">
          <div className="lux-ob-logo-icon">
            <Building2 size={20} color="white" />
          </div>
          <span className="lux-ob-brand">LuxStay</span>
        </div>

        {/* Step indicator */}
        <div className="lux-ob-steps">
          {STEPS.map((s, i) => (
            <div key={s} className="lux-ob-step-item">
              <div className={`lux-ob-step-dot ${i < step ? 'done' : i === step ? 'active' : ''}`}>
                {i < step ? <Check size={10} /> : i + 1}
              </div>
              <span className={`lux-ob-step-label ${i === step ? 'active' : ''}`}>{s}</span>
              {i < STEPS.length - 1 && <div className={`lux-ob-step-line ${i < step ? 'done' : ''}`} />}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && <div className="lux-ob-error">{error}</div>}

        {/* ── STEP 0: Account ── */}
        {step === 0 && (
          <div className="lux-ob-section">
            <h2 className="lux-ob-title">Create your account</h2>
            <p className="lux-ob-sub">You'll use these details to log in to LuxStay.</p>
            <div className="lux-ob-fields">
              <div className="lux-field-dark">
                <label>Full name</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Osas David" />
              </div>
              <div className="lux-field-dark">
                <label>Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@hotel.com" />
              </div>
              <div className="lux-field-dark">
                <label>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters" />
              </div>
            </div>
            <button
              className="lux-ob-next"
              onClick={() => {
                if (!fullName || !email || password.length < 8) {
                  setError('Please fill in all fields. Password must be at least 8 characters.')
                  return
                }
                setError('')
                setStep(1)
              }}
            >
              Continue <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ── STEP 1: Property ── */}
        {step === 1 && (
          <div className="lux-ob-section">
            <h2 className="lux-ob-title">Your property</h2>
            <p className="lux-ob-sub">Tell us about your hotel or property.</p>
            <div className="lux-ob-fields">
              <div className="lux-field-dark">
                <label>Property name</label>
                <input value={hotelName} onChange={e => setHotelName(e.target.value)} placeholder="Grand Lagos Hotel" />
              </div>
              <div className="lux-field-dark">
                <label>Property email</label>
                <input type="email" value={hotelEmail} onChange={e => setHotelEmail(e.target.value)} placeholder="info@grandlagos.com" />
              </div>
              <div className="lux-field-dark">
                <label>Property phone</label>
                <input value={hotelPhone} onChange={e => setHotelPhone(e.target.value)} placeholder="+234 800 000 0000" />
              </div>
              <div className="lux-field-dark">
                <label>Address</label>
                <input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Victoria Island" />
              </div>
              <div className="lux-field-dark">
                <label>City</label>
                <input value={city} onChange={e => setCity(e.target.value)} placeholder="Lagos" />
              </div>
            </div>
            <div className="lux-ob-nav">
              <button className="lux-ob-back" onClick={() => setStep(0)}>
                <ChevronLeft size={16} /> Back
              </button>
              <button
                className="lux-ob-next"
                onClick={() => {
                  if (!hotelName || !city) {
                    setError('Property name and city are required.')
                    return
                  }
                  setError('')
                  setStep(2)
                }}
              >
                Continue <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Location ── */}
        {step === 2 && (
          <div className="lux-ob-section">
            <h2 className="lux-ob-title">Location & currency</h2>
            <p className="lux-ob-sub">This sets your currency, VAT rate, and timezone automatically.</p>
            <div className="lux-ob-fields">
              <div className="lux-field-dark">
                <label>Country</label>
                <select value={countryCode} onChange={e => setCountryCode(e.target.value)}>
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Auto-filled preview */}
              <div className="lux-ob-preview">
                <div className="lux-ob-preview-row">
                  <span>Currency</span>
                  <strong>{country.currency} ({country.symbol})</strong>
                </div>
                <div className="lux-ob-preview-row">
                  <span>VAT / Tax rate</span>
                  <strong>{country.vat}%</strong>
                </div>
                <div className="lux-ob-preview-row">
                  <span>Timezone</span>
                  <strong>{country.tz}</strong>
                </div>
              </div>

              <p className="lux-ob-note">
                All of these can be changed later in Settings.
              </p>
            </div>

            <div className="lux-ob-nav">
              <button className="lux-ob-back" onClick={() => setStep(1)}>
                <ChevronLeft size={16} /> Back
              </button>
              <button className="lux-ob-next" onClick={handleSubmit} disabled={loading}>
                {loading
                  ? <><Loader2 size={16} className="lux-spin" /> Creating account...</>
                  : <>Create my account <ChevronRight size={16} /></>
                }
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Done ── */}
        {step === 3 && (
          <div className="lux-ob-done">
            <div className="lux-ob-done-icon">
              <Check size={32} color="white" />
            </div>
            <h2 className="lux-ob-title">You're all set!</h2>
            <p className="lux-ob-sub">
              Welcome to LuxStay. Your 60-day free trial has started.<br />
              Taking you to your dashboard now...
            </p>
            <div className="lux-ob-loading">
              <Loader2 size={20} className="lux-spin" style={{ color: 'var(--gold-500)' }} />
            </div>
          </div>
        )}

        {/* Sign in link */}
        {step < 3 && (
          <p className="lux-ob-signin">
            Already have an account?{' '}
            <a href="/login">Sign in</a>
          </p>
        )}
      </div>

      <style>{`
        .lux-ob-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          position: relative;
          font-family: 'DM Sans', sans-serif;
        }
        .lux-ob-bg {
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 80% 0%, rgba(201,168,76,0.1) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 20% 100%, rgba(46,77,122,0.2) 0%, transparent 60%),
            #080f1a;
          z-index: 0;
        }
        .lux-ob-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 460px;
          background: rgba(13,24,41,0.95);
          border: 1px solid rgba(201,168,76,0.15);
          border-radius: 20px;
          padding: 40px 36px;
          backdrop-filter: blur(20px);
          box-shadow: 0 24px 48px rgba(0,0,0,0.4);
        }
        @media (max-width: 480px) {
          .lux-ob-card { padding: 28px 20px; }
        }
        .lux-ob-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 28px;
        }
        .lux-ob-logo-icon {
          width: 36px; height: 36px;
          background: var(--gold-500);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .lux-ob-brand {
          font-family: 'Playfair Display', serif;
          font-size: 20px;
          font-weight: 700;
          color: white;
        }
        /* Steps */
        .lux-ob-steps {
          display: flex;
          align-items: center;
          margin-bottom: 32px;
          gap: 0;
        }
        .lux-ob-step-item {
          display: flex;
          align-items: center;
          gap: 6px;
          flex: 1;
        }
        .lux-ob-step-item:last-child { flex: 0; }
        .lux-ob-step-dot {
          width: 24px; height: 24px;
          border-radius: 50%;
          border: 1.5px solid rgba(255,255,255,0.15);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 600;
          color: rgba(255,255,255,0.3);
          flex-shrink: 0;
          transition: all 0.2s;
        }
        .lux-ob-step-dot.active {
          border-color: var(--gold-500);
          color: var(--gold-500);
          box-shadow: 0 0 0 3px rgba(201,168,76,0.15);
        }
        .lux-ob-step-dot.done {
          background: var(--gold-500);
          border-color: var(--gold-500);
          color: white;
        }
        .lux-ob-step-label {
          font-size: 11px;
          color: rgba(255,255,255,0.3);
          white-space: nowrap;
        }
        .lux-ob-step-label.active { color: var(--gold-400); font-weight: 500; }
        .lux-ob-step-line {
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.1);
          margin: 0 6px;
        }
        .lux-ob-step-line.done { background: var(--gold-500); }
        /* Content */
        .lux-ob-title {
          font-family: 'Playfair Display', serif;
          font-size: 22px;
          font-weight: 600;
          color: white;
          margin: 0 0 6px;
        }
        .lux-ob-sub {
          font-size: 14px;
          color: var(--slate-400);
          margin: 0 0 24px;
          line-height: 1.5;
        }
        .lux-ob-fields { display: flex; flex-direction: column; gap: 14px; }
        .lux-field-dark { display: flex; flex-direction: column; gap: 6px; }
        .lux-field-dark label {
          font-size: 13px; font-weight: 500;
          color: var(--slate-400);
        }
        .lux-field-dark input,
        .lux-field-dark select {
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 11px 14px;
          font-size: 14px;
          color: white;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 0.15s;
          -webkit-appearance: none;
        }
        .lux-field-dark input::placeholder { color: rgba(255,255,255,0.2); }
        .lux-field-dark input:focus,
        .lux-field-dark select:focus {
          border-color: var(--gold-500);
          box-shadow: 0 0 0 3px rgba(201,168,76,0.12);
        }
        .lux-field-dark select option { background: #0d1829; color: white; }
        /* Preview box */
        .lux-ob-preview {
          background: rgba(201,168,76,0.06);
          border: 1px solid rgba(201,168,76,0.2);
          border-radius: 10px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .lux-ob-preview-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
        }
        .lux-ob-preview-row span { color: var(--slate-400); }
        .lux-ob-preview-row strong { color: var(--gold-300); font-weight: 600; }
        .lux-ob-note {
          font-size: 12px;
          color: rgba(148,163,184,0.5);
          text-align: center;
        }
        /* Navigation buttons */
        .lux-ob-nav {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }
        .lux-ob-next {
          flex: 1;
          padding: 13px;
          background: linear-gradient(135deg, var(--gold-500) 0%, #b8922e 100%);
          color: white;
          font-size: 14px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          border: none; border-radius: 10px;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          transition: opacity 0.15s;
          margin-top: 24px;
        }
        .lux-ob-next:only-child { margin-top: 24px; }
        .lux-ob-next:hover:not(:disabled) { opacity: 0.9; }
        .lux-ob-next:disabled { opacity: 0.6; cursor: not-allowed; }
        .lux-ob-back {
          padding: 13px 18px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          color: var(--slate-400);
          font-size: 14px;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          display: flex; align-items: center; gap: 6px;
          transition: background 0.15s;
          margin-top: 24px;
        }
        .lux-ob-back:hover { background: rgba(255,255,255,0.08); }
        /* Done state */
        .lux-ob-done {
          text-align: center;
          padding: 20px 0;
        }
        .lux-ob-done-icon {
          width: 64px; height: 64px;
          background: linear-gradient(135deg, var(--gold-500), #b8922e);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 20px;
          box-shadow: 0 0 0 12px rgba(201,168,76,0.12);
        }
        .lux-ob-loading {
          display: flex; justify-content: center;
          margin-top: 20px;
        }
        /* Error */
        .lux-ob-error {
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.3);
          color: #fca5a5;
          font-size: 13px;
          padding: 12px 14px;
          border-radius: 10px;
          margin-bottom: 16px;
        }
        /* Sign in link */
        .lux-ob-signin {
          font-size: 13px;
          color: var(--slate-400);
          text-align: center;
          margin-top: 24px;
        }
        .lux-ob-signin a { color: var(--gold-400); text-decoration: none; }
        .lux-ob-signin a:hover { text-decoration: underline; }
        /* Spinner */
        @keyframes lux-spin { to { transform: rotate(360deg); } }
        .lux-spin { animation: lux-spin 0.8s linear infinite; }
      `}</style>
    </div>
  )
}
