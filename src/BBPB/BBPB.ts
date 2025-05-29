import { BollingerBands } from '../BBANDS/BollingerBands'
import { OHLCV } from '../types/candles'
import { PercentileResult } from '../types/result'
import { LightIndicator, LightIndicatorState, lastIndexOfEnum } from '../util'
import { PercentileCalculator } from '../util/percentile'
import { ohlcvValue } from '../util/candles'

// Define state indices for clarity
enum BBPBState {
  BBPB_VALUE = 0, // Store the %B value for state persistence
  DIFF = 1, // Store the difference between upper and lower bands
}

/**
 * Bollinger Bands %B (BBPB) Indicator
 * Type: Oscillator/Volatility Indicator
 *
 * Bollinger Bands %B (%B) is a technical analysis indicator that quantifies where the current
 * price is positioned relative to the Bollinger Bands. It normalizes the price position within
 * the bands to a scale where 0 represents the lower band and 1 represents the upper band.
 *
 * The %B indicator is particularly useful for identifying overbought and oversold conditions:
 * - Values above 1.0 indicate price is above the upper band (potential overbought)
 * - Values around 0.8-1.0 suggest approaching the upper band (potential resistance)
 * - Values around 0.5 indicate price is near the middle band (neutral)
 * - Values around 0.0-0.2 suggest approaching the lower band (potential support)
 * - Values below 0.0 indicate price is below the lower band (potential oversold)
 *
 * %B is commonly used with other indicators to confirm signals and can help identify
 * divergences between price action and band position.
 *
 * Formula: %B = (Close - Lower Band) / (Upper Band - Lower Band)
 *
 * Candle Input Type: OHLCV (Open, High, Low, Close, Volume)
 *
 * @see https://www.investopedia.com/terms/b/bollingerbands.asp
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:bollinger_band_perce
 */
export class BBPB extends LightIndicator<PercentileResult, OHLCV> {
  private readonly bollingerBands: BollingerBands
  private readonly percentileCalc?: PercentileCalculator

  /**
   * Creates a new BBPB indicator instance
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
     * @param historyLength - 1 (only need current candle for %B calculation)
     * @param defaultValue - ohlcvValue (default object with zero values, e.g., {open: 0, high: 0, low: 0, close: 0, volume: 0})
     * @param stateSize - lastIndexOfEnum(BBPBState) (size of Float64Array to store %B value and band difference)
     */
    super(1, ohlcvValue, lastIndexOfEnum(BBPBState)) // 1 history entry, 2 state values for the BBPB calculation

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
   * Calculate the BBPB value based on current history
   */
  protected calculate(): PercentileResult | null {
    const s = this._state
    const bb = this.bollingerBands
    const l = this._history.last
    // Update Bollinger Bands with latest price
    if (bb.next(l) === null) {
      return null
    }

    // Calculate band difference for %B calculation
    s[BBPBState.DIFF] = bb.result!.upper - bb.result!.lower

    // Calculate %B value (avoid division by zero)
    // Store value in state for export/restore capability
    s[BBPBState.BBPB_VALUE] =
      s[BBPBState.DIFF] === 0
        ? 0.5
        : (l.close - bb.result!.lower) / s[BBPBState.DIFF]

    // If percentile calculation is enabled
    if (this.percentileCalc) {
      // Use the simplified insert() that returns whether the array is full
      // Only include percentile if we have enough data
      if (this.percentileCalc.insert(s[BBPBState.BBPB_VALUE])) {
        return {
          value: s[BBPBState.BBPB_VALUE],
          percentile: this.percentileCalc.getPercentile(),
        }
      }
    }

    // Return the result without percentile
    return { value: s[BBPBState.BBPB_VALUE] }
  }

  /**
   * Export the indicator state
   */
  override exportState(): LightIndicatorState {
    return {
      bin: [],
      circ: [],
      child: [this.bollingerBands.exportState()],
      parent: super.exportState(),
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
