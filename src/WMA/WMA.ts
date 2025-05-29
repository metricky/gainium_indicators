import { LightIndicator, LightIndicatorState } from '../util/indicator'
import { Float64CircularArray, lastIndexOfEnum } from '../util'

// Define state indices for performance and readability
enum WMAState {
  SUM = 0, // Rolling weighted sum
  HIST_INDEX = 1, // History index for calculations
  WEIGHT = 2, // Current weight in calculation
  ROLLING_SUM = 3, // Rolling sum for efficient calculation
}

/**
 * Weighted Moving Average (WMA)
 * Type: Trend-Following/Smoothing Indicator
 *
 * The Weighted Moving Average (WMA) is a technical indicator that assigns greater
 * weight to more recent data points and less weight to older data points. This
 * weighting scheme makes the WMA more responsive to recent price changes compared
 * to a Simple Moving Average (SMA), while still providing smoothing to reduce noise.
 *
 * In a WMA, the most recent price receives the highest weight (equal to the period),
 * the second most recent receives a weight of (period-1), and so on, with the oldest
 * price receiving a weight of 1. This linear weighting progression creates a moving
 * average that responds more quickly to recent price movements while still considering
 * historical data.
 *
 * The WMA strikes a balance between responsiveness and smoothness, making it more
 * sensitive than SMA but less sensitive than EMA. It's particularly useful when
 * you want to give more importance to recent price action without the exponential
 * weighting characteristics of an EMA.
 *
 * Trading Interpretation:
 * - Trend Direction: Rising WMA indicates uptrend, falling WMA indicates downtrend
 * - Support/Resistance: WMA often acts as dynamic support in uptrends and resistance in downtrends
 * - Entry/Exit Signals: Price crossovers with WMA can signal potential trend changes
 * - Trend Strength: Steeper WMA slope indicates stronger momentum
 * - Multiple Timeframes: Can be used across different periods for short and long-term analysis
 * - Building Block: Used as a component in other indicators like Hull Moving Average (HMA)
 * - Responsiveness: More responsive than SMA, provides earlier signals with reasonable smoothing
 *
 * The WMA is commonly used in trend-following strategies and serves as a foundation
 * for more sophisticated indicators. Its balanced approach to weighting makes it
 * suitable for various market conditions and trading styles.
 *
 * Formula: WMA = (P₁×n + P₂×(n-1) + P₃×(n-2) + ... + Pₙ×1) / (n + (n-1) + (n-2) + ... + 1)
 * Where P is the price, n is the period, and the denominator equals n×(n+1)/2
 *
 * Candle Input Type: Single Price Value (typically Close price)
 *
 * @see https://www.investopedia.com/articles/technical/060401.asp
 * @see https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/wma
 */
export class WMA extends LightIndicator {
  // Pre-calculated denominator (sum of weights)
  private readonly _denominator: number
  private readonly prices: Float64CircularArray

  /**
   * Creates a new Weighted Moving Average indicator instance
   *
   * @param interval - Period for WMA calculation (typically 9, 14, 21, or 50 periods; shorter periods are more responsive, longer periods are smoother)
   */
  constructor(public readonly interval: number) {
    /**
     * Initialize the LightIndicator parent class
     * @param historyLength - interval (need full period for weighted calculation)
     * @param defaultValue - 0 (default numeric value for price input)
     * @param stateSize - lastIndexOfEnum(WMAState) (4) (size of Float64Array to store: sum, history index, weight, rolling sum)
     * @param fillValue - NaN (fill value for incomplete periods)
     */
    // Pass state size of 4 to LightIndicator constructor to store all our state values
    super(interval, 0, lastIndexOfEnum(WMAState), NaN)
    // Pre-calculate the denominator which is the sum of weights
    // For WMA, this is n*(n+1)/2 where n is the interval
    this._denominator = (interval * (interval + 1)) >> 1
    this.prices = new Float64CircularArray(interval, 0)
  }

  /**
   * Calculate WMA based on current history buffer
   */
  protected calculate(): number | null {
    // Use state reference for better performance
    const s = this._state

    // Get new value from history
    const l = this._history.last

    const p = this.prices

    // Add value to prices buffer
    p.add(l)

    // If this is our first complete calculation after filling the buffer
    if (p.isFilled) {
      if (isNaN(s[WMAState.SUM])) {
        s[WMAState.SUM] = 0

        for (
          s[WMAState.HIST_INDEX] = 0;
          s[WMAState.HIST_INDEX] < this.interval;
          s[WMAState.HIST_INDEX]++
        ) {
          // Weight is highest for most recent values
          s[WMAState.WEIGHT] = this.interval - s[WMAState.HIST_INDEX]
          // Add weighted value to sum
          s[WMAState.SUM] +=
            // Calculate the actual array index considering the circular buffer
            this.prices.array[
              (this.prices.prevIndex - s[WMAState.HIST_INDEX] + this.interval) %
                this.interval
            ] * s[WMAState.WEIGHT]
        }
      } else {
        // Use efficient rolling sum calculation
        // The formula is based on the fact that when we add a new value and remove an old one:
        // 1. The new value gets the highest weight (interval)
        // 2. The oldest value (weight 1) is removed
        // 3. All other values' weights shift by 1

        // This means we can simply:
        // 1. Remove all existing values multiplied by 1 (subtract the sum of all values)
        // 2. Add the new value * interval
        // 3. We don't need to add the oldest value back since it's being removed

        // Remove one weight of each value (this is the weight shift effect)
        s[WMAState.SUM] -= s[WMAState.ROLLING_SUM]

        // Add new value with highest weight
        s[WMAState.SUM] += l * this.interval
      }
    }

    s[WMAState.ROLLING_SUM] =
      (s[WMAState.ROLLING_SUM] || 0) - (p.oldValue || 0) + l

    // Check if we have enough data
    if (!p.isFilled) {
      return null
    }

    // Calculate the weighted average and store in result
    return s[WMAState.SUM] / this._denominator
  }

  exportState(): LightIndicatorState {
    return {
      bin: [],
      circ: [this.prices.exportState()],
      child: [],
      parent: super.exportState(),
    }
  }

  restoreState(state: LightIndicatorState): void {
    if (!state.parent) {
      throw new Error('Invalid state: parent state is missing')
    }
    if (!state.circ?.length) {
      throw new Error('Invalid state: circ state is missing')
    }
    this.prices.restoreState(state.circ[0])
    super.restoreState(state.parent)
  }
}
