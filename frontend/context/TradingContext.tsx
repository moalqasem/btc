'use client'
import React, { createContext, useContext } from 'react'
import { useLivePrices, PriceMap, TickerMap, TickerData } from '@/hooks/useLivePrices'
import { useWallet, WalletSnapshot, LedgerTrade } from '@/hooks/useWallet'
import { useStrategies, ActiveStrategy } from '@/hooks/useStrategies'
import { useAlgo, GridStatus, TrailingStatus } from '@/hooks/useAlgo'

interface TradingContextType {
  // Live Prices & Market Data
  prices: PriceMap
  tickers: TickerMap
  top100List: TickerData[]
  connected: boolean
  lastUpdate: number | null
  getPrice: (symbol: string) => number | undefined
  refreshTop100: () => Promise<void>

  // Wallet & Ledger
  wallet: WalletSnapshot | null
  ledger: LedgerTrade[]
  walletLoading: boolean
  executeBuy: (params: { symbol: string; usdt_amount?: number; quantity?: number; source?: string }) => Promise<any>
  executeSell: (params: { symbol: string; percentage?: number; quantity?: number; source?: string }) => Promise<any>
  resetWallet: () => Promise<void>
  refreshWallet: () => Promise<void>

  // Strategies
  activeStrategies: ActiveStrategy[]
  strategiesLoading: boolean
  startMacdRsi: (params: any) => Promise<any>
  stopMacdRsi: (symbol: string) => Promise<any>
  startBollinger: (params: any) => Promise<any>
  stopBollinger: (symbol: string) => Promise<any>
  startAiAgent: (params: any) => Promise<any>
  stopAiAgent: (symbol: string) => Promise<any>

  // Algo
  gridStatus: GridStatus
  trailingStatus: TrailingStatus
  loadingGrid: boolean
  loadingTrailing: boolean
  startGrid: (params: any) => Promise<any>
  stopGrid: () => Promise<any>
  startTrailing: (params: any) => Promise<any>
  stopTrailing: () => Promise<any>
}

const TradingContext = createContext<TradingContextType | null>(null)

export function TradingProvider({ children }: { children: React.ReactNode }) {
  const livePrices = useLivePrices()
  const walletHook = useWallet()
  const strategiesHook = useStrategies()
  const algoHook = useAlgo()

  const value: TradingContextType = {
    ...livePrices,
    wallet: walletHook.wallet,
    ledger: walletHook.ledger,
    walletLoading: walletHook.loading,
    executeBuy: walletHook.executeBuy,
    executeSell: walletHook.executeSell,
    resetWallet: walletHook.resetWallet,
    refreshWallet: walletHook.refresh,

    activeStrategies: strategiesHook.activeStrategies,
    strategiesLoading: strategiesHook.loading,
    startMacdRsi: strategiesHook.startMacdRsi,
    stopMacdRsi: strategiesHook.stopMacdRsi,
    startBollinger: strategiesHook.startBollinger,
    stopBollinger: strategiesHook.stopBollinger,
    startAiAgent: strategiesHook.startAiAgent,
    stopAiAgent: strategiesHook.stopAiAgent,

    gridStatus: algoHook.gridStatus,
    trailingStatus: algoHook.trailingStatus,
    loadingGrid: algoHook.loadingGrid,
    loadingTrailing: algoHook.loadingTrailing,
    startGrid: algoHook.startGrid,
    stopGrid: algoHook.stopGrid,
    startTrailing: algoHook.startTrailing,
    stopTrailing: algoHook.stopTrailing,
  }

  return <TradingContext.Provider value={value}>{children}</TradingContext.Provider>
}

export function useTrading() {
  const context = useContext(TradingContext)
  if (!context) {
    throw new Error('useTrading must be used within a TradingProvider')
  }
  return context
}
