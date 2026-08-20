'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Square, Activity, Cpu, Sparkles, AlertCircle } from 'lucide-react'
import clsx from 'clsx'
import { ActiveStrategy } from '@/hooks/useStrategies'

interface Props {
  activeStrategies: ActiveStrategy[]
  onStopMacdRsi: (symbol: string) => Promise<void>
  onStopBollinger: (symbol: string) => Promise<void>
  onStopAiAgent: (symbol: string) => Promise<void>
}

export default function ActiveBotsCard({
  activeStrategies,
  onStopMacdRsi,
  onStopBollinger,
  onStopAiAgent,
}: Props) {
  if (activeStrategies.length === 0) {
    return (
      <div className="card bg-bg-surface border-bg-border p-5 text-center text-xs text-text-muted">
        <Bot className="w-8 h-8 text-bg-border mx-auto mb-2" />
        <p className="font-medium text-text-secondary">No Automated Strategy Bots Active</p>
        <p className="mt-1">Configure and start an AI Bot or Indicator Strategy below to trade automatically.</p>
      </div>
    )
  }

  const handleStop = async (strat: ActiveStrategy) => {
    if (strat.type === 'MACD_RSI') await onStopMacdRsi(strat.symbol)
    else if (strat.type === 'BOLLINGER') await onStopBollinger(strat.symbol)
    else if (strat.type === 'AI_AGENT') await onStopAiAgent(strat.symbol)
  }

  return (
    <div className="card bg-bg-surface border-bg-border space-y-3">
      <div className="flex items-center justify-between border-b border-bg-border pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-bull animate-pulse" />
          <h3 className="font-semibold text-text-primary text-sm flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-accent-blue" /> Live Active Strategy Bots
          </h3>
        </div>
        <span className="badge-bull text-xs font-mono">{activeStrategies.length} Running</span>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto">
        <AnimatePresence>
          {activeStrategies.map((strat) => {
            const isAi = strat.type === 'AI_AGENT'
            const isMacd = strat.type === 'MACD_RSI'
            const isBoll = strat.type === 'BOLLINGER'

            return (
              <motion.div
                key={`${strat.type}-${strat.symbol}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className={clsx(
                  'p-3 rounded-lg border text-xs space-y-2',
                  isAi ? 'bg-accent-blue/5 border-accent-blue/30' : 'bg-bg-elevated/40 border-bg-border'
                )}
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {isAi && <Sparkles className="w-3.5 h-3.5 text-accent-blue" />}
                    <span className="font-bold text-text-primary text-xs">{strat.symbol}</span>
                    <span className="badge-neutral text-[10px]">{strat.name}</span>
                  </div>

                  <button
                    onClick={() => handleStop(strat)}
                    className="btn-danger py-0.5 px-2 text-[10px] flex items-center gap-1"
                  >
                    <Square className="w-2.5 h-2.5" /> Stop Bot
                  </button>
                </div>

                {/* Live Indicator Metrics */}
                <div className="grid grid-cols-3 gap-2 bg-bg-base/60 p-2 rounded border border-bg-border/60 text-[11px] font-mono">
                  <div>
                    <span className="text-text-muted block text-[10px]">Position</span>
                    <span className={clsx('font-semibold', strat.in_position ? 'text-bull' : 'text-text-secondary')}>
                      {strat.in_position ? 'IN ASSET' : 'IN CASH (USDT)'}
                    </span>
                  </div>

                  {isAi && (
                    <div>
                      <span className="text-text-muted block text-[10px]">AI Score</span>
                      <span className={clsx(
                        'font-bold',
                        (strat.ai_score || 0) > 0 ? 'text-bull' : (strat.ai_score || 0) < 0 ? 'text-bear' : 'text-text-primary'
                      )}>
                        {strat.ai_score !== undefined ? `${strat.ai_score > 0 ? '+' : ''}${strat.ai_score}%` : '—'}
                      </span>
                    </div>
                  )}

                  {isMacd && (
                    <div>
                      <span className="text-text-muted block text-[10px]">RSI (14)</span>
                      <span className="text-text-primary font-semibold">{strat.rsi ?? '—'}</span>
                    </div>
                  )}

                  {isBoll && (
                    <div>
                      <span className="text-text-muted block text-[10px]">%B (Bands)</span>
                      <span className="text-text-primary font-semibold">{strat.percent_b ?? '—'}</span>
                    </div>
                  )}

                  <div className="text-right">
                    <span className="text-text-muted block text-[10px]">Trades Fired</span>
                    <span className="text-text-primary font-semibold">{strat.total_trades}</span>
                  </div>
                </div>

                {/* Status / Reason */}
                <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                  <Activity className="w-3 h-3 text-accent-blue flex-shrink-0" />
                  <span className="truncate">Signal: <strong className="text-text-primary">{strat.last_signal}</strong></span>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
