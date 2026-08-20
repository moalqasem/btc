import type { Metadata } from 'next'
import './globals.css'
import ToastProvider from '@/components/layout/ToastProvider'
import { TradingProvider } from '@/context/TradingContext'

export const metadata: Metadata = {
  title: 'Spot Crypto Simulator & Platform',
  description: 'Virtual $10,000 Spot Trading Platform, 100 Cryptocurrencies, AI Strategies & Backtesting Engine — Spot Market Only',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="font-sans bg-bg-base text-text-primary antialiased" suppressHydrationWarning>
        <TradingProvider>
          {children}
        </TradingProvider>
        <ToastProvider />
      </body>
    </html>
  )
}
