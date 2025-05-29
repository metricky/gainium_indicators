import { lastIndexOfEnum } from '../util'
import { LightIndicator } from '../util/indicator'

// Define state indices for clarity
enum RMAState {
  PREVIOUS_RMA = 0,
  CURRENT_RMA = 1,
  SUM_FOR_FIRST_RMA = 2,
}

/**
 * Running Moving Average (RMA) / Wilders' Moving Average
 * Type: Trend-Following/Smoothing Indicator
 *
 * The Running Moving Average (RMA), also known as Wilders' Moving Average or Modified Moving
 * Average, was developed by J. Welles Wilder Jr. as part of his technical analysis arsenal.
 * It's a specialized form of exponential smoothing that uses a fixed smoothing factor of 1/n,
 * where n is the period length.
 *
 * RMA differs from the standard Exponential Moving Average (EMA) in its smoothing approach.
 * While EMA uses a smoothing factor of 2/(n+1), RMA uses 1/n, making it less reactive to
 * recent price changes and providing smoother trend signals. This characteristic makes RMA
 * particularly useful for reducing noise in volatile markets while maintaining sensitivity
 * to genuine trend changes.
 *
 * Wilder specifically designed this moving average for use in his other indicators such as
 * RSI (Relative Strength Index), ATR (Average True Range), and ADX (Average Directional Index).
 * The consistent smoothing approach across these indicators ensures they work harmoniously
 * together in technical analysis systems.
 *
 * Key Characteristics:
 * - Smoother than EMA with less sensitivity to recent price action
 * - Uses simple moving average for initialization (first n periods)
 * - Consistent smoothing factor (1/n) across all periods
 * - Less prone to whipsaws in choppy markets
 * - Foundation for many Wilder-based indicators
 *
 * Trading Interpretation:
 * - Rising RMA: Underlying upward trend in progress
 * - Falling RMA: Underlying downward trend in progress
 * - Price above RMA: Bullish bias, potential long opportunities
 * - Price below RMA: Bearish bias, potential short opportunities
 * - RMA slope changes: Early indication of trend shifts
 * - Distance from RMA: Measure of trend strength and potential mean reversion
 *
 * Advantages over Standard EMA:
 * - Smoother signals with less noise
 * - Better suited for trend-following strategies
 * - Consistent with Wilder's indicator family
 * - Less prone to false signals in volatile conditions
 * - More reliable in longer timeframe analysis
 *
 * Strategy Applications:
 * - Trend Direction: Primary trend identification and confirmation
 * - Support/Resistance: Dynamic levels based on RMA values
 * - Entry Timing: Pullbacks to RMA in trending markets
 * - Exit Signals: Price crossing RMA against trend direction
 * - Filter Component: Trend filter for other trading systems
 *
 * Formula:
 * - First RMA = SMA(n) for initialization
 * - Subsequent RMA = ((n-1) × Previous RMA + Current Price) ÷ n
 * - Alternative form: RMA = Previous RMA × (1-1/n) + Current Price × (1/n)
 * - Smoothing Factor = 1/n (compared to EMA's 2/(n+1))
 *
 * Candle Input Type: Numeric (typically Close price, but accepts any numeric series)
 *
 * @see https://www.incrediblecharts.com/indicators/wilder_moving_average.php
 * @see https://www.investopedia.com/terms/m/movingaverage.asp
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:moving_averages
 */
export class RMA extends LightIndicator {
  private readonly alpha: number
  private readonly oneMinusAlpha: number
  /**
   * Creates a new Running Moving Average (RMA) indicator
   *
   * @param interval Number of periods for the RMA calculation (typically 14-50). This determines
   *                 the smoothing period and sensitivity of the moving average. Common values:
   *                 14 (Wilder's standard for RSI/ATR), 21 (short-term trend), 30 (medium-term),
   *                 50 (long-term trend). Longer periods provide smoother signals but reduce
   *                 responsiveness to trend changes.
   */
  constructor(private readonly interval: number) {
    /**
     * Initializes the parent LightIndicator with:
     * @param historyLength interval - Needs full period of historical data for initial SMA calculation
     * @param defaultValue 0 - Uses numeric zero as default for price-based calculations
     * @param stateSize lastIndexOfEnum(RMAState) - Storage for previous_rma, current_rma, sum_for_first_rma (3 elements)
     * @param fillValue NaN - Returns NaN during initialization until sufficient data for first RMA calculation
     */
    super(interval, 0, lastIndexOfEnum(RMAState), NaN) // Use interval history size and 3 state values
    // Pre-calculate the alpha factor (smoothing constant)
    this.alpha = 1 / interval
    this.oneMinusAlpha = 1 - this.alpha
  }

  /**
   * Calculate RMA based on current history
   */
  protected calculate(): number | null {
    const s = this._state
    const h = this._history
    // Initialization phase - collect data for initial SMA calculation
    if (!h.isFilled) {
      if (isNaN(s[RMAState.SUM_FOR_FIRST_RMA])) {
        s[RMAState.SUM_FOR_FIRST_RMA] = 0
      }
      // Accumulate values for first RMA
      s[RMAState.SUM_FOR_FIRST_RMA] += h.last

      return null
    }

    if (isNaN(s[RMAState.CURRENT_RMA])) {
      s[RMAState.CURRENT_RMA] = s[RMAState.SUM_FOR_FIRST_RMA] / this.interval
      return s[RMAState.CURRENT_RMA]
    }

    // Regular RMA calculation
    // Save previous value
    s[RMAState.PREVIOUS_RMA] = s[RMAState.CURRENT_RMA]

    // Calculate RMA: RMA = ((n-1) * Previous RMA + Current Price) / n
    // or equivalently: RMA = Previous RMA * (1 - 1/n) + Current Price * (1/n)
    s[RMAState.CURRENT_RMA] =
      s[RMAState.PREVIOUS_RMA] * this.oneMinusAlpha + h.last * this.alpha

    return s[RMAState.CURRENT_RMA]
  }
}
