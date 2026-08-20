'use client'
import { useState, useMemo, useEffect } from 'react'
import { ArrowUpRight, ArrowDownRight, DollarSign, Zap, SlidersHorizontal, Percent } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { WalletSnapshot } from '@/hooks/useWallet'

interface Props {
  symbol: string
  currentPrice: number | undefined
  wallet: WalletSnapshot | null
  onExecuteBuy: (params: { symbol: string; usdt_amount?: number; quantity?: number; source?: string }) => Promise<any>
  onExecuteSell: (params: { symbol: string; percentage?: number; quantity?: number; source?: string }) => Promise<any>
}

export default function QuickTradeCard({
  symbol,
  currentPrice,
  wallet,
  onExecuteBuy,
  onExecuteSell,
}: Props) {
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY')
  const [amountUsdt, setAmountUsdt] = useState('500')
  const [sliderPct, setSliderPct] = useState(5)
  const [loading, setLoading] = useState(false)

  const cleanAsset = symbol.replace('USDT', '')
  const usdtBalance = wallet?.usdt_balance ?? 10000
  const heldPosition = wallet?.positions?.find(p => p.symbol === symbol)
  const heldQty = heldPosition?.quantity ?? 0
  const maxSellUsdt = heldQty * (currentPrice || 0)

  const parsedAmount = parseFloat(amountUsdt) || 0

  const estimatedCryptoQty = useMemo(() => {
    if (!currentPrice || currentPrice <= 0 || parsedAmount <= 0) return 0
    return parsedAmount / currentPrice
  }, [currentPrice, parsedAmount])

  // Sync slider when amountUsdt changes manually
  const handleAmountChange = (val: string) => {
    setAmountUsdt(val)
    const num = parseFloat(val) || 0
    if (side === 'BUY') {
      if (usdtBalance > 0) {
        setSliderPct(Math.min(100, Math.max(0, Math.round((num / usdtBalance) * 100))))
      }
    } else {
      if (maxSellUsdt > 0) {
        setSliderPct(Math.min(100, Math.max(0, Math.round((num / maxSellUsdt) * 100))))
      }
    }
  }

  // Handle slider movement
  const handleSliderChange = (pct: number) => {
    setSliderPct(pct)
    if (side === 'BUY') {
      const val = (usdtBalance * (pct / 100)).toFixed(2)
      setAmountUsdt(val)
    } else {
      if (heldQty > 0 && currentPrice) {
        const val = ((heldQty * (pct / 100)) * currentPrice).toFixed(2)
        setAmountUsdt(val)
      } else {
        setAmountUsdt('0')
      }
    }
  }

  // Switch tabs and reset default percentage
  const handleTabSwitch = (newSide: 'BUY' | 'SELL') => {
    setSide(newSide)
    if (newSide === 'BUY') {
      const defaultPct = 10
      setSliderPct(defaultPct)
      setAmountUsdt((usdtBalance * (defaultPct / 100)).toFixed(2))
    } else {
      if (heldQty > 0 && currentPrice) {
        const defaultPct = 50
        setSliderPct(defaultPct)
        setAmountUsdt(((heldQty * (defaultPct / 100)) * currentPrice).toFixed(2))
      } else {
        setSliderPct(0)
        setAmountUsdt('0')
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPrice || currentPrice <= 0) {
      toast.error('Waiting for live price update...')
      return
    }

    if (parsedAmount <= 0) {
      toast.error('Enter a valid amount')
      return
    }

    setLoading(true)
    try {
      if (side === 'BUY') {
        if (parsedAmount > usdtBalance) {
          toast.error(`Insufficient USDT balance ($${usdtBalance.toFixed(2)} available)`)
          return
        }
        await onExecuteBuy({
          symbol,
          usdt_amount: parsedAmount,
          source: 'MANUAL',
        })
        toast.success(`Bought ${estimatedCryptoQty.toFixed(4)} ${cleanAsset} for $${parsedAmount.toFixed(2)}!`)
      } else {
        if (heldQty <= 0) {
          toast.error(`You do not hold any ${cleanAsset} to sell`)
          return
        }
        const qtyToSell = parsedAmount / currentPrice
        await onExecuteSell({
          symbol,
          quantity: Math.min(qtyToSell, heldQty),
          source: 'MANUAL',
        })
        toast.success(`Sold ${cleanAsset} for $${parsedAmount.toFixed(2)} USDT!`)
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Trade execution failed')
    } finally {
      setLoading(false)
    }
  }

  const sellQtySelected = (heldQty * (sliderPct / 100))

  return (
    <div className="card bg-bg-surface border-bg-border p-4 flex flex-col space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-bg-border pb-2.5">
        <div className="flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-accent-blue" />
          <h3 className="font-semibold text-text-primary text-sm">Spot Execution Engine</h3>
        </div>
        <span className="text-[11px] font-mono font-semibold text-text-primary">
          {symbol}
        </span>
      </div>

      {/* Buy / Sell Tabs */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-bg-base rounded-lg border border-bg-border">
        <button
          type="button"
          onClick={() => handleTabSwitch('BUY')}
          className={clsx(
            'py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1',
            side === 'BUY' ? 'bg-bull text-white shadow' : 'text-text-muted hover:text-text-primary'
          )}
        >
          <ArrowUpRight className="w-3.5 h-3.5" /> BUY {cleanAsset}
        </button>
        <button
          type="button"
          onClick={() => handleTabSwitch('SELL')}
          className={clsx(
            'py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1',
            side === 'SELL' ? 'bg-bear text-white shadow' : 'text-text-muted hover:text-text-primary'
          )}
        >
          <ArrowDownRight className="w-3.5 h-3.5" /> SELL {cleanAsset}
        </button>
      </div>

      {/* Available Info */}
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>Available:</span>
        <span className="font-mono text-text-primary font-medium">
          {side === 'BUY'
            ? `$${usdtBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`
            : `${heldQty > 10 ? heldQty.toFixed(2) : heldQty.toFixed(4)} ${cleanAsset} ($${(heldQty * (currentPrice || 0)).toFixed(2)})`
          }
        </span>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="label text-[11px]">Order Value (USDT)</label>
          <div className="relative">
            <DollarSign className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="number"
              min="1"
              step="any"
              placeholder="e.g. 500"
              value={amountUsdt}
              onChange={(e) => handleAmountChange(e.target.value)}
              className="input-field pl-7 py-2 font-mono text-sm"
              required
            />
          </div>
        </div>

        {/* ── Interactive Quantity Slider (مؤشر السحب) ────────── */}
        <div className="space-y-1.5 bg-bg-base/70 p-2.5 rounded-lg border border-bg-border">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted flex items-center gap-1 text-[11px]">
              <SlidersHorizontal className="w-3 h-3 text-accent-blue" />
              {side === 'SELL' ? 'كمية البيع المحددة:' : 'نسبة الشراء:'}
            </span>
            <div className="flex items-center gap-1.5 font-mono">
              <span className={clsx(
                'font-bold text-xs px-1.5 py-0.5 rounded',
                side === 'SELL' ? 'bg-bear/15 text-bear' : 'bg-bull/15 text-bull'
              )}>
                {sliderPct}%
              </span>
              {side === 'SELL' && (
                <span className="text-[11px] text-text-secondary">
                  ({sellQtySelected > 10 ? sellQtySelected.toFixed(2) : sellQtySelected.toFixed(4)} {cleanAsset})
                </span>
              )}
            </div>
          </div>

          {/* Slider input */}
          <div className="relative flex items-center py-1">
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={sliderPct}
              onChange={(e) => handleSliderChange(parseInt(e.target.value))}
              className={clsx(
                'range-slider',
                side === 'SELL' ? 'range-slider-sell' : 'range-slider-buy'
              )}
              style={{
                background: `linear-gradient(to right, ${
                  side === 'SELL' ? '#F43F5E' : '#10B981'
                } 0%, ${
                  side === 'SELL' ? '#F43F5E' : '#10B981'
                } ${sliderPct}%, #334155 ${sliderPct}%, #334155 100%)`
              }}
            />
          </div>

          {/* % Quick Notch Buttons */}
          <div className="grid grid-cols-5 gap-1 text-[10px] font-mono pt-0.5">
            {[0, 25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => handleSliderChange(pct)}
                className={clsx(
                  'py-0.5 rounded transition-colors text-center font-medium',
                  sliderPct === pct
                    ? side === 'SELL'
                      ? 'bg-bear text-white'
                      : 'bg-bull text-white'
                    : 'bg-bg-elevated hover:bg-bg-border text-text-muted hover:text-text-primary'
                )}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        {/* Estimated Receive */}
        <div className="p-2.5 rounded-lg bg-bg-base border border-bg-border text-xs space-y-1">
          <div className="flex justify-between text-text-muted">
            <span>Execution Price:</span>
            <span className="font-mono text-text-primary font-medium">
              ${currentPrice ? currentPrice.toLocaleString() : '—'}
            </span>
          </div>
          <div className="flex justify-between text-text-muted">
            <span>{side === 'BUY' ? 'Est. Quantity:' : 'Est. Proceeds:'}</span>
            <span className={clsx(
              'font-mono font-bold',
              side === 'BUY' ? 'text-bull' : 'text-accent-blue'
            )}>
              {side === 'BUY'
                ? `≈ ${estimatedCryptoQty > 0 ? (estimatedCryptoQty > 10 ? estimatedCryptoQty.toFixed(2) : estimatedCryptoQty.toFixed(4)) : '0.00'} ${cleanAsset}`
                : `≈ $${parsedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`
              }
            </span>
          </div>
          <div className="flex justify-between text-[10px] text-text-muted">
            <span>Trading Fee (0.1%):</span>
            <span className="font-mono">${(parsedAmount * 0.001).toFixed(3)} USDT</span>
          </div>
        </div>

        {/* Submit Action Button */}
        <button
          type="submit"
          disabled={loading || !currentPrice || (side === 'SELL' && heldQty <= 0)}
          className={clsx(
            'w-full py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-all duration-200 shadow-md',
            side === 'BUY'
              ? 'bg-bull hover:bg-bull/90 text-white'
              : 'bg-bear hover:bg-bear/90 text-white',
            (loading || !currentPrice || (side === 'SELL' && heldQty <= 0)) && 'opacity-50 cursor-not-allowed'
          )}
        >
          {loading
            ? 'Executing Mock Trade...'
            : side === 'BUY'
            ? `Buy ${cleanAsset} (Spot)`
            : heldQty <= 0
            ? `No ${cleanAsset} to Sell`
            : `Sell ${cleanAsset} (${sliderPct}%)`
          }
        </button>
      </form>
    </div>
  )
}
