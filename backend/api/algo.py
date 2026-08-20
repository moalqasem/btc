"""
Algorithmic Trading API Endpoints
POST /api/algo/grid/start      — start grid trading
POST /api/algo/grid/stop       — stop grid trading
GET  /api/algo/grid/status     — current grid status
POST /api/algo/trailing/start  — start trailing stop
POST /api/algo/trailing/stop   — stop trailing stop
GET  /api/algo/trailing/status — current trailing stop status
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, validator

from core.grid_engine import GridConfig, grid_engine
from core.trailing_stop_engine import TrailingStopConfig, trailing_stop_engine
from services.binance_service import binance_service

router = APIRouter()


# ── Grid Trading ───────────────────────────────────────────────────────────────

class GridStartRequest(BaseModel):
    symbol: str = Field(..., example="BTCUSDT")
    upper_price: float = Field(..., gt=0, example=70000)
    lower_price: float = Field(..., gt=0, example=60000)
    grid_count: int = Field(..., ge=2, le=100, example=10)
    amount_per_grid_usd: float = Field(..., gt=0, example=100)

    @validator("upper_price")
    def upper_must_exceed_lower(cls, v, values):
        if "lower_price" in values and v <= values["lower_price"]:
            raise ValueError("upper_price must be greater than lower_price")
        return v


@router.post("/grid/start")
async def start_grid(req: GridStartRequest):
    symbol = req.symbol.upper()

    # Get current price to initialize grid
    price = binance_service.get_price(symbol)
    if price is None:
        raise HTTPException(status_code=400, detail=f"No price available for {symbol}. Wait for next poll.")

    if not (req.lower_price <= price <= req.upper_price):
        raise HTTPException(
            status_code=422,
            detail=f"Current price ${price:,.2f} is outside the grid range "
                   f"[${req.lower_price:,.2f} – ${req.upper_price:,.2f}]. Adjust your range.",
        )

    config = GridConfig(
        symbol=symbol,
        upper_price=req.upper_price,
        lower_price=req.lower_price,
        grid_count=req.grid_count,
        amount_per_grid_usd=req.amount_per_grid_usd,
    )

    binance_service.add_symbol(symbol)

    try:
        status = await grid_engine.start(config, price)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    return {"success": True, "status": status}


@router.post("/grid/stop")
async def stop_grid():
    if not grid_engine.is_running():
        raise HTTPException(status_code=409, detail="Grid engine is not running")
    status = await grid_engine.stop()
    return {"success": True, "status": status}


@router.get("/grid/status")
async def grid_status():
    return await grid_engine.get_status()


# ── Trailing Stop ──────────────────────────────────────────────────────────────

class TrailingStartRequest(BaseModel):
    symbol: str = Field(..., example="BTCUSDT")
    quantity: float = Field(..., gt=0, example=0.01)
    trail_pct: float = Field(..., gt=0, le=50, example=2.0)
    stop_loss_pct: float = Field(..., gt=0, le=50, example=5.0)
    entry_price: float = Field(default=0.0, ge=0, example=0)  # 0 = use current market price


@router.post("/trailing/start")
async def start_trailing(req: TrailingStartRequest):
    symbol = req.symbol.upper()

    price = binance_service.get_price(symbol)
    if price is None:
        raise HTTPException(status_code=400, detail=f"No price available for {symbol}.")

    config = TrailingStopConfig(
        symbol=symbol,
        entry_price=req.entry_price if req.entry_price > 0 else price,
        quantity=req.quantity,
        trail_pct=req.trail_pct,
        stop_loss_pct=req.stop_loss_pct,
    )

    binance_service.add_symbol(symbol)

    try:
        status = await trailing_stop_engine.start(config, price)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    return {"success": True, "status": status}


@router.post("/trailing/stop")
async def stop_trailing():
    if not trailing_stop_engine.is_running():
        raise HTTPException(status_code=409, detail="Trailing stop is not running")
    status = await trailing_stop_engine.stop()
    return {"success": True, "status": status}


@router.get("/trailing/status")
async def trailing_status():
    return await trailing_stop_engine.get_status()
