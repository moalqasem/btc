'use client'
import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { History, Search, ArrowUpCircle, ArrowDownCircle, Filter, Download } from 'lucide-react'
import { format } from 'date-fns'
import clsx from 'clsx'
import { LedgerTrade } from '@/hooks/useWallet'

interface Props {
  trades: LedgerTrade[]
}

type SideFilter = 'ALL' | 'BUY' | 'SELL'

export default function LedgerTable({ trades }: Props) {
  const [search, setSearch] = useState('')
  const [sideFilter, setSideFilter] = useState<SideFilter>('ALL')
  const [sourceFilter, setSourceFilter] = useState('ALL')

  const uniqueSources = useMemo(() => {
    const set = new Set<string>()
    trades.forEach(t => {
      if (t.source) set.add(t.source)
    })
    return ['ALL', ...Array.from(set)]
  }, [trades])

  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      const matchSearch =
        t.symbol.toLowerCase().includes(search.toLowerCase()) ||
        t.id.toLowerCase().includes(search.toLowerCase())
      const matchSide = sideFilter === 'ALL' ? true : t.side === sideFilter
      const matchSource = sourceFilter === 'ALL' ? true : t.source === sourceFilter
      return matchSearch && matchSide && matchSource
    })
  }, [trades, search, sideFilter, sourceFilter])

  return (
    <div className="card bg-bg-surface border-bg-border flex flex-col space-y-3">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-bg-border pb-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-accent-blue" />
          <h3 className="font-semibold text-text-primary text-sm">Execution Ledger & Trade History</h3>
          <span className="badge-neutral text-xs font-mono">{filteredTrades.length} Trades</span>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Search */}
          <div className="relative w-36">
            <Search className="w-3 h-3 text-text-muted absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search coin / ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-6 py-1 text-xs"
            />
          </div>

          {/* Side Filter */}
          <div className="flex items-center rounded-lg bg-bg-base border border-bg-border p-0.5">
            {(['ALL', 'BUY', 'SELL'] as SideFilter[]).map((side) => (
              <button
                key={side}
                onClick={() => setSideFilter(side)}
                className={clsx(
                  'px-2 py-0.5 rounded text-[11px] font-medium transition-colors',
                  sideFilter === side
                    ? side === 'BUY'
                      ? 'bg-bull text-white'
                      : side === 'SELL'
                      ? 'bg-bear text-white'
                      : 'bg-accent-blue text-white'
                    : 'text-text-muted hover:text-text-primary'
                )}
              >
                {side}
              </button>
            ))}
          </div>

          {/* Strategy Source Filter */}
          {uniqueSources.length > 2 && (
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="input-field py-1 text-xs max-w-[130px]"
            >
              {uniqueSources.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Table */}
      {filteredTrades.length === 0 ? (
        <div className="py-12 text-center text-xs text-text-muted">
          No executed trades matching the criteria.
        </div>
      ) : (
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-[11px] text-text-muted uppercase border-b border-bg-border sticky top-0 bg-bg-surface z-10">
              <tr>
                <th className="pb-2">Time (UTC)</th>
                <th className="pb-2">ID</th>
                <th className="pb-2">Side</th>
                <th className="pb-2">Coin</th>
                <th className="pb-2 text-right">Price</th>
                <th className="pb-2 text-right">Amount</th>
                <th className="pb-2 text-right">Total USDT</th>
                <th className="pb-2 text-right">Realized PnL</th>
                <th className="pb-2 text-right">Strategy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bg-border">
              <AnimatePresence>
                {filteredTrades.map((t) => {
                  const isBuy = t.side === 'BUY'
                  const formattedTime = t.timestamp ? format(new Date(t.timestamp), 'MM/dd HH:mm:ss') : '—'

                  return (
                    <motion.tr
                      key={t.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-bg-elevated/40 transition-colors font-mono"
                    >
                      <td className="py-2 text-text-muted text-[11px]">
                        {formattedTime}
                      </td>
                      <td className="py-2 text-text-muted text-[11px]">
                        {t.id}
                      </td>
                      <td className="py-2">
                        <span className={clsx(
                          'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full',
                          isBuy ? 'bg-bull/15 text-bull' : 'bg-bear/15 text-bear'
                        )}>
                          {isBuy ? <ArrowUpCircle className="w-3 h-3" /> : <ArrowDownCircle className="w-3 h-3" />}
                          {t.side}
                        </span>
                      </td>
                      <td className="py-2 font-sans font-semibold text-text-primary">
                        {t.symbol}
                      </td>
                      <td className="py-2 text-right text-text-primary">
                        ${t.price > 100
                          ? t.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : t.price.toFixed(4)
                        }
                      </td>
                      <td className="py-2 text-right text-text-secondary">
                        {t.quantity > 10 ? t.quantity.toFixed(2) : t.quantity.toFixed(4)}
                      </td>
                      <td className="py-2 text-right font-medium text-text-primary">
                        ${t.total_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 text-right">
                        {!isBuy && t.realized_pnl !== undefined ? (
                          <span className={clsx('font-semibold', t.realized_pnl >= 0 ? 'text-bull' : 'text-bear')}>
                            {t.realized_pnl >= 0 ? '+' : ''}${t.realized_pnl.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <span className="badge-neutral text-[10px] font-sans">
                          {t.source}
                        </span>
                      </td>
                    </motion.tr>
                  )
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
