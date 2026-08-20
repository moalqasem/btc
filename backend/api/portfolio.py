"""
Portfolio & Direct Trade API Endpoints
Maintains backward compatibility while providing full execution endpoints.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from core.portfolio_manager import portfolio_manager
from services.binance_service import binance_service

router = APIRouter()


class DirectTradeRequest(BaseModel):
    symbol: str = Field(..., example="BTCUSDT")
    quantity: Optional[float] = Field(None, gt=0, example=0.01)
    usdt_amount: Optional[float] = Field(None, gt=0, example=500.0)
    side: str = Field(default="BUY", example="BUY")  # BUY | SELL
    percentage: Optional[float] = Field(None, ge=1, le=100, example=100.0)
    source: str = Field(default="MANUAL", example="MANUAL")


@router.get("")
async def get_portfolio():
    """Return the full virtual portfolio snapshot with unrealized PnL."""
    prices = binance_service.get_cached_prices()
    return portfolio_manager.get_snapshot(prices)


@router.get("/trades")
async def get_trades(limit: int = 50):
    """Return recent trade history."""
    return {"trades": portfolio_manager.get_trades(limit=limit)}


@router.post("/trade")
async def execute_trade(req: DirectTradeRequest):
    """Manually execute a mock spot trade against the virtual balance."""
    symbol = req.symbol.upper()
    side = req.side.upper()

    binance_service.add_symbol(symbol)
    price = binance_service.get_price(symbol)
    if price is None:
        raise HTTPException(
            status_code=400,
            detail=f"No cached price for {symbol}. Wait for the next price poll.",
        )

    try:
        if side == "BUY":
            if req.usdt_amount:
                trade = await portfolio_manager.buy_usdt_amount(symbol, req.usdt_amount, price, req.source)
            elif req.quantity:
                trade = await portfolio_manager.buy(symbol, req.quantity, price, req.source)
            else:
                raise HTTPException(status_code=400, detail="Provide 'quantity' or 'usdt_amount'")
        elif side == "SELL":
            if req.percentage:
                trade = await portfolio_manager.sell_percentage(symbol, req.percentage, price, req.source)
            elif req.quantity:
                trade = await portfolio_manager.sell(symbol, req.quantity, price, req.source)
            else:
                raise HTTPException(status_code=400, detail="Provide 'quantity' or 'percentage'")
        else:
            raise HTTPException(status_code=400, detail="side must be BUY or SELL")

        return {"success": True, "trade": trade}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/buy")
async def direct_buy(req: DirectTradeRequest):
    req.side = "BUY"
    return await execute_trade(req)


@router.post("/sell")
async def direct_sell(req: DirectTradeRequest):
    req.side = "SELL"
    return await execute_trade(req)


@router.post("/reset")
async def reset_portfolio():
    """Reset the virtual portfolio to the initial $10,000 USD balance."""
    await portfolio_manager.reset()
    return {"success": True, "message": "Portfolio reset to $10,000.00 USD"}
