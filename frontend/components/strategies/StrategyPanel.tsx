'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  TrendingUp,
  Activity,
  Grid3x3,
  Shield,
  Play,
  CheckCircle2,
  Sliders,
  DollarSign,
  Zap,
} from 'lucide-react'
import clsx from 'clsx'
import { useStrategies } from '@/hooks/useStrategies'
import GridSettings from '@/components/algo/GridSettings'
import TrailingStopSettings from '@/components/algo/TrailingStopSettings'
import { PriceMap } from '@/hooks/useLivePrices'
import toast from 'react-hot-toast'

interface Props {
  selectedSymbol: string
  prices: PriceMap
}

type StrategyTab = 'ai' | 'macd_rsi' | 'bollinger' | 'grid' | 'trailing'

export default function StrategyPanel({ selectedSymbol, prices }: Props) {
  const [activeTab, setActiveTab] = useState<StrategyTab>('ai')
  const { startMacdRsi, startBollinger, startAiAgent, loading } = useStrategies()

  // AI Agent Form State
  const [aiRisk, setAiRisk] = useState('BALANCED')
  const [aiAmount, setAiAmount] = useState('600')
  const [aiInterval, setAiInterval] = useState('1h')

  // MACD + RSI Form State
  const [macdOversold, setMacdOversold] = useState('35')
  const [macdOverbought, setMacdOverbought] = useState('65')
  const [macdAmount, setMacdAmount] = useState('500')
  const [macdInterval, setMacdInterval] = useState('1h')

  // Bollinger Form State
  const [bollPeriod, setBollPeriod] = useState('20')
  const [bollStdDev, setBollStdDev] = useState('2.0')
  const [bollAmount, setBollAmount] = useState('500')
  const [bollInterval, setBollInterval] = useState('1h')

  const handleStartAi = async () => {
    try {
      await startAiAgent({
        symbol: selectedSymbol,
        risk_profile: aiRisk,
        trade_amount_usdt: parseFloat(aiAmount) || 600,
        candle_interval: aiInterval,
      })
    } catch {
      // Toast handled in hook
    }
  }

  const handleStartMacd = async () => {
    try {
      await startMacdRsi({
        symbol: selectedSymbol,
        rsi_oversold: parseFloat(macdOversold) || 35,
        rsi_overbought: parseFloat(macdOverbought) || 65,
        trade_amount_usdt: parseFloat(macdAmount) || 500,
        candle_interval: macdInterval,
      })
    } catch {
      // Toast handled in hook
    }
  }

  const handleStartBoll = async () => {
    try {
      await startBollinger({
        symbol: selectedSymbol,
        period: parseInt(bollPeriod) || 20,
        num_std_dev: parseFloat(bollStdDev) || 2.0,
        trade_amount_usdt: parseFloat(bollAmount) || 500,
        candle_interval: bollInterval,
      })
    } catch {
      // Toast handled in hook
    }
  }

  return (
    <div className="card bg-bg-surface border-bg-border p-4 flex flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-bg-border pb-2.5">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-accent-blue" />
          <h3 className="font-semibold text-text-primary text-sm">Automated Strategy Launcher</h3>
        </div>
        <span className="badge-neutral text-xs font-mono">{selectedSymbol}</span>
      </div>

      {/* Strategy Selector Tabs */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-1 p-1 bg-bg-base rounded-lg border border-bg-border text-xs">
        <button
          onClick={() => setActiveTab('ai')}
          className={clsx(
            'py-1.5 px-2 rounded-md font-semibold transition-all flex items-center justify-center gap-1',
            activeTab === 'ai'
              ? 'bg-accent-blue text-white shadow'
              : 'text-text-muted hover:text-text-primary'
          )}
        >
          <Sparkles className="w-3.5 h-3.5" /> AI Agent
        </button>

        <button
          onClick={() => setActiveTab('macd_rsi')}
          className={clsx(
            'py-1.5 px-2 rounded-md font-semibold transition-all flex items-center justify-center gap-1',
            activeTab === 'macd_rsi'
              ? 'bg-accent-blue text-white shadow'
              : 'text-text-muted hover:text-text-primary'
          )}
        >
          <TrendingUp className="w-3.5 h-3.5" /> MACD & RSI
        </button>

        <button
          onClick={() => setActiveTab('bollinger')}
          className={clsx(
            'py-1.5 px-2 rounded-md font-semibold transition-all flex items-center justify-center gap-1',
            activeTab === 'bollinger'
              ? 'bg-accent-blue text-white shadow'
              : 'text-text-muted hover:text-text-primary'
          )}
        >
          <Activity className="w-3.5 h-3.5" /> Bollinger
        </button>

        <button
          onClick={() => setActiveTab('grid')}
          className={clsx(
            'py-1.5 px-2 rounded-md font-semibold transition-all flex items-center justify-center gap-1',
            activeTab === 'grid'
              ? 'bg-accent-blue text-white shadow'
              : 'text-text-muted hover:text-text-primary'
          )}
        >
          <Grid3x3 className="w-3.5 h-3.5" /> Grid
        </button>

        <button
          onClick={() => setActiveTab('trailing')}
          className={clsx(
            'py-1.5 px-2 rounded-md font-semibold transition-all flex items-center justify-center gap-1',
            activeTab === 'trailing'
              ? 'bg-accent-blue text-white shadow'
              : 'text-text-muted hover:text-text-primary'
          )}
        >
          <Shield className="w-3.5 h-3.5" /> Trail Stop
        </button>
      </div>

      {/* Tab Panels with Smooth Transitions */}
      <AnimatePresence mode="wait">
        {/* ── TAB 1: AI TRADING AGENT ─────────────────────────────────────── */}
        {activeTab === 'ai' && (
          <motion.div
            key="ai"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-3"
          >
            <div className="bg-accent-blue/10 border border-accent-blue/20 rounded-lg p-3 text-xs text-text-secondary space-y-1">
              <p className="font-semibold text-text-primary flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-accent-blue" /> Smart Volatility AI Bot
              </p>
              <p className="text-[11px] text-text-muted">
                Dynamically adapts buy/sell thresholds using <strong>ATR Volatility</strong>, multi-factor momentum, and volume surge scoring to buy dips and sell peaks autonomously.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label text-[11px]">Risk Profile</label>
                <select
                  value={aiRisk}
                  onChange={(e) => setAiRisk(e.target.value)}
                  className="input-field py-1.5 text-xs"
                >
                  <option value="CONSERVATIVE">Conservative</option>
                  <option value="BALANCED">Balanced</option>
                  <option value="AGGRESSIVE">Aggressive</option>
                </select>
              </div>

              <div>
                <label className="label text-[11px]">Interval</label>
                <select
                  value={aiInterval}
                  onChange={(e) => setAiInterval(e.target.value)}
                  className="input-field py-1.5 text-xs"
                >
                  <option value="15m">15 Minutes</option>
                  <option value="1h">1 Hour</option>
                  <option value="4h">4 Hours</option>
                </select>
              </div>

              <div>
                <label className="label text-[11px]">Amount per Trade ($)</label>
                <input
                  type="number"
                  min="20"
                  value={aiAmount}
                  onChange={(e) => setAiAmount(e.target.value)}
                  className="input-field py-1.5 text-xs font-mono"
                  placeholder="600"
                />
              </div>
            </div>

            <button
              onClick={handleStartAi}
              disabled={loading}
              className="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 shadow"
            >
              <Sparkles className="w-4 h-4" /> Activate AI Bot on {selectedSymbol}
            </button>
          </motion.div>
        )}

        {/* ── TAB 2: MACD + RSI MOMENTUM ─────────────────────────────────── */}
        {activeTab === 'macd_rsi' && (
          <motion.div
            key="macd_rsi"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-3"
          >
            <div className="bg-bg-elevated/60 border border-bg-border rounded-lg p-3 text-xs text-text-muted">
              Buys when <strong>RSI &lt; {macdOversold}</strong> and MACD line crosses above Signal. Sells when <strong>RSI &gt; {macdOverbought}</strong> and MACD crosses down.
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="label text-[11px]">RSI Oversold</label>
                <input
                  type="number"
                  value={macdOversold}
                  onChange={(e) => setMacdOversold(e.target.value)}
                  className="input-field py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="label text-[11px]">RSI Overbought</label>
                <input
                  type="number"
                  value={macdOverbought}
                  onChange={(e) => setMacdOverbought(e.target.value)}
                  className="input-field py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="label text-[11px]">Interval</label>
                <select
                  value={macdInterval}
                  onChange={(e) => setMacdInterval(e.target.value)}
                  className="input-field py-1.5 text-xs"
                >
                  <option value="15m">15m</option>
                  <option value="1h">1h</option>
                  <option value="4h">4h</option>
                </select>
              </div>
              <div>
                <label className="label text-[11px]">Trade Amount ($)</label>
                <input
                  type="number"
                  value={macdAmount}
                  onChange={(e) => setMacdAmount(e.target.value)}
                  className="input-field py-1.5 text-xs font-mono"
                />
              </div>
            </div>

            <button
              onClick={handleStartMacd}
              disabled={loading}
              className="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 shadow"
            >
              <TrendingUp className="w-4 h-4" /> Start MACD & RSI Bot
            </button>
          </motion.div>
        )}

        {/* ── TAB 3: BOLLINGER MEAN REVERSION ────────────────────────────── */}
        {activeTab === 'bollinger' && (
          <motion.div
            key="bollinger"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-3"
          >
            <div className="bg-bg-elevated/60 border border-bg-border rounded-lg p-3 text-xs text-text-muted">
              Buys when price dips below the <strong>Lower Bollinger Band</strong>. Sells at the <strong>Upper Band</strong> profit target.
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="label text-[11px]">SMA Period</label>
                <input
                  type="number"
                  value={bollPeriod}
                  onChange={(e) => setBollPeriod(e.target.value)}
                  className="input-field py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="label text-[11px]">Std Dev (Multi)</label>
                <input
                  type="number"
                  step="0.1"
                  value={bollStdDev}
                  onChange={(e) => setBollStdDev(e.target.value)}
                  className="input-field py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="label text-[11px]">Interval</label>
                <select
                  value={bollInterval}
                  onChange={(e) => setBollInterval(e.target.value)}
                  className="input-field py-1.5 text-xs"
                >
                  <option value="15m">15m</option>
                  <option value="1h">1h</option>
                  <option value="4h">4h</option>
                </select>
              </div>
              <div>
                <label className="label text-[11px]">Trade Amount ($)</label>
                <input
                  type="number"
                  value={bollAmount}
                  onChange={(e) => setBollAmount(e.target.value)}
                  className="input-field py-1.5 text-xs font-mono"
                />
              </div>
            </div>

            <button
              onClick={handleStartBoll}
              disabled={loading}
              className="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 shadow"
            >
              <Activity className="w-4 h-4" /> Start Bollinger Bot
            </button>
          </motion.div>
        )}

        {/* ── TAB 4: SPOT GRID TRADING ───────────────────────────────────── */}
        {activeTab === 'grid' && (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <GridSettings />
          </motion.div>
        )}

        {/* ── TAB 5: TRAILING STOP ───────────────────────────────────────── */}
        {activeTab === 'trailing' && (
          <motion.div
            key="trailing"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <TrailingStopSettings prices={prices} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
