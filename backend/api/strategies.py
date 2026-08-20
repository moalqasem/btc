"""
Advanced Strategies API Endpoints
Controls live bot execution for MACD+RSI, Bollinger Mean Reversion, and AI Trading Agent.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from core.strategies.macd_rsi import MacdRsiConfig
from core.strategies.bollinger import BollingerConfig
from core.strategies.ai_agent import AiAgentConfig
from core.strategy_manager import strategy_manager
from services.binance_service import binance_service

router = APIRouter()


# ── Request Models ─────────────────────────────────────────────────────────────

class MacdRsiStartRequest(BaseModel):
    symbol: str = Field(..., example="BTCUSDT")
    rsi_period: int = Field(default=14, ge=5, le=50)
    rsi_oversold: float = Field(default=35.0, ge=10, le=45)
    rsi_overbought: float = Field(default=65.0, ge=55, le=90)
    trade_amount_usdt: float = Field(default=500.0, gt=10)
    candle_interval: str = Field(default="1h")


class BollingerStartRequest(BaseModel):
    symbol: str = Field(..., example="ETHUSDT")
    period: int = Field(default=20, ge=5, le=100)
    num_std_dev: float = Field(default=2.0, ge=1.0, le=4.0)
    trade_amount_usdt: float = Field(default=500.0, gt=10)
    candle_interval: str = Field(default="1h")


class AiAgentStartRequest(BaseModel):
    symbol: str = Field(..., example="SOLUSDT")
    risk_profile: str = Field(default="BALANCED", example="BALANCED")  # CONSERVATIVE | BALANCED | AGGRESSIVE
    trade_amount_usdt: float = Field(default=600.0, gt=10)
    candle_interval: str = Field(default="1h")
    buy_threshold: float = Field(default=50.0, ge=10, le=90)
    sell_threshold: float = Field(default=-50.0, ge=-90, le=-10)


class StopRequest(BaseModel):
    symbol: str = Field(..., example="BTCUSDT")


# ── MACD + RSI Endpoints ───────────────────────────────────────────────────────

@router.post("/macd-rsi/start")
async def start_macd_rsi(req: MacdRsiStartRequest):
    config = MacdRsiConfig(
        symbol=req.symbol.upper(),
        rsi_period=req.rsi_period,
        rsi_oversold=req.rsi_oversold,
        rsi_overbought=req.rsi_overbought,
        trade_amount_usdt=req.trade_amount_usdt,
        candle_interval=req.candle_interval,
    )
    status = await strategy_manager.start_macd_rsi(config)
    return {"success": True, "status": status}


@router.post("/macd-rsi/stop")
async def stop_macd_rsi(req: StopRequest):
    status = await strategy_manager.stop_macd_rsi(req.symbol)
    return {"success": True, "status": status}


# ── Bollinger Bands Endpoints ──────────────────────────────────────────────────

@router.post("/bollinger/start")
async def start_bollinger(req: BollingerStartRequest):
    config = BollingerConfig(
        symbol=req.symbol.upper(),
        period=req.period,
        num_std_dev=req.num_std_dev,
        trade_amount_usdt=req.trade_amount_usdt,
        candle_interval=req.candle_interval,
    )
    status = await strategy_manager.start_bollinger(config)
    return {"success": True, "status": status}


@router.post("/bollinger/stop")
async def stop_bollinger(req: StopRequest):
    status = await strategy_manager.stop_bollinger(req.symbol)
    return {"success": True, "status": status}


# ── AI Agent Endpoints ─────────────────────────────────────────────────────────

@router.post("/ai-agent/start")
async def start_ai_agent(req: AiAgentStartRequest):
    config = AiAgentConfig(
        symbol=req.symbol.upper(),
        risk_profile=req.risk_profile.upper(),
        trade_amount_usdt=req.trade_amount_usdt,
        candle_interval=req.candle_interval,
        buy_threshold=req.buy_threshold,
        sell_threshold=req.sell_threshold,
    )
    status = await strategy_manager.start_ai_agent(config)
    return {"success": True, "status": status}


@router.post("/ai-agent/stop")
async def stop_ai_agent(req: StopRequest):
    status = await strategy_manager.stop_ai_agent(req.symbol)
    return {"success": True, "status": status}


# ── Status Inspection ──────────────────────────────────────────────────────────

@router.get("/active")
async def get_active_strategies():
    """Return list of all currently active automated strategy bots."""
    return {"strategies": strategy_manager.get_all_active_strategies()}
