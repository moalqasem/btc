'use client'
import { useEffect, useRef, useState } from 'react'
import {
  createChart,
  IChartApi,
  ISeriesApi,
  IPriceLine,
  CandlestickData,
  LineData,
  SeriesMarker,
  Time,
  ColorType,
} from 'lightweight-charts'
import axios from 'axios'
import { Loader2, RefreshCw } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  symbol: string
  interval?: string
  gridLevels?: Array<{ price: number; side: 'BUY' | 'SELL'; filled: boolean }>
  trailPrice?: number
  peakPrice?: number
  markers?: Array<{ time: number; side: 'BUY' | 'SELL'; price: number }>
}

const INTERVALS = ['15m', '1h', '4h', '1d']

export default function CandlestickChart({
  symbol,
  interval: externalInterval,
  gridLevels,
  trailPrice,
  peakPrice,
  markers = [],
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const gridLineRefs = useRef<ISeriesApi<'Line'>[]>([])
  const trailLineRef = useRef<IPriceLine | null>(null)
  const peakLineRef = useRef<IPriceLine | null>(null)

  const [activeInterval, setActiveInterval] = useState(externalInterval || '1h')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Initialize Chart ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0F172A' },
        textColor: '#94A3B8',
      },
      grid: {
        vertLines: { color: '#1E293B' },
        horzLines: { color: '#1E293B' },
      },
      crosshair: {
        vertLine: { color: '#334155', labelBackgroundColor: '#1E293B' },
        horzLine: { color: '#334155', labelBackgroundColor: '#1E293B' },
      },
      rightPriceScale: {
        borderColor: '#334155',
      },
      timeScale: {
        borderColor: '#334155',
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || 420,
    })

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10B981',
      downColor: '#F43F5E',
      borderUpColor: '#10B981',
      borderDownColor: '#F43F5E',
      wickUpColor: '#10B981',
      wickDownColor: '#F43F5E',
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.resize(containerRef.current.clientWidth, containerRef.current.clientHeight || 420)
      }
    })
    if (containerRef.current) ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
    }
  }, [])

  // ── Load Candles ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!candleSeriesRef.current) return
    setLoading(true)
    setError(null)

    // Try custom backend first, fallback to direct Binance public API
    axios
      .get(`/api/market/klines/${symbol}?interval=${activeInterval}&limit=300`)
      .then((res) => {
        const candles: CandlestickData[] = (res.data.candles || [])
          .map((c: any) => ({
            time: (typeof c.time === 'number' ? c.time : Math.floor(new Date(c.time).getTime() / 1000)) as Time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
          .sort((a: any, b: any) => Number(a.time) - Number(b.time))
        candleSeriesRef.current?.setData(candles)
        chartRef.current?.timeScale().fitContent()
      })
      .catch(() => {
        // Fallback: Fetch directly from Binance Public API
        return axios
          .get(`https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${activeInterval}&limit=300`)
          .then((res) => {
            const candles: CandlestickData[] = (res.data || [])
              .map((c: any) => ({
                time: Math.floor(c[0] / 1000) as Time,
                open: parseFloat(c[1]),
                high: parseFloat(c[2]),
                low: parseFloat(c[3]),
                close: parseFloat(c[4]),
              }))
              .sort((a: any, b: any) => Number(a.time) - Number(b.time))
            candleSeriesRef.current?.setData(candles)
            chartRef.current?.timeScale().fitContent()
          })
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [symbol, activeInterval])

  // ── Overlay: Trade Markers ──────────────────────────────────────────────────
  useEffect(() => {
    if (!candleSeriesRef.current) return
    if (!markers || markers.length === 0) {
      candleSeriesRef.current.setMarkers([])
      return
    }

    const sortedMarkers = [...markers]
      .filter((m) => m.time && !isNaN(m.time))
      .sort((a, b) => a.time - b.time)

    const seriesMarkers: SeriesMarker<Time>[] = sortedMarkers.map((m) => ({
      time: m.time as Time,
      position: m.side === 'BUY' ? 'belowBar' : 'aboveBar',
      color: m.side === 'BUY' ? '#10B981' : '#F43F5E',
      shape: m.side === 'BUY' ? 'arrowUp' : 'arrowDown',
      text: `${m.side} @ $${m.price.toFixed(2)}`,
      size: 1,
    }))
    candleSeriesRef.current.setMarkers(seriesMarkers)
  }, [markers])

  // ── Overlay: Grid Level Lines ────────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current) return

    // Remove old grid lines
    gridLineRefs.current.forEach((s) => chartRef.current?.removeSeries(s))
    gridLineRefs.current = []
    trailLineRef.current = null
    peakLineRef.current = null

    if (!gridLevels || gridLevels.length === 0) return

    // Get time range from candle series for the price lines
    gridLevels.forEach((level) => {
      const series = chartRef.current!.addLineSeries({
        color: level.side === 'BUY'
          ? level.filled ? '#065F46' : '#10B981'
          : level.filled ? '#881337' : '#F43F5E',
        lineWidth: 1,
        lineStyle: 2, // dashed
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      })
      // We'll set a dummy data point — the price line will be visible as a horizontal
      const now = Math.floor(Date.now() / 1000) as Time
      series.setData([{ time: now, value: level.price }])
      series.createPriceLine({
        price: level.price,
        color: level.side === 'BUY' ? '#10B981' : '#F43F5E',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `${level.side}${level.filled ? ' ✓' : ''}`,
      })
      gridLineRefs.current.push(series)
    })
  }, [gridLevels])

  // ── Overlay: Trail & Peak Price Lines ────────────────────────────────────────
  useEffect(() => {
    if (!candleSeriesRef.current) return

    if (trailLineRef.current) {
      candleSeriesRef.current.removePriceLine(trailLineRef.current)
      trailLineRef.current = null
    }
    if (peakLineRef.current) {
      candleSeriesRef.current.removePriceLine(peakLineRef.current)
      peakLineRef.current = null
    }

    if (trailPrice) {
      trailLineRef.current = candleSeriesRef.current.createPriceLine({
        price: trailPrice,
        color: '#F43F5E',
        lineWidth: 1,
        lineStyle: 1, // dotted
        axisLabelVisible: true,
        title: 'Trail Stop',
      })
    }

    if (peakPrice) {
      peakLineRef.current = candleSeriesRef.current.createPriceLine({
        price: peakPrice,
        color: '#3B82F6',
        lineWidth: 1,
        lineStyle: 1, // dotted
        axisLabelVisible: true,
        title: 'Peak',
      })
    }
  }, [trailPrice, peakPrice])

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Controls */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              onClick={() => setActiveInterval(iv)}
              className={clsx(
                'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                activeInterval === iv
                  ? 'bg-accent-blue text-white'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
              )}
            >
              {iv}
            </button>
          ))}
        </div>
        <button
          onClick={() => setActiveInterval(v => { setLoading(true); return v })}
          className="text-text-muted hover:text-text-secondary transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Chart */}
      <div className="relative flex-1 min-h-[380px]">
        <div ref={containerRef} className="absolute inset-0" />

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-base/60 z-10">
            <Loader2 className="w-6 h-6 text-accent-blue animate-spin" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <p className="text-bear text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
