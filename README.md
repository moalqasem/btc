# Spot Crypto Trading Simulator & Backtesting Dashboard

> **SPOT MARKET ONLY** — No margin, no futures, no leverage. Virtual $10,000 USD balance.

## Architecture

```
btc/
├── backend/               # FastAPI Python server
│   ├── main.py            # App entry point + lifecycle
│   ├── requirements.txt
│   ├── api/
│   │   ├── portfolio.py   # Virtual balance & trade endpoints
│   │   ├── market.py      # Prices, klines, WebSocket stream
│   │   ├── algo.py        # Grid & Trailing Stop control
│   │   └── backtest.py    # Backtesting engine endpoints
│   ├── core/
│   │   ├── portfolio_manager.py   # $10k virtual balance state
│   │   ├── grid_engine.py         # Spot grid trading logic
│   │   ├── trailing_stop_engine.py # Trailing stop logic
│   │   └── backtester.py          # pandas/numpy backtesting
│   └── services/
│       └── binance_service.py     # Binance REST API wrapper
│
└── frontend/              # Next.js 14 + Tailwind + Framer Motion
    ├── app/
    │   ├── page.tsx        # Main Simulator page
    │   └── backtest/
    │       └── page.tsx    # Backtesting page
    ├── components/
    │   ├── layout/DashboardLayout.tsx
    │   ├── chart/CandlestickChart.tsx   # TradingView Lightweight Charts
    │   ├── portfolio/
    │   │   ├── PortfolioCard.tsx
    │   │   └── TradeHistory.tsx
    │   ├── algo/
    │   │   ├── GridSettings.tsx
    │   │   └── TrailingStopSettings.tsx
    │   ├── market/PriceTickers.tsx
    │   └── backtest/
    │       ├── BacktestForm.tsx
    │       └── BacktestResults.tsx
    └── hooks/
        ├── useLivePrices.ts   # WebSocket price stream
        ├── usePortfolio.ts    # Portfolio state (5s poll)
        └── useAlgo.ts         # Grid & trailing stop control
```

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- npm or yarn

### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# (Optional) Copy and configure environment variables
copy .env.example .env

# Start the FastAPI server
uvicorn main:app --reload --port 8000
```

The API will be available at http://localhost:8000
Interactive docs: http://localhost:8000/docs

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The dashboard will be available at http://localhost:3000

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/portfolio` | GET | Virtual portfolio snapshot |
| `/api/portfolio/trade` | POST | Execute manual mock trade |
| `/api/portfolio/reset` | POST | Reset to $10,000 |
| `/api/market/price/{symbol}` | GET | Latest spot price |
| `/api/market/klines/{symbol}` | GET | OHLCV candles |
| `/api/market/ws/prices` | WS | Live 5-second price stream |
| `/api/algo/grid/start` | POST | Start grid simulator |
| `/api/algo/grid/stop` | POST | Stop grid simulator |
| `/api/algo/trailing/start` | POST | Start trailing stop |
| `/api/algo/trailing/stop` | POST | Stop trailing stop |
| `/api/backtest/grid` | POST | Run grid backtest |
| `/api/backtest/trailing` | POST | Run trailing stop backtest |

## Features

- 📊 **Live Candlestick Charts** — TradingView Lightweight Charts with grid level overlays
- 💼 **Virtual $10,000 Portfolio** — Tracks USD balance, asset holdings, unrealized P&L
- 🤖 **Grid Trading Simulator** — Auto-places virtual buys/sells across a price range
- 🛡 **Trailing Stop Simulator** — Dynamically tracks peak price and triggers sell
- 🔬 **Backtesting Engine** — pandas/numpy simulation on historical Binance spot data
- 📡 **WebSocket Live Updates** — 5-second price stream with soft pulse animations
- 🌙 **Dark Theme UI** — Deep navy background, trust blue, emerald green, rose red

## Notes

- This system uses **Binance public APIs only** — no API keys required for price/kline data
- All trades are **simulated** — no real money is involved
- The WebSocket price stream automatically reconnects on disconnect
- Grid and Trailing Stop engines run on the same 5-second tick cycle as the price poll
