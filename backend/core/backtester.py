"""
Comprehensive Backtesting Engine (Spot Market Only)
Vectorized & candle-by-candle simulations for:
- Grid Trading
- Trailing Stop
- MACD & RSI Momentum
- Bollinger Bands Mean Reversion
- AI Trading Agent (Smart Execution)
"""
import logging
from dataclasses import dataclass
from typing import Dict, List, Optional
import numpy as np
import pandas as pd

from core.strategies.macd_rsi import compute_rsi, compute_macd
from core.strategies.bollinger import compute_bollinger_bands
from core.strategies.ai_agent import compute_atr

logger = logging.getLogger(__name__)
STARTING_BALANCE = 10_000.0


@dataclass
class BacktestResult:
    strategy: str
    symbol: str
    interval: str
    start_balance: float
    end_balance: float
    total_return_pct: float
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate_pct: float
    max_drawdown_pct: float
    sharpe_ratio: float
    total_fees_usd: float
    trades: List[dict]
    equity_curve: List[dict]  # [{"time": int, "value": float}]
    params: dict


def _make_result(
    strategy: str,
    symbol: str,
    interval: str,
    balance_history: List[float],
    times: List[int],
    trades: List[dict],
    params: dict,
    fee_rate: float = 0.001,
) -> BacktestResult:
    start = STARTING_BALANCE
    end = balance_history[-1] if balance_history else start
    total_return = (end - start) / start * 100

    equity_curve = [{"time": t, "value": round(v, 2)} for t, v in zip(times, balance_history)]

    peak = np.maximum.accumulate(balance_history) if balance_history else np.array([start])
    drawdowns = (np.array(balance_history) - peak) / peak * 100 if len(balance_history) > 0 else np.array([0])
    max_dd = float(drawdowns.min()) if len(drawdowns) > 0 else 0.0

    sell_trades = [t for t in trades if t.get("side") == "SELL"]
    pnls = [t.get("pnl", 0) for t in sell_trades if "pnl" in t]
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p <= 0]
    win_rate = (len(wins) / len(pnls) * 100) if pnls else 0.0

    if len(balance_history) > 1:
        returns = np.diff(balance_history) / np.array(balance_history[:-1])
        std_ret = float(np.std(returns))
        sharpe = (float(np.mean(returns)) / std_ret * np.sqrt(252 * 24)) if std_ret > 0 else 0.0
    else:
        sharpe = 0.0

    total_fees = sum(t.get("fee_usd", 0) for t in trades)

    return BacktestResult(
        strategy=strategy,
        symbol=symbol,
        interval=interval,
        start_balance=start,
        end_balance=round(end, 2),
        total_return_pct=round(total_return, 2),
        total_trades=len(trades),
        winning_trades=len(wins),
        losing_trades=len(losses),
        win_rate_pct=round(win_rate, 2),
        max_drawdown_pct=round(max_dd, 2),
        sharpe_ratio=round(sharpe, 2),
        total_fees_usd=round(total_fees, 2),
        trades=trades,
        equity_curve=equity_curve,
        params=params,
    )


# ── 1. MACD & RSI Backtest ───────────────────────────────────────────────────

def backtest_macd_rsi(
    candles: List[dict],
    symbol: str,
    interval: str = "1h",
    rsi_period: int = 14,
    rsi_oversold: float = 35.0,
    rsi_overbought: float = 65.0,
    trade_amount_usdt: float = 1000.0,
    fee_rate: float = 0.001,
) -> BacktestResult:
    df = pd.DataFrame(candles)
    closes = df["close"]

    rsi = compute_rsi(closes, rsi_period)
    macd_line, sig_line, _ = compute_macd(closes, 12, 26, 9)

    usd_balance = STARTING_BALANCE
    holding = 0.0
    entry_price = 0.0
    in_position = False

    trades: List[dict] = []
    balance_history: List[float] = []
    times: List[int] = []

    for i in range(len(df)):
        t = int(df["time"].iloc[i])
        close_p = float(closes.iloc[i])
        curr_rsi = float(rsi.iloc[i]) if not np.isnan(rsi.iloc[i]) else 50.0
        curr_macd = float(macd_line.iloc[i]) if not np.isnan(macd_line.iloc[i]) else 0.0
        prev_macd = float(macd_line.iloc[i - 1]) if i > 0 and not np.isnan(macd_line.iloc[i - 1]) else 0.0
        curr_sig = float(sig_line.iloc[i]) if not np.isnan(sig_line.iloc[i]) else 0.0
        prev_sig = float(sig_line.iloc[i - 1]) if i > 0 and not np.isnan(sig_line.iloc[i - 1]) else 0.0

        macd_cross_up = (prev_macd <= prev_sig) and (curr_macd > curr_sig)
        macd_cross_down = (prev_macd >= prev_sig) and (curr_macd < curr_sig)

        if not in_position:
            if curr_rsi <= rsi_oversold or (macd_cross_up and curr_rsi <= 50):
                cost = min(trade_amount_usdt, usd_balance)
                if cost >= 10:
                    fee = cost * fee_rate
                    net_cost = cost - fee
                    qty = net_cost / close_p
                    usd_balance -= cost
                    holding = qty
                    entry_price = close_p
                    in_position = True
                    trades.append({
                        "time": t,
                        "side": "BUY",
                        "price": close_p,
                        "quantity": qty,
                        "total_usd": cost,
                        "fee_usd": fee,
                        "reason": f"RSI {curr_rsi:.1f} + MACD Cross Up",
                    })
        else:
            if curr_rsi >= rsi_overbought or macd_cross_down:
                proceeds = holding * close_p
                fee = proceeds * fee_rate
                net_proceeds = proceeds - fee
                usd_balance += net_proceeds
                pnl = (close_p - entry_price) * holding - fee
                trades.append({
                    "time": t,
                    "side": "SELL",
                    "price": close_p,
                    "quantity": holding,
                    "total_usd": proceeds,
                    "fee_usd": fee,
                    "pnl": pnl,
                    "reason": f"RSI {curr_rsi:.1f} + MACD Cross Down",
                })
                holding = 0.0
                in_position = False

        total_val = usd_balance + (holding * close_p)
        balance_history.append(total_val)
        times.append(t)

    params = {
        "rsi_period": rsi_period,
        "rsi_oversold": rsi_oversold,
        "rsi_overbought": rsi_overbought,
        "trade_amount_usdt": trade_amount_usdt,
        "fee_rate": fee_rate,
    }
    return _make_result("MACD_RSI", symbol, interval, balance_history, times, trades, params, fee_rate)


# ── 2. Bollinger Bands Backtest ──────────────────────────────────────────────

def backtest_bollinger(
    candles: List[dict],
    symbol: str,
    interval: str = "1h",
    period: int = 20,
    num_std_dev: float = 2.0,
    trade_amount_usdt: float = 1000.0,
    fee_rate: float = 0.001,
) -> BacktestResult:
    df = pd.DataFrame(candles)
    closes = df["close"]
    _, upper, lower, _, pct_b = compute_bollinger_bands(closes, period, num_std_dev)

    usd_balance = STARTING_BALANCE
    holding = 0.0
    entry_price = 0.0
    in_position = False

    trades: List[dict] = []
    balance_history: List[float] = []
    times: List[int] = []

    for i in range(len(df)):
        t = int(df["time"].iloc[i])
        close_p = float(closes.iloc[i])
        low_p = float(df["low"].iloc[i])
        high_p = float(df["high"].iloc[i])
        curr_upper = float(upper.iloc[i]) if not np.isnan(upper.iloc[i]) else close_p * 1.05
        curr_lower = float(lower.iloc[i]) if not np.isnan(lower.iloc[i]) else close_p * 0.95

        if not in_position:
            if low_p <= curr_lower:
                cost = min(trade_amount_usdt, usd_balance)
                if cost >= 10:
                    fee = cost * fee_rate
                    qty = (cost - fee) / curr_lower
                    usd_balance -= cost
                    holding = qty
                    entry_price = curr_lower
                    in_position = True
                    trades.append({
                        "time": t,
                        "side": "BUY",
                        "price": curr_lower,
                        "quantity": qty,
                        "total_usd": cost,
                        "fee_usd": fee,
                        "reason": f"Price crossed lower band ${curr_lower:,.2f}",
                    })
        else:
            if high_p >= curr_upper:
                proceeds = holding * curr_upper
                fee = proceeds * fee_rate
                usd_balance += proceeds - fee
                pnl = (curr_upper - entry_price) * holding - fee
                trades.append({
                    "time": t,
                    "side": "SELL",
                    "price": curr_upper,
                    "quantity": holding,
                    "total_usd": proceeds,
                    "fee_usd": fee,
                    "pnl": pnl,
                    "reason": f"Price reached upper band ${curr_upper:,.2f}",
                })
                holding = 0.0
                in_position = False

        total_val = usd_balance + (holding * close_p)
        balance_history.append(total_val)
        times.append(t)

    params = {
        "period": period,
        "num_std_dev": num_std_dev,
        "trade_amount_usdt": trade_amount_usdt,
        "fee_rate": fee_rate,
    }
    return _make_result("BOLLINGER", symbol, interval, balance_history, times, trades, params, fee_rate)


# ── 3. AI Trading Agent Backtest ─────────────────────────────────────────────

def backtest_ai_agent(
    candles: List[dict],
    symbol: str,
    interval: str = "1h",
    risk_profile: str = "BALANCED",
    trade_amount_usdt: float = 1200.0,
    buy_threshold: float = 50.0,
    sell_threshold: float = -50.0,
    fee_rate: float = 0.001,
) -> BacktestResult:
    df = pd.DataFrame(candles)
    closes = df["close"]
    highs = df["high"]
    lows = df["low"]
    volumes = df["volume"]

    atr = compute_atr(df, 14)
    rsi = compute_rsi(closes, 14)
    ema20 = closes.ewm(span=20, adjust=False).mean()
    ema50 = closes.ewm(span=50, adjust=False).mean()
    vol_sma = volumes.rolling(window=20).mean()

    risk_mult = 1.2 if risk_profile == "AGGRESSIVE" else (0.85 if risk_profile == "CONSERVATIVE" else 1.0)

    usd_balance = STARTING_BALANCE
    holding = 0.0
    entry_price = 0.0
    peak_price = 0.0
    in_position = False

    trades: List[dict] = []
    balance_history: List[float] = []
    times: List[int] = []

    for i in range(len(df)):
        t = int(df["time"].iloc[i])
        close_p = float(closes.iloc[i])
        curr_high = float(highs.iloc[i])

        if i < 20:
            balance_history.append(usd_balance)
            times.append(t)
            continue

        curr_atr = float(atr.iloc[i]) if not np.isnan(atr.iloc[i]) else close_p * 0.02
        atr_pct = (curr_atr / close_p) * 100
        curr_rsi = float(rsi.iloc[i]) if not np.isnan(rsi.iloc[i]) else 50.0
        rsi_score = (50 - curr_rsi) * 1.5

        curr_vol = float(volumes.iloc[i])
        curr_vol_sma = float(vol_sma.iloc[i]) if not np.isnan(vol_sma.iloc[i]) else curr_vol
        vol_ratio = curr_vol / (curr_vol_sma + 1e-10)
        vol_score = min(30.0, max(-10.0, (vol_ratio - 1.0) * 15.0))

        curr_ema20 = float(ema20.iloc[i])
        curr_ema50 = float(ema50.iloc[i])
        trend_score = ((curr_ema20 - curr_ema50) / (curr_ema50 + 1e-10)) * 500.0

        start_idx = max(0, i - 15)
        local_low = float(lows.iloc[start_idx:i+1].min())
        local_high = float(highs.iloc[start_idx:i+1].max())
        pos_in_range = (close_p - local_low) / (local_high - local_low + 1e-10)
        range_score = (0.5 - pos_in_range) * 40.0

        ai_confidence = float(np.clip(
            ((rsi_score * 0.35) + (vol_score * 0.25) + (trend_score * 0.15) + (range_score * 0.25)) * risk_mult,
            -100.0,
            100.0,
        ))

        if not in_position:
            if ai_confidence >= buy_threshold:
                cost = min(trade_amount_usdt, usd_balance)
                if cost >= 10:
                    fee = cost * fee_rate
                    qty = (cost - fee) / close_p
                    usd_balance -= cost
                    holding = qty
                    entry_price = close_p
                    peak_price = close_p
                    in_position = True
                    trades.append({
                        "time": t,
                        "side": "BUY",
                        "price": close_p,
                        "quantity": qty,
                        "total_usd": cost,
                        "fee_usd": fee,
                        "reason": f"AI Confidence +{ai_confidence:.1f}% (Dip buy with {vol_ratio:.1f}x vol)",
                    })
        else:
            if curr_high > peak_price:
                peak_price = curr_high

            dynamic_trail_pct = max(1.5, min(6.0, atr_pct * 1.5))
            trail_level = peak_price * (1 - dynamic_trail_pct / 100.0)

            if ai_confidence <= sell_threshold or close_p <= trail_level:
                proceeds = holding * close_p
                fee = proceeds * fee_rate
                usd_balance += proceeds - fee
                pnl = (close_p - entry_price) * holding - fee
                trades.append({
                    "time": t,
                    "side": "SELL",
                    "price": close_p,
                    "quantity": holding,
                    "total_usd": proceeds,
                    "fee_usd": fee,
                    "pnl": pnl,
                    "reason": f"AI Exit ({ai_confidence:.1f}%) / ATR Trail {dynamic_trail_pct:.1f}%",
                })
                holding = 0.0
                in_position = False

        total_val = usd_balance + (holding * close_p)
        balance_history.append(total_val)
        times.append(t)

    params = {
        "risk_profile": risk_profile,
        "trade_amount_usdt": trade_amount_usdt,
        "buy_threshold": buy_threshold,
        "sell_threshold": sell_threshold,
        "fee_rate": fee_rate,
    }
    return _make_result("AI_AGENT", symbol, interval, balance_history, times, trades, params, fee_rate)


# ── 4. Grid Backtest (Preserved & Enhanced) ───────────────────────────────────

def backtest_grid(
    candles: List[dict],
    symbol: str,
    interval: str,
    upper_price: float,
    lower_price: float,
    grid_count: int,
    amount_per_grid_usd: float,
    fee_rate: float = 0.001,
) -> BacktestResult:
    if len(candles) < 10:
        raise ValueError("Not enough candle data for backtesting.")

    df = pd.DataFrame(candles)
    step = (upper_price - lower_price) / grid_count
    grid_prices = [lower_price + i * step for i in range(grid_count + 1)]

    usd_balance = STARTING_BALANCE
    holdings: Dict[str, float] = {}
    trades: List[dict] = []
    balance_history: List[float] = []
    times: List[int] = []
    orders: Dict[float, dict] = {}

    first_open = float(df["open"].iloc[0])
    for gp in grid_prices:
        qty = amount_per_grid_usd / gp
        cost = qty * gp * (1 + fee_rate)
        if gp < first_open and cost <= usd_balance:
            orders[gp] = {"side": "BUY", "qty": qty}

    for _, candle in df.iterrows():
        low = float(candle["low"])
        high = float(candle["high"])
        close = float(candle["close"])
        t = int(candle["time"])

        new_orders = dict(orders)
        for gp, order in list(orders.items()):
            if order["side"] == "BUY" and low <= gp:
                qty = order["qty"]
                cost = qty * gp
                fee = cost * fee_rate
                if cost + fee <= usd_balance:
                    usd_balance -= (cost + fee)
                    holdings["asset"] = holdings.get("asset", 0) + qty
                    trades.append({
                        "time": t,
                        "side": "BUY",
                        "price": gp,
                        "quantity": qty,
                        "total_usd": cost,
                        "fee_usd": fee,
                    })
                    del new_orders[gp]
                    sell_price = round(gp + step, 4)
                    if sell_price <= upper_price:
                        new_orders[sell_price] = {"side": "SELL", "qty": qty}

            elif order["side"] == "SELL" and high >= gp:
                qty = min(order["qty"], holdings.get("asset", 0))
                if qty > 1e-8:
                    proceeds = qty * gp
                    fee = proceeds * fee_rate
                    usd_balance += proceeds - fee
                    holdings["asset"] = holdings.get("asset", 0) - qty
                    buy_price = round(gp - step, 4)
                    pnl = qty * step - (qty * gp * fee_rate + qty * buy_price * fee_rate)
                    trades.append({
                        "time": t,
                        "side": "SELL",
                        "price": gp,
                        "quantity": qty,
                        "total_usd": proceeds,
                        "fee_usd": fee,
                        "pnl": pnl,
                    })
                    del new_orders[gp]
                    if buy_price >= lower_price:
                        new_orders[buy_price] = {"side": "BUY", "qty": qty}
        orders = new_orders

        asset_value = holdings.get("asset", 0) * close
        balance_history.append(usd_balance + asset_value)
        times.append(t)

    params = {
        "upper_price": upper_price,
        "lower_price": lower_price,
        "grid_count": grid_count,
        "amount_per_grid_usd": amount_per_grid_usd,
        "fee_rate": fee_rate,
    }
    return _make_result("GRID", symbol, interval, balance_history, times, trades, params, fee_rate)


# ── 5. Trailing Stop Backtest (Preserved & Enhanced) ───────────────────────────

def backtest_trailing_stop(
    candles: List[dict],
    symbol: str,
    interval: str,
    trail_pct: float,
    stop_loss_pct: float,
    position_size_usd: float,
    fee_rate: float = 0.001,
) -> BacktestResult:
    df = pd.DataFrame(candles)
    usd_balance = STARTING_BALANCE
    holding = 0.0
    entry_price = 0.0
    peak_price = 0.0
    in_position = False
    trades: List[dict] = []
    balance_history: List[float] = []
    times: List[int] = []

    for _, candle in df.iterrows():
        open_p = float(candle["open"])
        high = float(candle["high"])
        low = float(candle["low"])
        close = float(candle["close"])
        t = int(candle["time"])

        if not in_position:
            cost = position_size_usd
            if usd_balance >= cost:
                qty = (cost / open_p) * (1 - fee_rate)
                usd_balance -= cost
                holding = qty
                entry_price = open_p
                peak_price = open_p
                in_position = True
                trades.append({
                    "time": t,
                    "side": "BUY",
                    "price": open_p,
                    "quantity": qty,
                    "total_usd": cost,
                    "fee_usd": cost * fee_rate,
                })

        if in_position:
            if high > peak_price:
                peak_price = high

            trail_trigger = peak_price * (1 - trail_pct / 100)
            stop_loss_trigger = entry_price * (1 - stop_loss_pct / 100)

            exit_price = None
            exit_reason = None

            if low <= stop_loss_trigger:
                exit_price = stop_loss_trigger
                exit_reason = "STOP_LOSS"
            elif low <= trail_trigger:
                exit_price = trail_trigger
                exit_reason = "TRAIL"

            if exit_price:
                proceeds = holding * exit_price
                fee = proceeds * fee_rate
                usd_balance += proceeds - fee
                pnl = (exit_price - entry_price) * holding - fee
                trades.append({
                    "time": t,
                    "side": "SELL",
                    "price": exit_price,
                    "quantity": holding,
                    "total_usd": proceeds,
                    "fee_usd": fee,
                    "pnl": pnl,
                    "reason": exit_reason,
                })
                holding = 0.0
                in_position = False

        asset_value = holding * close
        balance_history.append(usd_balance + asset_value)
        times.append(t)

    params = {
        "trail_pct": trail_pct,
        "stop_loss_pct": stop_loss_pct,
        "position_size_usd": position_size_usd,
        "fee_rate": fee_rate,
    }
    return _make_result("TRAILING_STOP", symbol, interval, balance_history, times, trades, params, fee_rate)
