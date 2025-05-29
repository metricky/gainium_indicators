import { LightIndicator, LightIndicatorState } from '../util/indicator'
import { ATR } from '../ATR/ATR'
import { SuperTrendResult } from '../types/result'
import { HLC } from '../types/candles'
import { hlcValue, lastIndexOfEnum } from '../util'

// Define state indices for performance and readability
enum SuperTrendState {
  DIRECTION = 0, // Current trend direction (1 = up, -1 = down)
  UPPER_BAND = 1, // Current upper band value
  LOWER_BAND = 2, // Current lower band value
  SUPERTREND = 3, // Current SuperTrend value
  PREV_UPPER = 4, // Previous upper band value
  PREV_LOWER = 5, // Previous lower band value
  PREV_ST = 6, // Previous SuperTrend value
  SRC = 7, // Source price ((high + low) / 2)
  FRC = 8, // Factor for ATR multiplier
  PREV_ATR = 9, // Previous ATR value
}

/**
 * SuperTrend Indicator
 * Type: Trend-Following / Volatility-Adaptive
 *
 * SuperTrend is a powerful trend-following indicator that combines price action with
 * volatility analysis to provide clear trend direction signals. Developed as an
 * improvement over traditional moving averages, SuperTrend adapts to market volatility
 * using the Average True Range (ATR) to create dynamic support and resistance levels
 * that adjust based on market conditions.
 *
 * The indicator creates upper and lower bands around the price using a multiple of ATR,
 * then follows these bands to determine trend direction. When price breaks above the
 * SuperTrend line, it signals an uptrend (bullish), and when price breaks below, it
 * signals a downtrend (bearish). The line changes color and position based on trend
 * direction, providing clear visual confirmation.
 *
 * SuperTrend's key advantage is its ability to reduce false signals common in moving
 * averages by incorporating volatility. During high volatility periods, the bands
 * widen to avoid premature trend changes, while in low volatility periods, the bands
 * tighten to provide more sensitive signals.
 *
 * Key Characteristics:
 * - Volatility-adaptive using ATR for dynamic band calculation
 * - Clear trend direction with color-coded signals
 * - Reduced lag compared to traditional moving averages
 * - Automatic adjustment to market volatility conditions
 * - Strong trend-following capabilities with fewer whipsaws
 *
 * Trading Interpretation:
 * - Price above SuperTrend line: Uptrend (bullish) - consider long positions
 * - Price below SuperTrend line: Downtrend (bearish) - consider short positions
 * - SuperTrend line color change: Trend reversal signal
 * - Line acting as dynamic support in uptrends
 * - Line acting as dynamic resistance in downtrends
 * - Direction value: 1 = downtrend, -1 = uptrend
 *
 * Signal Generation:
 * - Buy Signal: Price closes above SuperTrend line (line turns green)
 * - Sell Signal: Price closes below SuperTrend line (line turns red)
 * - Trend Continuation: Price respecting SuperTrend line as support/resistance
 * - Exit Signal: Opposite trend signal or price breaking through line
 *
 * Strategy Applications:
 * - Trend Following: Enter trades in direction of SuperTrend signal
 * - Swing Trading: Use trend changes for position entries and exits
 * - Stop Loss Placement: Use SuperTrend line as trailing stop loss
 * - Multiple Timeframe Analysis: Confirm trends across different timeframes
 * - Breakout Trading: Confirm breakouts with SuperTrend direction
 * - Risk Management: Avoid trades against SuperTrend direction
 *
 * Market Condition Adaptations:
 * - Trending Markets: Excellent performance with clear directional moves
 * - Volatile Markets: ATR adaptation helps avoid false signals
 * - Range-bound Markets: May generate more false signals, use with caution
 * - News Events: ATR expansion helps handle volatility spikes
 * - Different Timeframes: Adjust parameters based on trading timeframe
 *
 * Parameter Guidelines:
 * - Factor (ATR Multiplier): 2.0-3.0 (standard), 1.5-2.0 (sensitive), 3.0-4.0 (conservative)
 * - ATR Period: 10-14 (standard), 7-10 (more responsive), 14-21 (smoother)
 * - Shorter periods: More signals but higher noise
 * - Longer periods: Fewer signals but higher reliability
 *
 * Advantages:
 * - Adapts to market volatility automatically
 * - Clear, unambiguous signals
 * - Excellent for trend identification
 * - Reduces whipsaws compared to moving averages
 * - Works well across different timeframes
 * - Combines price and volatility analysis
 *
 * Limitations:
 * - Can lag during rapid trend changes
 * - Less effective in sideways markets
 * - May generate false signals during consolidation
 * - Requires trend confirmation from other indicators
 * - Performance depends on proper parameter selection
 *
 * Formula:
 * - Upper Band = (High + Low) / 2 + (Factor × ATR)
 * - Lower Band = (High + Low) / 2 - (Factor × ATR)
 * - SuperTrend = Upper Band (in downtrend) or Lower Band (in uptrend)
 * - Trend changes when price crosses the SuperTrend line
 *
 * Candle Input Type: HLC (High, Low, Close prices required for ATR and trend calculation)
 *
 * @see https://www.investopedia.com/articles/active-trading/121114/supertrend-indicator.asp
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:supertrend
 */
export class SuperTrend extends LightIndicator<SuperTrendResult, HLC> {
  // Component indicator
  private readonly atr: ATR
  /**
   * Creates a new SuperTrend indicator
   *
   * @param factor Multiplier for ATR to set band distance from the median price.
   *              This controls the sensitivity of the indicator:
   *              - 1.0-2.0: Very sensitive, more signals, higher noise
   *              - 2.0-3.0: Standard sensitivity, balanced performance
   *              - 3.0-4.0: Conservative, fewer signals, higher reliability
   *              - 5.0+: Very conservative, trend-following only
   *              Common values: 2.0, 2.5, 3.0
   * @param atrPeriod Period for ATR calculation to measure market volatility.
   *                 This determines how volatility is measured:
   *                 - 7-10: More responsive to recent volatility changes
   *                 - 10-14: Standard setting, good balance
   *                 - 14-21: Smoother volatility measurement
   *                 - 21+: Very smooth, less sensitive to volatility spikes
   *                 Common values: 10, 14
   */
  constructor(
    public readonly factor: number,
    public readonly atrPeriod: number,
  ) {
    /**
     * Initialize SuperTrend indicator with LightIndicator base class
     *
     * @param historyLength 1 - Only needs current HLC candle for calculation.
     *                      ATR component manages its own historical data
     * @param defaultValue hlcValue - Function to extract HLC data from candle input
     * @param stateSize lastIndexOfEnum(SuperTrendState) - State array size from SuperTrendState enum.
     *                  Stores: direction, upper/lower bands, SuperTrend values, previous values, source price, factor, previous ATR
     * @param fillValue NaN - Returns NaN when ATR is not yet ready for calculation
     */
    super(1, hlcValue, lastIndexOfEnum(SuperTrendState), NaN)

    // Initialize component ATR indicator
    this.atr = new ATR(atrPeriod)
  }

  /**
   * Calculate SuperTrend value
   */
  protected calculate(): SuperTrendResult | null {
    const s = this._state
    const l = this._history.last
    const p = this._history.prev
    const atr = this.atr

    // First calculate ATR
    if (!atr.next(l)) {
      return null
    }

    // Calculate source value
    s[SuperTrendState.SRC] = (l.high + l.low) / 2
    s[SuperTrendState.FRC] = this.factor * atr.result!

    s[SuperTrendState.UPPER_BAND] =
      s[SuperTrendState.SRC] + s[SuperTrendState.FRC]

    s[SuperTrendState.LOWER_BAND] =
      s[SuperTrendState.SRC] - s[SuperTrendState.FRC]

    if (isNaN(s[SuperTrendState.PREV_LOWER])) {
      s[SuperTrendState.PREV_LOWER] = 0
    }
    if (isNaN(s[SuperTrendState.PREV_UPPER])) {
      s[SuperTrendState.PREV_UPPER] = 0
    }
    // Apply SuperTrend formula for lower band
    s[SuperTrendState.LOWER_BAND] =
      s[SuperTrendState.LOWER_BAND] > s[SuperTrendState.PREV_LOWER] ||
      p.close < s[SuperTrendState.PREV_LOWER]
        ? s[SuperTrendState.LOWER_BAND]
        : s[SuperTrendState.PREV_LOWER]

    // Apply SuperTrend formula for upper band
    s[SuperTrendState.UPPER_BAND] =
      s[SuperTrendState.UPPER_BAND] < s[SuperTrendState.PREV_UPPER] ||
      p.close > s[SuperTrendState.PREV_UPPER]
        ? s[SuperTrendState.UPPER_BAND]
        : s[SuperTrendState.PREV_UPPER]

    // Determine trend direction
    s[SuperTrendState.DIRECTION] = NaN

    // First value special case
    if (isNaN(s[SuperTrendState.PREV_ATR])) {
      s[SuperTrendState.DIRECTION] = 1 // Default to downtrend on first value
    }
    // Check previous trend and current price position
    else if (s[SuperTrendState.PREV_ST] === s[SuperTrendState.PREV_UPPER]) {
      // Was in downtrend (using upper band as SuperTrend line)
      // Switch to uptrend if price closes above the previous SuperTrend line
      s[SuperTrendState.DIRECTION] =
        l.close > s[SuperTrendState.PREV_ST] ? -1 : 1
    } else {
      // Was in uptrend (using lower band as SuperTrend line)
      // Switch to downtrend if price closes below the previous SuperTrend line
      s[SuperTrendState.DIRECTION] =
        l.close < s[SuperTrendState.PREV_ST] ? 1 : -1
    }

    // Calculate SuperTrend value based on direction
    s[SuperTrendState.SUPERTREND] =
      s[SuperTrendState.DIRECTION] === -1
        ? s[SuperTrendState.LOWER_BAND]
        : s[SuperTrendState.UPPER_BAND]

    // Store values as previous for next calculation
    s[SuperTrendState.PREV_UPPER] = s[SuperTrendState.UPPER_BAND]
    s[SuperTrendState.PREV_LOWER] = s[SuperTrendState.LOWER_BAND]
    s[SuperTrendState.PREV_ST] = s[SuperTrendState.SUPERTREND]
    s[SuperTrendState.PREV_ATR] = atr.result!

    return {
      value: s[SuperTrendState.SUPERTREND],
      direction: s[SuperTrendState.DIRECTION],
      all: {
        up: s[SuperTrendState.UPPER_BAND],
        down: s[SuperTrendState.LOWER_BAND],
      },
    }
  }

  /**
   * Exports the state of the indicator for restoration later
   */
  override exportState(): LightIndicatorState {
    return {
      parent: super.exportState(),
      child: [this.atr.exportState()],
      bin: [],
      circ: [],
    }
  }

  /**
   * Restores the state of the indicator
   * @param state Previously exported state
   */
  override restoreState(state: LightIndicatorState): void {
    if (!state.parent) {
      throw new Error('Invalid state: parent state is missing')
    }

    if (!state.child) {
      throw new Error('Invalid state: child state is missing')
    }

    // Restore ATR state
    this.atr.restoreState(state.child[0])

    // Restore parent state
    super.restoreState(state.parent)
  }
}
