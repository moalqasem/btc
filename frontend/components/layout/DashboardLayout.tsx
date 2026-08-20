'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart2,
  TrendingUp,
  Clock,
  Wifi,
  WifiOff,
  DollarSign,
  Activity,
  Wallet,
  Cpu,
} from 'lucide-react'
import clsx from 'clsx'
import { useTrading } from '@/context/TradingContext'

interface Props {
  children: React.ReactNode
  activeMainTab?: 'market' | 'portfolio' | 'strategies'
  onSelectMainTab?: (tab: 'market' | 'portfolio' | 'strategies') => void
  totalPortfolioValue?: number
  totalPnl?: number
  totalPnlPct?: number
  connected?: boolean
  lastUpdate?: number | null
}

export default function DashboardLayout({
  children,
  activeMainTab,
  onSelectMainTab,
  totalPortfolioValue,
  totalPnl,
  totalPnlPct,
  connected: externalConnected,
  lastUpdate: externalLastUpdate,
}: Props) {
  const pathname = usePathname()
  const { wallet, connected, lastUpdate } = useTrading()

  const totalValue = totalPortfolioValue ?? wallet?.total_portfolio_value ?? 10000.0
  const pnl = totalPnl ?? wallet?.total_pnl ?? 0.0
  const pnlPct = totalPnlPct ?? wallet?.total_pnl_pct ?? 0.0
  const isConnected = externalConnected !== undefined ? externalConnected : connected
  const lastUpdateTime = externalLastUpdate !== undefined ? externalLastUpdate : lastUpdate

  return (
    <div className="flex h-screen overflow-hidden bg-bg-base text-text-primary">
      {/* ── Sidebar ──────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 bg-bg-surface border-r border-bg-border flex flex-col z-20">
        {/* Logo */}
        <div className="p-4 border-b border-bg-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-blue flex items-center justify-center shadow-glow">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-text-primary text-sm tracking-tight">SpotSim Pro</p>
              <p className="text-[10px] text-accent-blue font-medium">100 Coins • AI Engine</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {/* Main Simulator / Market View */}
          {onSelectMainTab ? (
            <>
              <button
                onClick={() => onSelectMainTab('market')}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-150',
                  activeMainTab === 'market'
                    ? 'bg-accent-blue/15 text-accent-blue border border-accent-blue/30 shadow-sm'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                )}
              >
                <Activity className="w-4 h-4 flex-shrink-0" />
                Market & Terminal
              </button>

              <button
                onClick={() => onSelectMainTab('portfolio')}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-150',
                  activeMainTab === 'portfolio'
                    ? 'bg-accent-blue/15 text-accent-blue border border-accent-blue/30 shadow-sm'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                )}
              >
                <Wallet className="w-4 h-4 flex-shrink-0" />
                Wallet & Ledger
              </button>

              <button
                onClick={() => onSelectMainTab('strategies')}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-150',
                  activeMainTab === 'strategies'
                    ? 'bg-accent-blue/15 text-accent-blue border border-accent-blue/30 shadow-sm'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                )}
              >
                <Cpu className="w-4 h-4 flex-shrink-0" />
                AI & Algo Strategies
              </button>
            </>
          ) : (
            <Link
              href="/"
              className={clsx(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-150',
                pathname === '/'
                  ? 'bg-accent-blue/15 text-accent-blue border border-accent-blue/30'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
              )}
            >
              <Activity className="w-4 h-4 flex-shrink-0" />
              Simulator Dashboard
            </Link>
          )}

          {/* Backtesting Engine Page */}
          <Link
            href="/backtest"
            className={clsx(
              'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-150 mt-1',
              pathname === '/backtest'
                ? 'bg-accent-blue/15 text-accent-blue border border-accent-blue/30 shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
            )}
          >
            <BarChart2 className="w-4 h-4 flex-shrink-0" />
            Backtesting Engine
          </Link>
        </nav>

        {/* Spot-Only Badge & Status */}
        <div className="p-3 border-t border-bg-border space-y-2">
          <div className="bg-bg-base/60 p-2 rounded border border-bg-border/60 text-[10px] text-text-muted">
            <span className="text-bull font-semibold block">SPOT ONLY GUARANTEE</span>
            No margin, no futures, no leverage. Real-time Binance spot rates.
          </div>

          {/* Connection Status */}
          <div
            className={clsx(
              'flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg font-medium',
              isConnected ? 'bg-bull/10 text-bull border border-bull/20' : 'bg-bear/10 text-bear border border-bear/20'
            )}
          >
            {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{isConnected ? 'Live (5s Stream)' : 'Reconnecting...'}</span>
            {isConnected && <span className="w-2 h-2 rounded-full bg-bull ml-auto animate-pulse" />}
          </div>
        </div>
      </aside>

      {/* ── Main Content Area ────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-14 bg-bg-surface border-b border-bg-border flex items-center px-5 gap-6 flex-shrink-0 z-10">
          {/* Live Balance */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-bg-elevated flex items-center justify-center text-accent-blue">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-text-muted uppercase tracking-wider block">Mock Portfolio Value</span>
              <p className="font-mono font-bold text-text-primary text-sm">
                ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
              </p>
            </div>
          </div>

          {/* P&L */}
          <div className="flex items-center gap-2 border-l border-bg-border pl-4">
            <span className="text-xs text-text-muted">P&L:</span>
            <span
              className={clsx(
                'font-mono font-bold text-xs',
                pnl >= 0 ? 'text-bull' : 'text-bear'
              )}
            >
              {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
            </span>
          </div>

          <div className="flex-1" />

          {/* Clock & Update */}
          {lastUpdateTime && (
            <div className="flex items-center gap-1.5 text-xs text-text-muted font-mono" suppressHydrationWarning>
              <Clock className="w-3.5 h-3.5" />
              <span suppressHydrationWarning>{new Date(lastUpdateTime).toLocaleTimeString()}</span>
            </div>
          )}
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-bg-base">
          {children}
        </main>
      </div>
    </div>
  )
}
