'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, DollarSign, Briefcase } from 'lucide-react'
import clsx from 'clsx'
import { Portfolio, Position } from '@/hooks/usePortfolio'
import { PriceMap } from '@/hooks/useLivePrices'

interface Props {
  portfolio: Portfolio | null
  prices: PriceMap
  loading: boolean
}

function PnLBadge({ value, pct }: { value: number; pct: number }) {
  const positive = value >= 0
  const zero = Math.abs(value) < 0.01
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 text-xs font-medium font-mono',
      zero ? 'text-text-secondary'
        : positive ? 'text-bull' : 'text-bear'
    )}>
      {zero ? <Minus className="w-3 h-3" />
        : positive ? <TrendingUp className="w-3 h-3" />
        : <TrendingDown className="w-3 h-3" />
      }
      {positive && !zero ? '+' : ''}{value.toFixed(2)} ({positive && !zero ? '+' : ''}{pct.toFixed(2)}%)
    </span>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="card flex-1 min-w-0">
      <p className="stat-label">{label}</p>
      <p className="stat-value truncate">{value}</p>
      {sub && <div className="mt-1">{sub}</div>}
    </div>
  )
}

export default function PortfolioCard({ portfolio, prices, loading }: Props) {
  if (loading && !portfolio) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-3 w-20 bg-bg-elevated rounded mb-2" />
            <div className="h-7 w-32 bg-bg-elevated rounded" />
          </div>
        ))}
      </div>
    )
  }

  const totalValue = portfolio?.total_portfolio_value ?? 10000
  const usdBalance = portfolio?.usd_balance ?? 10000
  const totalPnL = portfolio?.total_pnl ?? 0
  const totalPnLPct = portfolio?.total_pnl_pct ?? 0
  const positions = portfolio?.positions ?? []

  return (
    <div className="space-y-4">
      {/* Top stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Portfolio Value"
          value={`$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub={<PnLBadge value={totalPnL} pct={totalPnLPct} />}
        />
        <StatCard
          label="Available USD"
          value={`$${usdBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />
        <StatCard
          label="Asset Value"
          value={`$${(portfolio?.total_asset_value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />
      </div>

      {/* Positions */}
      {positions.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Briefcase className="w-4 h-4 text-text-muted" />
            <h3 className="text-sm font-medium text-text-primary">Open Positions</h3>
          </div>
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {positions.map((pos) => {
                const liveData = prices[pos.symbol]
                const livePrice = liveData?.price ?? pos.current_price
                const liveValue = pos.quantity * livePrice
                const livePnL = liveValue - pos.cost_basis
                const livePnLPct = pos.cost_basis > 0 ? (livePnL / pos.cost_basis) * 100 : 0

                return (
                  <motion.div
                    key={pos.symbol}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex items-center justify-between py-2 border-b border-bg-border last:border-0"
                  >
                    <div>
                      <span className="font-medium text-text-primary text-sm">{pos.symbol}</span>
                      <p className="text-text-muted text-xs font-mono">{pos.quantity.toFixed(6)} units</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm text-text-primary">
                        ${liveValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <PnLBadge value={livePnL} pct={livePnLPct} />
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  )
}
