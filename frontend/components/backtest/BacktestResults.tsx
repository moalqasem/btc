'use client'
import { motion } from 'framer-motion'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Target, Activity, DollarSign, Percent } from 'lucide-react'
import clsx from 'clsx'
import { format, fromUnixTime } from 'date-fns'

interface BacktestResult {
  strategy: string
  symbol: string
  interval: string
  start_balance: number
  end_balance: number
  total_return_pct: number
  total_trades: number
  winning_trades: number
  losing_trades: number
  win_rate_pct: number
  max_drawdown_pct: number
  sharpe_ratio: number
  total_fees_usd: number
  equity_curve: Array<{ time: number; value: number }>
  trades: Array<{
    time: number
    side: string
    price: number
    quantity: number
    total_usd: number
    pnl?: number
    reason?: string
  }>
}

interface Props {
  result: BacktestResult
}

function MetricCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string
  value: string
  sub?: string
  positive?: boolean | null
}) {
  return (
    <div className="card text-center">
      <p className="stat-label">{label}</p>
      <p className={clsx(
        'stat-value text-xl',
        positive === true ? 'text-bull'
          : positive === false ? 'text-bear'
          : 'text-text-primary'
      )}>
        {value}
      </p>
      {sub && <p className="text-text-muted text-xs mt-0.5">{sub}</p>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-surface border border-bg-border rounded-lg px-3 py-2 text-xs shadow-card">
      <p className="text-text-muted mb-1">
        {typeof label === 'number' ? format(fromUnixTime(label), 'MMM dd, HH:mm') : label}
      </p>
      <p className="font-mono text-text-primary font-semibold">
        ${payload[0].value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  )
}

export default function BacktestResults({ result }: Props) {
  const isPositive = result.total_return_pct >= 0
  const chartData = result.equity_curve.map(p => ({
    time: p.time,
    value: p.value,
    label: format(fromUnixTime(p.time), 'MMM dd'),
  }))

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-text-primary">
            {result.strategy} — {result.symbol} ({result.interval})
          </h3>
          <p className="text-text-muted text-xs">{result.total_trades} trades simulated over {result.equity_curve.length} candles</p>
        </div>
        <span className={clsx(
          'font-mono font-bold text-lg',
          isPositive ? 'text-bull' : 'text-bear'
        )}>
          {isPositive ? '+' : ''}{result.total_return_pct.toFixed(2)}%
        </span>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        <MetricCard
          label="Final Balance"
          value={`$${result.end_balance.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          positive={result.end_balance >= result.start_balance ? true : false}
        />
        <MetricCard
          label="Total Return"
          value={`${isPositive ? '+' : ''}${result.total_return_pct.toFixed(2)}%`}
          positive={isPositive}
        />
        <MetricCard
          label="Win Rate"
          value={`${result.win_rate_pct.toFixed(1)}%`}
          sub={`${result.winning_trades}W / ${result.losing_trades}L`}
          positive={result.win_rate_pct >= 50 ? true : null}
        />
        <MetricCard
          label="Max Drawdown"
          value={`${result.max_drawdown_pct.toFixed(2)}%`}
          positive={false}
        />
        <MetricCard
          label="Sharpe Ratio"
          value={result.sharpe_ratio.toFixed(2)}
          positive={result.sharpe_ratio > 1 ? true : result.sharpe_ratio < 0 ? false : null}
        />
        <MetricCard
          label="Fees Paid"
          value={`$${result.total_fees_usd.toFixed(2)}`}
        />
      </div>

      {/* Equity Curve Chart */}
      <div className="card">
        <h4 className="text-sm font-medium text-text-secondary mb-3">Equity Curve</h4>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isPositive ? '#10B981' : '#F43F5E'} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={isPositive ? '#10B981' : '#F43F5E'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#475569', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: '#475569', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => `$${(v / 1000).toFixed(1)}k`}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={isPositive ? '#10B981' : '#F43F5E'}
                strokeWidth={2}
                fill="url(#equityGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trade Log */}
      <div className="card">
        <h4 className="text-sm font-medium text-text-secondary mb-3">
          Trade Log ({result.trades.length})
        </h4>
        <div className="max-h-52 overflow-y-auto space-y-1">
          {result.trades.map((trade, i) => (
            <div
              key={i}
              className={clsx(
                'flex items-center justify-between py-1.5 px-2.5 rounded text-xs',
                trade.side === 'BUY' ? 'bg-bull/5' : 'bg-bear/5'
              )}
            >
              <div className="flex items-center gap-2">
                <span className={clsx(
                  'font-semibold w-7',
                  trade.side === 'BUY' ? 'text-bull' : 'text-bear'
                )}>
                  {trade.side}
                </span>
                <span className="text-text-muted">
                  {format(fromUnixTime(trade.time), 'MMM dd HH:mm')}
                </span>
                {trade.reason && (
                  <span className="badge-neutral text-[10px]">{trade.reason}</span>
                )}
              </div>
              <div className="text-right font-mono">
                <span className="text-text-primary">${trade.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                {trade.pnl !== undefined && (
                  <span className={clsx('ml-2', trade.pnl >= 0 ? 'text-bull' : 'text-bear')}>
                    {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
