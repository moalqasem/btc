'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import clsx from 'clsx'
import { PriceMap, PriceData } from '@/hooks/useLivePrices'

interface Props {
  prices: PriceMap
  selectedSymbol: string
  onSelectSymbol: (sym: string) => void
}

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT']

function PriceTicker({ data, selected, onClick }: {
  data: PriceData | undefined
  selected: boolean
  onClick: () => void
}) {
  const price = data?.price
  const dir = data?.direction ?? 'neutral'
  const updated = data?.updatedAt

  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex flex-col items-start px-3 py-2.5 rounded-lg border transition-all duration-200 min-w-[120px]',
        selected
          ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
          : 'border-bg-border bg-bg-elevated hover:border-bg-border/60 hover:bg-bg-elevated'
      )}
    >
      <span className="text-xs font-medium text-text-muted">
        {data?.symbol ?? '...'}
      </span>
      <motion.span
        key={updated}
        initial={{ opacity: 0.6, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className={clsx(
          'font-mono font-bold text-sm',
          selected ? 'text-accent-blue'
            : dir === 'up' ? 'text-bull'
            : dir === 'down' ? 'text-bear'
            : 'text-text-primary'
        )}
      >
        {price != null
          ? `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: price > 100 ? 2 : 4 })}`
          : '—'
        }
      </motion.span>
      <span className={clsx(
        'flex items-center gap-0.5 text-[10px]',
        dir === 'up' ? 'text-bull' : dir === 'down' ? 'text-bear' : 'text-text-muted'
      )}>
        {dir === 'up' ? <TrendingUp className="w-2.5 h-2.5" />
          : dir === 'down' ? <TrendingDown className="w-2.5 h-2.5" />
          : <Minus className="w-2.5 h-2.5" />
        }
        {dir === 'neutral' ? 'Stable' : dir === 'up' ? 'Rising' : 'Falling'}
      </span>
    </button>
  )
}

export default function PriceTickers({ prices, selectedSymbol, onSelectSymbol }: Props) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {SYMBOLS.map(sym => (
        <PriceTicker
          key={sym}
          data={prices[sym]}
          selected={selectedSymbol === sym}
          onClick={() => onSelectSymbol(sym)}
        />
      ))}
    </div>
  )
}
