'use client'
import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'

export interface Position {
  symbol: string
  quantity: number
  current_price: number
  market_value: number
  cost_basis: number
  unrealized_pnl: number
  unrealized_pnl_pct: number
}

export interface Portfolio {
  usd_balance: number
  total_asset_value: number
  total_portfolio_value: number
  total_pnl: number
  total_pnl_pct: number
  starting_balance: number
  positions: Position[]
}

export interface Trade {
  id: string
  symbol: string
  side: 'BUY' | 'SELL'
  quantity: number
  price: number
  total_usd: number
  source: string
  timestamp: string
}

const POLL_INTERVAL = 5000

export function usePortfolio() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPortfolio = useCallback(async () => {
    try {
      const [portRes, tradesRes] = await Promise.all([
        axios.get<Portfolio>('/api/portfolio'),
        axios.get<{ trades: Trade[] }>('/api/portfolio/trades?limit=50'),
      ])
      setPortfolio(portRes.data)
      setTrades(tradesRes.data.trades)
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Failed to load portfolio')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPortfolio()
    const interval = setInterval(fetchPortfolio, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchPortfolio])

  const executeTrade = useCallback(async (
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number
  ) => {
    const res = await axios.post('/api/portfolio/trade', { symbol, side, quantity })
    await fetchPortfolio()
    return res.data
  }, [fetchPortfolio])

  const resetPortfolio = useCallback(async () => {
    await axios.post('/api/portfolio/reset')
    await fetchPortfolio()
  }, [fetchPortfolio])

  return {
    portfolio,
    trades,
    loading,
    error,
    refresh: fetchPortfolio,
    executeTrade,
    resetPortfolio,
  }
}
