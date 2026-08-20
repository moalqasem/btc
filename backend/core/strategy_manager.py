"""
Central Strategy Manager & Execution Loop
Coordinates and ticks active algorithmic strategies (MACD+RSI, Bollinger Bands, AI Agent),
evaluates live market conditions, and triggers mock executions.
"""
import asyncio
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

from core.portfolio_manager import portfolio_manager
from core.strategies.macd_rsi import MacdRsiStrategy, MacdRsiConfig
from core.strategies.bollinger import BollingerStrategy, BollingerConfig
from core.strategies.ai_agent import AiTradingAgentStrategy, AiAgentConfig
from services.binance_service import binance_service

logger = logging.getLogger(__name__)


class StrategyManager:
    def __init__(self):
        self._lock = asyncio.Lock()
        self._macd_rsi_strategies: Dict[str, MacdRsiStrategy] = {}
        self._bollinger_strategies: Dict[str, BollingerStrategy] = {}
        self._ai_strategies: Dict[str, AiTradingAgentStrategy] = {}
        self._evaluating = False

    # ── MACD + RSI Control ───────────────────────────────────────────────────

    async def start_macd_rsi(self, config: MacdRsiConfig) -> dict:
        async with self._lock:
            sym = config.symbol.upper()
            strategy = MacdRsiStrategy(config)
            strategy.running = True
            self._macd_rsi_strategies[sym] = strategy
            binance_service.add_symbol(sym)
            logger.info(f"Started MACD+RSI strategy for {sym}")
            return self._get_strategy_status("MACD_RSI", sym)

    async def stop_macd_rsi(self, symbol: str) -> dict:
        async with self._lock:
            sym = symbol.upper()
            if sym in self._macd_rsi_strategies:
                self._macd_rsi_strategies[sym].running = False
                del self._macd_rsi_strategies[sym]
            return {"status": "stopped", "symbol": sym}

    # ── Bollinger Bands Control ──────────────────────────────────────────────

    async def start_bollinger(self, config: BollingerConfig) -> dict:
        async with self._lock:
            sym = config.symbol.upper()
            strategy = BollingerStrategy(config)
            strategy.running = True
            self._bollinger_strategies[sym] = strategy
            binance_service.add_symbol(sym)
            logger.info(f"Started Bollinger Mean Reversion strategy for {sym}")
            return self._get_strategy_status("BOLLINGER", sym)

    async def stop_bollinger(self, symbol: str) -> dict:
        async with self._lock:
            sym = symbol.upper()
            if sym in self._bollinger_strategies:
                self._bollinger_strategies[sym].running = False
                del self._bollinger_strategies[sym]
            return {"status": "stopped", "symbol": sym}

    # ── AI Agent Control ─────────────────────────────────────────────────────

    async def start_ai_agent(self, config: AiAgentConfig) -> dict:
        async with self._lock:
            sym = config.symbol.upper()
            strategy = AiTradingAgentStrategy(config)
            strategy.running = True
            self._ai_strategies[sym] = strategy
            binance_service.add_symbol(sym)
            logger.info(f"Started AI Trading Agent for {sym} ({config.risk_profile})")
            return self._get_strategy_status("AI_AGENT", sym)

    async def stop_ai_agent(self, symbol: str) -> dict:
        async with self._lock:
            sym = symbol.upper()
            if sym in self._ai_strategies:
                self._ai_strategies[sym].running = False
                del self._ai_strategies[sym]
            return {"status": "stopped", "symbol": sym}

    # ── Status Inspection ────────────────────────────────────────────────────

    def get_all_active_strategies(self) -> List[dict]:
        active = []
        for sym, s in self._macd_rsi_strategies.items():
            active.append({
                "type": "MACD_RSI",
                "name": "MACD & RSI Momentum",
                "symbol": sym,
                "running": s.running,
                "in_position": s.in_position,
                "last_signal": s.last_signal,
                "rsi": s.last_rsi,
                "macd": s.last_macd,
                "total_trades": s.total_trades,
            })
        for sym, s in self._bollinger_strategies.items():
            active.append({
                "type": "BOLLINGER",
                "name": "Mean Reversion (Bollinger)",
                "symbol": sym,
                "running": s.running,
                "in_position": s.in_position,
                "last_signal": s.last_signal,
                "middle_band": s.last_middle,
                "upper_band": s.last_upper,
                "lower_band": s.last_lower,
                "percent_b": s.last_percent_b,
                "total_trades": s.total_trades,
            })
        for sym, s in self._ai_strategies.items():
            active.append({
                "type": "AI_AGENT",
                "name": f"AI Agent ({s.config.risk_profile})",
                "symbol": sym,
                "running": s.running,
                "in_position": s.in_position,
                "last_signal": s.last_signal,
                "ai_score": s.last_score,
                "metrics": s.last_reasoning,
                "total_trades": s.total_trades,
            })
        return active

    def _get_strategy_status(self, strat_type: str, symbol: str) -> dict:
        sym = symbol.upper()
        if strat_type == "MACD_RSI" and sym in self._macd_rsi_strategies:
            s = self._macd_rsi_strategies[sym]
            return {
                "type": strat_type,
                "symbol": sym,
                "running": s.running,
                "in_position": s.in_position,
                "last_signal": s.last_signal,
                "rsi": s.last_rsi,
                "macd": s.last_macd,
            }
        elif strat_type == "BOLLINGER" and sym in self._bollinger_strategies:
            s = self._bollinger_strategies[sym]
            return {
                "type": strat_type,
                "symbol": sym,
                "running": s.running,
                "in_position": s.in_position,
                "last_signal": s.last_signal,
                "percent_b": s.last_percent_b,
            }
        elif strat_type == "AI_AGENT" and sym in self._ai_strategies:
            s = self._ai_strategies[sym]
            return {
                "type": strat_type,
                "symbol": sym,
                "running": s.running,
                "in_position": s.in_position,
                "last_signal": s.last_signal,
                "ai_score": s.last_score,
                "metrics": s.last_reasoning,
            }
        return {"running": False, "symbol": sym}

    # ── Strategy Evaluation Tick (Runs every 5s / on price poll) ─────────────

    async def tick(self, price_map: Dict[str, float]):
        """Tick all active strategy bots with live market updates."""
        if self._evaluating:
            return
        self._evaluating = True

        try:
            # 1. Tick MACD + RSI
            for sym, strat in list(self._macd_rsi_strategies.items()):
                if not strat.running:
                    continue
                await self._evaluate_macd_rsi_step(strat)

            # 2. Tick Bollinger Bands
            for sym, strat in list(self._bollinger_strategies.items()):
                if not strat.running:
                    continue
                await self._evaluate_bollinger_step(strat)

            # 3. Tick AI Agent
            for sym, strat in list(self._ai_strategies.items()):
                if not strat.running:
                    continue
                await self._evaluate_ai_agent_step(strat)

        except Exception as e:
            logger.warning(f"Error in strategy manager tick: {e}")
        finally:
            self._evaluating = False

    async def _evaluate_macd_rsi_step(self, strat: MacdRsiStrategy):
        try:
            candles = await binance_service.get_klines(strat.symbol, strat.config.candle_interval, limit=60)
            res = strat.evaluate_signals(candles)
            price = res.get("price") or binance_service.get_price(strat.symbol)
            if not price:
                return

            action = res.get("action")
            if action == "BUY" and not strat.in_position:
                trade = await portfolio_manager.buy_usdt_amount(
                    symbol=strat.symbol,
                    usdt_amount=strat.config.trade_amount_usdt,
                    price=price,
                    source="MACD_RSI",
                )
                strat.in_position = True
                strat.total_trades += 1
                logger.info(f"[MACD+RSI BOT] BUY {trade['quantity']:.6f} {strat.symbol} @ ${price:,.2f}")

            elif action == "SELL" and strat.in_position:
                trade = await portfolio_manager.sell_percentage(
                    symbol=strat.symbol,
                    percentage=100.0,
                    price=price,
                    source="MACD_RSI",
                )
                strat.in_position = False
                strat.total_trades += 1
                logger.info(f"[MACD+RSI BOT] SELL {trade['quantity']:.6f} {strat.symbol} @ ${price:,.2f} (PnL=${trade.get('realized_pnl', 0):.2f})")

        except Exception as e:
            logger.warning(f"MACD+RSI tick error on {strat.symbol}: {e}")

    async def _evaluate_bollinger_step(self, strat: BollingerStrategy):
        try:
            candles = await binance_service.get_klines(strat.symbol, strat.config.candle_interval, limit=60)
            res = strat.evaluate_signals(candles)
            price = res.get("price") or binance_service.get_price(strat.symbol)
            if not price:
                return

            action = res.get("action")
            if action == "BUY" and not strat.in_position:
                trade = await portfolio_manager.buy_usdt_amount(
                    symbol=strat.symbol,
                    usdt_amount=strat.config.trade_amount_usdt,
                    price=price,
                    source="BOLLINGER",
                )
                strat.in_position = True
                strat.total_trades += 1
                logger.info(f"[BOLLINGER BOT] BUY {trade['quantity']:.6f} {strat.symbol} @ ${price:,.2f}")

            elif action == "SELL" and strat.in_position:
                trade = await portfolio_manager.sell_percentage(
                    symbol=strat.symbol,
                    percentage=100.0,
                    price=price,
                    source="BOLLINGER",
                )
                strat.in_position = False
                strat.total_trades += 1
                logger.info(f"[BOLLINGER BOT] SELL {trade['quantity']:.6f} {strat.symbol} @ ${price:,.2f} (PnL=${trade.get('realized_pnl', 0):.2f})")

        except Exception as e:
            logger.warning(f"Bollinger tick error on {strat.symbol}: {e}")

    async def _evaluate_ai_agent_step(self, strat: AiTradingAgentStrategy):
        try:
            candles = await binance_service.get_klines(strat.symbol, strat.config.candle_interval, limit=60)
            res = strat.evaluate_signals(candles)
            price = res.get("price") or binance_service.get_price(strat.symbol)
            if not price:
                return

            action = res.get("action")
            if action == "BUY" and not strat.in_position:
                trade = await portfolio_manager.buy_usdt_amount(
                    symbol=strat.symbol,
                    usdt_amount=strat.config.trade_amount_usdt,
                    price=price,
                    source="AI_AGENT",
                )
                strat.in_position = True
                strat.entry_price = price
                strat.peak_price = price
                strat.total_trades += 1
                logger.info(f"[AI AGENT BOT] BUY {trade['quantity']:.6f} {strat.symbol} @ ${price:,.2f} ({res.get('reason')})")

            elif action == "SELL" and strat.in_position:
                trade = await portfolio_manager.sell_percentage(
                    symbol=strat.symbol,
                    percentage=100.0,
                    price=price,
                    source="AI_AGENT",
                )
                strat.in_position = False
                strat.entry_price = None
                strat.peak_price = None
                strat.total_trades += 1
                logger.info(f"[AI AGENT BOT] SELL {trade['quantity']:.6f} {strat.symbol} @ ${price:,.2f} (PnL=${trade.get('realized_pnl', 0):.2f})")

        except Exception as e:
            logger.warning(f"AI Agent tick error on {strat.symbol}: {e}")


# Singleton
strategy_manager = StrategyManager()
