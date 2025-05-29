import { SMA } from '../SMA/SMA'
import { LightIndicator, LightIndicatorState } from '../util/indicator'
import { HL } from '../types/candles'
import { PercentileCalculator } from '../util/percentile'
import { PercentileResult } from '../types/result'
import { hlValue, lastIndexOfEnum } from '../util'

// Define state indices for clarity
enum AOState {
  MEDIAN_PRICE = 0,
  AO_VALUE = 1,
}

/**
 * Awesome Oscillator (AO) Indicator
 * Type: Momentum Oscillator
 *
 * The Awesome Oscillator (AO) was developed by Bill Williams to measure market momentum
 * by comparing short-term and long-term moving averages of the median price. It helps
 * identify the overall market direction and potential reversal points.
 *
 * The AO oscillates around zero line. When AO crosses above zero, short-term momentum
 * is rising faster than long-term momentum, signaling bullish conditions. When AO
 * crosses below zero, short-term momentum is falling faster than long-term momentum,
 * signaling bearish conditions.
 *
 * Typical signals include: zero line crossovers, saucer formations, and twin peaks patterns.
 *
 * Formula: AO = SMA(Median Price, 5) - SMA(Median Price, 34)
 * Where Median Price = (High + Low) / 2
 *
 * Candle Input Type: HL (High, Low)
 *
 * @see https://www.investopedia.com/terms/a/awesome-oscillator.asp
 * @see https://www.tradingview.com/support/solutions/43000501826-awesome-oscillator-ao/
 * @see https://tradingstrategyguides.com/bill-williams-awesome-oscillator-strategy/
 */
export class AO extends LightIndicator<PercentileResult, HL> {
  // Moving averages for short and long periods
  public readonly short: SMA
  public readonly long: SMA

  // Percentile calculation
  private _percentileCalculator?: PercentileCalculator

  /**
   * Creates a new AO indicator instance
   *
   * @param shortInterval - Period for the short-term SMA (typically 5)
   * @param longInterval - Period for the long-term SMA (typically 34)
   * @param percentile - Whether to calculate percentile ranking (optional)
   * @param percentileLookback - Number of periods for percentile calculation (optional)
   * @param percentilePercentage - Percentile threshold percentage (optional)
   */
  constructor(
    shortInterval: number,
    longInterval: number,
    percentile?: boolean,
    percentileLookback?: number,
    percentilePercentage?: number,
  ) {
    /**
     * Initialize the LightIndicator parent class
     * @param historyLength - 1 (only need current candle for median price calculation)
     * @param defaultValue - hlValue (default object with zero values, e.g., {high: 0, low: 0})
     * @param stateSize - lastIndexOfEnum(AOState) (size of Float64Array to store AO calculation states)
     */
    super(1, hlValue, lastIndexOfEnum(AOState)) // We only need to track one candle, 2 state values

    // Initialize MA indicators
    this.short = new SMA(shortInterval)
    this.long = new SMA(longInterval)

    // Initialize percentile calculator if requested
    if (percentile && percentileLookback && percentilePercentage) {
      this._percentileCalculator = new PercentileCalculator(
        percentileLookback,
        percentilePercentage,
      )
    }
  }

  /**
   * Calculate the indicator value from the history buffer
   */
  protected calculate(): PercentileResult | null {
    const s = this._state
    const last = this._history.last
    const short = this.short
    const long = this.long
    // Calculate median price
    s[AOState.MEDIAN_PRICE] = (last.high + last.low) / 2

    // Only calculate if long MA is stable
    short.next(s[AOState.MEDIAN_PRICE])
    long.next(s[AOState.MEDIAN_PRICE])
    if (short.result !== null && long.result !== null) {
      // Calculate AO value
      s[AOState.AO_VALUE] = short.result! - long.result!

      // Calculate percentile if applicable
      if (this._percentileCalculator) {
        if (this._percentileCalculator.insert(s[AOState.AO_VALUE])) {
          return {
            value: s[AOState.AO_VALUE],
            percentile: this._percentileCalculator.getPercentile(),
          }
        }
      }
      return {
        value: s[AOState.AO_VALUE],
      }
    }
    return null
  }

  override exportState(): LightIndicatorState {
    return {
      bin: [],
      circ: [],
      child: [this.short.exportState(), this.long.exportState()],
      parent: super.exportState(),
    }
  }

  override restoreState(state: LightIndicatorState): void {
    if (!state.parent) {
      throw new Error('Invalid state: parent state is missing')
    }
    if (!state.child?.length) {
      throw new Error('Invalid state: child state is missing')
    }
    this.short.restoreState(state.child[0])
    this.long.restoreState(state.child[1])
    super.restoreState(state.parent)
  }
}
