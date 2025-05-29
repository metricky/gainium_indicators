import { BollingerBands } from '../BBANDS/BollingerBands'
import {
  CircularArray,
  LightIndicator,
  LightIndicatorState,
  lastIndexOfEnum,
} from '../util'
import { OHLCV } from '../types/candles'
import { ohlcvValue } from '../util/candles'

// Define state indices for clarity
enum BBWPState {
  CURRENT_BBW = 0,
  COUNT_BELOW = 1,
}

/**
 * Bollinger Bands Width Percentile (BBWP) Indicator
 * Type: Volatility Oscillator
 *
 * The Bollinger Bands Width Percentile (BBWP) indicator measures where the current
 * Bollinger Bands Width (BBW) value ranks as a percentile within a specified lookback
 * period. It normalizes volatility measurements to a 0-100 scale, making it easier to
 * identify extreme volatility conditions across different time periods and instruments.
 *
 * BBWP is particularly useful for:
 * - Identifying volatility extremes: values near 0 indicate extremely low volatility
 * - Spotting high volatility periods: values near 100 indicate extremely high volatility
 * - Market squeeze detection: sustained low BBWP values often precede volatility expansions
 * - Volatility mean reversion: extreme BBWP readings tend to revert to average levels
 * - Cross-market volatility comparison: normalized scale allows comparison across assets
 *
 * Low BBWP values (0-20) suggest potential breakout opportunities as volatility is compressed.
 * High BBWP values (80-100) indicate elevated volatility that may lead to consolidation.
 *
 * Formula: BBWP = (Count of BBW values ≤ current BBW / Total lookback values) × 100
 * Where BBW = (Upper Band - Lower Band) / Middle Band
 *
 * Candle Input Type: OHLCV (Open, High, Low, Close, Volume)
 *
 * @see https://www.tradingview.com/support/solutions/43000501972-bollinger-bands-width-bbw/
 * @see https://squeezemetrics.com/monitor/download/pdf/white_paper_data_is_beautiful.pdf
 */
export class BBWP extends LightIndicator<number, OHLCV> {
  private readonly bollingerBands: BollingerBands
  private readonly bbwValues: CircularArray<number>

  /**
   * Creates a new BBWP indicator instance
   *
   * @param bollingerBands - Pre-configured BollingerBands indicator instance
   * @param lookback - Lookback period for percentile calculation (typically 252 for daily data)
   */
  constructor(
    bollingerBands: BollingerBands,
    private readonly lookback: number,
  ) {
    /**
     * Initialize the LightIndicator parent class
     * @param historyLength - 1 (only need current candle for BBWP calculation)
     * @param defaultValue - ohlcvValue (default object with zero values, e.g., {open: 0, high: 0, low: 0, close: 0, volume: 0})
     * @param stateSize - lastIndexOfEnum(BBWPState) (size of Float64Array to store current BBW and count below values)
     */
    // Use 1 history entry, 2 state values
    super(1, ohlcvValue, lastIndexOfEnum(BBWPState))

    this.bollingerBands = bollingerBands
    // Pre-allocate array for BBW values
    this.bbwValues = new CircularArray(lookback, 0)
  }

  /**
   * Calculate BBWP based on current history
   */
  protected calculate(): number | null {
    const s = this._state
    const bb = this.bollingerBands
    const bbw = this.bbwValues
    // Get Bollinger Bands result from child indicator
    if (bb.next(this._history.last) === null) {
      return null
    }

    // Calculate BBW value
    s[BBWPState.CURRENT_BBW] =
      bb.result!.middle === 0
        ? 0
        : (bb.result!.upper - bb.result!.lower) / bb.result!.middle

    // Update our circular buffer of BBW values
    // Only calculate BBWP if we have enough data
    if (!bbw.add(s[BBWPState.CURRENT_BBW])) {
      return null
    }

    // Count how many values are less than or equal to current BBW
    s[BBWPState.COUNT_BELOW] = 0
    for (let i = 0; i < this.lookback; i++) {
      if (bbw.array[i] <= s[BBWPState.CURRENT_BBW]) {
        s[BBWPState.COUNT_BELOW]++
      }
    }

    // Calculate BBWP as a percentage
    return (s[BBWPState.COUNT_BELOW] / this.lookback) * 100
  }

  /**
   * Export the indicator state
   */
  override exportState(): LightIndicatorState {
    return {
      bin: [],
      circ: [this.bbwValues.exportState()],
      child: [this.bollingerBands.exportState()],
      parent: super.exportState(),
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
    if (!state.circ?.length) {
      throw new Error('Invalid state: circ state is missing')
    }

    // Restore the Bollinger Bands and BBW values
    this.bollingerBands.restoreState(state.child[0])
    this.bbwValues.restoreState(state.circ[0])
    super.restoreState(state.parent)
  }
}
