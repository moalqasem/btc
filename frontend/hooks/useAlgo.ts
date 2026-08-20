'use client'
import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'

export interface GridStatus {
  running: boolean
  symbol?: string
  upper_price?: number
  lower_price?: number
  grid_count?: number
  amount_per_grid_usd?: number
  start_price?: number
  last_price?: number
  grid_profit?: number
  levels?: Array<{
    price: number
    side: 'BUY' | 'SELL'
    quantity: number
    filled: boolean
    filled_at: string | null
  }>
  total_trades?: number
}

export interface TrailingStatus {
  running: boolean
  triggered?: boolean
  symbol?: string
  entry_price?: number
  quantity?: number
  trail_pct?: number
  stop_loss_pct?: number
  peak_price?: number
  trail_price?: number
  current_price?: number
  trigger_price?: number | null
  realized_pnl?: number | null
  start_time?: string
}

const POLL_INTERVAL = 3000

export function useAlgo() {
  const [gridStatus, setGridStatus] = useState<GridStatus>({ running: false })
  const [trailingStatus, setTrailingStatus] = useState<TrailingStatus>({ running: false })
  const [loadingGrid, setLoadingGrid] = useState(false)
  const [loadingTrailing, setLoadingTrailing] = useState(false)

  const fetchStatuses = useCallback(async () => {
    try {
      const [g, t] = await Promise.all([
        axios.get<GridStatus>('/api/algo/grid/status'),
        axios.get<TrailingStatus>('/api/algo/trailing/status'),
      ])
      setGridStatus(g.data)
      setTrailingStatus(t.data)
    } catch {
      // silent — backend may not be ready yet
    }
  }, [])

  useEffect(() => {
    fetchStatuses()
    const interval = setInterval(fetchStatuses, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchStatuses])

  const startGrid = useCallback(async (params: {
    symbol: string
    upper_price: number
    lower_price: number
    grid_count: number
    amount_per_grid_usd: number
  }) => {
    setLoadingGrid(true)
    try {
      const res = await axios.post('/api/algo/grid/start', params)
      setGridStatus(res.data.status)
      return res.data
    } finally {
      setLoadingGrid(false)
    }
  }, [])

  const stopGrid = useCallback(async () => {
    setLoadingGrid(true)
    try {
      const res = await axios.post('/api/algo/grid/stop')
      setGridStatus(res.data.status)
    } finally {
      setLoadingGrid(false)
    }
  }, [])

  const startTrailing = useCallback(async (params: {
    symbol: string
    quantity: number
    trail_pct: number
    stop_loss_pct: number
    entry_price?: number
  }) => {
    setLoadingTrailing(true)
    try {
      const res = await axios.post('/api/algo/trailing/start', params)
      setTrailingStatus(res.data.status)
      return res.data
    } finally {
      setLoadingTrailing(false)
    }
  }, [])

  const stopTrailing = useCallback(async () => {
    setLoadingTrailing(true)
    try {
      const res = await axios.post('/api/algo/trailing/stop')
      setTrailingStatus(res.data.status)
    } finally {
      setLoadingTrailing(false)
    }
  }, [])

  return {
    gridStatus,
    trailingStatus,
    loadingGrid,
    loadingTrailing,
    startGrid,
    stopGrid,
    startTrailing,
    stopTrailing,
    refresh: fetchStatuses,
  }
}
