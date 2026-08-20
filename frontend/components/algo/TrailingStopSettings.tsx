'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingDown, Play, Square, ChevronDown, ChevronUp, Shield } from 'lucide-react'
import { useAlgo, TrailingStatus } from '@/hooks/useAlgo'
import { PriceMap } from '@/hooks/useLivePrices'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Props {
  prices: PriceMap
}

export default function TrailingStopSettings({ prices }: Props) {
  const { trailingStatus, loadingTrailing, startTrailing, stopTrailing } = useAlgo()
  const [expanded, setExpanded] = useState(true)

  const [form, setForm] = useState({
    symbol: 'BTCUSDT',
    quantity: '',
    trail_pct: '2',
    stop_loss_pct: '5',
    entry_price: '',
  })

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const currentPrice = prices[form.symbol.toUpperCase()]?.price

  const handleStart = async () => {
    try {
      const params: any = {
        symbol: form.symbol.toUpperCase(),
        quantity: parseFloat(form.quantity),
        trail_pct: parseFloat(form.trail_pct),
        stop_loss_pct: parseFloat(form.stop_loss_pct),
      }

      if (form.entry_price) {
        params.entry_price = parseFloat(form.entry_price)
      }

      if (isNaN(params.quantity) || params.quantity <= 0) {
        toast.error('Enter a valid quantity')
        return
      }

      await startTrailing(params)
      toast.success(`Trailing stop active — trail ${params.trail_pct}%, stop loss ${params.stop_loss_pct}%`)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || e.message || 'Failed to start trailing stop')
    }
  }

  const handleStop = async () => {
    try {
      await stopTrailing()
      toast.success('Trailing stop deactivated')
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to stop trailing stop')
    }
  }

  const isRunning = trailingStatus.running
  const isTriggered = trailingStatus.triggered

  const trailProgress = trailingStatus.peak_price && trailingStatus.trail_price && trailingStatus.current_price
    ? Math.max(0, Math.min(100,
        ((trailingStatus.current_price - trailingStatus.trail_price) /
        (trailingStatus.peak_price - trailingStatus.trail_price)) * 100
      ))
    : null

  return (
    <div className="card">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-accent-blue" />
          <span className="font-medium text-text-primary text-sm">Trailing Stop</span>
          {isRunning && !isTriggered && (
            <span className="flex items-center gap-1 badge-bull text-[10px]">
              <span className="w-1.5 h-1.5 bg-bull rounded-full animate-pulse" />
              ACTIVE
            </span>
          )}
          {isTriggered && (
            <span className="badge-bear text-[10px]">TRIGGERED</span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-3">
              {/* Symbol */}
              <div>
                <label className="label">Symbol (SPOT)</label>
                <select
                  value={form.symbol}
                  onChange={e => set('symbol', e.target.value)}
                  disabled={isRunning}
                  className="input-field"
                >
                  {['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Current price hint */}
              {currentPrice && (
                <p className="text-xs text-text-muted">
                  Market Price: <span className="font-mono text-text-secondary">
                    ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </p>
              )}

              {/* Quantity & Entry Price */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Quantity (Asset)</label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="e.g. 0.01"
                    step="0.001"
                    value={form.quantity}
                    onChange={e => set('quantity', e.target.value)}
                    disabled={isRunning}
                  />
                </div>
                <div>
                  <label className="label">Entry Price ($)</label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="Leave blank for market"
                    value={form.entry_price}
                    onChange={e => set('entry_price', e.target.value)}
                    disabled={isRunning}
                  />
                </div>
              </div>

              {/* Trail % & Stop Loss % */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Trail Distance (%)</label>
                  <input
                    type="number"
                    className="input-field"
                    min="0.1"
                    max="50"
                    step="0.1"
                    value={form.trail_pct}
                    onChange={e => set('trail_pct', e.target.value)}
                    disabled={isRunning}
                  />
                </div>
                <div>
                  <label className="label">Hard Stop Loss (%)</label>
                  <input
                    type="number"
                    className="input-field"
                    min="0.1"
                    max="50"
                    step="0.1"
                    value={form.stop_loss_pct}
                    onChange={e => set('stop_loss_pct', e.target.value)}
                    disabled={isRunning}
                  />
                </div>
              </div>

              {/* Status info when running */}
              {(isRunning || isTriggered) && (
                <div className={clsx(
                  'border rounded-lg p-3 text-xs space-y-2',
                  isTriggered ? 'bg-bear/5 border-bear/20' : 'bg-accent-blue/5 border-accent-blue/20'
                )}>
                  {trailProgress !== null && !isTriggered && (
                    <div>
                      <div className="flex justify-between text-text-secondary mb-1">
                        <span>Distance to trail</span>
                        <span className="font-mono">{trailProgress.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-bull rounded-full"
                          animate={{ width: `${trailProgress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {trailingStatus.peak_price && (
                      <><span className="text-text-secondary">Peak</span>
                      <span className="font-mono text-text-primary text-right">
                        ${trailingStatus.peak_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span></>
                    )}
                    {trailingStatus.trail_price && (
                      <><span className="text-text-secondary">Trail floor</span>
                      <span className="font-mono text-bear text-right">
                        ${trailingStatus.trail_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span></>
                    )}
                    {trailingStatus.realized_pnl !== undefined && trailingStatus.realized_pnl !== null && (
                      <><span className="text-text-secondary">Realized P&L</span>
                      <span className={clsx(
                        'font-mono text-right',
                        trailingStatus.realized_pnl >= 0 ? 'text-bull' : 'text-bear'
                      )}>
                        {trailingStatus.realized_pnl >= 0 ? '+' : ''}${trailingStatus.realized_pnl.toFixed(4)}
                      </span></>
                    )}
                  </div>

                  {isTriggered && (
                    <p className="text-bear font-medium">
                      ⚡ Sell triggered @ ${trailingStatus.trigger_price?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              )}

              {/* Action */}
              {!isRunning ? (
                <button
                  onClick={handleStart}
                  disabled={loadingTrailing}
                  className="btn-success w-full flex items-center justify-center gap-2"
                >
                  <Play className="w-3.5 h-3.5" />
                  Activate Trailing Stop
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  disabled={loadingTrailing}
                  className="btn-danger w-full flex items-center justify-center gap-2"
                >
                  <Square className="w-3.5 h-3.5" />
                  Deactivate
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
