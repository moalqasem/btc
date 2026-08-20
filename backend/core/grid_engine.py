"""
Spot Grid Trading Engine
Divides a price range into N equal grid levels and places virtual buy/sell
orders as price crosses each level.

Strategy:
- Place BUY orders at each grid level below current price
- When a BUY is filled (price drops to that level), set a SELL at the next
  level above
- When a SELL is filled (price rises), profit is locked in
- Only uses virtual USD balance (SPOT ONLY)
"""
import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional

from core.portfolio_manager import portfolio_manager

logger = logging.getLogger(__name__)


@dataclass
class GridLevel:
    price: float
    side: str  # "BUY" | "SELL"
    quantity: float
    filled: bool = False
    filled_at: Optional[str] = None


@dataclass
class GridConfig:
    symbol: str
    upper_price: float
    lower_price: float
    grid_count: int
    amount_per_grid_usd: float  # USD to spend per grid level


class GridEngine:
    def __init__(self):
        self._lock = asyncio.Lock()
        self._running: bool = False
        self._config: Optional[GridConfig] = None
        self._levels: List[GridLevel] = []
        self._trades_log: List[dict] = []
        self._profit: float = 0.0
        self._start_price: Optional[float] = None
        self._last_price: Optional[float] = None

    # ── Public API ─────────────────────────────────────────────────────────────

    async def start(self, config: GridConfig, current_price: float) -> dict:
        async with self._lock:
            if self._running:
                raise ValueError("Grid engine is already running. Stop it first.")

            self._config = config
            self._running = True
            self._profit = 0.0
            self._trades_log = []
            self._start_price = current_price
            self._last_price = current_price
            self._levels = self._build_grid(config, current_price)

            return self._status_dict()

    async def stop(self) -> dict:
        async with self._lock:
            self._running = False
            status = self._status_dict()
            return status

    def is_running(self) -> bool:
        return self._running

    async def tick(self, price_map: Dict[str, float]):
        """Called every 5 seconds. Checks if any grid levels were crossed."""
        async with self._lock:
            if not self._running or not self._config:
                return

            symbol = self._config.symbol
            price = price_map.get(symbol)
            if price is None:
                return

            prev_price = self._last_price or price
            self._last_price = price

            for level in self._levels:
                if level.filled:
                    continue
                await self._check_and_fill(level, prev_price, price)

    async def get_status(self) -> dict:
        async with self._lock:
            return self._status_dict()

    # ── Internal ───────────────────────────────────────────────────────────────

    def _build_grid(self, cfg: GridConfig, current_price: float) -> List[GridLevel]:
        """Create grid levels spanning [lower_price, upper_price]."""
        if cfg.grid_count < 2:
            raise ValueError("Grid count must be at least 2")

        step = (cfg.upper_price - cfg.lower_price) / cfg.grid_count
        levels: List[GridLevel] = []

        for i in range(cfg.grid_count + 1):
            price = cfg.lower_price + i * step
            quantity = cfg.amount_per_grid_usd / price
            # Levels below current price are initial BUY orders
            # Levels above current price are initial SELL orders (for existing holdings)
            side = "BUY" if price < current_price else "SELL"
            levels.append(GridLevel(price=round(price, 2), side=side, quantity=quantity))

        return levels

    async def _check_and_fill(self, level: GridLevel, prev: float, curr: float):
        """Fill the level if price has crossed it."""
        crossed = False
        if level.side == "BUY" and curr <= level.price <= prev:
            crossed = True
        elif level.side == "SELL" and prev <= level.price <= curr:
            crossed = True

        if not crossed:
            return

        try:
            if level.side == "BUY":
                trade = await portfolio_manager.buy(
                    self._config.symbol,
                    level.quantity,
                    level.price,
                    source="GRID",
                )
                # After buying, place a SELL at the next level above
                next_price = level.price + (
                    (self._config.upper_price - self._config.lower_price)
                    / self._config.grid_count
                )
                sell_level = GridLevel(
                    price=round(next_price, 2),
                    side="SELL",
                    quantity=level.quantity,
                )
                self._levels.append(sell_level)

            else:  # SELL
                trade = await portfolio_manager.sell(
                    self._config.symbol,
                    level.quantity,
                    level.price,
                    source="GRID",
                )
                step = (self._config.upper_price - self._config.lower_price) / self._config.grid_count
                self._profit += level.quantity * step  # Approximate profit per grid

            level.filled = True
            level.filled_at = datetime.utcnow().isoformat()
            self._trades_log.append(trade)
            logger.info(f"[Grid] {level.side} {level.quantity:.6f} {self._config.symbol} @ {level.price}")

        except ValueError as e:
            logger.warning(f"[Grid] Could not fill {level.side} @ {level.price}: {e}")

    def _status_dict(self) -> dict:
        if not self._config:
            return {"running": False}
        return {
            "running": self._running,
            "symbol": self._config.symbol,
            "upper_price": self._config.upper_price,
            "lower_price": self._config.lower_price,
            "grid_count": self._config.grid_count,
            "amount_per_grid_usd": self._config.amount_per_grid_usd,
            "start_price": self._start_price,
            "last_price": self._last_price,
            "grid_profit": round(self._profit, 4),
            "levels": [
                {
                    "price": lv.price,
                    "side": lv.side,
                    "quantity": round(lv.quantity, 6),
                    "filled": lv.filled,
                    "filled_at": lv.filled_at,
                }
                for lv in self._levels
            ],
            "total_trades": len(self._trades_log),
        }


# Singleton
grid_engine = GridEngine()
