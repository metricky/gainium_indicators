import { EMA } from '../EMA/EMA'
import { SMA } from '../SMA/SMA'
import { LightIndicator, LightIndicatorState } from '../util/indicator'
import { MACDResult } from '../types/result'
import { PercentileCalculator } from '../util/percentile'
import { lastIndexOfEnum } from '../util'

enum MACDState {
  MACD = 0, // MACD value
  HIST = 1, // Histogram value
}
/**
 * Moving Average Convergence Divergence (MACD)
 * Type: Momentum/Trend-Following Indicator
 *
 * MACD is one of the most popular and widely used momentum indicators in technical analysis,
 * developed by Gerald Appel in the late 1970s. It combines trend-following and momentum
 * characteristics by showing the relationship between two moving averages of a security's price.
 *
 * The indicator consists of three components:
 * 1. MACD Line: Difference between fast EMA and slow EMA (typically 12-26)
 * 2. Signal Line: EMA of the MACD line (typically 9 periods)
 * 3. Histogram: Difference between MACD line and signal line
 *
 * MACD is particularly effective because it provides both trend direction and momentum
 * strength in a single indicator. The histogram component adds an extra dimension by
 * showing the momentum of the momentum, making it excellent for early signal detection.
 *
 * Trading Interpretation:
 * - MACD Line above zero: Bullish momentum (fast MA > slow MA)
 * - MACD Line below zero: Bearish momentum (fast MA < slow MA)
 * - MACD crossing above Signal: Bullish crossover signal
 * - MACD crossing below Signal: Bearish crossover signal
 * - Histogram growing: Momentum strengthening in current direction
 * - Histogram shrinking: Momentum weakening, potential reversal ahead
 * - Histogram crossing zero: Early warning of MACD/Signal crossover
 *
 * Advanced Techniques:
 * - Divergences: Price makes new highs/lows while MACD doesn't confirm
 * - Centerline Crossovers: MACD crossing above/below zero line
 * - Signal Line Crossovers: Primary buy/sell signals
 * - Histogram Analysis: Momentum acceleration/deceleration patterns
 *
 * Formula:
 * - MACD Line = EMA(fast_period) - EMA(slow_period)
 * - Signal Line = EMA(MACD, signal_period)
 * - Histogram = MACD Line - Signal Line
 * - Standard parameters: 12, 26, 9
 *
 * Candle Input Type: Numeric (typically Close price, but can use any price series)
 *
 * @see https://www.investopedia.com/terms/m/macd.asp
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:moving_average_convergence_divergence_macd
 * @see https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/macd
 */
export class MACD extends LightIndicator<MACDResult> {
  // Optimized percentile calculator instead of raw history array
  private percentileCalc?: PercentileCalculator

  /**
   * Creates a new MACD (Moving Average Convergence Divergence) indicator
   *
   * @param short Fast moving average (typically EMA with 12 periods). This should be
   *              a shorter period than the long MA to capture recent price movements.
   *              Common values: 8, 12, 19.
   * @param long Slow moving average (typically EMA with 26 periods). This should be
   *             a longer period than the short MA to capture longer-term trends.
   *             Common values: 21, 26, 39.
   * @param signal Signal line moving average (typically EMA with 9 periods). Applied to
   *               the MACD line to smooth it and generate crossover signals.
   *               Common values: 7, 9, 14.
   * @param percentile Whether to calculate percentile ranking of histogram values.
   *                   Useful for identifying extreme readings relative to historical data.
   * @param percentileLookback Number of periods for percentile calculation (typically 50-200).
   *                           Larger values provide more stable percentile rankings.
   * @param percentilePercentage Percentile level to use for ranking (default: 50 for median).
   *                            Common values: 25, 50, 75, 90 for different thresholds.
   */
  constructor(
    public readonly short: EMA | SMA,
    public readonly long: EMA | SMA,
    public readonly signal: EMA | SMA,
    percentile?: boolean,
    percentileLookback?: number,
    percentilePercentage?: number,
  ) {
    /**
     * Initializes the parent LightIndicator with:
     * @param historyLength 1 - Only needs current value since MAs handle historical processing
     * @param defaultValue 0 - Uses numeric zero as default for MACD calculations
     * @param stateSize lastIndexOfEnum(MACDState) - Storage for MACD and Histogram values (2 elements)
     * @param fillValue undefined - Uses default fill behavior during MA initialization
     */
    super(1, 0, lastIndexOfEnum(MACDState)) // Only need to track current value

    // Initialize percentile history if needed
    if (percentile && percentileLookback) {
      this.percentileCalc = new PercentileCalculator(
        percentileLookback,
        percentilePercentage,
      )
    }
  }

  protected calculate(): MACDResult | null {
    const s = this._state
    const h = this._history
    const short = this.short
    const long = this.long
    const signal = this.signal
    // Get both moving averages
    short.next(h.last)
    long.next(h.last)

    // Need both moving averages to calculate MACD
    if (short.result === null || long.result === null) {
      return null
    }

    s[MACDState.MACD] = short.result - long.result

    // Get signal line value
    if (signal.next(s[MACDState.MACD]) === null) {
      return null
    }

    // Calculate histogram
    s[MACDState.HIST] = s[MACDState.MACD] - signal.result!

    // Update percentile rank if applicable
    if (this.percentileCalc) {
      // using our circular buffer index to replace oldest value
      if (this.percentileCalc.insert(s[MACDState.HIST])) {
        // Get the percentile rank
        return {
          histogram: s[MACDState.HIST],
          macd: s[MACDState.MACD],
          signal: signal.result!,
          rank: this.percentileCalc.getPercentile(),
        }
      }
    }

    return {
      histogram: s[MACDState.HIST],
      macd: s[MACDState.MACD],
      signal: signal.result!,
    }
  }

  exportState(): LightIndicatorState {
    return {
      bin: [],
      circ: [],
      child: [
        this.short.exportState(),
        this.long.exportState(),
        this.signal.exportState(),
      ],
      parent: super.exportState(),
      percentile: this.percentileCalc?.exportState(),
    }
  }

  restoreState(state: LightIndicatorState): void {
    if (!state.parent) {
      throw new Error('Invalid state: parent state is missing')
    }
    if (!state.child) {
      throw new Error('Invalid state: child states are missing')
    }

    this.short.restoreState(state.child[0])
    this.long.restoreState(state.child[1])
    this.signal.restoreState(state.child[2])

    super.restoreState(state.parent)

    // Restore percentile calculator state if applicable
    if (this.percentileCalc && state.percentile) {
      this.percentileCalc.restoreState(state.percentile)
    }
  }
}
