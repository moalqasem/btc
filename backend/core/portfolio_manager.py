"""
Virtual Portfolio Manager & Mock Execution Engine
Strictly Spot Market Only: Tracks $10,000 USDT virtual wallet, crypto holdings,
and complete ledger trade history.
"""
import asyncio
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

STARTING_BALANCE_USDT = 10_000.0
FEE_RATE = 0.001  # 0.1% spot trading fee


class Trade:
    def __init__(
        self,
        symbol: str,
        side: str,  # "BUY" | "SELL"
        quantity: float,
        price: float,
        source: str = "MANUAL",  # "MANUAL" | "MACD_RSI" | "BOLLINGER" | "AI_AGENT" | "GRID" | "TRAILING_STOP"
        realized_pnl: float = 0.0,
        realized_pnl_pct: float = 0.0,
        fee: float = 0.0,
    ):
        self.id = f"TRD-{str(uuid.uuid4())[:8].upper()}"
        self.symbol = symbol.upper()
        self.side = side.upper()
        self.quantity = float(quantity)
        self.price = float(price)
        self.total_usd = float(quantity * price)
        self.fee = float(fee)
        self.realized_pnl = float(realized_pnl)
        self.realized_pnl_pct = float(realized_pnl_pct)
        self.source = source
        self.timestamp = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "symbol": self.symbol,
            "side": self.side,
            "quantity": self.quantity,
            "price": self.price,
            "total_usd": self.total_usd,
            "fee": self.fee,
            "realized_pnl": self.realized_pnl,
            "realized_pnl_pct": self.realized_pnl_pct,
            "source": self.source,
            "timestamp": self.timestamp,
        }


class PortfolioManager:
    def __init__(self):
        self._lock = asyncio.Lock()
        self._usdt_balance: float = STARTING_BALANCE_USDT
        # {symbol: quantity}
        self._holdings: Dict[str, float] = {}
        # {symbol: [list of buy lots for FIFO cost basis: {"qty": float, "price": float}]}
        self._buy_lots: Dict[str, List[dict]] = {}
        self._trades: List[Trade] = []

    # ── State Accessors ────────────────────────────────────────────────────────

    def get_usd_balance(self) -> float:
        return self._usdt_balance

    def get_holdings(self) -> Dict[str, float]:
        return dict(self._holdings)

    def get_trades(self, limit: int = 100) -> List[dict]:
        return [t.to_dict() for t in reversed(self._trades[-limit:])]

    def get_snapshot(self, current_prices: Dict[str, float] = None) -> dict:
        """Full wallet & portfolio snapshot with live valuation and asset distribution."""
        holdings = dict(self._holdings)
        current_prices = current_prices or {}

        positions = []
        total_asset_value = 0.0

        for symbol, qty in holdings.items():
            if qty <= 1e-10:
                continue
            price = current_prices.get(symbol, 0.0)
            market_val = qty * price
            total_asset_value += market_val

            cost_basis = self._calculate_current_cost_basis(symbol)
            unrealized_pnl = market_val - cost_basis if price > 0 else 0.0
            unrealized_pnl_pct = (unrealized_pnl / cost_basis * 100) if cost_basis > 0 else 0.0
            avg_entry_price = cost_basis / qty if qty > 0 else 0.0

            positions.append({
                "symbol": symbol,
                "asset": symbol.replace("USDT", ""),
                "quantity": qty,
                "current_price": price,
                "market_value": market_val,
                "cost_basis": cost_basis,
                "avg_entry_price": avg_entry_price,
                "unrealized_pnl": unrealized_pnl,
                "unrealized_pnl_pct": unrealized_pnl_pct,
            })

        total_portfolio_value = self._usdt_balance + total_asset_value
        total_pnl = total_portfolio_value - STARTING_BALANCE_USDT
        total_pnl_pct = (total_pnl / STARTING_BALANCE_USDT) * 100

        # Calculate allocation percentages for Pie/Donut Chart
        allocations = []
        if total_portfolio_value > 0:
            usdt_pct = (self._usdt_balance / total_portfolio_value) * 100
            allocations.append({
                "name": "USDT",
                "symbol": "USDT",
                "value": self._usdt_balance,
                "percentage": round(usdt_pct, 2),
                "color": "#3B82F6",
            })

            colors = ["#10B981", "#8B5CF6", "#F59E0B", "#EC4899", "#06B6D4", "#14B8A6", "#F97316"]
            for idx, p in enumerate(positions):
                pct = (p["market_value"] / total_portfolio_value) * 100
                allocations.append({
                    "name": p["asset"],
                    "symbol": p["symbol"],
                    "value": p["market_value"],
                    "percentage": round(pct, 2),
                    "color": colors[idx % len(colors)],
                })

        # Calculate total realized PnL from all completed sells
        total_realized_pnl = sum(t.realized_pnl for t in self._trades if t.side == "SELL")

        return {
            "usdt_balance": self._usdt_balance,
            "usd_balance": self._usdt_balance,  # alias for backward compatibility
            "total_asset_value": total_asset_value,
            "total_portfolio_value": total_portfolio_value,
            "total_pnl": total_pnl,
            "total_pnl_pct": total_pnl_pct,
            "total_realized_pnl": total_realized_pnl,
            "starting_balance": STARTING_BALANCE_USDT,
            "positions": positions,
            "allocations": allocations,
            "total_trades_count": len(self._trades),
        }

    def _calculate_current_cost_basis(self, symbol: str) -> float:
        lots = self._buy_lots.get(symbol, [])
        return sum(lot["qty"] * lot["price"] for lot in lots)

    # ── Mock Execution Engine: BUY ──────────────────────────────────────────

    async def buy(
        self,
        symbol: str,
        quantity: float,
        price: float,
        source: str = "MANUAL",
    ) -> dict:
        """Execute mock Spot BUY: Deduct USDT, Credit Crypto."""
        async with self._lock:
            sym = symbol.upper()
            gross_cost = quantity * price
            fee = gross_cost * FEE_RATE
            total_required = gross_cost + fee

            if total_required > self._usdt_balance:
                raise ValueError(
                    f"Insufficient USDT balance. Required ${total_required:,.2f} (${gross_cost:,.2f} + ${fee:,.2f} fee), available ${self._usdt_balance:,.2f}"
                )

            self._usdt_balance -= total_required
            self._holdings[sym] = self._holdings.get(sym, 0.0) + quantity

            # Record lot for FIFO accounting
            if sym not in self._buy_lots:
                self._buy_lots[sym] = []
            self._buy_lots[sym].append({"qty": quantity, "price": price})

            trade = Trade(
                symbol=sym,
                side="BUY",
                quantity=quantity,
                price=price,
                source=source,
                fee=fee,
            )
            self._trades.append(trade)
            trade_dict = trade.to_dict()

        # Broadcast event outside lock
        from services.binance_service import binance_service
        binance_service.broadcast_trade_event(trade_dict)
        return trade_dict

    async def buy_usdt_amount(
        self,
        symbol: str,
        usdt_amount: float,
        price: float,
        source: str = "MANUAL",
    ) -> dict:
        """Buy as much crypto as $usdt_amount can afford (including fee)."""
        if price <= 0:
            raise ValueError("Price must be greater than zero")
        if usdt_amount <= 0:
            raise ValueError("USDT amount must be greater than zero")

        # total = qty * price * (1 + fee_rate) => qty = usdt_amount / (price * (1 + fee_rate))
        quantity = usdt_amount / (price * (1 + FEE_RATE))
        return await self.buy(symbol, quantity, price, source)

    # ── Mock Execution Engine: SELL ─────────────────────────────────────────

    async def sell(
        self,
        symbol: str,
        quantity: float,
        price: float,
        source: str = "MANUAL",
    ) -> dict:
        """Execute mock Spot SELL: Deduct Crypto, Credit USDT, Compute Realized PnL."""
        async with self._lock:
            sym = symbol.upper()
            held = self._holdings.get(sym, 0.0)

            if quantity > held + 1e-9:
                raise ValueError(
                    f"Insufficient {sym} holdings. Need {quantity:.6f}, have {held:.6f}"
                )

            # Cap quantity to held to avoid floating point precision remainder
            actual_qty = min(quantity, held)
            gross_proceeds = actual_qty * price
            fee = gross_proceeds * FEE_RATE
            net_proceeds = gross_proceeds - fee

            # Calculate realized PnL via FIFO
            cost_basis = 0.0
            remaining_to_sell = actual_qty
            lots = self._buy_lots.get(sym, [])

            new_lots = []
            for lot in lots:
                if remaining_to_sell <= 0:
                    new_lots.append(lot)
                elif lot["qty"] <= remaining_to_sell:
                    cost_basis += lot["qty"] * lot["price"]
                    remaining_to_sell -= lot["qty"]
                else:
                    cost_basis += remaining_to_sell * lot["price"]
                    lot["qty"] -= remaining_to_sell
                    remaining_to_sell = 0.0
                    new_lots.append(lot)

            self._buy_lots[sym] = new_lots
            self._holdings[sym] = held - actual_qty
            if self._holdings[sym] < 1e-8:
                del self._holdings[sym]
                self._buy_lots[sym] = []

            self._usdt_balance += net_proceeds

            realized_pnl = net_proceeds - cost_basis
            realized_pnl_pct = (realized_pnl / cost_basis * 100) if cost_basis > 0 else 0.0

            trade = Trade(
                symbol=sym,
                side="SELL",
                quantity=actual_qty,
                price=price,
                source=source,
                realized_pnl=realized_pnl,
                realized_pnl_pct=realized_pnl_pct,
                fee=fee,
            )
            self._trades.append(trade)
            trade_dict = trade.to_dict()

        from services.binance_service import binance_service
        binance_service.broadcast_trade_event(trade_dict)
        return trade_dict

    async def sell_percentage(
        self,
        symbol: str,
        percentage: float,  # 1 to 100
        price: float,
        source: str = "MANUAL",
    ) -> dict:
        """Sell a percentage (e.g. 50%, 100%) of held crypto."""
        sym = symbol.upper()
        held = self._holdings.get(sym, 0.0)
        if held <= 0:
            raise ValueError(f"You have no {sym} to sell")
        qty = held * (percentage / 100.0)
        return await self.sell(sym, qty, price, source)

    async def reset(self):
        """Reset virtual wallet back to exactly $10,000 USDT."""
        async with self._lock:
            self._usdt_balance = STARTING_BALANCE_USDT
            self._holdings = {}
            self._buy_lots = {}
            self._trades = []


# Singleton
portfolio_manager = PortfolioManager()
