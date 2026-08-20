"""
Binance Spot Market Service
Fetches live spot prices, 24h ticker data, and historical klines for Top 100 USDT pairs.
STRICTLY SPOT MARKET ONLY - No Margin, No Futures, No Leverage.
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

import aiohttp
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

BINANCE_BASE = "https://api.binance.com"
POLL_INTERVAL = 5  # seconds
TOP_COINS_LIMIT = 100

DEFAULT_FALLBACK_SYMBOLS = [
    "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT",
    "ADAUSDT", "AVAXUSDT", "DOGEUSDT", "DOTUSDT", "MATICUSDT",
    "LINKUSDT", "NEARUSDT", "LTCUSDT", "UNIUSDT", "APTUSDT",
    "ATOMUSDT", "ICPUSDT", "FILUSDT", "ETCUSDT", "XLMUSDT"
]


class BinanceService:
    def __init__(self):
        self._session: Optional[aiohttp.ClientSession] = None
        self._prices: Dict[str, float] = {}
        self._tickers_24h: Dict[str, dict] = {}
        self._price_ts: Dict[str, str] = {}
        self._subscribers: List[asyncio.Queue] = []
        self._trade_subscribers: List[asyncio.Queue] = []
        self._tracked_symbols: List[str] = list(DEFAULT_FALLBACK_SYMBOLS)
        self._top_100_symbols: List[str] = list(DEFAULT_FALLBACK_SYMBOLS)
        self._lock = asyncio.Lock()
        self._initialized = False

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=12)
            self._session = aiohttp.ClientSession(timeout=timeout)
        return self._session

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()

    # ── Initialization: Fetch Top 100 Spot Pairs ─────────────────────────────

    async def initialize_top_100(self):
        """Fetch the top 100 USDT spot pairs ranked by 24h Quote Volume."""
        try:
            session = await self._get_session()
            url = f"{BINANCE_BASE}/api/v3/ticker/24hr"
            async with session.get(url) as resp:
                if resp.status != 200:
                    logger.error(f"Failed to fetch 24hr tickers: {resp.status}")
                    return
                all_tickers = await resp.json()

            # Filter for USDT Spot pairs, ignoring leveraged token pairs (UP/DOWN/BEAR/BULL)
            usdt_spot = []
            excluded_suffixes = ("UPUSDT", "DOWNUSDT", "BEARUSDT", "BULLUSDT")
            for t in all_tickers:
                sym = t.get("symbol", "")
                if (
                    sym.endswith("USDT")
                    and not any(sym.endswith(ex) for ex in excluded_suffixes)
                    and float(t.get("quoteVolume", 0)) > 0
                ):
                    usdt_spot.append(t)

            # Sort descending by 24h USDT Quote Volume
            usdt_spot.sort(key=lambda x: float(x.get("quoteVolume", 0)), reverse=True)
            top_list = usdt_spot[:TOP_COINS_LIMIT]

            top_symbols = [t["symbol"] for t in top_list]
            if len(top_symbols) >= 10:
                async with self._lock:
                    self._top_100_symbols = top_symbols
                    self._tracked_symbols = list(top_symbols)
                    for t in top_list:
                        sym = t["symbol"]
                        self._tickers_24h[sym] = {
                            "symbol": sym,
                            "price": float(t.get("lastPrice", 0)),
                            "priceChange": float(t.get("priceChange", 0)),
                            "priceChangePercent": float(t.get("priceChangePercent", 0)),
                            "highPrice": float(t.get("highPrice", 0)),
                            "lowPrice": float(t.get("lowPrice", 0)),
                            "volume": float(t.get("volume", 0)),
                            "quoteVolume": float(t.get("quoteVolume", 0)),
                        }
                        self._prices[sym] = float(t.get("lastPrice", 0))

                logger.info(f"Successfully loaded Top {len(self._top_100_symbols)} Binance Spot pairs by 24h volume.")
                self._initialized = True
        except Exception as e:
            logger.warning(f"Error loading Top 100 symbols: {e}. Using fallback defaults.")

    # ── Price Polling (Every 5 seconds) ──────────────────────────────────────

    async def start_price_polling(self):
        """Background polling loop updating Top 100 spot prices every 5s."""
        logger.info("Binance Spot 5s Price Poller started")
        await self.initialize_top_100()

        while True:
            try:
                await self._fetch_all_prices()
            except Exception as e:
                logger.warning(f"Price poll cycle error: {e}")
            await asyncio.sleep(POLL_INTERVAL)

    async def _fetch_all_prices(self):
        session = await self._get_session()
        url = f"{BINANCE_BASE}/api/v3/ticker/24hr"

        async with session.get(url) as resp:
            if resp.status != 200:
                logger.error(f"Binance ticker price fetch failed: {resp.status}")
                return
            data = await resp.json()

        ts = datetime.now(timezone.utc).isoformat()
        updates: Dict[str, float] = {}
        ticker_updates: Dict[str, dict] = {}

        async with self._lock:
            tracked_set = set(self._tracked_symbols)
            for item in data:
                sym = item.get("symbol", "")
                if sym in tracked_set:
                    last_price = float(item.get("lastPrice", 0))
                    self._prices[sym] = last_price
                    self._price_ts[sym] = ts
                    updates[sym] = last_price
                    
                    ticker_info = {
                        "symbol": sym,
                        "price": last_price,
                        "priceChange": float(item.get("priceChange", 0)),
                        "priceChangePercent": float(item.get("priceChangePercent", 0)),
                        "highPrice": float(item.get("highPrice", 0)),
                        "lowPrice": float(item.get("lowPrice", 0)),
                        "volume": float(item.get("volume", 0)),
                        "quoteVolume": float(item.get("quoteVolume", 0)),
                    }
                    self._tickers_24h[sym] = ticker_info
                    ticker_updates[sym] = ticker_info

        # Broadcast to WebSocket subscribers
        if updates:
            payload = {
                "type": "price_update",
                "timestamp": ts,
                "prices": updates,
                "tickers": ticker_updates,
            }
            dead = []
            for q in self._subscribers:
                try:
                    q.put_nowait(payload)
                except asyncio.QueueFull:
                    dead.append(q)
            for q in dead:
                if q in self._subscribers:
                    self._subscribers.remove(q)

    # ── State Accessors ──────────────────────────────────────────────────────

    def get_cached_prices(self) -> Dict[str, float]:
        return dict(self._prices)

    def get_price(self, symbol: str) -> Optional[float]:
        return self._prices.get(symbol.upper())

    def get_all_tickers(self) -> List[dict]:
        return list(self._tickers_24h.values())

    def get_top_100_symbols(self) -> List[str]:
        return list(self._top_100_symbols)

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        if q in self._subscribers:
            self._subscribers.remove(q)

    def subscribe_trades(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._trade_subscribers.append(q)
        return q

    def unsubscribe_trades(self, q: asyncio.Queue):
        if q in self._trade_subscribers:
            self._trade_subscribers.remove(q)

    def broadcast_trade_event(self, trade_data: dict):
        """Broadcast executed trades to connected clients for live toasts."""
        payload = {
            "type": "trade_executed",
            "trade": trade_data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        dead = []
        for q in self._trade_subscribers:
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                dead.append(q)
        for q in dead:
            if q in self._trade_subscribers:
                self._trade_subscribers.remove(q)

    def add_symbol(self, symbol: str):
        sym = symbol.upper()
        if sym not in self._tracked_symbols:
            self._tracked_symbols.append(sym)

    # ── Candlestick Klines (Spot Only) ───────────────────────────────────────

    async def get_klines(
        self,
        symbol: str,
        interval: str = "1h",
        limit: int = 200,
        start_time: Optional[int] = None,
        end_time: Optional[int] = None,
    ) -> List[dict]:
        """Fetch spot OHLCV klines from Binance."""
        session = await self._get_session()
        params: Dict[str, Any] = {
            "symbol": symbol.upper(),
            "interval": interval,
            "limit": limit,
        }
        if start_time:
            params["startTime"] = start_time
        if end_time:
            params["endTime"] = end_time

        url = f"{BINANCE_BASE}/api/v3/klines"
        async with session.get(url, params=params) as resp:
            if resp.status != 200:
                text = await resp.text()
                raise ValueError(f"Binance klines error {resp.status}: {text}")
            raw = await resp.json()

        candles = []
        for k in raw:
            candles.append({
                "time": int(k[0]) // 1000,
                "open": float(k[1]),
                "high": float(k[2]),
                "low": float(k[3]),
                "close": float(k[4]),
                "volume": float(k[5]),
            })
        return candles

    async def get_24h_ticker(self, symbol: str) -> dict:
        sym = symbol.upper()
        if sym in self._tickers_24h:
            return self._tickers_24h[sym]

        session = await self._get_session()
        url = f"{BINANCE_BASE}/api/v3/ticker/24hr"
        async with session.get(url, params={"symbol": sym}) as resp:
            if resp.status != 200:
                raise ValueError(f"Binance ticker error: {resp.status}")
            data = await resp.json()
            return {
                "symbol": sym,
                "price": float(data.get("lastPrice", 0)),
                "priceChange": float(data.get("priceChange", 0)),
                "priceChangePercent": float(data.get("priceChangePercent", 0)),
                "highPrice": float(data.get("highPrice", 0)),
                "lowPrice": float(data.get("lowPrice", 0)),
                "volume": float(data.get("volume", 0)),
                "quoteVolume": float(data.get("quoteVolume", 0)),
            }


binance_service = BinanceService()
