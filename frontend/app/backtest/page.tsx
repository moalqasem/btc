'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import DashboardLayout from '@/components/layout/DashboardLayout'
import BacktestForm, { AlgoStrategyType } from '@/components/backtest/BacktestForm'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart2, Info } from 'lucide-react'

const BacktestResults = dynamic(() => import('@/components/backtest/BacktestResults'), {
  ssr: false,
  loading: () => (
    <div className="card animate-pulse py-16 text-center text-text-muted text-xs">
      Loading backtest results...
    </div>
  ),
})

export default function BacktestPage() {
  const [result, setResult] = useState<any | null>(null)
  const [algoType, setAlgoType] = useState<AlgoStrategyType>('ai_agent')

  return (
    <DashboardLayout>
      <div className="max-w-[1200px] mx-auto space-y-4">
        {/* Page Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center">
            <BarChart2 className="w-5 h-5 text-accent-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Backtesting Engine</h1>
            <p className="text-text-muted text-sm">
              Simulate AI Agent, MACD+RSI, Bollinger Bands, Grid, or Trailing Stop strategies on historical Binance spot data
            </p>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-2 bg-accent-blue/5 border border-accent-blue/20 rounded-lg p-3 text-xs text-text-secondary">
          <Info className="w-3.5 h-3.5 text-accent-blue flex-shrink-0 mt-0.5" />
          <span>
            This backtester uses <strong>Spot Market only</strong> historical OHLCV data from Binance.
            Past performance does not guarantee future results. Fees default to 0.1% (Binance maker rate).
            Starting balance is always $10,000.
          </span>
        </div>

        {/* Two Column: Form + Results */}
        <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-4 items-start">
          {/* Form */}
          <BacktestForm onResult={(r, type) => { setResult(r); setAlgoType(type) }} />

          {/* Results */}
          <AnimatePresence mode="wait">
            {result ? (
              <BacktestResults key="results" result={result} />
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="card flex flex-col items-center justify-center py-20 text-center"
              >
                <BarChart2 className="w-12 h-12 text-bg-border mb-4" />
                <p className="text-text-secondary font-medium">No backtest results yet</p>
                <p className="text-text-muted text-sm mt-1">
                  Configure your strategy on the left and click "Run Backtest"
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </DashboardLayout>
  )
}
