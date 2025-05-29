import { LightIndicator } from '../util/indicator'
import { hlValue, lastIndexOfEnum } from '../util'
import { ExtremumResult } from '../types/result'
import { HL } from '../types/candles'

/**
 * Define state indices for Extremum for better performance and readability
 */
enum ExtremumState {
  HIGHEST = 0,
  LOWEST = 1,
  I = 2,
}

/**
 * Extremum - High/Low Range Detector
 * Type: Volatility/Support-Resistance Indicator
 *
 * The Extremum indicator efficiently identifies the highest and lowest values within
 * a specified lookback period. This high-performance indicator uses rolling calculations
 * and optimized algorithms to track price extremes with minimal computational overhead.
 *
 * The indicator maintains running highest and lowest values and only recalculates when
 * an extreme value exits the rolling window. This makes it particularly suitable for
 * real-time applications and as a building block for other technical indicators like
 * Donchian Channels, Stochastic Oscillator, and Williams %R.
 *
 * Trading Interpretation:
 * - Support/Resistance Levels: Extremum values often act as significant support and resistance
 * - Breakout Signals: Price breaking above highest or below lowest may signal strong moves
 * - Range Trading: The high-low range helps identify consolidation periods
 * - Volatility Assessment: Range width (highest - lowest) indicates market volatility
 * - Channel Trading: Can be used to create dynamic trading channels
 * - Stop Loss Placement: Extremes provide logical levels for stop-loss orders
 *
 * The indicator is widely used as a foundation for:
 * - Donchian Channels (uses extremum values as channel boundaries)
 * - Stochastic Oscillator (%K calculation)
 * - Williams %R (similar to Stochastic but inverted)
 * - Various volatility and range-based indicators
 *
 * Performance Features:
 * - Rolling calculations with minimal recalculation
 * - Circular buffer implementation for efficiency
 * - Optimized for high-frequency updates
 * - Replaces deprecated FasterPeriod class with better performance
 *
 * Formula:
 * - Highest = Maximum of High values over N periods
 * - Lowest = Minimum of Low values over N periods
 *
 * Candle Input Type: HL (High, Low) - requires high and low values for range calculation
 *
 * @see https://www.investopedia.com/terms/s/support.asp
 * @see https://www.investopedia.com/terms/r/resistance.asp
 */
export class Extremum extends LightIndicator<ExtremumResult, HL> {
  /**
   * Creates a new Extremum indicator instance
   *
   * @param period - The number of periods to look back for highest/lowest values (typically 14-20 for short-term, 50-100 for longer-term analysis)
   */
  constructor(public readonly period: number) {
    /**
     * Initialize the LightIndicator parent class
     * @param historyLength - period (need full lookback period to find highest high and lowest low)
     * @param defaultValue - hlValue (default object with zero values, e.g., {high: 0, low: 0})
     * @param stateSize - astIndexOfEnum(ExtremumState) (size of Float64Array to store: highest value, lowest value, loop iterator)
     * @param fillValue - NaN (fill value for incomplete periods)
     */
    // Pass state size of 3 to LightIndicator constructor to store our state values
    super(period, hlValue, lastIndexOfEnum(ExtremumState), NaN)
  }

  /**
   * Calculate highest and lowest values in the current window
   */
  protected calculate(): ExtremumResult | null {
    const s = this._state
    const h = this._history

    if (
      isNaN(s[ExtremumState.HIGHEST]) ||
      h.last.high > s[ExtremumState.HIGHEST]
    ) {
      s[ExtremumState.HIGHEST] = h.last.high
    }

    if (
      isNaN(s[ExtremumState.LOWEST]) ||
      h.last.low < s[ExtremumState.LOWEST]
    ) {
      s[ExtremumState.LOWEST] = h.last.low
    }

    if (
      !isNaN(s[ExtremumState.HIGHEST]) &&
      h.oldValue.high === s[ExtremumState.HIGHEST]
    ) {
      s[ExtremumState.HIGHEST] = -Infinity
      for (
        s[ExtremumState.I] = 0;
        s[ExtremumState.I] < h.size;
        s[ExtremumState.I]++
      ) {
        if (h.array[s[ExtremumState.I]].high > s[ExtremumState.HIGHEST]) {
          s[ExtremumState.HIGHEST] = h.array[s[ExtremumState.I]].high
        }
      }
    }

    if (
      !isNaN(s[ExtremumState.LOWEST]) &&
      h.oldValue.low === s[ExtremumState.LOWEST]
    ) {
      s[ExtremumState.LOWEST] = Infinity
      for (
        s[ExtremumState.I] = 0;
        s[ExtremumState.I] < h.size;
        s[ExtremumState.I]++
      ) {
        if (
          h.array[s[ExtremumState.I]].low &&
          h.array[s[ExtremumState.I]].low < s[ExtremumState.LOWEST]
        ) {
          s[ExtremumState.LOWEST] = h.array[s[ExtremumState.I]].low
        }
      }
    }

    if (!h.isFilled) {
      return null
    }

    return {
      highest: s[ExtremumState.HIGHEST],
      lowest: s[ExtremumState.LOWEST],
    }
  }
}
