import { LightIndicator, lastIndexOfEnum } from '../util'

// State indices for the Sum indicator
enum SumState {
  CURRENT_SUM = 0, // Current sum value
}

/**
 * Sum (Rolling Sum)
 * Type: Helper / Utility
 *
 * The Sum indicator calculates the rolling sum of input values over a specified period.
 * This is a fundamental building block used by many other technical indicators for their
 * calculations. Unlike a simple cumulative sum, this maintains a fixed window size by
 * adding new values and subtracting old values that fall outside the period.
 *
 * As a utility indicator, Sum is primarily used internally by other indicators such as:
 * - Simple Moving Average (SMA = Sum / Period)
 * - Volume indicators that need volume accumulation
 * - Momentum indicators requiring price change accumulation
 * - Any indicator needing efficient rolling window summation
 *
 * The implementation uses a rolling sum approach for O(1) computational efficiency,
 * making it suitable for high-frequency trading applications and real-time analysis.
 *
 * Key Characteristics:
 * - Fixed window size (rolling window)
 * - O(1) update complexity for efficiency
 * - Maintains numerical precision for financial calculations
 * - Foundation component for many technical indicators
 *
 * Trading Interpretation:
 * While Sum is primarily a utility indicator, it can be used directly for:
 * - Volume accumulation analysis over specific periods
 * - Price change accumulation for custom momentum calculations
 * - Custom indicator development requiring rolling summation
 * - Performance analysis of cumulative metrics
 *
 * Formula:
 * Rolling Sum = Previous Sum - Oldest Value + Newest Value
 * Where the window size is fixed at the specified period
 *
 * Candle Input Type: Numeric (any numeric value - price, volume, indicator output, etc.)
 *
 * @see https://en.wikipedia.org/wiki/Moving_average#Simple_moving_average
 */

export class Sum extends LightIndicator {
  /**
   * Creates a new Sum indicator
   *
   * @param period Number of periods to include in the rolling sum calculation.
   *              This determines the window size for the summation.
   *              Common usage patterns:
   *              - Short periods (5-10): For short-term accumulation analysis
   *              - Medium periods (20-50): For intermediate-term summation
   *              - Long periods (100+): For long-term accumulation trends
   *              - Custom periods: Based on specific indicator requirements
   */
  constructor(period: number) {
    /**
     * Initialize Sum indicator with LightIndicator base class
     *
     * @param historyLength period - Needs full period of data to calculate rolling sum
     * @param defaultValue 0 - Default numeric value for sum initialization
     * @param stateSize lastIndexOfEnum(SumState) - Single state value to store current sum
     * @param fillValue undefined - Uses default LightIndicator behavior (returns null until filled)
     */
    super(period, 0, lastIndexOfEnum(SumState)) // We only need to track current candle, 1 state values
  }

  calculate(): number | null {
    const s = this._state
    const h = this._history

    s[SumState.CURRENT_SUM] = s[SumState.CURRENT_SUM] - h.oldValue + h.last

    if (!h.isFilled) {
      return null
    }

    return s[SumState.CURRENT_SUM]
  }
}
