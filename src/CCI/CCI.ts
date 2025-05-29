import { SMA } from '../SMA/SMA'
import { LightIndicator, LightIndicatorState } from '../util/indicator'
import { HLC } from '../types/candles'
import { PercentileCalculator } from '../util/percentile'
import { PercentileResult } from '../types/result'
import { hlcValue, lastIndexOfEnum } from '../util'
import { Float64CircularArray } from '../util/array'
import { hlc3 } from '../util/price'
import { MAD } from '../MAD/MAD'

// Define source types for price calculation
type SourceType = 'hlc3' | 'close'

// Define state indices for clarity
enum CCIState {
  TYPICAL_PRICE = 0,
  MEAN_DEVIATION = 1,
  NUMERATOR = 2,
  DENOMINATOR = 3,
  CCI_VALUE = 4,
}

/**
 * Commodity Channel Index (CCI)
 * Type: Momentum/Oscillator Indicator
 *
 * The Commodity Channel Index (CCI) is a versatile momentum oscillator that measures
 * the current price level relative to its statistical norm over a specific period.
 * Originally developed by Donald Lambert in 1980 for commodity trading, CCI has since
 * become widely used across all financial markets including stocks, forex, and cryptocurrencies.
 *
 * The indicator identifies cyclical turns in price by comparing the typical price
 * (average of high, low, and close) to its moving average and dividing by the mean
 * absolute deviation multiplied by a constant factor (0.015). This normalization
 * process results in an oscillator that typically fluctuates between +100 and -100.
 *
 * Trading Interpretation:
 * - Values above +100: Indicate overbought conditions and potential sell signals
 * - Values below -100: Indicate oversold conditions and potential buy signals
 * - Values between -100 and +100: Represent normal price action within the range
 * - Divergences: When price makes new highs/lows but CCI doesn't, it may signal reversal
 * - Zero line crossovers: Can indicate trend direction changes
 *
 * The CCI is particularly effective at identifying cyclic price patterns and can be
 * used for both trend-following and contrarian trading strategies. When used with
 * percentile ranking, it provides additional context about the relative strength
 * of current readings compared to historical values.
 *
 * Formula: CCI = (Typical Price - SMA(Typical Price, period)) / (0.015 × Mean Absolute Deviation)
 * Where Typical Price = (High + Low + Close) / 3 (or Close if using close source)
 *
 * Candle Input Type: HLC (High, Low, Close) or Close only depending on source parameter
 *
 * Performance optimizations:
 * - Uses circular buffer pattern for price history
 * - Pre-allocates all objects and variables with Float64Array
 * - Zero allocation during updates for minimal GC pressure
 * - State stored in Float64Array for cache locality
 *
 * @see https://www.investopedia.com/articles/active-trading/031914/how-traders-can-utilize-cci-commodity-channel-index-trade-stock-trends.asp
 * @see https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/cci
 */
export class CCI extends LightIndicator<PercentileResult, HLC> {
  private static readonly CONSTANT_FACTOR = 0.015
  // Pre-allocated buffer using circular pattern
  private readonly typicalPrices: Float64CircularArray

  // Pre-allocated for calculations
  private readonly sma: SMA
  private readonly percentileCalc?: PercentileCalculator

  /**
   * Creates a new CCI indicator instance
   *
   * @param interval - Period over which to calculate CCI (typically 14-20 periods)
   * @param sourceType - Price source to use: 'hlc3' for typical price (H+L+C)/3 or 'close' for close price only
   * @param percentile - Optional flag to enable percentile ranking of CCI values
   * @param percentileLookback - Lookback period for percentile calculation (required if percentile is true)
   * @param percentilePercentage - Percentile percentage to calculate (e.g., 80 for 80th percentile)
   */
  constructor(
    interval: number,
    private readonly sourceType: SourceType = 'hlc3',
    percentile?: boolean,
    percentileLookback?: number,
    percentilePercentage?: number,
  ) {
    /**
     * Initialize the LightIndicator parent class
     * @param historyLength - 1 (only need current candle for typical price calculation)
     * @param defaultValue - hlcValue (default object with zero values, e.g., {high: 0, low: 0, close: 0})
     * @param stateSize - lastIndexOfEnum(CCIState) (size of Float64Array to store: typical price, mean deviation, numerator, denominator, CCI value)
     */
    super(1, hlcValue, lastIndexOfEnum(CCIState)) // 1 history entry, 5 state values

    // Initialize components
    this.sma = new SMA(interval)
    this.typicalPrices = new Float64CircularArray(interval, 0)

    // Initialize percentile calculator if enabled
    if (percentile && percentileLookback) {
      this.percentileCalc = new PercentileCalculator(
        percentileLookback,
        percentilePercentage,
      )
    }
  }

  /**
   * Calculate CCI based on current history
   */
  protected calculate(): PercentileResult | null {
    const s = this._state
    const sma = this.sma
    // Calculate typical price based on source type
    s[CCIState.TYPICAL_PRICE] = this.calculateTypicalPrice(this._history.last)

    // Update circular buffer with new typical price
    this.typicalPrices.add(s[CCIState.TYPICAL_PRICE])

    // Get SMA result for typical price
    if (sma.next(s[CCIState.TYPICAL_PRICE]) === null) {
      return null
    }

    // Calculate CCI components
    s[CCIState.MEAN_DEVIATION] = MAD.getResultFromBatch(
      this.typicalPrices.array,
      sma.result!,
    )
    s[CCIState.NUMERATOR] = s[CCIState.TYPICAL_PRICE] - sma.result!
    s[CCIState.DENOMINATOR] = CCI.CONSTANT_FACTOR * s[CCIState.MEAN_DEVIATION]

    // Calculate CCI value, avoiding division by zero
    s[CCIState.CCI_VALUE] =
      s[CCIState.DENOMINATOR] === 0
        ? 0
        : s[CCIState.NUMERATOR] / s[CCIState.DENOMINATOR]

    if (this.percentileCalc) {
      // Update percentile calculator
      // Only return a percentile if we have enough data
      if (this.percentileCalc.insert(s[CCIState.CCI_VALUE])) {
        return {
          value: s[CCIState.CCI_VALUE],
          percentile: this.percentileCalc.getPercentile(),
        }
      }
    }

    // Return the result
    return {
      value: s[CCIState.CCI_VALUE],
    }
  }

  /**
   * Calculate typical price based on price source
   *
   * @param candle HLC price data
   * @returns Calculated typical price
   */
  private calculateTypicalPrice({ high, low, close }: HLC): number {
    return this.sourceType === 'hlc3' ? hlc3(high, low, close) : close
  }

  /**
   * Export the indicator state
   */
  exportState(): LightIndicatorState {
    return {
      bin: [],
      circ: [this.typicalPrices.exportState()],
      child: [this.sma.exportState()],
      parent: super.exportState(),
    }
  }

  /**
   * Restore the indicator state
   */
  restoreState(state: LightIndicatorState): void {
    if (!state.parent) {
      throw new Error('Invalid state: parent state is missing')
    }
    if (!state.child?.length) {
      throw new Error('Invalid state: child state is missing')
    }
    if (!state.circ?.length) {
      throw new Error('Invalid state: circ state is missing')
    }
    if (this.percentileCalc && state.percentile) {
      this.percentileCalc.restoreState(state.percentile)
    }
    this.sma.restoreState(state.child[0])
    this.typicalPrices.restoreState(state.circ[0])
  }
}
