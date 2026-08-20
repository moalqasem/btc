"""
Wallet & Mock Execution API Endpoints
POST /api/wallet/buy           — Buy spot crypto with USDT amount or exact quantity
POST /api/wallet/sell          — Sell spot crypto by quantity or percentage
GET  /api/wallet/balance       — Wallet snapshot ($10k starting balance + live assets)
GET  /api/wallet/ledger        — Full trade history ledger with PnL
POST /api/wallet/reset         — Reset wallet to initial $10,000 USDT
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from core.portfolio_manager import portfolio_manager
from services.binance_service import binance_service

router = APIRouter()


class BuyRequest(BaseModel):
    symbol: str = Field(..., example="BTCUSDT")
    quantity: Optional[float] = Field(None, gt=0, example=0.01)
    usdt_amount: Optional[float] = Field(None, gt=0, example=500.0)
    source: str = Field(default="MANUAL", example="MANUAL")


class SellRequest(BaseModel):
    symbol: str = Field(..., example="BTCUSDT")
    quantity: Optional[float] = Field(None, gt=0, example=0.01)
    percentage: Optional[float] = Field(None, ge=1, le=100, example=100.0)
    source: str = Field(default="MANUAL", example="MANUAL")


@router.get("/balance")
async def get_wallet_balance():
    """Returns real-time balance, asset valuation, and allocations for Pie chart."""
    prices = binance_service.get_cached_prices()
    return portfolio_manager.get_snapshot(prices)


@router.get("/ledger")
async def get_ledger(limit: int = 100):
    """Returns complete trade ledger history."""
    return {"trades": portfolio_manager.get_trades(limit=limit)}


@router.post("/buy")
async def execute_buy(req: BuyRequest):
    """
    Execute mock Spot Buy: Deduct USDT and credit Crypto at live Binance price.
    Specify either 'usdt_amount' (e.g. $500) OR 'quantity' (e.g. 0.01 BTC).
    """
    sym = req.symbol.upper()
    binance_service.add_symbol(sym)
    price = binance_service.get_price(sym)

    if price is None:
        raise HTTPException(
            status_code=400,
            detail=f"Live price for {sym} not yet available. Please wait 3-5s for price polling.",
        )

    try:
        if req.usdt_amount is not None and req.usdt_amount > 0:
            trade = await portfolio_manager.buy_usdt_amount(sym, req.usdt_amount, price, req.source)
        elif req.quantity is not None and req.quantity > 0:
            trade = await portfolio_manager.buy(sym, req.quantity, price, req.source)
        else:
            raise HTTPException(status_code=400, detail="Must provide either 'quantity' or 'usdt_amount'")

        return {"success": True, "trade": trade}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/sell")
async def execute_sell(req: SellRequest):
    """
    Execute mock Spot Sell: Deduct Crypto and credit USDT at live Binance price.
    Specify either 'percentage' (e.g. 100% or 50%) OR 'quantity'.
    """
    sym = req.symbol.upper()
    price = binance_service.get_price(sym)

    if price is None:
        raise HTTPException(
            status_code=400,
            detail=f"Live price for {sym} not yet available.",
        )

    try:
        if req.percentage is not None and req.percentage > 0:
            trade = await portfolio_manager.sell_percentage(sym, req.percentage, price, req.source)
        elif req.quantity is not None and req.quantity > 0:
            trade = await portfolio_manager.sell(sym, req.quantity, price, req.source)
        else:
            raise HTTPException(status_code=400, detail="Must provide either 'quantity' or 'percentage'")

        return {"success": True, "trade": trade}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/reset")
async def reset_wallet():
    """Reset virtual wallet back to $10,000 USDT."""
    await portfolio_manager.reset()
    return {"success": True, "message": "Wallet reset to initial $10,000.00 USDT balance."}
