"""
Comprehensive Platform Test Suite
Tests:
- Technical Indicators & Strategies (MACD+RSI, Bollinger Bands, AI Agent with ATR)
- Portfolio Manager & Mock Execution Engine (FIFO, Realized P&L, Fees)
- Backtesting Engines (All 5 strategies)
"""
import os
import sys
import unittest
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.portfolio_manager import PortfolioManager, STARTING_BALANCE_USDT
from core.strategies.macd_rsi import MacdRsiStrategy, MacdRsiConfig, compute_rsi, compute_macd
from core.strategies.bollinger import BollingerStrategy, BollingerConfig, compute_bollinger_bands
from core.strategies.ai_agent import AiTradingAgentStrategy, AiAgentConfig, compute_atr
from core.backtester import (
    backtest_macd_rsi,
    backtest_bollinger,
    backtest_ai_agent,
    backtest_grid,
    backtest_trailing_stop,
)


def generate_mock_candles(n=100, base_price=50000.0, trend="sideways"):
    np.random.seed(42)
    candles = []
    curr = base_price
    t_start = 1700000000

    for i in range(n):
        if trend == "up":
            ret = np.random.normal(0.003, 0.01)
        elif trend == "down":
            ret = np.random.normal(-0.003, 0.01)
        else:
            ret = np.random.normal(0.0, 0.012)

        open_p = curr
        close_p = curr * (1 + ret)
        high_p = max(open_p, close_p) * (1 + abs(np.random.normal(0.002, 0.002)))
        low_p = min(open_p, close_p) * (1 - abs(np.random.normal(0.002, 0.002)))
        volume = float(np.random.uniform(50, 500))

        candles.append({
            "time": t_start + i * 3600,
            "open": open_p,
            "high": high_p,
            "low": low_p,
            "close": close_p,
            "volume": volume,
        })
        curr = close_p

    return candles


class TestPlatform(unittest.IsolatedAsyncioTestCase):

    def test_indicators_math(self):
        candles = generate_mock_candles(50)
        df = pd.DataFrame(candles)
        closes = df["close"]

        # RSI
        rsi = compute_rsi(closes, 14)
        self.assertEqual(len(rsi), 50)
        self.assertTrue(0 <= rsi.dropna().iloc[-1] <= 100)

        # MACD
        macd, sig, hist = compute_macd(closes, 12, 26, 9)
        self.assertEqual(len(macd), 50)
        self.assertEqual(len(sig), 50)

        # Bollinger Bands
        sma, upper, lower, bw, pct_b = compute_bollinger_bands(closes, 20, 2.0)
        self.assertTrue(upper.iloc[-1] > lower.iloc[-1])
        self.assertTrue(upper.iloc[-1] > sma.iloc[-1] > lower.iloc[-1])

        # ATR
        atr = compute_atr(df, 14)
        self.assertTrue(atr.dropna().iloc[-1] > 0)

    def test_strategies_evaluation(self):
        candles = generate_mock_candles(60)

        # 1. MACD + RSI
        s1 = MacdRsiStrategy(MacdRsiConfig(symbol="BTCUSDT"))
        res1 = s1.evaluate_signals(candles)
        self.assertIn(res1["action"], ["BUY", "SELL", "HOLD"])
        self.assertIn("rsi", res1)
        self.assertIn("macd", res1)

        # 2. Bollinger
        s2 = BollingerStrategy(BollingerConfig(symbol="ETHUSDT"))
        res2 = s2.evaluate_signals(candles)
        self.assertIn(res2["action"], ["BUY", "SELL", "HOLD"])
        self.assertIn("middle_band", res2)

        # 3. AI Agent
        s3 = AiTradingAgentStrategy(AiAgentConfig(symbol="SOLUSDT", risk_profile="BALANCED"))
        res3 = s3.evaluate_signals(candles)
        self.assertIn(res3["action"], ["BUY", "SELL", "HOLD"])
        self.assertTrue(-100 <= res3["score"] <= 100)
        self.assertIn("metrics", res3)

    async def test_portfolio_mock_execution(self):
        pm = PortfolioManager()
        self.assertEqual(pm.get_usd_balance(), STARTING_BALANCE_USDT)

        # Buy $1,000 USDT of BTC at $50,000
        trade1 = await pm.buy_usdt_amount("BTCUSDT", 1000.0, 50000.0, source="MANUAL")
        self.assertEqual(trade1["side"], "BUY")
        self.assertTrue(trade1["quantity"] > 0)
        self.assertAlmostEqual(pm.get_usd_balance(), 9000.0, delta=1.0)
        self.assertIn("BTCUSDT", pm.get_holdings())

        # Check snapshot
        snap = pm.get_snapshot({"BTCUSDT": 55000.0})
        self.assertEqual(snap["usdt_balance"], pm.get_usd_balance())
        self.assertTrue(snap["total_pnl"] > 0)  # Price rose from 50k to 55k

        # Sell 100% of BTC at $55,000
        trade2 = await pm.sell_percentage("BTCUSDT", 100.0, 55000.0, source="MANUAL")
        self.assertEqual(trade2["side"], "SELL")
        self.assertTrue(trade2["realized_pnl"] > 0)  # Realized profit confirmed
        self.assertNotIn("BTCUSDT", pm.get_holdings())

        # Reset
        await pm.reset()
        self.assertEqual(pm.get_usd_balance(), STARTING_BALANCE_USDT)
        self.assertEqual(len(pm.get_holdings()), 0)

    def test_backtest_all_strategies(self):
        candles = generate_mock_candles(150, base_price=60000.0, trend="up")

        # 1. MACD + RSI Backtest
        r1 = backtest_macd_rsi(candles, "BTCUSDT")
        self.assertIsNotNone(r1.total_return_pct)
        self.assertTrue(len(r1.equity_curve) > 0)

        # 2. Bollinger Backtest
        r2 = backtest_bollinger(candles, "ETHUSDT")
        self.assertIsNotNone(r2.total_return_pct)

        # 3. AI Agent Backtest
        r3 = backtest_ai_agent(candles, "SOLUSDT")
        self.assertIsNotNone(r3.total_return_pct)

        # 4. Grid Backtest
        r4 = backtest_grid(candles, "BTCUSDT", "1h", 70000, 50000, 10, 100)
        self.assertIsNotNone(r4.total_return_pct)

        # 5. Trailing Stop Backtest
        r5 = backtest_trailing_stop(candles, "BTCUSDT", "1h", 2.0, 5.0, 1000)
        self.assertIsNotNone(r5.total_return_pct)


if __name__ == "__main__":
    unittest.main()
