"""
Strategy B: Mean Reversion (Bollinger Bands) Strategy (Spot Only)
Calculates 20-period Simple Moving Average with Upper and Lower volatility bands.
Buys when price dips below the Lower Bollinger Band (discount/oversold mean-reversion).
Sells when price touches or exceeds the Upper Bollinger Band (overbought target).
"""
from dataclasses import dataclass
from typing import List, Dict, Optional
import numpy as np
import pandas as pd


@dataclass
class BollingerConfig:
    symbol: str
    period: int = 20
    num_std_dev: float = 2.0
    trade_amount_usdt: float = 500.0
    candle_interval: str = "1h"


def compute_bollinger_bands(series: pd.Series, period: int = 20, num_std: float = 2.0):
    sma = series.rolling(window=period).mean()
    std = series.rolling(window=period).std()
    upper = sma + (std * num_std)
    lower = sma - (std * num_std)
    bandwidth = (upper - lower) / (sma + 1e-10) * 100
    percent_b = (series - lower) / (upper - lower + 1e-10)
    return sma, upper, lower, bandwidth, percent_b


class BollingerStrategy:
    def __init__(self, config: BollingerConfig):
        self.config = config
        self.symbol = config.symbol.upper()
        self.running = False
        self.in_position = False
        self.last_signal = "NEUTRAL"
        self.last_middle: Optional[float] = None
        self.last_upper: Optional[float] = None
        self.last_lower: Optional[float] = None
        self.last_percent_b: Optional[float] = None
        self.total_trades = 0
        self.strategy_pnl = 0.0

    def evaluate_signals(self, candles: List[dict]) -> dict:
        if len(candles) < self.config.period + 5:
            return {"action": "HOLD", "reason": "Insufficient candle data"}

        df = pd.DataFrame(candles)
        closes = df["close"]

        sma, upper, lower, _, pct_b = compute_bollinger_bands(
            closes, self.config.period, self.config.num_std_dev
        )

        curr_price = float(closes.iloc[-1])
        curr_upper = float(upper.iloc[-1])
        curr_lower = float(lower.iloc[-1])
        curr_sma = float(sma.iloc[-1])
        curr_pct_b = float(pct_b.iloc[-1])

        self.last_middle = round(curr_sma, 4)
        self.last_upper = round(curr_upper, 4)
        self.last_lower = round(curr_lower, 4)
        self.last_percent_b = round(curr_pct_b, 3)

        action = "HOLD"
        reason = f"Price ${curr_price:,.2f} inside Bands [${curr_lower:,.2f} - ${curr_upper:,.2f}] (%B={curr_pct_b:.2f})"

        if not self.in_position:
            # Mean Reversion Buy: Price has dropped below or equal to Lower Band
            if curr_price <= curr_lower or curr_pct_b <= 0.05:
                action = "BUY"
                reason = f"Oversold Bounce Trigger: Price ${curr_price:,.2f} pierced Lower Band (${curr_lower:,.2f})"
        else:
            # Mean Reversion Sell: Price has reached Upper Band or above
            if curr_price >= curr_upper or curr_pct_b >= 0.95:
                action = "SELL"
                reason = f"Overbought Target Reached: Price ${curr_price:,.2f} hit Upper Band (${curr_upper:,.2f})"

        self.last_signal = action
        return {
            "symbol": self.symbol,
            "action": action,
            "reason": reason,
            "middle_band": self.last_middle,
            "upper_band": self.last_upper,
            "lower_band": self.last_lower,
            "percent_b": self.last_percent_b,
            "price": curr_price,
        }
