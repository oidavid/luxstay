'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Building2, Eye, EyeOff, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Invalid email or password. Please try again.')
      setLoading(false)
      return
    }

    router.push('/overview')
    router.refresh()
  }

  return (
    <div className="lux-login-root">
      {/* Background */}
      <div className="lux-login-bg" />

      {/* Card */}
      <div className="lux-login-card">

        {/* Logo */}
        <div className="lux-login-logo">
          <div className="lux-login-logo-icon">
            <Building2 size={22} color="white" />
          </div>
          <div>
            <h1 className="lux-login-brand">LuxStay</h1>
            <p className="lux-login-tagline">Hospitality Operating System</p>
          </div>
        </div>

        {/* Heading */}
        <div className="lux-login-heading">
          <h2>Welcome back</h2>
          <p>Sign in to your property dashboard</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="lux-login-form">

          {/* Error */}
          {error && (
            <div className="lux-login-error">
              {error}
            </div>
          )}

          {/* Email */}
          <div className="lux-field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@hotel.com"
            />
          </div>

          {/* Password */}
          <div className="lux-field">
            <div className="lux-field-label-row">
              <label htmlFor="password">Password</label>
              <button type="button" className="lux-forgot">Forgot password?</button>
            </div>
            <div className="lux-pw-wrap">
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                className="lux-pw-toggle"
                onClick={() => setShowPw(!showPw)}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button type="submit" className="lux-login-btn" disabled={loading}>
            {loading
              ? <><Loader2 size={16} className="lux-spin" /> Signing in...</>
              : 'Sign in to LuxStay'
            }
          </button>
        </form>

        {/* Divider */}
        <div className="lux-login-divider">
          <span>New to LuxStay?</span>
        </div>

        {/* Register */}
        <a href="/onboarding" className="lux-register-btn">
          Create your hotel account
        </a>

        {/* Footer */}
        <p className="lux-login-footer">
          By signing in you agree to LuxStay's Terms of Service and Privacy Policy.
        </p>
      </div>

      <style>{`
        .lux-login-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          position: relative;
          font-family: 'DM Sans', sans-serif;
        }

        .lux-login-bg {
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 20% 0%, rgba(201,168,76,0.12) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 80% 100%, rgba(46,77,122,0.2) 0%, transparent 60%),
            #080f1a;
          z-index: 0;
        }

        .lux-login-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 420px;
          background: rgba(13,24,41,0.95);
          border: 1px solid rgba(201,168,76,0.2);
          border-radius: 20px;
          padding: 40px 36px;
          backdrop-filter: blur(20px);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.04),
            0 24px 48px rgba(0,0,0,0.4);
        }

        @media (max-width: 480px) {
          .lux-login-card { padding: 32px 24px; }
        }

        .lux-login-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 32px;
        }

        .lux-login-logo-icon {
          width: 44px;
          height: 44px;
          background: var(--gold-500);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .lux-login-brand {
          font-family: 'Playfair Display', serif;
          font-size: 22px;
          font-weight: 700;
          color: white;
          line-height: 1;
          margin: 0;
        }

        .lux-login-tagline {
          font-size: 11px;
          color: var(--slate-400);
          margin-top: 3px;
          letter-spacing: 0.02em;
        }

        .lux-login-heading {
          margin-bottom: 28px;
        }

        .lux-login-heading h2 {
          font-family: 'Playfair Display', serif;
          font-size: 26px;
          font-weight: 600;
          color: white;
          margin: 0 0 6px;
        }

        .lux-login-heading p {
          font-size: 14px;
          color: var(--slate-400);
          margin: 0;
        }

        .lux-login-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .lux-login-error {
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.3);
          color: #fca5a5;
          font-size: 13px;
          padding: 12px 14px;
          border-radius: 10px;
        }

        .lux-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .lux-field label {
          font-size: 13px;
          font-weight: 500;
          color: var(--slate-400);
          letter-spacing: 0.01em;
        }

        .lux-field input {
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 15px;
          color: white;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }

        .lux-field input::placeholder { color: rgba(255,255,255,0.25); }

        .lux-field input:focus {
          border-color: var(--gold-500);
          box-shadow: 0 0 0 3px rgba(201,168,76,0.15);
        }

        .lux-field-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .lux-forgot {
          font-size: 12px;
          color: var(--gold-400);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          font-family: 'DM Sans', sans-serif;
        }

        .lux-pw-wrap {
          position: relative;
        }

        .lux-pw-wrap input {
          padding-right: 44px;
        }

        .lux-pw-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: var(--slate-400);
          display: flex;
          align-items: center;
          padding: 4px;
        }

        .lux-login-btn {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, var(--gold-500) 0%, #b8922e 100%);
          color: white;
          font-size: 15px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: opacity 0.15s, transform 0.1s;
          margin-top: 4px;
        }

        .lux-login-btn:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
        .lux-login-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        @keyframes lux-spin {
          to { transform: rotate(360deg); }
        }
        .lux-spin { animation: lux-spin 0.8s linear infinite; }

        .lux-login-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 24px 0 0;
        }

        .lux-login-divider::before,
        .lux-login-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.08);
        }

        .lux-login-divider span {
          font-size: 12px;
          color: var(--slate-400);
          white-space: nowrap;
        }

        .lux-register-btn {
          display: block;
          width: 100%;
          padding: 13px;
          margin-top: 12px;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px;
          color: white;
          font-size: 14px;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          text-align: center;
          text-decoration: none;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
        }

        .lux-register-btn:hover {
          border-color: rgba(201,168,76,0.4);
          background: rgba(201,168,76,0.05);
        }

        .lux-login-footer {
          font-size: 11px;
          color: rgba(148,163,184,0.5);
          text-align: center;
          margin-top: 24px;
          line-height: 1.5;
        }
      `}</style>
    </div>
  )
}
