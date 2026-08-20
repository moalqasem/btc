'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUpCircle, ArrowDownCircle, Clock } from 'lucide-react'
import clsx from 'clsx'
import { Trade } from '@/hooks/usePortfolio'
import { format } from 'date-fns'

interface Props {
  trades: Trade[]
}

export default function TradeHistory({ trades }: Props) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-text-muted" />
        <h3 className="text-sm font-medium text-text-primary">Trade History</h3>
        <span className="ml-auto badge-neutral">{trades.length}</span>
      </div>

      {trades.length === 0 ? (
        <div className="py-8 text-center text-text-muted text-sm">
          No trades yet. Start the Grid or Trailing Stop simulator to generate trades.
        </div>
      ) : (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          <AnimatePresence>
            {trades.map((trade) => (
              <motion.div
                key={trade.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className={clsx(
                  'flex items-center justify-between py-2 px-3 rounded-lg text-xs',
                  trade.side === 'BUY' ? 'bg-bull/5' : 'bg-bear/5'
                )}
              >
                <div className="flex items-center gap-2">
                  {trade.side === 'BUY'
                    ? <ArrowUpCircle className="w-3.5 h-3.5 text-bull flex-shrink-0" />
                    : <ArrowDownCircle className="w-3.5 h-3.5 text-bear flex-shrink-0" />
                  }
                  <div>
                    <span className={clsx(
                      'font-medium',
                      trade.side === 'BUY' ? 'text-bull' : 'text-bear'
                    )}>
                      {trade.side}
                    </span>
                    {' '}
                    <span className="text-text-secondary">{trade.symbol}</span>
                    <span className="text-text-muted ml-1">
                      [{trade.source}]
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-mono text-text-primary">
                    {trade.quantity.toFixed(6)} @ ${trade.price.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </p>
                  <p className="text-text-muted">
                    ${trade.total_usd.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                    {' · '}
                    {format(new Date(trade.timestamp), 'HH:mm:ss')}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
