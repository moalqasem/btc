"""
Spot Crypto Trading Simulator & Platform — FastAPI Backend Entry Point
STRICTLY SPOT MARKET ONLY — No Margin, No Futures, No Leverage.
"""
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.portfolio import router as portfolio_router
from api.wallet import router as wallet_router
from api.market import router as market_router
from api.algo import router as algo_router
from api.strategies import router as strategies_router
from api.backtest import router as backtest_router

from core.grid_engine import grid_engine
from core.trailing_stop_engine import trailing_stop_engine
from core.strategy_manager import strategy_manager
from services.binance_service import binance_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    # 1. Start top 100 price polling loop
    price_task = asyncio.create_task(binance_service.start_price_polling())
    # 2. Start automated strategy execution loop (ticks every 5s)
    algo_task = asyncio.create_task(_run_algo_loop())
    yield
    # Graceful shutdown
    price_task.cancel()
    algo_task.cancel()
    await binance_service.close()


async def _run_algo_loop():
    """Tick all active algorithms and bots every 5 seconds in sync with price updates."""
    while True:
        await asyncio.sleep(5)
        price_map = binance_service.get_cached_prices()
        if price_map:
            # Tick Grid and Trailing Stop
            await grid_engine.tick(price_map)
            await trailing_stop_engine.tick(price_map)
            # Tick Advanced & AI Strategies (MACD+RSI, Bollinger, AI Agent)
            await strategy_manager.tick(price_map)


app = FastAPI(
    title="Spot Crypto Simulator & Platform API",
    description="Virtual $10,000 USDT Spot Trading Platform with 100 Cryptocurrencies, Mock Execution Engine, and AI-Driven Strategies. SPOT ONLY.",
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(portfolio_router, prefix="/api/portfolio", tags=["Portfolio"])
app.include_router(wallet_router, prefix="/api/wallet", tags=["Wallet & Mock Execution"])
app.include_router(market_router, prefix="/api/market", tags=["Market Data (100 Coins)"])
app.include_router(algo_router, prefix="/api/algo", tags=["Grid & Trailing Stop"])
app.include_router(strategies_router, prefix="/api/strategies", tags=["Advanced & AI Strategies"])
app.include_router(backtest_router, prefix="/api/backtest", tags=["Backtesting Engine"])

# Direct top-level buy/sell endpoints as requested in requirements
from api.portfolio import DirectTradeRequest

@app.post("/api/buy", tags=["Direct Execution"])
async def api_buy(req: DirectTradeRequest):
    from api.portfolio import direct_buy
    return await direct_buy(req)

@app.post("/api/sell", tags=["Direct Execution"])
async def api_sell(req: DirectTradeRequest):
    from api.portfolio import direct_sell
    return await direct_sell(req)


@app.get("/", tags=["Health"])
async def root():
    return {
        "status": "ok",
        "message": "Spot Crypto Simulator & Platform API v2.0 is running",
        "tracked_coins": len(binance_service.get_top_100_symbols()),
    }


@app.get("/api/health", tags=["Health"])
async def health():
    return {"status": "healthy", "mode": "SPOT_ONLY"}
