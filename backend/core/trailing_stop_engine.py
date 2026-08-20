"""
Trailing Stop Engine (Spot Only)
Tracks a virtual spot position and fires a mock SELL when the price
drawdown from the peak exceeds the configured trail percentage.

No leverage, no margin — purely spot asset management.
"""
import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Optional

from core.portfolio_manager import portfolio_manager

logger = logging.getLogger(__name__)


@dataclass
class TrailingStopConfig:
    symbol: str
    entry_price: float
    quantity: float       # Amount of the asset to protect
    trail_pct: float      # e.g. 2.0 means sell if price drops 2% from peak
    stop_loss_pct: float  # Hard stop loss % below entry (e.g. 5.0)


class TrailingStopEngine:
    def __init__(self):
        self._lock = asyncio.Lock()
        self._running: bool = False
        self._config: Optional[TrailingStopConfig] = None
        self._peak_price: float = 0.0
        self._trail_price: float = 0.0
        self._entry_price: float = 0.0
        self._current_price: float = 0.0
        self._triggered: bool = False
        self._trigger_price: Optional[float] = None
        self._trigger_time: Optional[str] = None
        self._trade_log: Optional[dict] = None
        self._start_time: Optional[str] = None

    # ── Public API ─────────────────────────────────────────────────────────────

    async def start(self, config: TrailingStopConfig, current_price: float) -> dict:
        async with self._lock:
            if self._running:
                raise ValueError("Trailing stop is already active. Stop it first.")

            self._config = config
            self._running = True
            self._triggered = False
            self._trigger_price = None
            self._trigger_time = None
            self._trade_log = None
            self._start_time = datetime.utcnow().isoformat()

            # Use the provided entry price or current market price
            entry = config.entry_price if config.entry_price > 0 else current_price
            self._entry_price = entry
            self._peak_price = current_price
            self._current_price = current_price
            self._trail_price = self._calc_trail_price(current_price, config.trail_pct)

            return self._status_dict()

    async def stop(self) -> dict:
        async with self._lock:
            self._running = False
            status = self._status_dict()
            return status

    def is_running(self) -> bool:
        return self._running

    async def tick(self, price_map: Dict[str, float]):
        """Called every 5 seconds. Updates trailing price and fires sell if triggered."""
        async with self._lock:
            if not self._running or not self._config or self._triggered:
                return

            symbol = self._config.symbol
            price = price_map.get(symbol)
            if price is None:
                return

            self._current_price = price

            # Update peak & trail
            if price > self._peak_price:
                self._peak_price = price
                self._trail_price = self._calc_trail_price(price, self._config.trail_pct)

            # Check hard stop loss
            stop_loss_price = self._entry_price * (1 - self._config.stop_loss_pct / 100)
            if price <= stop_loss_price:
                logger.info(f"[TrailingStop] Hard stop-loss triggered @ {price}")
                await self._execute_sell(price, reason="STOP_LOSS")
                return

            # Check trailing stop
            if price <= self._trail_price:
                logger.info(f"[TrailingStop] Trail triggered @ {price} (trail={self._trail_price:.2f})")
                await self._execute_sell(price, reason="TRAIL")

    async def get_status(self) -> dict:
        async with self._lock:
            return self._status_dict()

    # ── Internal ───────────────────────────────────────────────────────────────

    @staticmethod
    def _calc_trail_price(peak: float, trail_pct: float) -> float:
        return peak * (1 - trail_pct / 100)

    async def _execute_sell(self, price: float, reason: str):
        try:
            trade = await portfolio_manager.sell(
                self._config.symbol,
                self._config.quantity,
                price,
                source=f"TRAILING_STOP_{reason}",
            )
            self._triggered = True
            self._trigger_price = price
            self._trigger_time = datetime.utcnow().isoformat()
            self._trade_log = trade
            self._running = False
            pnl = (price - self._entry_price) * self._config.quantity
            logger.info(f"[TrailingStop] Sold {self._config.quantity} {self._config.symbol}. PnL=${pnl:.2f}")
        except ValueError as e:
            logger.warning(f"[TrailingStop] Sell failed: {e}")

    def _status_dict(self) -> dict:
        if not self._config:
            return {"running": False}

        pnl = None
        if self._trigger_price and self._entry_price:
            pnl = (self._trigger_price - self._entry_price) * self._config.quantity

        return {
            "running": self._running,
            "triggered": self._triggered,
            "symbol": self._config.symbol,
            "entry_price": self._entry_price,
            "quantity": self._config.quantity,
            "trail_pct": self._config.trail_pct,
            "stop_loss_pct": self._config.stop_loss_pct,
            "peak_price": self._peak_price,
            "trail_price": self._trail_price,
            "current_price": self._current_price,
            "trigger_price": self._trigger_price,
            "trigger_time": self._trigger_time,
            "realized_pnl": round(pnl, 4) if pnl is not None else None,
            "start_time": self._start_time,
        }


# Singleton
trailing_stop_engine = TrailingStopEngine()
