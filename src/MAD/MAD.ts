import { average, lastIndexOfEnum } from '../util'
import { LightIndicator } from '../util/indicator'

// Define state indices for clarity and performance
enum MADState {
  SUM_MEAN = 0, // Running sum for mean calculation
  MEAN = 1, // Current mean value
  OLD_MEAN = 2, // Previous mean value
  SUM_DEV = 3, // Running sum of absolute deviations
}

/**
 * Mean Absolute Deviation (MAD)
 * Type: Volatility/Statistical Indicator
 *
 * Mean Absolute Deviation (MAD) is a robust measure of variability that calculates the
 * average of the absolute deviations from the arithmetic mean. Unlike standard deviation,
 * MAD is less sensitive to extreme outliers, making it a more stable measure of dispersion
 * in volatile markets or when dealing with data that contains occasional extreme values.
 *
 * MAD provides a linear measure of spread around the mean, where each data point contributes
 * proportionally to its distance from the mean. This characteristic makes it particularly
 * useful for risk assessment and volatility measurement in financial markets, where
 * understanding the typical deviation from average price levels is crucial.
 *
 * The indicator is especially valuable for:
 * - Risk management: Measuring price volatility with reduced outlier sensitivity
 * - Portfolio analysis: Assessing consistent vs. erratic price behavior
 * - Trend analysis: Identifying periods of low vs. high price dispersion
 * - Statistical analysis: Providing robust volatility measures for quantitative strategies
 *
 * Trading Interpretation:
 * - High MAD values: Increased volatility, prices deviating significantly from mean
 * - Low MAD values: Lower volatility, prices clustering around the mean
 * - Rising MAD: Increasing market uncertainty and price dispersion
 * - Falling MAD: Decreasing volatility, price stabilization around mean
 * - Relative MAD levels: Compare current readings to historical averages for context
 *
 * Advantages over Standard Deviation:
 * - Less sensitive to extreme outliers
 * - Easier to interpret (same units as original data)
 * - More robust in non-normal distributions
 * - Computationally simpler and more intuitive
 *
 * Formula: MAD = Σ|Xi - X̄| / n
 * Where Xi = individual values, X̄ = arithmetic mean, n = number of observations
 *
 * Candle Input Type: Numeric (typically Close price, but accepts any numeric series)
 *
 * @see https://en.wikipedia.org/wiki/Average_absolute_deviation
 * @see https://www.investopedia.com/terms/m/meanabsolutedeviation.asp
 */
export class MAD extends LightIndicator {
  /**
   * Creates a new Mean Absolute Deviation (MAD) indicator
   *
   * @param interval Number of periods to include in the MAD calculation (typically 10-50).
   *                 Larger intervals provide more stable readings but reduce sensitivity
   *                 to recent changes. Common values: 14, 20, 30 for different timeframes.
   *                 Short-term: 10-15, Medium-term: 20-30, Long-term: 40-50.
   */
  constructor(public readonly interval: number) {
    /**
     * Initializes the parent LightIndicator with:
     * @param historyLength 1 - Only needs current value, uses circular buffer for efficiency
     * @param defaultValue 0 - Uses numeric zero as default for deviation calculations
     * @param stateSize lastIndexOfEnum(MADState) - Storage for sum_mean, mean, old_mean, sum_dev (4 elements)
     * @param fillValue undefined - Uses default fill behavior, returns null until history filled
     */
    super(1, 0, lastIndexOfEnum(MADState))
  }

  protected calculate(): number | null {
    if (!this._history.isFilled) {
      return null
    }

    // Use state reference for better performance
    const s = this._state
    const h = this._history

    // Calculate mean first using running sum
    s[MADState.SUM_MEAN] = s[MADState.SUM_MEAN] - h.oldValue + h.last

    // Store old mean for comparison
    s[MADState.OLD_MEAN] = s[MADState.MEAN]

    // Calculate new mean
    s[MADState.MEAN] = s[MADState.SUM_MEAN] / this.interval

    // If mean changed significantly, recalculate all deviations
    if (s[MADState.OLD_MEAN] !== s[MADState.MEAN]) {
      s[MADState.SUM_DEV] = 0
      for (let i = 0; i < this.interval; i++) {
        s[MADState.SUM_DEV] += Math.abs(h.array[i] - s[MADState.MEAN])
      }
    } else {
      s[MADState.SUM_DEV] =
        s[MADState.SUM_DEV] -
        Math.abs(h.oldValue - s[MADState.MEAN]) +
        Math.abs(h.last - s[MADState.MEAN])
    }

    // Return the mean absolute deviation
    return s[MADState.SUM_DEV] / this.interval
  }

  static mean: number = 0
  static sumDev: number = 0

  static getResultFromBatch(
    prices: number[] | Float64Array,
    _average?: number,
  ): number {
    const mean = _average || average(prices)
    let sumDev = 0
    for (let i = 0; i < prices.length; i++) {
      const deviation = Math.abs(prices[i] - mean)
      sumDev += deviation
    }
    if (prices.length > 0) {
      return sumDev / prices.length
    }
    return 0
  }
}
