import { BollingerBands } from '../BBANDS/BollingerBands'
import { PercentileCalculator } from '../util/percentile'
import { LightIndicator, LightIndicatorState } from '../util/indicator'
import { OHLCV } from '../types/candles'
import { PercentileResult } from '../types/result'
import { lastIndexOfEnum, ohlcvValue } from '../util'

// Define state indices for clarity
enum BBWState {
  BBW_VALUE = 0,
}

/**
 * Bollinger Bands Width (BBW) Indicator
 * Type: Volatility Indicator
 *
 * The Bollinger Bands Width (BBW) indicator, developed by John A. Bollinger, measures the
 * width of the Bollinger Bands relative to the middle band (moving average). It quantifies
 * the bands' expansion and contraction, providing a clear measure of market volatility.
 *
 * BBW is particularly useful for identifying:
 * - High volatility periods when bands are wide (high BBW values)
 * - Low volatility periods when bands are narrow (low BBW values)
 * - Potential breakout opportunities during periods of low volatility
 * - Market squeeze conditions that often precede significant price movements
 *
 * Low BBW values indicate consolidation phases and potential upcoming volatility increases.
 * High BBW values suggest high volatility that may be followed by consolidation periods.
 * BBW is often used in conjunction with other indicators to time entries and exits.
 *
 * Formula: BBW = (Upper Band - Lower Band) / Middle Band
 *
 * Candle Input Type: OHLCV (Open, High, Low, Close, Volume)
 *
 * @see https://www.investopedia.com/terms/b/bollingerbands.asp
 * @see https://www.tradingview.com/support/solutions/43000501972-bollinger-bands-width-bbw/
 */
export class BollingerBandsWidth extends LightIndicator<
  PercentileResult,
  OHLCV
> {
  private readonly bollingerBands: BollingerBands
  private readonly percentileCalc?: PercentileCalculator

  /**
   * Creates a new BollingerBandsWidth indicator instance
   *
   * @param bollingerBands - Pre-configured BollingerBands indicator instance
   * @param percentile - Whether to enable percentile calculation (optional)
   * @param percentileLookback - Lookback period for percentile calculation (optional)
   * @param percentilePercentage - Percentile percentage to calculate (optional)
   */
  constructor(
    bollingerBands: BollingerBands,
    percentile?: boolean,
    percentileLookback?: number,
    percentilePercentage?: number,
  ) {
    /**
     * Initialize the LightIndicator parent class
     * @param historyLength - 1 (only need current candle for BBW calculation)
     * @param defaultValue - ohlcvValue (default object with zero values, e.g., {open: 0, high: 0, low: 0, close: 0, volume: 0})
     * @param stateSize - lastIndexOfEnum(BBWState) (size of Float64Array to store BBW value)
     */
    super(1, ohlcvValue, lastIndexOfEnum(BBWState)) // 1 history entry, 1 state value

    this.bollingerBands = bollingerBands

    // Initialize percentile calculator if enabled
    if (percentile && percentileLookback) {
      this.percentileCalc = new PercentileCalculator(
        percentileLookback,
        percentilePercentage,
      )
    }
  }

  /**
   * Calculate BBW based on current history
   */
  protected calculate(): PercentileResult | null {
    const s = this._state
    const bb = this.bollingerBands
    // Get Bollinger Bands values from child indicator
    if (bb.next(this._history.last) === null) {
      return null
    }

    // Calculate BBW value
    s[BBWState.BBW_VALUE] =
      bb.result!.middle === 0
        ? 0
        : (bb.result!.upper - bb.result!.lower) / bb.result!.middle

    if (this.percentileCalc) {
      // Update percentile calculator
      // Only return a percentile if we have enough data
      if (this.percentileCalc.insert(s[BBWState.BBW_VALUE])) {
        return {
          value: s[BBWState.BBW_VALUE],
          percentile: this.percentileCalc.getPercentile(),
        }
      }
    }

    // Return the result
    return {
      value: s[BBWState.BBW_VALUE],
    }
  }

  /**
   * Export the indicator state
   */
  override exportState(): LightIndicatorState {
    return {
      bin: [],
      circ: [],
      child: [this.bollingerBands.exportState()],
      percentile: this.percentileCalc?.exportState(),
    }
  }

  /**
   * Restore the indicator state
   */
  override restoreState(state: LightIndicatorState): void {
    if (!state.parent) {
      throw new Error('Invalid state: parent state is missing')
    }
    if (!state.child?.length) {
      throw new Error('Invalid state: child state is missing')
    }
    if (this.percentileCalc && state.percentile) {
      this.percentileCalc.restoreState(state.percentile)
    }
    this.bollingerBands.restoreState(state.child[0])
    super.restoreState(state.parent)
  }
}
