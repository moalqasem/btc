'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { FlaskConical, Loader2, Sparkles, TrendingUp, Activity, Grid3x3, Shield } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export type AlgoStrategyType = 'ai_agent' | 'macd_rsi' | 'bollinger' | 'grid' | 'trailing'

interface Props {
  onResult: (result: any, algo: AlgoStrategyType) => void
}

const STRATEGIES = [
  { id: 'ai_agent', label: 'AI Agent', icon: Sparkles },
  { id: 'macd_rsi', label: 'MACD & RSI', icon: TrendingUp },
  { id: 'bollinger', label: 'Bollinger Bands', icon: Activity },
  { id: 'grid', label: 'Grid Trading', icon: Grid3x3 },
  { id: 'trailing', label: 'Trailing Stop', icon: Shield },
]

export default function BacktestForm({ onResult }: Props) {
  const [algo, setAlgo] = useState<AlgoStrategyType>('ai_agent')
  const [loading, setLoading] = useState(false)

  // Common parameters
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [interval, setInterval] = useState('1h')
  const [limit, setLimit] = useState('500')
  const [feeRate, setFeeRate] = useState('0.001')

  // AI Agent fields
  const [riskProfile, setRiskProfile] = useState('BALANCED')
  const [aiTradeAmount, setAiTradeAmount] = useState('1200')
  const [buyThreshold, setBuyThreshold] = useState('50')
  const [sellThreshold, setSellThreshold] = useState('-50')

  // MACD+RSI fields
  const [rsiPeriod, setRsiPeriod] = useState('14')
  const [rsiOversold, setRsiOversold] = useState('35')
  const [rsiOverbought, setRsiOverbought] = useState('65')
  const [macdAmount, setMacdAmount] = useState('1000')

  // Bollinger fields
  const [bollPeriod, setBollPeriod] = useState('20')
  const [bollStdDev, setBollStdDev] = useState('2.0')
  const [bollAmount, setBollAmount] = useState('1000')

  // Grid fields
  const [upperPrice, setUpperPrice] = useState('75000')
  const [lowerPrice, setLowerPrice] = useState('55000')
  const [gridCount, setGridCount] = useState('10')
  const [amountPerGrid, setAmountPerGrid] = useState('100')

  // Trailing Stop fields
  const [trailPct, setTrailPct] = useState('2.5')
  const [stopLossPct, setStopLossPct] = useState('5.0')
  const [positionSize, setPositionSize] = useState('1000')

  const handleRun = async () => {
    setLoading(true)
    try {
      let endpoint = ''
      let payload: any = {
        symbol: symbol.toUpperCase(),
        interval,
        limit: parseInt(limit) || 500,
        fee_rate: parseFloat(feeRate) || 0.001,
      }

      if (algo === 'ai_agent') {
        endpoint = '/api/backtest/ai-agent'
        payload = {
          ...payload,
          risk_profile: riskProfile,
          trade_amount_usdt: parseFloat(aiTradeAmount) || 1200,
          buy_threshold: parseFloat(buyThreshold) || 50,
          sell_threshold: parseFloat(sellThreshold) || -50,
        }
      } else if (algo === 'macd_rsi') {
        endpoint = '/api/backtest/macd-rsi'
        payload = {
          ...payload,
          rsi_period: parseInt(rsiPeriod) || 14,
          rsi_oversold: parseFloat(rsiOversold) || 35,
          rsi_overbought: parseFloat(rsiOverbought) || 65,
          trade_amount_usdt: parseFloat(macdAmount) || 1000,
        }
      } else if (algo === 'bollinger') {
        endpoint = '/api/backtest/bollinger'
        payload = {
          ...payload,
          period: parseInt(bollPeriod) || 20,
          num_std_dev: parseFloat(bollStdDev) || 2.0,
          trade_amount_usdt: parseFloat(bollAmount) || 1000,
        }
      } else if (algo === 'grid') {
        endpoint = '/api/backtest/grid'
        payload = {
          ...payload,
          upper_price: parseFloat(upperPrice),
          lower_price: parseFloat(lowerPrice),
          grid_count: parseInt(gridCount) || 10,
          amount_per_grid_usd: parseFloat(amountPerGrid) || 100,
        }
        if (isNaN(payload.upper_price) || isNaN(payload.lower_price)) {
          toast.error('Enter valid upper and lower price bounds for grid')
          return
        }
      } else if (algo === 'trailing') {
        endpoint = '/api/backtest/trailing'
        payload = {
          ...payload,
          trail_pct: parseFloat(trailPct) || 2.5,
          stop_loss_pct: parseFloat(stopLossPct) || 5.0,
          position_size_usd: parseFloat(positionSize) || 1000,
        }
      }

      const res = await axios.post(endpoint, payload)
      onResult(res.data, algo)
      toast.success(`Backtest completed! Simulated ${res.data.total_trades} trades.`)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || e.message || 'Backtest failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card bg-bg-surface border-bg-border p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-bg-border pb-2.5">
        <FlaskConical className="w-4 h-4 text-accent-blue" />
        <h3 className="font-semibold text-text-primary text-sm">Strategy Backtester</h3>
      </div>

      {/* Strategy Selector Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-1 bg-bg-base rounded-lg border border-bg-border text-xs">
        {STRATEGIES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setAlgo(id as AlgoStrategyType)}
            className={clsx(
              'py-1.5 px-2 rounded font-semibold transition-all flex items-center justify-center gap-1.5',
              algo === id
                ? 'bg-accent-blue text-white shadow'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Common Parameters (Coin, Interval, Candle count) */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="label text-[11px]">Symbol</label>
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="BTCUSDT"
            className="input-field py-1.5 text-xs font-mono font-bold"
          />
        </div>

        <div>
          <label className="label text-[11px]">Interval</label>
          <select
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            className="input-field py-1.5 text-xs"
          >
            <option value="15m">15m</option>
            <option value="1h">1h</option>
            <option value="4h">4h</option>
            <option value="1d">1d</option>
          </select>
        </div>

        <div>
          <label className="label text-[11px]">Candles</label>
          <input
            type="number"
            min="50"
            max="1000"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className="input-field py-1.5 text-xs font-mono"
          />
        </div>
      </div>

      {/* Strategy-Specific Parameter Inputs */}
      <motion.div
        key={algo}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
      >
        {/* ── AI Agent Parameters ────────────────────────────────────────── */}
        {algo === 'ai_agent' && (
          <div className="space-y-2 bg-bg-base/60 p-3 rounded-lg border border-bg-border text-xs">
            <span className="font-semibold text-text-primary text-[11px] block">AI Agent Parameters</span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label text-[10px]">Risk Profile</label>
                <select
                  value={riskProfile}
                  onChange={(e) => setRiskProfile(e.target.value)}
                  className="input-field py-1 text-xs"
                >
                  <option value="CONSERVATIVE">Conservative</option>
                  <option value="BALANCED">Balanced</option>
                  <option value="AGGRESSIVE">Aggressive</option>
                </select>
              </div>

              <div>
                <label className="label text-[10px]">Position Size ($)</label>
                <input
                  type="number"
                  value={aiTradeAmount}
                  onChange={(e) => setAiTradeAmount(e.target.value)}
                  className="input-field py-1 text-xs font-mono"
                />
              </div>

              <div>
                <label className="label text-[10px]">Buy Confidence (+)</label>
                <input
                  type="number"
                  value={buyThreshold}
                  onChange={(e) => setBuyThreshold(e.target.value)}
                  className="input-field py-1 text-xs font-mono"
                />
              </div>

              <div>
                <label className="label text-[10px]">Sell Confidence (-)</label>
                <input
                  type="number"
                  value={sellThreshold}
                  onChange={(e) => setSellThreshold(e.target.value)}
                  className="input-field py-1 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── MACD + RSI Parameters ──────────────────────────────────────── */}
        {algo === 'macd_rsi' && (
          <div className="space-y-2 bg-bg-base/60 p-3 rounded-lg border border-bg-border text-xs">
            <span className="font-semibold text-text-primary text-[11px] block">MACD & RSI Parameters</span>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label text-[10px]">RSI Oversold</label>
                <input
                  type="number"
                  value={rsiOversold}
                  onChange={(e) => setRsiOversold(e.target.value)}
                  className="input-field py-1 text-xs font-mono"
                />
              </div>
              <div>
                <label className="label text-[10px]">RSI Overbought</label>
                <input
                  type="number"
                  value={rsiOverbought}
                  onChange={(e) => setRsiOverbought(e.target.value)}
                  className="input-field py-1 text-xs font-mono"
                />
              </div>
              <div>
                <label className="label text-[10px]">Trade Amount ($)</label>
                <input
                  type="number"
                  value={macdAmount}
                  onChange={(e) => setMacdAmount(e.target.value)}
                  className="input-field py-1 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Bollinger Parameters ───────────────────────────────────────── */}
        {algo === 'bollinger' && (
          <div className="space-y-2 bg-bg-base/60 p-3 rounded-lg border border-bg-border text-xs">
            <span className="font-semibold text-text-primary text-[11px] block">Bollinger Bands Parameters</span>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label text-[10px]">Period</label>
                <input
                  type="number"
                  value={bollPeriod}
                  onChange={(e) => setBollPeriod(e.target.value)}
                  className="input-field py-1 text-xs font-mono"
                />
              </div>
              <div>
                <label className="label text-[10px]">Std Dev</label>
                <input
                  type="number"
                  step="0.1"
                  value={bollStdDev}
                  onChange={(e) => setBollStdDev(e.target.value)}
                  className="input-field py-1 text-xs font-mono"
                />
              </div>
              <div>
                <label className="label text-[10px]">Trade Amount ($)</label>
                <input
                  type="number"
                  value={bollAmount}
                  onChange={(e) => setBollAmount(e.target.value)}
                  className="input-field py-1 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Grid Parameters ────────────────────────────────────────────── */}
        {algo === 'grid' && (
          <div className="space-y-2 bg-bg-base/60 p-3 rounded-lg border border-bg-border text-xs">
            <span className="font-semibold text-text-primary text-[11px] block">Grid Trading Parameters</span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label text-[10px]">Upper Price ($)</label>
                <input
                  type="number"
                  value={upperPrice}
                  onChange={(e) => setUpperPrice(e.target.value)}
                  className="input-field py-1 text-xs font-mono"
                />
              </div>
              <div>
                <label className="label text-[10px]">Lower Price ($)</label>
                <input
                  type="number"
                  value={lowerPrice}
                  onChange={(e) => setLowerPrice(e.target.value)}
                  className="input-field py-1 text-xs font-mono"
                />
              </div>
              <div>
                <label className="label text-[10px]">Grid Count</label>
                <input
                  type="number"
                  value={gridCount}
                  onChange={(e) => setGridCount(e.target.value)}
                  className="input-field py-1 text-xs font-mono"
                />
              </div>
              <div>
                <label className="label text-[10px]">$ per Grid</label>
                <input
                  type="number"
                  value={amountPerGrid}
                  onChange={(e) => setAmountPerGrid(e.target.value)}
                  className="input-field py-1 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Trailing Stop Parameters ───────────────────────────────────── */}
        {algo === 'trailing' && (
          <div className="space-y-2 bg-bg-base/60 p-3 rounded-lg border border-bg-border text-xs">
            <span className="font-semibold text-text-primary text-[11px] block">Trailing Stop Parameters</span>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label text-[10px]">Trail (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={trailPct}
                  onChange={(e) => setTrailPct(e.target.value)}
                  className="input-field py-1 text-xs font-mono"
                />
              </div>
              <div>
                <label className="label text-[10px]">Hard Stop Loss (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={stopLossPct}
                  onChange={(e) => setStopLossPct(e.target.value)}
                  className="input-field py-1 text-xs font-mono"
                />
              </div>
              <div>
                <label className="label text-[10px]">Position Size ($)</label>
                <input
                  type="number"
                  value={positionSize}
                  onChange={(e) => setPositionSize(e.target.value)}
                  className="input-field py-1 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Fee Rate Setting */}
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>Binance Spot Fee Rate:</span>
        <span className="font-mono text-text-primary font-medium">0.1% (Maker/Taker)</span>
      </div>

      {/* Execute Backtest Button */}
      <button
        onClick={handleRun}
        disabled={loading}
        className="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2 shadow-glow"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Running Historical Simulation...
          </>
        ) : (
          <>
            <FlaskConical className="w-4 h-4" /> Run Backtest Simulation
          </>
        )}
      </button>
    </div>
  )
}
