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
    } catch (e: any) {
      setError(e?.message || 'Failed to load wallet')
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
              // Trigger instant refresh
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
    const res = await axios.post('/api/wallet/buy', {
      ...params,
      source: params.source || 'MANUAL',
    })
    await fetchWallet()
    return res.data
  }, [fetchWallet])

  // Sell helper
  const executeSell = useCallback(async (params: { symbol: string; percentage?: number; quantity?: number; source?: string }) => {
    const res = await axios.post('/api/wallet/sell', {
      ...params,
      source: params.source || 'MANUAL',
    })
    await fetchWallet()
    return res.data
  }, [fetchWallet])

  // Reset wallet
  const resetWallet = useCallback(async () => {
    await axios.post('/api/wallet/reset')
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
