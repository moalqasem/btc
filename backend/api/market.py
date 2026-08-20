"""
Market Data API Endpoints (Spot Only)
GET  /api/market/top100                — Top 100 USDT spot pairs by 24h volume
GET  /api/market/tickers               — Full list of 24h ticker metrics
GET  /api/market/price/{symbol}        — latest spot price
GET  /api/market/ticker/{symbol}       — 24h stats for single symbol
GET  /api/market/klines/{symbol}       — OHLCV candlestick data
WS   /api/market/ws/prices             — live price stream (5-second updates)
WS   /api/market/ws/trades             — live executed trade notifications for toasts
"""
import asyncio
import json
import logging

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from services.binance_service import binance_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/top100")
async def get_top_100_symbols():
    """Return top 100 spot pairs ranked by 24h volume."""
    tickers = binance_service.get_all_tickers()
    if not tickers:
        symbols = binance_service.get_top_100_symbols()
        return {"count": len(symbols), "symbols": symbols, "tickers": []}

    # Sort descending by quote volume
    sorted_tickers = sorted(tickers, key=lambda x: x.get("quoteVolume", 0), reverse=True)
    return {
        "count": len(sorted_tickers),
        "symbols": [t["symbol"] for t in sorted_tickers],
        "tickers": sorted_tickers[:100],
    }


@router.get("/tickers")
async def get_all_tickers():
    """Return all cached 24h ticker data."""
    tickers = binance_service.get_all_tickers()
    return {"tickers": tickers, "count": len(tickers)}


@router.get("/price/{symbol}")
async def get_price(symbol: str):
    """Return the latest cached spot price for a symbol."""
    sym = symbol.upper()
    binance_service.add_symbol(sym)

    price = binance_service.get_price(sym)
    if price is None:
        try:
            ticker = await binance_service.get_24h_ticker(sym)
            price = ticker.get("price")
        except Exception:
            pass

    if price is None:
        raise HTTPException(status_code=404, detail=f"Price not found for {sym}")

    return {"symbol": sym, "price": price}


@router.get("/ticker/{symbol}")
async def get_ticker(symbol: str):
    """Return 24-hour price change statistics for a symbol."""
    try:
        data = await binance_service.get_24h_ticker(symbol.upper())
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/klines/{symbol}")
async def get_klines(
    symbol: str,
    interval: str = "1h",
    limit: int = 200,
    start_time: int = None,
    end_time: int = None,
):
    """Return OHLCV candlestick data for a spot symbol."""
    valid_intervals = [
        "1m", "3m", "5m", "15m", "30m",
        "1h", "2h", "4h", "6h", "8h", "12h",
        "1d", "3d", "1w", "1M",
    ]
    if interval not in valid_intervals:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid interval '{interval}'. Valid: {valid_intervals}",
        )
    try:
        candles = await binance_service.get_klines(
            symbol.upper(), interval, min(limit, 1000), start_time, end_time
        )
        return {"symbol": symbol.upper(), "interval": interval, "candles": candles}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/prices")
async def get_all_prices():
    """Return all currently cached spot prices."""
    prices = binance_service.get_cached_prices()
    return {"prices": prices, "count": len(prices)}


# ── WebSocket: Live Price & Tickers Stream ────────────────────────────────────

@router.websocket("/ws/prices")
async def websocket_prices(websocket: WebSocket):
    """WebSocket streaming 100-coin spot prices every 5s."""
    await websocket.accept()
    queue = binance_service.subscribe()
    logger.info("WebSocket client connected to /ws/prices")

    # Send current snapshot immediately
    cached = binance_service.get_cached_prices()
    tickers = {t["symbol"]: t for t in binance_service.get_all_tickers()}
    if cached:
        await websocket.send_json({
            "type": "price_update",
            "timestamp": "initial",
            "prices": cached,
            "tickers": tickers,
        })

    try:
        while True:
            try:
                update = await asyncio.wait_for(queue.get(), timeout=1.0)
                await websocket.send_json(update)
            except asyncio.TimeoutError:
                pass

            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=0.01)
                msg = json.loads(data)
                if msg.get("action") == "subscribe" and "symbols" in msg:
                    for sym in msg["symbols"]:
                        binance_service.add_symbol(sym.upper())
            except (asyncio.TimeoutError, json.JSONDecodeError):
                pass

    except (WebSocketDisconnect, Exception):
        logger.info("WebSocket client disconnected from /ws/prices")
    finally:
        binance_service.unsubscribe(queue)


# ── WebSocket: Live Executed Trade Notifications (for Toasts) ─────────────────

@router.websocket("/ws/trades")
async def websocket_trades(websocket: WebSocket):
    """WebSocket streaming trade execution events for instant toast alerts."""
    await websocket.accept()
    queue = binance_service.subscribe_trades()
    logger.info("WebSocket client connected to /ws/trades")

    try:
        while True:
            trade_event = await queue.get()
            await websocket.send_json(trade_event)
    except (WebSocketDisconnect, Exception):
        logger.info("WebSocket client disconnected from /ws/trades")
    finally:
        binance_service.unsubscribe_trades(queue)
