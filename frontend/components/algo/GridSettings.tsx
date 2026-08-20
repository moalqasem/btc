'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Grid3x3, Play, Square, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useAlgo, GridStatus } from '@/hooks/useAlgo'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Props {
  onStatusChange?: (status: GridStatus) => void
}

export default function GridSettings({ onStatusChange }: Props) {
  const { gridStatus, loadingGrid, startGrid, stopGrid } = useAlgo()
  const [expanded, setExpanded] = useState(true)

  const [form, setForm] = useState({
    symbol: 'BTCUSDT',
    upper_price: '',
    lower_price: '',
    grid_count: '10',
    amount_per_grid_usd: '100',
  })

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const handleStart = async () => {
    try {
      const params = {
        symbol: form.symbol.toUpperCase(),
        upper_price: parseFloat(form.upper_price),
        lower_price: parseFloat(form.lower_price),
        grid_count: parseInt(form.grid_count),
        amount_per_grid_usd: parseFloat(form.amount_per_grid_usd),
      }

      if (isNaN(params.upper_price) || isNaN(params.lower_price)) {
        toast.error('Enter valid upper and lower price bounds')
        return
      }
      if (params.upper_price <= params.lower_price) {
        toast.error('Upper price must be greater than lower price')
        return
      }

      const result = await startGrid(params)
      onStatusChange?.(result.status)
      toast.success(`Grid started: ${params.grid_count} levels on ${params.symbol}`)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || e.message || 'Failed to start grid')
    }
  }

  const handleStop = async () => {
    try {
      await stopGrid()
      toast.success('Grid stopped')
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to stop grid')
    }
  }

  const isRunning = gridStatus.running

  return (
    <div className="card">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between mb-0"
      >
        <div className="flex items-center gap-2">
          <Grid3x3 className="w-4 h-4 text-accent-blue" />
          <span className="font-medium text-text-primary text-sm">Grid Trading</span>
          {isRunning && (
            <span className="flex items-center gap-1 badge-bull text-[10px]">
              <span className="w-1.5 h-1.5 bg-bull rounded-full animate-pulse" />
              ACTIVE
            </span>
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

              {/* Price Range */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Upper Price ($)</label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="e.g. 70000"
                    value={form.upper_price}
                    onChange={e => set('upper_price', e.target.value)}
                    disabled={isRunning}
                  />
                </div>
                <div>
                  <label className="label">Lower Price ($)</label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="e.g. 60000"
                    value={form.lower_price}
                    onChange={e => set('lower_price', e.target.value)}
                    disabled={isRunning}
                  />
                </div>
              </div>

              {/* Grid Count & Amount */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Grid Levels</label>
                  <input
                    type="number"
                    className="input-field"
                    min="2"
                    max="100"
                    value={form.grid_count}
                    onChange={e => set('grid_count', e.target.value)}
                    disabled={isRunning}
                  />
                </div>
                <div>
                  <label className="label">$ per Grid Level</label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="100"
                    value={form.amount_per_grid_usd}
                    onChange={e => set('amount_per_grid_usd', e.target.value)}
                    disabled={isRunning}
                  />
                </div>
              </div>

              {/* Status info when running */}
              {isRunning && gridStatus.grid_profit !== undefined && (
                <div className="bg-bull/5 border border-bull/20 rounded-lg p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Trades Executed</span>
                    <span className="font-mono text-text-primary">{gridStatus.total_trades}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Grid Profit</span>
                    <span className={clsx(
                      'font-mono',
                      (gridStatus.grid_profit ?? 0) >= 0 ? 'text-bull' : 'text-bear'
                    )}>
                      ${(gridStatus.grid_profit ?? 0).toFixed(4)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Last Price</span>
                    <span className="font-mono text-text-primary">
                      ${gridStatus.last_price?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}

              {/* Action Button */}
              {!isRunning ? (
                <button
                  onClick={handleStart}
                  disabled={loadingGrid}
                  className="btn-success w-full flex items-center justify-center gap-2"
                >
                  <Play className="w-3.5 h-3.5" />
                  Start Grid
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  disabled={loadingGrid}
                  className="btn-danger w-full flex items-center justify-center gap-2"
                >
                  <Square className="w-3.5 h-3.5" />
                  Stop Grid
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
