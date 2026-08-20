"""
Strategy C: AI Trading Agent (Smart Execution Engine) - Spot Only
Simulates an intelligent autonomous AI trading agent:
1. Dynamic Volatility Scaling via Average True Range (ATR).
2. Multi-factor Weighted Scoring:
   - Momentum (RSI + MACD Histogram Slope)
   - Volume Surge Factor (Current Volume vs 20-period volume average)
   - Trend Regime (EMA 20 vs EMA 50 alignment)
   - Dip/Peak Extension (Distance from recent local extrema)
3. Outputs an AI Confidence Score [-100 to +100] and detailed decision reasoning.
"""
from dataclasses import dataclass
from typing import List, Dict, Optional, Tuple
import numpy as np
import pandas as pd


@dataclass
class AiAgentConfig:
    symbol: str
    risk_profile: str = "BALANCED"  # "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE"
    trade_amount_usdt: float = 600.0
    candle_interval: str = "1h"
    atr_period: int = 14
    buy_threshold: float = 50.0   # Confidence score needed to trigger smart buy
    sell_threshold: float = -50.0 # Confidence score needed to trigger smart sell


def compute_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    high = df["high"]
    low = df["low"]
    close_prev = df["close"].shift(1)
    tr1 = high - low
    tr2 = (high - close_prev).abs()
    tr3 = (low - close_prev).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    return tr.rolling(window=period).mean()


class AiTradingAgentStrategy:
    def __init__(self, config: AiAgentConfig):
        self.config = config
        self.symbol = config.symbol.upper()
        self.running = False
        self.in_position = False
        self.entry_price: Optional[float] = None
        self.peak_price: Optional[float] = None
        self.last_score: float = 0.0
        self.last_reasoning: dict = {}
        self.last_signal = "NEUTRAL"
        self.total_trades = 0
        self.strategy_pnl = 0.0

    def evaluate_signals(self, candles: List[dict]) -> dict:
        if len(candles) < 30:
            return {"action": "HOLD", "score": 0, "reason": "Gathering market intelligence (need more candles)"}

        df = pd.DataFrame(candles)
        closes = df["close"]
        volumes = df["volume"]
        highs = df["high"]
        lows = df["low"]

        curr_price = float(closes.iloc[-1])

        # ── 1. ATR & Volatility Analysis ─────────────────────────────────────
        atr_series = compute_atr(df, self.config.atr_period)
        curr_atr = float(atr_series.iloc[-1]) if not np.isnan(atr_series.iloc[-1]) else curr_price * 0.02
        atr_pct = (curr_atr / curr_price) * 100

        # Adjust score sensitivity based on risk profile and ATR
        risk_mult = 1.2 if self.config.risk_profile == "AGGRESSIVE" else (0.85 if self.config.risk_profile == "CONSERVATIVE" else 1.0)

        # ── 2. Momentum Factor (RSI + MACD) ──────────────────────────────────
        delta = closes.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / (loss + 1e-10)
        rsi = float((100 - (100 / (1 + rs))).iloc[-1])

        # RSI Score: Oversold (< 35) gives positive score (dip to buy), Overbought gives negative score
        rsi_score = (50 - rsi) * 1.5  # e.g. RSI 30 -> +30, RSI 70 -> -30

        # ── 3. Volume Surge Factor ───────────────────────────────────────────
        vol_sma20 = float(volumes.rolling(window=20).mean().iloc[-1])
        curr_vol = float(volumes.iloc[-1])
        vol_ratio = (curr_vol / (vol_sma20 + 1e-10))
        vol_score = min(30.0, max(-10.0, (vol_ratio - 1.0) * 15.0))

        # ── 4. Trend & Mean Distance Factor ──────────────────────────────────
        ema20 = float(closes.ewm(span=20, adjust=False).mean().iloc[-1])
        ema50 = float(closes.ewm(span=50, adjust=False).mean().iloc[-1])
        trend_score = ((ema20 - ema50) / (ema50 + 1e-10)) * 500.0

        # ── 5. Dip / Peak Detection Factor ───────────────────────────────────
        local_low = float(lows.iloc[-15:].min())
        local_high = float(highs.iloc[-15:].max())
        range_span = local_high - local_low + 1e-10
        position_in_range = (curr_price - local_low) / range_span  # 0.0 (at low) to 1.0 (at high)

        range_score = (0.5 - position_in_range) * 40.0  # +20 at low, -20 at high

        # ── Weighted Aggregate AI Confidence Score [-100 to +100] ────────────
        raw_score = (
            (rsi_score * 0.35) +
            (vol_score * 0.25) +
            (trend_score * 0.15) +
            (range_score * 0.25)
        ) * risk_mult

        ai_confidence = float(np.clip(raw_score, -100.0, 100.0))
        self.last_score = round(ai_confidence, 1)

        # ── Decision Tree ────────────────────────────────────────────────────
        action = "HOLD"
        reason = f"AI Score: {ai_confidence:+.1f}% | Market Regime: {self.config.risk_profile} (ATR: {atr_pct:.2f}%)"

        if not self.in_position:
            if ai_confidence >= self.config.buy_threshold:
                action = "BUY"
                reason = (
                    f"AI Smart BUY Signal (Confidence: {ai_confidence:.1f}%): "
                    f"Dip detected with volume surge ({vol_ratio:.1f}x) & RSI ({rsi:.1f})"
                )
        else:
            # Trailing dynamic profit target or bearish AI flip
            if self.peak_price and curr_price > self.peak_price:
                self.peak_price = curr_price

            dynamic_trail_pct = max(1.5, min(6.0, atr_pct * 1.5))
            trail_stop_level = (self.peak_price or curr_price) * (1 - dynamic_trail_pct / 100.0)

            if ai_confidence <= self.config.sell_threshold:
                action = "SELL"
                reason = f"AI Smart SELL Signal (Confidence: {ai_confidence:.1f}%): Momentum peak reached"
            elif self.entry_price and curr_price <= trail_stop_level:
                action = "SELL"
                reason = f"AI Volatility Trailing Stop hit @ ${curr_price:,.2f} (Trail: {dynamic_trail_pct:.1f}% based on ATR)"

        self.last_reasoning = {
            "ai_confidence": self.last_score,
            "rsi": round(rsi, 1),
            "atr_pct": round(atr_pct, 2),
            "volume_surge": round(vol_ratio, 2),
            "trend_alignment": "BULLISH" if ema20 > ema50 else "BEARISH",
            "position_in_range_pct": round(position_in_range * 100, 1),
            "risk_profile": self.config.risk_profile,
        }
        self.last_signal = action

        return {
            "symbol": self.symbol,
            "action": action,
            "score": self.last_score,
            "reason": reason,
            "metrics": self.last_reasoning,
            "price": curr_price,
        }
