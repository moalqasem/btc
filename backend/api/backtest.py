"""
Backtesting API Endpoints (Spot Only)
Supports:
- MACD & RSI Momentum
- Mean Reversion (Bollinger Bands)
- AI Trading Agent (Smart Execution)
- Spot Grid Trading
- Trailing Stop
"""
import dataclasses
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, validator

from core.backtester import (
    backtest_grid,
    backtest_trailing_stop,
    backtest_macd_rsi,
    backtest_bollinger,
    backtest_ai_agent,
)
from services.binance_service import binance_service

router = APIRouter()


class MacdRsiBacktestRequest(BaseModel):
    symbol: str = Field(..., example="BTCUSDT")
    interval: str = Field(default="1h")
    limit: int = Field(default=500, ge=50, le=1000)
    rsi_period: int = Field(default=14, ge=5, le=50)
    rsi_oversold: float = Field(default=35.0, ge=10, le=45)
    rsi_overbought: float = Field(default=65.0, ge=55, le=90)
    trade_amount_usdt: float = Field(default=1000.0, gt=10)
    fee_rate: float = Field(default=0.001)


class BollingerBacktestRequest(BaseModel):
    symbol: str = Field(..., example="ETHUSDT")
    interval: str = Field(default="1h")
    limit: int = Field(default=500, ge=50, le=1000)
    period: int = Field(default=20, ge=5, le=100)
    num_std_dev: float = Field(default=2.0, ge=1.0, le=4.0)
    trade_amount_usdt: float = Field(default=1000.0, gt=10)
    fee_rate: float = Field(default=0.001)


class AiAgentBacktestRequest(BaseModel):
    symbol: str = Field(..., example="SOLUSDT")
    interval: str = Field(default="1h")
    limit: int = Field(default=500, ge=50, le=1000)
    risk_profile: str = Field(default="BALANCED")
    trade_amount_usdt: float = Field(default=1200.0, gt=10)
    buy_threshold: float = Field(default=50.0, ge=10, le=90)
    sell_threshold: float = Field(default=-50.0, ge=-90, le=-10)
    fee_rate: float = Field(default=0.001)


class GridBacktestRequest(BaseModel):
    symbol: str = Field(..., example="BTCUSDT")
    interval: str = Field(default="1h")
    limit: int = Field(default=500, ge=50, le=1000)
    upper_price: float = Field(..., gt=0)
    lower_price: float = Field(..., gt=0)
    grid_count: int = Field(..., ge=2, le=100)
    amount_per_grid_usd: float = Field(..., gt=0)
    fee_rate: float = Field(default=0.001)

    @validator("upper_price")
    def upper_must_exceed_lower(cls, v, values):
        if "lower_price" in values and v <= values["lower_price"]:
            raise ValueError("upper_price must be greater than lower_price")
        return v


class TrailingBacktestRequest(BaseModel):
    symbol: str = Field(..., example="BTCUSDT")
    interval: str = Field(default="1h")
    limit: int = Field(default=500, ge=50, le=1000)
    trail_pct: float = Field(..., gt=0, le=50)
    stop_loss_pct: float = Field(..., gt=0, le=50)
    position_size_usd: float = Field(..., gt=0)
    fee_rate: float = Field(default=0.001)


@router.post("/macd-rsi")
async def run_macd_rsi_backtest(req: MacdRsiBacktestRequest):
    candles = await binance_service.get_klines(req.symbol.upper(), req.interval, req.limit)
    if len(candles) < 35:
        raise HTTPException(status_code=400, detail="Insufficient candle data")
    res = backtest_macd_rsi(
        candles=candles,
        symbol=req.symbol.upper(),
        interval=req.interval,
        rsi_period=req.rsi_period,
        rsi_oversold=req.rsi_oversold,
        rsi_overbought=req.rsi_overbought,
        trade_amount_usdt=req.trade_amount_usdt,
        fee_rate=req.fee_rate,
    )
    return dataclasses.asdict(res)


@router.post("/bollinger")
async def run_bollinger_backtest(req: BollingerBacktestRequest):
    candles = await binance_service.get_klines(req.symbol.upper(), req.interval, req.limit)
    if len(candles) < 30:
        raise HTTPException(status_code=400, detail="Insufficient candle data")
    res = backtest_bollinger(
        candles=candles,
        symbol=req.symbol.upper(),
        interval=req.interval,
        period=req.period,
        num_std_dev=req.num_std_dev,
        trade_amount_usdt=req.trade_amount_usdt,
        fee_rate=req.fee_rate,
    )
    return dataclasses.asdict(res)


@router.post("/ai-agent")
async def run_ai_agent_backtest(req: AiAgentBacktestRequest):
    candles = await binance_service.get_klines(req.symbol.upper(), req.interval, req.limit)
    if len(candles) < 30:
        raise HTTPException(status_code=400, detail="Insufficient candle data")
    res = backtest_ai_agent(
        candles=candles,
        symbol=req.symbol.upper(),
        interval=req.interval,
        risk_profile=req.risk_profile,
        trade_amount_usdt=req.trade_amount_usdt,
        buy_threshold=req.buy_threshold,
        sell_threshold=req.sell_threshold,
        fee_rate=req.fee_rate,
    )
    return dataclasses.asdict(res)


@router.post("/grid")
async def run_grid_backtest(req: GridBacktestRequest):
    candles = await binance_service.get_klines(req.symbol.upper(), req.interval, req.limit)
    if len(candles) < 10:
        raise HTTPException(status_code=400, detail="Not enough candle data")
    res = backtest_grid(
        candles=candles,
        symbol=req.symbol.upper(),
        interval=req.interval,
        upper_price=req.upper_price,
        lower_price=req.lower_price,
        grid_count=req.grid_count,
        amount_per_grid_usd=req.amount_per_grid_usd,
        fee_rate=req.fee_rate,
    )
    return dataclasses.asdict(res)


@router.post("/trailing")
async def run_trailing_backtest(req: TrailingBacktestRequest):
    candles = await binance_service.get_klines(req.symbol.upper(), req.interval, req.limit)
    if len(candles) < 10:
        raise HTTPException(status_code=400, detail="Not enough candle data")
    res = backtest_trailing_stop(
        candles=candles,
        symbol=req.symbol.upper(),
        interval=req.interval,
        trail_pct=req.trail_pct,
        stop_loss_pct=req.stop_loss_pct,
        position_size_usd=req.position_size_usd,
        fee_rate=req.fee_rate,
    )
    return dataclasses.asdict(res)
