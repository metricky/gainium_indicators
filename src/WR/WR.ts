import { LightIndicator, LightIndicatorState } from '../util/indicator'
import { PercentileResult } from '../types/result'
import { PercentileCalculator } from '../util/percentile'
import { Float64CircularArray } from '../util/array'
import { hlcValue } from '../util'
import { HLC } from '../types/candles'

// Define state indices for better performance and readability
enum WilliamsRState {
  HIGHEST = 0, // Highest high in the period
  LOWEST = 1, // Lowest low in the period
  RESULT = 2, // Current Williams %R value
  DENOMINATOR = 3, // Denominator for Williams %R calculation
}

/**
 * Williams %R (Williams Percent Range)
 * Type: Momentum / Oscillator
 *
 * Williams %R, developed by Larry Williams, is a momentum oscillator that measures overbought
 * and oversold conditions in the market. Unlike most oscillators that range from 0 to 100,
 * Williams %R is inverted and moves between 0 and -100, making it a unique tool for identifying
 * potential reversal points.
 *
 * The indicator compares the current closing price to the high-low range over a specific
 * lookback period, essentially measuring where the close sits within the recent trading range.
 * This relationship provides insights into the relative strength or weakness of the current
 * price position.
 *
 * Williams %R is closely related to the Stochastic Oscillator but with an inverted scale,
 * making it particularly useful for traders who prefer negative values to indicate overbought
 * conditions. The indicator's sensitivity makes it excellent for short-term trading and
 * identifying quick reversal opportunities.
 *
 * Key Characteristics:
 * - Oscillates between 0 and -100 (inverted scale)
 * - Fast and sensitive to price changes
 * - Excellent for identifying short-term reversals
 * - Can remain in extreme zones during strong trends
 * - Works well in conjunction with trend analysis
 *
 * Trading Interpretation:
 * - -20 to 0: Overbought zone, potential selling opportunity
 * - -80 to -100: Oversold zone, potential buying opportunity
 * - Above -20: Strong upward momentum (caution on longs)
 * - Below -80: Strong downward momentum (caution on shorts)
 * - Crossing -20 downward: Potential sell signal
 * - Crossing -80 upward: Potential buy signal
 * - Failure to reach extreme levels: Weakening momentum
 *
 * Advanced Analysis Techniques:
 * - Divergences: Williams %R moving opposite to price signals potential reversals
 * - Failure Swings: Indicator failing to confirm new price extremes
 * - Multiple Timeframe Analysis: Confirm signals across different time periods
 * - Trend Context: Use with trend indicators to avoid counter-trend trades
 * - Support/Resistance: Look for bounces at key -20 and -80 levels
 *
 * Strategy Applications:
 * - Scalping: Quick entries and exits based on extreme readings
 * - Swing Trading: Identify potential reversal points for position entries
 * - Trend Filtering: Avoid trades against the main trend direction
 * - Exit Timing: Close positions when Williams %R reaches opposite extreme
 * - Divergence Trading: Trade price/indicator divergences for reversals
 *
 * Market Condition Adaptations:
 * - Trending Markets: Use extreme readings (-10/-90) to reduce false signals
 * - Range-bound Markets: Standard -20/-80 levels work well for reversals
 * - High Volatility: Consider longer periods (21-30) for smoother signals
 * - Low Volatility: Shorter periods (7-10) may provide more timely signals
 *
 * Period Selection Guidelines:
 * - 14: Standard period, good balance of sensitivity and reliability
 * - 7-10: More sensitive, faster signals, more noise
 * - 21-30: Less sensitive, smoother signals, fewer false signals
 * - 5: Very short-term, for scalping strategies
 * - 34: Longer-term momentum assessment
 *
 * Advantages:
 * - Fast response to price changes
 * - Clear overbought/oversold signals
 * - Works well in ranging markets
 * - Simple interpretation
 * - Good for short-term trading
 *
 * Limitations:
 * - Can give false signals in strong trends
 * - May stay in extreme zones for extended periods
 * - Requires confirmation from other indicators
 * - Less effective in low volatility environments
 *
 * Formula:
 * Williams %R = ((Highest High - Close) / (Highest High - Lowest Low)) × -100
 * Where:
 * - Highest High = Highest high over the lookback period
 * - Lowest Low = Lowest low over the lookback period
 * - Close = Current closing price
 *
 * Candle Input Type: HLC (High, Low, Close) - Requires full candle data for range calculation
 *
 * @see https://www.investopedia.com/terms/w/williamsr.asp
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:williams_r
 * @see https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/williams-percent-r
 */
export class WilliamsR extends LightIndicator<PercentileResult, HLC> {
  // Circular buffers for price data
  private readonly highValues: Float64CircularArray
  private readonly lowValues: Float64CircularArray

  // Percentile calculator
  private readonly percentileCalc?: PercentileCalculator

  /**
   * Creates a new Williams %R indicator
   *
   * @param period Lookback period for calculation (typically 14)
   * @param percentile Whether to calculate percentile ranking
   * @param percentileLookback Lookback period for percentile calculation
   * @param percentilePercentage Percentile threshold (default: 50)
   */
  constructor(
    public readonly period: number,
    private readonly percentile?: boolean,
    private readonly percentileLookback?: number,
    private readonly percentilePercentage?: number,
  ) {
    // Initialize state array with 4 state values
    super(1, hlcValue, 4, NaN)

    // Initialize circular buffers
    this.highValues = new Float64CircularArray(period, NaN)
    this.lowValues = new Float64CircularArray(period, NaN)

    // Initialize percentile calculator if needed
    if (this.percentile && this.percentileLookback) {
      this.percentileCalc = new PercentileCalculator(
        this.percentileLookback,
        this.percentilePercentage,
      )
    }
  }

  /**
   * Calculate Williams %R value
   */
  protected calculate(): PercentileResult | null {
    const s = this._state
    const h = this._history
    const l = h.last
    const hv = this.highValues
    const lv = this.lowValues

    // Update circular buffers with latest values
    hv.add(l.high)
    lv.add(l.low)

    if (
      isNaN(s[WilliamsRState.HIGHEST]) ||
      l.high > s[WilliamsRState.HIGHEST]
    ) {
      s[WilliamsRState.HIGHEST] = l.high
    }

    if (isNaN(s[WilliamsRState.LOWEST]) || l.low < s[WilliamsRState.LOWEST]) {
      s[WilliamsRState.LOWEST] = l.low
    }

    if (hv.oldValue === s[WilliamsRState.HIGHEST]) {
      s[WilliamsRState.HIGHEST] = -Infinity
      for (let i = 0; i < this.period; i++) {
        if (hv.array[i] > s[WilliamsRState.HIGHEST]) {
          s[WilliamsRState.HIGHEST] = hv.array[i]
        }
      }
    }

    if (lv.oldValue === s[WilliamsRState.LOWEST]) {
      s[WilliamsRState.LOWEST] = Infinity
      for (let i = 0; i < this.period; i++) {
        if (lv.array[i] < s[WilliamsRState.LOWEST]) {
          s[WilliamsRState.LOWEST] = lv.array[i]
        }
      }
    }

    // Wait until we have enough data
    if (!hv.isFilled || !lv.isFilled) {
      return null
    }

    // Calculate Williams %R: ((Highest - Close) / (Highest - Lowest)) * -100
    s[WilliamsRState.DENOMINATOR] =
      s[WilliamsRState.HIGHEST] - s[WilliamsRState.LOWEST]

    // Prevent division by zero
    if (s[WilliamsRState.DENOMINATOR] === 0) {
      s[WilliamsRState.RESULT] = 0
    } else {
      s[WilliamsRState.RESULT] =
        ((s[WilliamsRState.HIGHEST] - l.close) /
          s[WilliamsRState.DENOMINATOR]) *
        -100
    } // Handle percentile calculation if needed
    if (this.percentileCalc) {
      if (this.percentileCalc.insert(s[WilliamsRState.RESULT])) {
        return {
          value: s[WilliamsRState.RESULT],
          percentile: this.percentileCalc.getPercentile(),
        }
      }
    }

    return {
      value: s[WilliamsRState.RESULT],
    }
  }

  /**
   * Export the state of the indicator for persistence
   */
  override exportState(): LightIndicatorState {
    return {
      parent: super.exportState(),
      circ: [this.highValues.exportState(), this.lowValues.exportState()],
      percentile: this.percentileCalc?.exportState(),
      bin: [],
    }
  }

  /**
   * Restore indicator state from persistence
   */
  override restoreState(state: LightIndicatorState): void {
    if (!state.parent) {
      throw new Error('Invalid state: parent state is missing')
    }

    if (!state.circ) {
      throw new Error('Invalid state: circular buffer states are missing')
    }

    // Restore parent state
    super.restoreState(state.parent)

    // Restore circular buffer states
    this.highValues.restoreState(state.circ[0])
    this.lowValues.restoreState(state.circ[1])

    // Restore percentile calculator if available
    if (this.percentileCalc && state.percentile) {
      this.percentileCalc.restoreState(state.percentile)
    }
  }
}
