'use client'
import { motion } from 'framer-motion'
import {
  Wallet,
  DollarSign,
  TrendingUp,
  TrendingDown,
  PieChart as PieIcon,
  RotateCcw,
  ArrowDownRight,
  ArrowUpRight,
  Percent,
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import clsx from 'clsx'
import { WalletSnapshot, Position } from '@/hooks/useWallet'
import toast from 'react-hot-toast'

interface Props {
  wallet: WalletSnapshot | null
  loading: boolean
  onSellPosition: (symbol: string, percentage: number) => Promise<any>
  onResetWallet: () => Promise<void>
}

const CustomPieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  return (
    <div className="bg-bg-surface border border-bg-border rounded-lg px-3 py-2 text-xs shadow-card">
      <p className="font-semibold text-text-primary mb-1 flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
        {data.name}
      </p>
      <p className="font-mono text-text-secondary">
        Value: <span className="text-text-primary font-semibold">${data.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </p>
      <p className="font-mono text-accent-blue mt-0.5">
        Share: {data.percentage.toFixed(1)}%
      </p>
    </div>
  )
}

export default function WalletDashboard({
  wallet,
  loading,
  onSellPosition,
  onResetWallet,
}: Props) {
  if (loading && !wallet) {
    return (
      <div className="card animate-pulse py-16 text-center text-text-muted">
        Loading Wallet & Portfolio Engine...
      </div>
    )
  }

  const totalValue = wallet?.total_portfolio_value ?? 10000.0
  const usdtBalance = wallet?.usdt_balance ?? 10000.0
  const totalAssetValue = wallet?.total_asset_value ?? 0.0
  const totalPnl = wallet?.total_pnl ?? 0.0
  const totalPnlPct = wallet?.total_pnl_pct ?? 0.0
  const totalRealizedPnl = wallet?.total_realized_pnl ?? 0.0
  const positions = wallet?.positions ?? []
  const allocations = wallet?.allocations ?? [
    { name: 'USDT', symbol: 'USDT', value: 10000, percentage: 100, color: '#3B82F6' },
  ]

  const handleQuickSell = async (symbol: string, pct: number) => {
    try {
      await onSellPosition(symbol, pct)
      toast.success(`Sold ${pct}% of ${symbol}`)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || `Failed to sell ${symbol}`)
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Top Metric Cards Row ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Portfolio Value */}
        <div className="card bg-bg-surface border-bg-border relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-text-muted mb-1">
            <span className="font-medium uppercase tracking-wider">Total Portfolio Value</span>
            <Wallet className="w-3.5 h-3.5 text-accent-blue" />
          </div>
          <motion.p
            key={totalValue}
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 1 }}
            className="text-2xl font-bold font-mono text-text-primary"
          >
            ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </motion.p>
          <div className="flex items-center gap-1 mt-1 text-xs">
            <span className={clsx('font-mono font-semibold', totalPnl >= 0 ? 'text-bull' : 'text-bear')}>
              {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)} ({totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* USDT Cash Balance */}
        <div className="card bg-bg-surface border-bg-border">
          <div className="flex items-center justify-between text-xs text-text-muted mb-1">
            <span className="font-medium uppercase tracking-wider">Available USDT</span>
            <DollarSign className="w-3.5 h-3.5 text-bull" />
          </div>
          <p className="text-2xl font-bold font-mono text-text-primary">
            ${usdtBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-text-muted mt-1 block">Ready for Spot Trades</span>
        </div>

        {/* Crypto Asset Value */}
        <div className="card bg-bg-surface border-bg-border">
          <div className="flex items-center justify-between text-xs text-text-muted mb-1">
            <span className="font-medium uppercase tracking-wider">Crypto Holdings Value</span>
            <PieIcon className="w-3.5 h-3.5 text-accent-blue" />
          </div>
          <p className="text-2xl font-bold font-mono text-text-primary">
            ${totalAssetValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-text-muted mt-1 block">{positions.length} Active Coins Held</span>
        </div>

        {/* Total Realized PnL */}
        <div className="card bg-bg-surface border-bg-border">
          <div className="flex items-center justify-between text-xs text-text-muted mb-1">
            <span className="font-medium uppercase tracking-wider">Total Realized P&L</span>
            {totalRealizedPnl >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-bull" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-bear" />
            )}
          </div>
          <p className={clsx(
            'text-2xl font-bold font-mono',
            totalRealizedPnl >= 0 ? 'text-bull' : 'text-bear'
          )}>
            {totalRealizedPnl >= 0 ? '+' : ''}${totalRealizedPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-text-muted mt-1 block">From Completed Sells</span>
        </div>
      </div>

      {/* ── Asset Allocation Donut Chart + Breakdown ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Donut Chart */}
        <div className="card bg-bg-surface border-bg-border flex flex-col items-center justify-center p-4">
          <div className="w-full flex items-center justify-between mb-2">
            <h4 className="font-semibold text-text-primary text-sm flex items-center gap-1.5">
              <PieIcon className="w-4 h-4 text-accent-blue" /> Asset Distribution
            </h4>
            <span className="text-xs text-text-muted font-mono">{allocations.length} Assets</span>
          </div>

          <div className="w-full h-52 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={allocations}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {allocations.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#0F172A" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Donut Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] text-text-muted uppercase">Total Balance</span>
              <span className="text-xs font-bold font-mono text-text-primary">
                ${(totalValue / 1000).toFixed(1)}k
              </span>
            </div>
          </div>

          {/* Allocation Badges */}
          <div className="flex flex-wrap gap-2 justify-center mt-2 max-h-24 overflow-y-auto w-full">
            {allocations.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5 text-xs bg-bg-elevated px-2.5 py-1 rounded-md">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="font-medium text-text-primary">{item.name}</span>
                <span className="text-text-muted font-mono">{item.percentage.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Holdings Table */}
        <div className="card bg-bg-surface border-bg-border lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-text-primary text-sm flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-bull" /> Open Spot Positions
            </h4>
            <button
              onClick={onResetWallet}
              className="btn-ghost text-xs py-1 px-2.5 flex items-center gap-1.5 hover:text-bear"
              title="Reset wallet to starting $10,000 USDT"
            >
              <RotateCcw className="w-3 h-3" /> Reset to $10k
            </button>
          </div>

          {positions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-text-muted text-xs">
              <Wallet className="w-8 h-8 text-bg-border mb-2" />
              <p>No active crypto holdings in wallet.</p>
              <p className="text-text-muted mt-1">Use the Quick Trade panel or activate an AI Strategy to buy spot assets.</p>
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-xs text-left">
                <thead className="text-[11px] text-text-muted uppercase border-b border-bg-border">
                  <tr>
                    <th className="pb-2">Asset</th>
                    <th className="pb-2 text-right">Holdings</th>
                    <th className="pb-2 text-right">Avg Entry</th>
                    <th className="pb-2 text-right">Live Price</th>
                    <th className="pb-2 text-right">Market Value</th>
                    <th className="pb-2 text-right">Unrealized P&L</th>
                    <th className="pb-2 text-center">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bg-border">
                  {positions.map((pos) => {
                    const isProfit = pos.unrealized_pnl >= 0
                    return (
                      <tr key={pos.symbol} className="hover:bg-bg-elevated/50 transition-colors">
                        <td className="py-2.5 font-semibold text-text-primary">
                          {pos.asset} <span className="text-text-muted text-[10px]">/USDT</span>
                        </td>
                        <td className="py-2.5 text-right font-mono text-text-primary">
                          {pos.quantity > 10 ? pos.quantity.toFixed(2) : pos.quantity.toFixed(4)}
                        </td>
                        <td className="py-2.5 text-right font-mono text-text-muted">
                          ${pos.avg_entry_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 text-right font-mono font-medium text-text-primary">
                          ${pos.current_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 text-right font-mono font-semibold text-text-primary">
                          ${pos.market_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 text-right font-mono">
                          <span className={clsx('font-semibold', isProfit ? 'text-bull' : 'text-bear')}>
                            {isProfit ? '+' : ''}${pos.unrealized_pnl.toFixed(2)} ({isProfit ? '+' : ''}{pos.unrealized_pnl_pct.toFixed(2)}%)
                          </span>
                        </td>
                        <td className="py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleQuickSell(pos.symbol, 50)}
                              className="px-2 py-0.5 rounded text-[10px] font-medium bg-bg-elevated hover:bg-bear/20 hover:text-bear text-text-secondary transition-colors"
                              title="Sell 50% of position"
                            >
                              Sell 50%
                            </button>
                            <button
                              onClick={() => handleQuickSell(pos.symbol, 100)}
                              className="px-2 py-0.5 rounded text-[10px] font-medium bg-bear/15 hover:bg-bear text-bear hover:text-white transition-colors"
                              title="Sell 100% of position"
                            >
                              Sell 100%
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
