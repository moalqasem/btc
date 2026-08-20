'use client'
import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

export interface ActiveStrategy {
  type: string
  name: string
  symbol: string
  running: boolean
  in_position: boolean
  last_signal: string
  rsi?: number
  macd?: number
  middle_band?: number
  upper_band?: number
  lower_band?: number
  percent_b?: number
  ai_score?: number
  metrics?: Record<string, any>
  total_trades: number
}

export function useStrategies() {
  const [activeStrategies, setActiveStrategies] = useState<ActiveStrategy[]>([])
  const [loading, setLoading] = useState(false)

  const fetchActive = useCallback(async () => {
    try {
      const res = await axios.get<{ strategies: ActiveStrategy[] }>('/api/strategies/active')
      setActiveStrategies(res.data.strategies || [])
    } catch {
      // Backend not ready
    }
  }, [])

  useEffect(() => {
    fetchActive()
    const interval = setInterval(fetchActive, 3000)
    return () => clearInterval(interval)
  }, [fetchActive])

  // Start MACD+RSI
  const startMacdRsi = useCallback(async (params: {
    symbol: string
    rsi_period?: number
    rsi_oversold?: number
    rsi_overbought?: number
    trade_amount_usdt?: number
    candle_interval?: string
  }) => {
    setLoading(true)
    try {
      const res = await axios.post('/api/strategies/macd-rsi/start', params)
      toast.success(`MACD & RSI Momentum bot started on ${params.symbol.toUpperCase()}!`)
      await fetchActive()
      return res.data
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to start MACD+RSI bot')
      throw e
    } finally {
      setLoading(false)
    }
  }, [fetchActive])

  // Stop MACD+RSI
  const stopMacdRsi = useCallback(async (symbol: string) => {
    try {
      await axios.post('/api/strategies/macd-rsi/stop', { symbol })
      toast.success(`MACD+RSI bot stopped for ${symbol}`)
      await fetchActive()
    } catch (e: any) {
      toast.error('Failed to stop bot')
    }
  }, [fetchActive])

  // Start Bollinger
  const startBollinger = useCallback(async (params: {
    symbol: string
    period?: number
    num_std_dev?: number
    trade_amount_usdt?: number
    candle_interval?: string
  }) => {
    setLoading(true)
    try {
      const res = await axios.post('/api/strategies/bollinger/start', params)
      toast.success(`Mean Reversion Bollinger bot started on ${params.symbol.toUpperCase()}!`)
      await fetchActive()
      return res.data
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to start Bollinger bot')
      throw e
    } finally {
      setLoading(false)
    }
  }, [fetchActive])

  // Stop Bollinger
  const stopBollinger = useCallback(async (symbol: string) => {
    try {
      await axios.post('/api/strategies/bollinger/stop', { symbol })
      toast.success(`Bollinger bot stopped for ${symbol}`)
      await fetchActive()
    } catch (e: any) {
      toast.error('Failed to stop bot')
    }
  }, [fetchActive])

  // Start AI Agent
  const startAiAgent = useCallback(async (params: {
    symbol: string
    risk_profile?: string
    trade_amount_usdt?: number
    candle_interval?: string
    buy_threshold?: number
    sell_threshold?: number
  }) => {
    setLoading(true)
    try {
      const res = await axios.post('/api/strategies/ai-agent/start', params)
      toast.success(`AI Trading Agent (${params.risk_profile || 'BALANCED'}) activated on ${params.symbol.toUpperCase()}!`)
      await fetchActive()
      return res.data
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to start AI Agent')
      throw e
    } finally {
      setLoading(false)
    }
  }, [fetchActive])

  // Stop AI Agent
  const stopAiAgent = useCallback(async (symbol: string) => {
    try {
      await axios.post('/api/strategies/ai-agent/stop', { symbol })
      toast.success(`AI Agent stopped for ${symbol}`)
      await fetchActive()
    } catch (e: any) {
      toast.error('Failed to stop AI Agent')
    }
  }, [fetchActive])

  return {
    activeStrategies,
    loading,
    startMacdRsi,
    stopMacdRsi,
    startBollinger,
    stopBollinger,
    startAiAgent,
    stopAiAgent,
    refresh: fetchActive,
  }
}
