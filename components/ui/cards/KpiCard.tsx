import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'

interface KpiCardProps {
  label:      string
  value:      string
  subvalue?:  string
  trend?:     number
  icon:       LucideIcon
  iconColor?: string
  iconBg?:    string
}

export function KpiCard({
  label, value, subvalue, trend, icon: Icon, iconColor, iconBg
}: KpiCardProps) {
  const isPositive = trend !== undefined && trend >= 0

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4"
      style={{
        background:  'var(--card-bg)',
        border:      '1px solid var(--card-border)',
        boxShadow:   '0 1px 3px rgba(0,0,0,0.04)'
      }}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: iconBg ?? 'var(--slate-100)' }}
        >
          <Icon size={18} style={{ color: iconColor ?? 'var(--slate-600)' }} />
        </div>

        {trend !== undefined && (
          <div
            className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full"
            style={{
              background: isPositive ? 'var(--green-100)' : 'var(--red-100)',
              color:      isPositive ? '#065f46'          : '#991b1b'
            }}
          >
            {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>

      <div>
        <p className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          {value}
        </p>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
        {subvalue && (
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{subvalue}</p>
        )}
      </div>
    </div>
  )
}
