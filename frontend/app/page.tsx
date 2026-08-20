'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import DashboardLayout from '@/components/layout/DashboardLayout'
import MarketWatch from '@/components/market/MarketWatch'
import QuickTradeCard from '@/components/trading/QuickTradeCard'
import LedgerTable from '@/components/portfolio/LedgerTable'
import StrategyPanel from '@/components/strategies/StrategyPanel'
import ActiveBotsCard from '@/components/strategies/ActiveBotsCard'
import clsx from 'clsx'
import { useTrading } from '@/context/TradingContext'

const CandlestickChart = dynamic(() => import('@/components/chart/CandlestickChart'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full min-h-[430px] bg-bg-surface text-text-muted text-xs">
      Loading chart engine...
    </div>
  ),
})

const WalletDashboard = dynamic(() => import('@/components/portfolio/WalletDashboard'), {
  ssr: false,
  loading: () => (
    <div className="card animate-pulse py-16 text-center text-text-muted text-xs">
      Loading wallet & asset distribution...
    </div>
  ),
})

export default function SimulatorPage() {
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT')
  const [activeTab, setActiveTab] = useState<'market' | 'portfolio' | 'strategies'>('market')

  const {
    prices,
    tickers,
    top100List,
    wallet,
    ledger,
    walletLoading,
    executeBuy,
    executeSell,
    resetWallet,
    activeStrategies,
    stopMacdRsi,
    stopBollinger,
    stopAiAgent,
    gridStatus,
    trailingStatus,
  } = useTrading()

  const currentPrice = prices[selectedSymbol]?.price || tickers[selectedSymbol]?.price

  // Extract grid levels & trailing lines for chart overlay
  const gridLevels = gridStatus.running && gridStatus.symbol === selectedSymbol
    ? gridStatus.levels
    : undefined
  const trailPrice = trailingStatus.running && trailingStatus.symbol === selectedSymbol
    ? trailingStatus.trail_price
    : undefined
  const peakPrice = trailingStatus.running && trailingStatus.symbol === selectedSymbol
    ? trailingStatus.peak_price
    : undefined

  // Chart trade markers from ledger (sorted ascending for lightweight-charts)
  const chartMarkers = ledger
    .filter(t => t.symbol === selectedSymbol && t.timestamp)
    .map(t => ({
      time: Math.floor(new Date(t.timestamp).getTime() / 1000),
      side: t.side,
      price: t.price,
    }))
    .filter(m => !isNaN(m.time))
    .sort((a, b) => a.time - b.time)

  return (
    <DashboardLayout
      activeMainTab={activeTab}
      onSelectMainTab={setActiveTab}
    >
      <AnimatePresence mode="wait">
        {/* ── VIEW 1: TRADING TERMINAL / MARKET VIEW ──────────────────────── */}
        {activeTab === 'market' && (
          <motion.div
            key="market-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-3 sm:space-y-4 max-w-[1550px] mx-auto"
          >
            {/* Quick Coin Selector Chips (Horizontal Scroll on Mobile) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              {['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT'].map((sym) => {
                const tick = tickers[sym]
                const isSelected = selectedSymbol === sym
                const clean = sym.replace('USDT', '')
                const pct = tick?.priceChangePercent || 0
                return (
                  <button
                    key={sym}
                    onClick={() => setSelectedSymbol(sym)}
                    className={clsx(
                      'flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono transition-all',
                      isSelected
                        ? 'bg-accent-blue/15 border-accent-blue text-text-primary shadow-sm'
                        : 'bg-bg-surface border-bg-border text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                    )}
                  >
                    <span className="font-bold">{clean}</span>
                    <span className="text-[11px] font-medium text-text-muted">
                      ${tick ? (tick.price > 100 ? tick.price.toFixed(2) : tick.price.toFixed(3)) : '—'}
                    </span>
                    <span className={clsx(
                      'text-[10px] font-semibold',
                      pct >= 0 ? 'text-bull' : 'text-bear'
                    )}>
                      {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-start">
              {/* Left Column on Desktop: Top 100 Market Watch (Hidden on small mobile, or placed after chart) */}
              <div className="order-2 lg:order-1 lg:col-span-4 xl:col-span-3 h-[420px] lg:h-[680px]">
                <MarketWatch
                  tickers={tickers}
                  top100List={top100List}
                  selectedSymbol={selectedSymbol}
                  onSelectSymbol={setSelectedSymbol}
                />
              </div>

              {/* Middle Column: Chart & Header */}
              <div className="order-1 lg:order-2 lg:col-span-8 xl:col-span-6 space-y-3 sm:space-y-4">
                {/* Chart Card */}
                <div className="card bg-bg-surface border-bg-border p-3 sm:p-4 flex flex-col" style={{ minHeight: '420px' }}>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2 sm:mb-3 border-b border-bg-border pb-2">
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-text-primary text-sm sm:text-base">
                        {selectedSymbol}
                      </h2>
                      <span className="badge-neutral text-[10px]">Binance Spot</span>
                    </div>

                    {/* Price & 24h Change */}
                    {tickers[selectedSymbol] && (
                      <div className="flex items-center gap-2 sm:gap-3">
                        <span className="font-mono font-bold text-base sm:text-lg text-text-primary">
                          ${currentPrice ? currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: currentPrice > 100 ? 2 : 4 }) : '—'}
                        </span>
                        <span className={`font-mono text-xs font-semibold px-1.5 sm:px-2 py-0.5 rounded ${
                          tickers[selectedSymbol].priceChangePercent >= 0 ? 'bg-bull/15 text-bull' : 'bg-bear/15 text-bear'
                        }`}>
                          {tickers[selectedSymbol].priceChangePercent >= 0 ? '+' : ''}{tickers[selectedSymbol].priceChangePercent.toFixed(2)}%
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 w-full min-h-[320px] sm:min-h-[380px]">
                    <CandlestickChart
                      symbol={selectedSymbol}
                      gridLevels={gridLevels}
                      trailPrice={trailPrice}
                      peakPrice={peakPrice}
                      markers={chartMarkers}
                    />
                  </div>
                </div>

                {/* Active Bots Mini-Card */}
                <ActiveBotsCard
                  activeStrategies={activeStrategies}
                  onStopMacdRsi={stopMacdRsi}
                  onStopBollinger={stopBollinger}
                  onStopAiAgent={stopAiAgent}
                />
              </div>

              {/* Right Column: Execution Engine Card & Strategy Launcher */}
              <div className="order-3 lg:order-3 lg:col-span-12 xl:col-span-3 space-y-3 sm:space-y-4">
                <QuickTradeCard
                  symbol={selectedSymbol}
                  currentPrice={currentPrice}
                  wallet={wallet}
                  onExecuteBuy={executeBuy}
                  onExecuteSell={executeSell}
                />
                <StrategyPanel selectedSymbol={selectedSymbol} prices={prices} />
              </div>
            </div>
          </motion.div>
        )}

        {/* ── VIEW 2: PORTFOLIO & WALLET DASHBOARD ────────────────────────── */}
        {activeTab === 'portfolio' && (
          <motion.div
            key="portfolio-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-5 max-w-[1400px] mx-auto"
          >
            <WalletDashboard
              wallet={wallet}
              loading={walletLoading}
              onSellPosition={(sym, pct) => executeSell({ symbol: sym, percentage: pct, source: 'MANUAL' })}
              onResetWallet={resetWallet}
            />
            <LedgerTable trades={ledger} />
          </motion.div>
        )}

        {/* ── VIEW 3: AI & ALGO STRATEGIES DASHBOARD ───────────────────────── */}
        {activeTab === 'strategies' && (
          <motion.div
            key="strategies-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-5 max-w-[1400px] mx-auto"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              <StrategyPanel selectedSymbol={selectedSymbol} prices={prices} />
              <ActiveBotsCard
                activeStrategies={activeStrategies}
                onStopMacdRsi={stopMacdRsi}
                onStopBollinger={stopBollinger}
                onStopAiAgent={stopAiAgent}
              />
            </div>
            <LedgerTable trades={ledger} />
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  )
}
