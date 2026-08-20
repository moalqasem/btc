'use client'
import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, TrendingUp, TrendingDown, Flame, ArrowUpDown } from 'lucide-react'
import clsx from 'clsx'
import { TickerData, TickerMap } from '@/hooks/useLivePrices'

interface Props {
  tickers: TickerMap
  top100List: TickerData[]
  selectedSymbol: string
  onSelectSymbol: (symbol: string) => void
}

type SortField = 'volume' | 'change' | 'price' | 'symbol'

export default function MarketWatch({
  tickers,
  top100List,
  selectedSymbol,
  onSelectSymbol,
}: Props) {
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('volume')
  const [sortAsc, setSortAsc] = useState(false)
  const [filterGainersOnly, setFilterGainersOnly] = useState(false)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(prev => !prev)
    } else {
      setSortField(field)
      setSortAsc(false)
    }
  }

  const filteredCoins = useMemo(() => {
    const list = top100List.length > 0 ? top100List : Object.values(tickers)
    return list.filter((coin) => {
      const matchSearch =
        coin.symbol.toLowerCase().includes(search.toLowerCase()) ||
        coin.symbol.replace('USDT', '').toLowerCase().includes(search.toLowerCase())
      const matchGainer = filterGainersOnly ? coin.priceChangePercent > 0 : true
      return matchSearch && matchGainer
    }).sort((a, b) => {
      let comparison = 0
      if (sortField === 'volume') comparison = (b.quoteVolume || 0) - (a.quoteVolume || 0)
      else if (sortField === 'change') comparison = b.priceChangePercent - a.priceChangePercent
      else if (sortField === 'price') comparison = b.price - a.price
      else if (sortField === 'symbol') comparison = a.symbol.localeCompare(b.symbol)
      return sortAsc ? -comparison : comparison
    })
  }, [top100List, tickers, search, sortField, sortAsc, filterGainersOnly])

  return (
    <div className="card flex flex-col h-full overflow-hidden p-3 border-bg-border bg-bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-accent-blue" />
          <h3 className="font-semibold text-text-primary text-sm">Market Watch (Top 100)</h3>
        </div>
        <span className="text-[11px] text-text-muted font-mono">{filteredCoins.length} Spot Pairs</span>
      </div>

      {/* Search & Filter Bar */}
      <div className="space-y-2 mb-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search coin (e.g. BTC, SOL, ETH)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-8 py-1.5 text-xs bg-bg-base"
          />
        </div>

        {/* Quick Filter Buttons */}
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setFilterGainersOnly(false)}
            className={clsx(
              'px-2 py-0.5 rounded text-[11px] font-medium transition-colors',
              !filterGainersOnly ? 'bg-accent-blue text-white' : 'text-text-muted hover:text-text-primary bg-bg-elevated'
            )}
          >
            All 100
          </button>
          <button
            onClick={() => setFilterGainersOnly(true)}
            className={clsx(
              'px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1',
              filterGainersOnly ? 'bg-bull text-white' : 'text-text-muted hover:text-bull bg-bg-elevated'
            )}
          >
            <TrendingUp className="w-3 h-3" /> Top Gainers
          </button>
        </div>
      </div>

      {/* Column Headers for Sorting */}
      <div className="grid grid-cols-12 gap-1 py-1 px-2 text-[11px] text-text-muted font-medium border-b border-bg-border select-none">
        <button
          onClick={() => handleSort('symbol')}
          className="col-span-5 text-left flex items-center gap-1 hover:text-text-primary"
        >
          Coin <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
        </button>
        <button
          onClick={() => handleSort('price')}
          className="col-span-4 text-right flex items-center justify-end gap-1 hover:text-text-primary"
        >
          Price <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
        </button>
        <button
          onClick={() => handleSort('change')}
          className="col-span-3 text-right flex items-center justify-end gap-1 hover:text-text-primary"
        >
          24h% <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
        </button>
      </div>

      {/* Scrollable Coin List */}
      <div className="flex-1 overflow-y-auto space-y-0.5 mt-1 pr-1 max-h-[540px]">
        {filteredCoins.length === 0 ? (
          <div className="py-12 text-center text-xs text-text-muted">No coins found matching "{search}"</div>
        ) : (
          filteredCoins.map((coin) => {
            const isSelected = selectedSymbol === coin.symbol
            const isPositive = coin.priceChangePercent >= 0
            const cleanAsset = coin.symbol.replace('USDT', '')
            const volMillions = ((coin.quoteVolume || 0) / 1_000_000).toFixed(1)

            return (
              <motion.button
                key={coin.symbol}
                layout
                onClick={() => onSelectSymbol(coin.symbol)}
                className={clsx(
                  'w-full grid grid-cols-12 gap-1 items-center py-2 px-2 rounded-lg text-left transition-all duration-150',
                  isSelected
                    ? 'bg-accent-blue/15 border border-accent-blue/40 shadow-sm'
                    : 'hover:bg-bg-elevated border border-transparent'
                )}
              >
                {/* Symbol & Volume */}
                <div className="col-span-5 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={clsx(
                      'font-semibold text-xs truncate',
                      isSelected ? 'text-accent-blue' : 'text-text-primary'
                    )}>
                      {cleanAsset}
                    </span>
                    <span className="text-[10px] text-text-muted">/USDT</span>
                  </div>
                  <p className="text-[10px] text-text-muted font-mono truncate">
                    ${volMillions}M 24h
                  </p>
                </div>

                {/* Live Price */}
                <div className="col-span-4 text-right">
                  <span className={clsx(
                    'font-mono text-xs font-medium block truncate',
                    isSelected ? 'text-accent-blue'
                      : coin.direction === 'up' ? 'text-bull'
                      : coin.direction === 'down' ? 'text-bear'
                      : 'text-text-primary'
                  )}>
                    ${coin.price > 100
                      ? coin.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : coin.price > 1
                      ? coin.price.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 4 })
                      : coin.price.toFixed(5)
                    }
                  </span>
                </div>

                {/* 24h Change % */}
                <div className="col-span-3 text-right">
                  <span
                    className={clsx(
                      'inline-block text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded',
                      isPositive
                        ? 'bg-bull/15 text-bull'
                        : 'bg-bear/15 text-bear'
                    )}
                  >
                    {isPositive ? '+' : ''}{coin.priceChangePercent.toFixed(2)}%
                  </span>
                </div>
              </motion.button>
            )
          })
        )}
      </div>
    </div>
  )
}
