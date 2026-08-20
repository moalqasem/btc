'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

export interface PriceData {
  symbol: string
  price: number
  prevPrice?: number
  direction?: 'up' | 'down' | 'neutral'
  updatedAt: number
}

export interface TickerData {
  symbol: string
  price: number
  priceChange: number
  priceChangePercent: number
  highPrice: number
  lowPrice: number
  volume: number
  quoteVolume: number
  prevPrice?: number
  direction?: 'up' | 'down' | 'neutral'
  updatedAt?: number
}

export type TickerMap = Record<string, TickerData>
export type PriceMap = Record<string, PriceData>

const getWsUrl = () => {
  if (typeof window === 'undefined') return ''
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.hostname || 'localhost'
  return process.env.NEXT_PUBLIC_WS_URL || `${protocol}//${host}:8000/api/market/ws/prices`
}
const RECONNECT_DELAY_MS = 3000

export function useLivePrices(initialSymbols: string[] = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT']) {
  const [tickers, setTickers] = useState<TickerMap>({})
  const [prices, setPrices] = useState<PriceMap>({})
  const [top100List, setTop100List] = useState<TickerData[]>([])
  const [connected, setConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<number | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  // Fetch initial top 100 snapshot via REST on load
  const fetchTop100 = useCallback(async () => {
    try {
      const res = await fetch('/api/market/top100')
      if (!res.ok) return
      const data = await res.json()
      if (data.tickers && Array.isArray(data.tickers)) {
        const tMap: TickerMap = {}
        const pMap: PriceMap = {}
        const now = Date.now()

        data.tickers.forEach((t: any) => {
          tMap[t.symbol] = {
            ...t,
            direction: 'neutral',
            updatedAt: now,
          }
          pMap[t.symbol] = {
            symbol: t.symbol,
            price: t.price,
            direction: 'neutral',
            updatedAt: now,
          }
        })
        setTickers(tMap)
        setPrices(pMap)
        setTop100List(data.tickers)
        setLastUpdate(now)
      }
    } catch {
      // Backend may be starting up
    }
  }, [])

  const connect = useCallback(() => {
    if (!mountedRef.current) return

    try {
      const url = getWsUrl()
      if (!url) return
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        if (!mountedRef.current) return
        setConnected(true)
      }

      ws.onmessage = (event) => {
        if (!mountedRef.current) return
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'price_update') {
            const now = Date.now()
            const incomingPrices = msg.prices || {}
            const incomingTickers = msg.tickers || {}

            setPrices(prev => {
              const next = { ...prev }
              Object.entries(incomingPrices as Record<string, number>).forEach(([sym, price]) => {
                const prevEntry = prev[sym]
                const prevPrice = prevEntry?.price
                const direction =
                  prevPrice == null ? 'neutral'
                  : price > prevPrice ? 'up'
                  : price < prevPrice ? 'down'
                  : 'neutral'

                next[sym] = {
                  symbol: sym,
                  price,
                  direction,
                  updatedAt: now,
                }
              })
              return next
            })

            setTickers(prev => {
              const next = { ...prev }
              Object.entries(incomingTickers as Record<string, any>).forEach(([sym, t]) => {
                const prevPrice = prev[sym]?.price
                const direction =
                  prevPrice == null ? 'neutral'
                  : t.price > prevPrice ? 'up'
                  : t.price < prevPrice ? 'down'
                  : 'neutral'

                next[sym] = {
                  ...t,
                  direction,
                  updatedAt: now,
                }
              })
              return next
            })

            setLastUpdate(now)
          }
        } catch {
          // ignore
        }
      }

      ws.onclose = () => {
        if (!mountedRef.current) return
        setConnected(false)
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS)
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch {
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    fetchTop100()
    connect()

    return () => {
      mountedRef.current = false
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [fetchTop100, connect])

  // Maintain sorted top 100 list
  useEffect(() => {
    const list = Object.values(tickers)
    if (list.length > 0) {
      list.sort((a, b) => (b.quoteVolume || 0) - (a.quoteVolume || 0))
      setTop100List(list)
    }
  }, [tickers])

  const getPrice = useCallback((symbol: string): number | undefined => {
    return prices[symbol.toUpperCase()]?.price
  }, [prices])

  return { prices, tickers, top100List, connected, lastUpdate, getPrice, refreshTop100: fetchTop100 }
}
