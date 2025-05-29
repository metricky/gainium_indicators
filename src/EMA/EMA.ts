import { lastIndexOfEnum } from '../util'
import { LightIndicator } from '../util/indicator'

// Define state indices for clarity
enum EMAState {
  CURRENT_EMA = 0,
  PREVIOUS_EMA = 1,
  SUM_FOR_INITIAL_EMA = 2,
}

/**
 * Exponential Moving Average (EMA)
 * Type: Trend-Following/Smoothing Indicator
 *
 * The Exponential Moving Average (EMA) is a type of moving average that gives greater
 * weight and significance to the most recent data points. Unlike the Simple Moving Average
 * (SMA) which treats all data points equally, the EMA applies more weight to recent prices,
 * making it more responsive to new information and price changes.
 *
 * The EMA responds more quickly to recent price changes than the SMA, which makes it
 * particularly useful for trend-following strategies and identifying trend reversals
 * earlier. However, this increased sensitivity also means the EMA is more prone to
 * false signals in choppy or sideways markets.
 *
 * The indicator uses a smoothing factor (alpha) that determines how much weight is given
 * to the most recent price. A higher smoothing factor makes the EMA more responsive,
 * while a lower factor makes it smoother but less reactive to recent changes.
 *
 * Trading Interpretation:
 * - Trend Direction: Price above EMA suggests uptrend, below suggests downtrend
 * - Support/Resistance: EMA often acts as dynamic support in uptrends and resistance in downtrends
 * - Entry/Exit Signals: Crossovers between price and EMA can signal trend changes
 * - Multiple EMAs: Different periods can be used together (e.g., 12/26 for MACD)
 * - Slope Analysis: Rising EMA indicates bullish momentum, falling indicates bearish
 * - Distance Analysis: Large distance from EMA may indicate overbought/oversold conditions
 *
 * The EMA is widely used as a building block for other technical indicators (like MACD,
 * PPO) and is fundamental to many trading strategies due to its responsiveness and
 * trend-following characteristics.
 *
 * Formula: EMA = (Price × Smoothing Factor) + (Previous EMA × (1 - Smoothing Factor))
 * Where Smoothing Factor = 2 / (Period + 1)
 * Initial EMA = SMA of first N periods
 *
 * Candle Input Type: Single Price Value (typically Close price)
 *
 * @see https://www.investopedia.com/terms/e/ema.asp
 * @see https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/ema
 */
export class EMA extends LightIndicator {
  private readonly weightFactor: number
  /**
   * Creates a new EMA indicator instance
   *
   * @param interval - Period over which to calculate EMA (typically 9, 12, 21, 26, or 50 periods depending on trading strategy)
   */
  constructor(private readonly interval: number) {
    /**
     * Initialize the LightIndicator parent class
     * @param historyLength - interval (need full period for initial SMA calculation)
     * @param defaultValue - 0 (default numeric value for price input)
     * @param stateSize - lastIndexOfEnum(EMAState) (3) (size of Float64Array to store: current EMA, previous EMA, sum for initial calculation)
     * @param fillValue - NaN (fill value for incomplete periods)
     */
    super(interval, 0, lastIndexOfEnum(EMAState), NaN) // interval history entries, 3 state values

    // Pre-calculate weight factor and store in state
    this.weightFactor = 2 / (interval + 1)
  }

  /**
   * Calculate EMA based on current history buffer
   */
  protected calculate(): number | null {
    const s = this._state
    const h = this._history
    // Initialization phase: collect data for initial SMA calculation
    if (!h.isFilled) {
      if (isNaN(s[EMAState.SUM_FOR_INITIAL_EMA])) {
        s[EMAState.SUM_FOR_INITIAL_EMA] = 0
      }
      // Accumulate sum for initial EMA (which is actually SMA)
      s[EMAState.SUM_FOR_INITIAL_EMA] += h.last
      return null
    }
    if (isNaN(s[EMAState.CURRENT_EMA])) {
      // When we have enough data, calculate the initial EMA (which is SMA)
      s[EMAState.CURRENT_EMA] = s[EMAState.SUM_FOR_INITIAL_EMA] / this.interval
      return s[EMAState.CURRENT_EMA]
    }
    // Regular EMA calculation after initialization

    // Save previous value
    s[EMAState.PREVIOUS_EMA] = s[EMAState.CURRENT_EMA]

    // Calculate new EMA: EMA = Price * k + EMA(previous) * (1 - k)
    // where k is the weight factor 2/(interval + 1)
    s[EMAState.CURRENT_EMA] =
      (h.last - s[EMAState.PREVIOUS_EMA]) * this.weightFactor +
      s[EMAState.PREVIOUS_EMA]
    return s[EMAState.CURRENT_EMA]
  }
}
