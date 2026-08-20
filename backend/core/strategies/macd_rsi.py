"""
Strategy A: MACD & RSI Momentum Strategy (Spot Only)
Combines Moving Average Convergence Divergence (MACD 12,26,9) and Relative Strength Index (RSI 14).
Generates BUY when RSI is oversold and MACD line crosses above Signal line.
Generates SELL when RSI is overbought and MACD line crosses below Signal line.
"""
from dataclasses import dataclass
from typing import List, Dict, Optional, Tuple
import numpy as np
import pandas as pd


@dataclass
class MacdRsiConfig:
    symbol: str
    rsi_period: int = 14
    rsi_oversold: float = 35.0
    rsi_overbought: float = 65.0
    macd_fast: int = 12
    macd_slow: int = 26
    macd_signal: int = 9
    trade_amount_usdt: float = 500.0  # USDT per trade
    candle_interval: str = "1h"


def compute_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / (loss + 1e-10)
    return 100 - (100 / (1 + rs))


def compute_macd(series: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> Tuple[pd.Series, pd.Series, pd.Series]:
    ema_fast = series.ewm(span=fast, adjust=False).mean()
    ema_slow = series.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    hist = macd_line - signal_line
    return macd_line, signal_line, hist


class MacdRsiStrategy:
    def __init__(self, config: MacdRsiConfig):
        self.config = config
        self.symbol = config.symbol.upper()
        self.running = False
        self.in_position = False
        self.last_signal = "NEUTRAL"
        self.last_rsi: Optional[float] = None
        self.last_macd: Optional[float] = None
        self.last_macd_signal: Optional[float] = None
        self.total_trades = 0
        self.strategy_pnl = 0.0

    def evaluate_signals(self, candles: List[dict]) -> dict:
        """
        Evaluate candle data and return the current indicator values + action (BUY/SELL/HOLD).
        """
        if len(candles) < 35:
            return {"action": "HOLD", "reason": "Insufficient candle data"}

        df = pd.DataFrame(candles)
        closes = df["close"]

        rsi_series = compute_rsi(closes, self.config.rsi_period)
        macd_line, sig_line, _ = compute_macd(
            closes, self.config.macd_fast, self.config.macd_slow, self.config.macd_signal
        )

        curr_rsi = float(rsi_series.iloc[-1])
        curr_macd = float(macd_line.iloc[-1])
        prev_macd = float(macd_line.iloc[-2])
        curr_sig = float(sig_line.iloc[-1])
        prev_sig = float(sig_line.iloc[-2])
        curr_price = float(closes.iloc[-1])

        self.last_rsi = round(curr_rsi, 2)
        self.last_macd = round(curr_macd, 4)
        self.last_macd_signal = round(curr_sig, 4)

        # Bullish Crossover: MACD crosses above Signal AND RSI < oversold threshold
        macd_cross_up = (prev_macd <= prev_sig) and (curr_macd > curr_sig)
        macd_cross_down = (prev_macd >= prev_sig) and (curr_macd < curr_sig)

        action = "HOLD"
        reason = f"RSI: {curr_rsi:.1f} | MACD: {curr_macd:.3f} vs Sig: {curr_sig:.3f}"

        if not self.in_position:
            if curr_rsi <= self.config.rsi_oversold or (macd_cross_up and curr_rsi <= 50):
                action = "BUY"
                reason = f"Bullish momentum trigger: RSI {curr_rsi:.1f} + MACD Bullish Crossover"
        else:
            if curr_rsi >= self.config.rsi_overbought or macd_cross_down:
                action = "SELL"
                reason = f"Bearish momentum trigger: RSI {curr_rsi:.1f} + MACD Bearish Crossover"

        self.last_signal = action
        return {
            "symbol": self.symbol,
            "action": action,
            "reason": reason,
            "rsi": self.last_rsi,
            "macd": self.last_macd,
            "signal_line": self.last_macd_signal,
            "price": curr_price,
        }
