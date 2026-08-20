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

const isLocalHost = () => {
  if (typeof window === 'undefined') return false
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
}

export function useLivePrices() {
  const [tickers, setTickers] = useState<TickerMap>({})
  const [prices, setPrices] = useState<PriceMap>({})
  const [top100List, setTop100List] = useState<TickerData[]>([])
  const [connected, setConnected] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<number | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  // ── Fetch & Parse Binance Top 100 Spot Tickers ──────────────────────────────
  const fetchPricesFromSource = useCallback(async () => {
    if (!mountedRef.current) return
    const now = Date.now()

    // 1. Try local backend if on localhost
    if (isLocalHost()) {
      try {
        const res = await fetch('/api/market/top100')
        if (res.ok) {
          const data = await res.json()
          if (data.tickers && Array.isArray(data.tickers) && data.tickers.length > 0) {
            updateTickersAndPrices(data.tickers, now)
            setConnected(true)
            return
          }
        }
      } catch {
        // Fallback to direct Binance
      }
    }

    // 2. Direct Binance Public REST API (Fast & Reliable worldwide)
    try {
      const res = await fetch('https://api.binance.com/api/v3/ticker/24hr')
      if (!res.ok) return
      const raw = await res.json()
      if (Array.isArray(raw)) {
        const usdtPairs: TickerData[] = raw
          .filter((t: any) =>
            t.symbol &&
            t.symbol.endsWith('USDT') &&
            !t.symbol.includes('UP') &&
            !t.symbol.includes('DOWN') &&
            !t.symbol.includes('BEAR') &&
            !t.symbol.includes('BULL')
          )
          .map((t: any) => ({
            symbol: t.symbol,
            price: parseFloat(t.lastPrice) || 0,
            priceChange: parseFloat(t.priceChange) || 0,
            priceChangePercent: parseFloat(t.priceChangePercent) || 0,
            highPrice: parseFloat(t.highPrice) || 0,
            lowPrice: parseFloat(t.lowPrice) || 0,
            volume: parseFloat(t.volume) || 0,
            quoteVolume: parseFloat(t.quoteVolume) || 0,
          }))
          .sort((a, b) => b.quoteVolume - a.quoteVolume)
          .slice(0, 100)

        updateTickersAndPrices(usdtPairs, now)
        setConnected(true)
      }
    } catch (e) {
      // Network hiccup, keep current data
    }
  }, [])

  // Helper to merge incoming tickers with direction arrows
  const updateTickersAndPrices = (incoming: TickerData[], now: number) => {
    setPrices(prev => {
      const next = { ...prev }
      incoming.forEach((t) => {
        const prevPrice = prev[t.symbol]?.price
        const direction =
          prevPrice == null ? 'neutral'
          : t.price > prevPrice ? 'up'
          : t.price < prevPrice ? 'down'
          : 'neutral'

        next[t.symbol] = {
          symbol: t.symbol,
          price: t.price,
          prevPrice,
          direction,
          updatedAt: now,
        }
      })
      return next
    })

    setTickers(prev => {
      const next = { ...prev }
      incoming.forEach((t) => {
        const prevPrice = prev[t.symbol]?.price
        const direction =
          prevPrice == null ? 'neutral'
          : t.price > prevPrice ? 'up'
          : t.price < prevPrice ? 'down'
          : 'neutral'

        next[t.symbol] = {
          ...t,
          prevPrice,
          direction,
          updatedAt: now,
        }
      })
      return next
    })

    setLastUpdate(now)
  }

  // ── WebSocket Connection Setup ──────────────────────────────────────────────
  const startWebSocket = useCallback(() => {
    if (!mountedRef.current) return

    try {
      let wsUrl = ''
      if (isLocalHost()) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        wsUrl = process.env.NEXT_PUBLIC_WS_URL || `${protocol}//${window.location.hostname}:8000/api/market/ws/prices`
      } else {
        // Direct Binance Public Multi-Ticker Stream for Vercel Cloud
        wsUrl = 'wss://stream.binance.com:9443/ws/!miniTicker@arr'
      }

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        if (!mountedRef.current) return
        setConnected(true)
      }

      ws.onmessage = (event) => {
        if (!mountedRef.current) return
        try {
          const now = Date.now()
          const data = JSON.parse(event.data)

          // Format 1: Backend custom format
          if (data.type === 'price_update') {
            const incomingPrices = data.prices || {}
            const incomingTickers = data.tickers || {}

            setPrices(prev => {
              const next = { ...prev }
              Object.entries(incomingPrices as Record<string, number>).forEach(([sym, price]) => {
                const prevPrice = prev[sym]?.price
                const direction =
                  prevPrice == null ? 'neutral'
                  : price > prevPrice ? 'up'
                  : price < prevPrice ? 'down'
                  : 'neutral'
                next[sym] = { symbol: sym, price, prevPrice, direction, updatedAt: now }
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
                next[sym] = { ...t, prevPrice, direction, updatedAt: now }
              })
              return next
            })

            setLastUpdate(now)
            setConnected(true)
            return
          }

          // Format 2: Direct Binance MiniTicker Stream Array
          if (Array.isArray(data)) {
            setPrices(prev => {
              const next = { ...prev }
              data.forEach((t: any) => {
                const sym = t.s
                if (sym && sym.endsWith('USDT') && next[sym]) {
                  const price = parseFloat(t.c)
                  const prevPrice = prev[sym]?.price
                  const direction =
                    prevPrice == null ? 'neutral'
                    : price > prevPrice ? 'up'
                    : price < prevPrice ? 'down'
                    : 'neutral'
                  next[sym] = { symbol: sym, price, prevPrice, direction, updatedAt: now }
                }
              })
              return next
            })

            setTickers(prev => {
              const next = { ...prev }
              data.forEach((t: any) => {
                const sym = t.s
                if (sym && sym.endsWith('USDT') && next[sym]) {
                  const price = parseFloat(t.c)
                  const open = parseFloat(t.o)
                  const priceChangePercent = open > 0 ? ((price - open) / open) * 100 : 0
                  const prevPrice = prev[sym]?.price
                  const direction =
                    prevPrice == null ? 'neutral'
                    : price > prevPrice ? 'up'
                    : price < prevPrice ? 'down'
                    : 'neutral'

                  next[sym] = {
                    ...next[sym],
                    price,
                    priceChangePercent,
                    highPrice: parseFloat(t.h),
                    lowPrice: parseFloat(t.l),
                    volume: parseFloat(t.v),
                    quoteVolume: parseFloat(t.q),
                    prevPrice,
                    direction,
                    updatedAt: now,
                  }
                }
              })
              return next
            })

            setLastUpdate(now)
            setConnected(true)
          }
        } catch {
          // ignore
        }
      }

      ws.onclose = () => {
        if (!mountedRef.current) return
        setConnected(true) // Polling keeps it connected
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch {
      // ignore
    }
  }, [])

  // ── Lifecycle: Initial Load + Fast 2.5s Polling + WebSocket ─────────────────
  useEffect(() => {
    mountedRef.current = true

    // 1. Initial snapshot
    fetchPricesFromSource()

    // 2. Continuous 2.5s Auto-Poll (Ensures live updates never freeze)
    pollIntervalRef.current = setInterval(() => {
      fetchPricesFromSource()
    }, 2500)

    // 3. Connect WebSocket for sub-second ticks
    startWebSocket()

    return () => {
      mountedRef.current = false
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      wsRef.current?.close()
    }
  }, [fetchPricesFromSource, startWebSocket])

  // ── Keep Top 100 List Sorted ────────────────────────────────────────────────
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

  return {
    prices,
    tickers,
    top100List,
    connected,
    lastUpdate,
    getPrice,
    refreshTop100: fetchPricesFromSource,
  }
}
