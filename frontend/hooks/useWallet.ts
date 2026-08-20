'use client'
import { useCallback, useEffect, useState, useRef } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

export interface Position {
  symbol: string
  asset: string
  quantity: number
  current_price: number
  market_value: number
  cost_basis: number
  avg_entry_price: number
  unrealized_pnl: number
  unrealized_pnl_pct: number
}

export interface Allocation {
  name: string
  symbol: string
  value: number
  percentage: number
  color: string
}

export interface WalletSnapshot {
  usdt_balance: number
  usd_balance: number
  total_asset_value: number
  total_portfolio_value: number
  total_pnl: number
  total_pnl_pct: number
  total_realized_pnl: number
  starting_balance: number
  positions: Position[]
  allocations: Allocation[]
  total_trades_count: number
}

export interface LedgerTrade {
  id: string
  symbol: string
  side: 'BUY' | 'SELL'
  quantity: number
  price: number
  total_usd: number
  fee: number
  realized_pnl: number
  realized_pnl_pct: number
  source: string
  timestamp: string
}

const getTradesWsUrl = () => {
  if (typeof window === 'undefined') return ''
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.hostname || 'localhost'
  return process.env.NEXT_PUBLIC_TRADES_WS_URL || `${protocol}//${host}:8000/api/market/ws/trades`
}

const getLocalWallet = (): { wallet: WalletSnapshot; ledger: LedgerTrade[] } => {
  if (typeof window === 'undefined') {
    return {
      wallet: {
        usdt_balance: 10000,
        usd_balance: 10000,
        total_asset_value: 0,
        total_portfolio_value: 10000,
        total_pnl: 0,
        total_pnl_pct: 0,
        total_realized_pnl: 0,
        starting_balance: 10000,
        positions: [],
        allocations: [{ name: 'USDT', symbol: 'USDT', value: 10000, percentage: 100, color: '#3B82F6' }],
        total_trades_count: 0,
      },
      ledger: [],
    }
  }

  try {
    const rawW = localStorage.getItem('spotsim_wallet')
    const rawL = localStorage.getItem('spotsim_ledger')
    const wallet = rawW ? JSON.parse(rawW) : {
      usdt_balance: 10000,
      usd_balance: 10000,
      total_asset_value: 0,
      total_portfolio_value: 10000,
      total_pnl: 0,
      total_pnl_pct: 0,
      total_realized_pnl: 0,
      starting_balance: 10000,
      positions: [],
      allocations: [{ name: 'USDT', symbol: 'USDT', value: 10000, percentage: 100, color: '#3B82F6' }],
      total_trades_count: 0,
    }
    const ledger = rawL ? JSON.parse(rawL) : []
    return { wallet, ledger }
  } catch {
    return {
      wallet: {
        usdt_balance: 10000,
        usd_balance: 10000,
        total_asset_value: 0,
        total_portfolio_value: 10000,
        total_pnl: 0,
        total_pnl_pct: 0,
        total_realized_pnl: 0,
        starting_balance: 10000,
        positions: [],
        allocations: [{ name: 'USDT', symbol: 'USDT', value: 10000, percentage: 100, color: '#3B82F6' }],
        total_trades_count: 0,
      },
      ledger: [],
    }
  }
}

export function useWallet() {
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null)
  const [ledger, setLedger] = useState<LedgerTrade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const fetchWallet = useCallback(async () => {
    try {
      const [balRes, legRes] = await Promise.all([
        axios.get<WalletSnapshot>('/api/wallet/balance'),
        axios.get<{ trades: LedgerTrade[] }>('/api/wallet/ledger?limit=100'),
      ])
      setWallet(balRes.data)
      setLedger(legRes.data.trades)
      setError(null)
    } catch {
      // Fallback to local storage wallet (for Vercel standalone)
      const local = getLocalWallet()
      setWallet(local.wallet)
      setLedger(local.ledger)
    } finally {
      setLoading(false)
    }
  }, [])

  // Listen to WebSocket trade events for live toasts
  useEffect(() => {
    fetchWallet()
    const interval = setInterval(fetchWallet, 4000)

    let ws: WebSocket | null = null
    try {
      const url = getTradesWsUrl()
      if (url) {
        ws = new WebSocket(url)
        wsRef.current = ws

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'trade_executed' && data.trade) {
              const t: LedgerTrade = data.trade
              const isBuy = t.side === 'BUY'
              const pnlStr = !isBuy && t.realized_pnl !== undefined
                ? ` (PnL: ${t.realized_pnl >= 0 ? '+' : ''}$${t.realized_pnl.toFixed(2)})`
                : ''

              toast(
                `${isBuy ? '🟢 BUY' : '🔴 SELL'} ${t.quantity.toFixed(4)} ${t.symbol} @ $${t.price.toLocaleString()}${pnlStr} [${t.source}]`,
                {
                  duration: 4500,
                  style: {
                    background: '#1E293B',
                    color: '#F1F5F9',
                    border: `1px solid ${isBuy ? '#10B981' : '#F43F5E'}`,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  },
                }
              )
              fetchWallet()
            }
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }

    return () => {
      clearInterval(interval)
      ws?.close()
    }
  }, [fetchWallet])

  // Buy helper
  const executeBuy = useCallback(async (params: { symbol: string; usdt_amount?: number; quantity?: number; source?: string }) => {
    try {
      const res = await axios.post('/api/wallet/buy', {
        ...params,
        source: params.source || 'MANUAL',
      })
      await fetchWallet()
      return res.data
    } catch {
      // Client-side local execution
      const local = getLocalWallet()
      const w = { ...local.wallet }
      const l = [...local.ledger]

      let price = 0
      try {
        const pRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${params.symbol.toUpperCase()}`)
        const pData = await pRes.json()
        price = parseFloat(pData.price)
      } catch {
        price = 100
      }

      const costUsdt = params.usdt_amount || (params.quantity ? params.quantity * price : 500)
      const fee = costUsdt * 0.001
      const totalCost = costUsdt + fee
      const qty = costUsdt / price

      if (totalCost > w.usdt_balance) {
        throw new Error(`Insufficient USDT balance ($${w.usdt_balance.toFixed(2)} available)`)
      }

      w.usdt_balance -= totalCost
      w.usd_balance = w.usdt_balance

      const cleanAsset = params.symbol.replace('USDT', '')
      const existingPosIdx = w.positions.findIndex(p => p.symbol === params.symbol)
      if (existingPosIdx >= 0) {
        const pos = w.positions[existingPosIdx]
        const newQty = pos.quantity + qty
        const newCost = pos.cost_basis + costUsdt
        w.positions[existingPosIdx] = {
          ...pos,
          quantity: newQty,
          cost_basis: newCost,
          avg_entry_price: newCost / newQty,
          current_price: price,
          market_value: newQty * price,
          unrealized_pnl: newQty * price - newCost,
          unrealized_pnl_pct: ((newQty * price - newCost) / newCost) * 100,
        }
      } else {
        w.positions.push({
          symbol: params.symbol,
          asset: cleanAsset,
          quantity: qty,
          current_price: price,
          market_value: costUsdt,
          cost_basis: costUsdt,
          avg_entry_price: price,
          unrealized_pnl: 0,
          unrealized_pnl_pct: 0,
        })
      }

      const newTrade: LedgerTrade = {
        id: `TRD-${Date.now().toString(16).toUpperCase()}`,
        symbol: params.symbol,
        side: 'BUY',
        quantity: qty,
        price,
        total_usd: costUsdt,
        fee,
        realized_pnl: 0,
        realized_pnl_pct: 0,
        source: params.source || 'MANUAL',
        timestamp: new Date().toISOString(),
      }
      l.unshift(newTrade)

      // Recalculate totals
      const totalAsset = w.positions.reduce((acc, p) => acc + p.market_value, 0)
      w.total_asset_value = totalAsset
      w.total_portfolio_value = w.usdt_balance + totalAsset
      w.total_pnl = w.total_portfolio_value - w.starting_balance
      w.total_pnl_pct = (w.total_pnl / w.starting_balance) * 100
      w.total_trades_count = l.length

      localStorage.setItem('spotsim_wallet', JSON.stringify(w))
      localStorage.setItem('spotsim_ledger', JSON.stringify(l))
      setWallet(w)
      setLedger(l)

      return { success: true, trade: newTrade }
    }
  }, [fetchWallet])

  // Sell helper
  const executeSell = useCallback(async (params: { symbol: string; percentage?: number; quantity?: number; source?: string }) => {
    try {
      const res = await axios.post('/api/wallet/sell', {
        ...params,
        source: params.source || 'MANUAL',
      })
      await fetchWallet()
      return res.data
    } catch {
      // Client-side local execution
      const local = getLocalWallet()
      const w = { ...local.wallet }
      const l = [...local.ledger]

      const posIdx = w.positions.findIndex(p => p.symbol === params.symbol)
      if (posIdx < 0) {
        throw new Error(`You do not hold any ${params.symbol} to sell`)
      }

      const pos = w.positions[posIdx]
      let sellQty = params.quantity || (params.percentage ? (pos.quantity * params.percentage) / 100 : pos.quantity)
      sellQty = Math.min(sellQty, pos.quantity)

      let price = 0
      try {
        const pRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${params.symbol.toUpperCase()}`)
        const pData = await pRes.json()
        price = parseFloat(pData.price)
      } catch {
        price = pos.current_price || pos.avg_entry_price
      }

      const proceeds = sellQty * price
      const fee = proceeds * 0.001
      const netProceeds = proceeds - fee
      const costPortion = (sellQty / pos.quantity) * pos.cost_basis
      const pnl = netProceeds - costPortion
      const pnlPct = costPortion > 0 ? (pnl / costPortion) * 100 : 0

      w.usdt_balance += netProceeds
      w.usd_balance = w.usdt_balance
      w.total_realized_pnl += pnl

      const remainingQty = pos.quantity - sellQty
      if (remainingQty <= 1e-8) {
        w.positions.splice(posIdx, 1)
      } else {
        const newCost = pos.cost_basis - costPortion
        w.positions[posIdx] = {
          ...pos,
          quantity: remainingQty,
          cost_basis: newCost,
          avg_entry_price: newCost / remainingQty,
          current_price: price,
          market_value: remainingQty * price,
          unrealized_pnl: remainingQty * price - newCost,
          unrealized_pnl_pct: ((remainingQty * price - newCost) / newCost) * 100,
        }
      }

      const newTrade: LedgerTrade = {
        id: `TRD-${Date.now().toString(16).toUpperCase()}`,
        symbol: params.symbol,
        side: 'SELL',
        quantity: sellQty,
        price,
        total_usd: proceeds,
        fee,
        realized_pnl: pnl,
        realized_pnl_pct: pnlPct,
        source: params.source || 'MANUAL',
        timestamp: new Date().toISOString(),
      }
      l.unshift(newTrade)

      const totalAsset = w.positions.reduce((acc, p) => acc + p.market_value, 0)
      w.total_asset_value = totalAsset
      w.total_portfolio_value = w.usdt_balance + totalAsset
      w.total_pnl = w.total_portfolio_value - w.starting_balance
      w.total_pnl_pct = (w.total_pnl / w.starting_balance) * 100
      w.total_trades_count = l.length

      localStorage.setItem('spotsim_wallet', JSON.stringify(w))
      localStorage.setItem('spotsim_ledger', JSON.stringify(l))
      setWallet(w)
      setLedger(l)

      return { success: true, trade: newTrade }
    }
  }, [fetchWallet])

  // Reset wallet
  const resetWallet = useCallback(async () => {
    try {
      await axios.post('/api/wallet/reset')
    } catch {
      localStorage.removeItem('spotsim_wallet')
      localStorage.removeItem('spotsim_ledger')
    }
    toast.success('Wallet successfully reset to $10,000 USDT!')
    await fetchWallet()
  }, [fetchWallet])

  return {
    wallet,
    ledger,
    loading,
    error,
    refresh: fetchWallet,
    executeBuy,
    executeSell,
    resetWallet,
  }
}
