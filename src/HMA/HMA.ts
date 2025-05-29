import { WMA } from '../WMA/WMA'
import { LightIndicator, LightIndicatorState } from '../util/indicator'

/**
 * Hull Moving Average (HMA)
 * Type: Trend-Following/Smoothing Indicator
 *
 * The Hull Moving Average (HMA) was developed by Alan Hull in 2005 to address the
 * inherent trade-off between lag and smoothness in traditional moving averages.
 * The HMA achieves remarkable responsiveness to price changes while maintaining
 * smoothness by combining multiple Weighted Moving Averages (WMAs) with different
 * periods in an innovative mathematical approach.
 *
 * The HMA calculation involves three steps: first, it calculates two WMAs with
 * different periods (full period and half period), then computes a raw Hull value
 * by doubling the faster WMA and subtracting the slower WMA, and finally smooths
 * this result with another WMA using the square root of the period.
 *
 * This sophisticated approach significantly reduces lag compared to simple moving
 * averages while providing excellent smoothness, making it particularly valuable
 * for trend identification and signal generation in various market conditions.
 *
 * Trading Interpretation:
 * - Trend Direction: Rising HMA indicates uptrend, falling HMA indicates downtrend
 * - Color Changes: Many traders use HMA color changes (slope direction) as entry/exit signals
 * - Support/Resistance: HMA often acts as dynamic support in uptrends and resistance in downtrends
 * - Crossover Signals: Price crossing above/below HMA can signal trend changes
 * - Multiple Timeframes: HMA works well across different timeframes for trend analysis
 * - Low Lag: Provides earlier signals than traditional MAs while filtering noise
 * - Trend Strength: Steeper HMA slope indicates stronger trend momentum
 *
 * The HMA is particularly popular among swing traders and trend followers who need
 * responsive yet smooth trend indicators. It's also commonly used in automated
 * trading systems where quick trend identification with minimal false signals is crucial.
 *
 * Formula: HMA = WMA[√n](2 × WMA[n/2](price) - WMA[n](price))
 * Where n is the period, WMA is Weighted Moving Average, and √n is the square root of n
 *
 * Candle Input Type: Single Price Value (typically Close price)
 *
 * @see https://alanhull.com/hull-moving-average
 * @see https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/hull-moving-average
 */
export class HMA extends LightIndicator {
  // Component WMAs
  private readonly _rootWMA: WMA
  private readonly _fullLengthWMA: WMA
  private readonly _halfLengthWMA: WMA

  /**
   * Creates a new Hull Moving Average indicator instance
   *
   * @param interval - Period for HMA calculation (typically 9, 14, 21, or 34 periods; lower values are more responsive, higher values are smoother)
   */
  constructor(public readonly interval: number) {
    /**
     * Initialize the LightIndicator parent class
     * @param historyLength - 1 (only need current price value as WMA components handle their own history)
     * @param defaultValue - 0 (default numeric value for price input)
     * @param stateSize - 0 (no additional state storage needed as calculations are handled by child WMAs)
     */
    super(1, 0, 0)

    // Initialize component WMAs
    this._rootWMA = new WMA(Math.floor(Math.sqrt(interval)))
    this._fullLengthWMA = new WMA(interval)
    this._halfLengthWMA = new WMA(Math.floor(interval / 2))
  }

  /**
   * Calculate HMA based on current history
   */
  protected calculate(): number | null {
    const l = this._history.last
    const fma = this._fullLengthWMA
    const hma = this._halfLengthWMA

    // Update the full-length WMA
    if (fma.next(l) === null) {
      return null
    }

    // Update the half-length WMA
    if (hma.next(l) === null) {
      return null
    }

    // Return the final HMA result
    return this._rootWMA.next(2 * hma.result! - fma.result!)
  }

  /**
   * Export the state of this indicator for persistence
   */
  exportState(): LightIndicatorState {
    return {
      bin: [],
      circ: [],
      child: [
        this._fullLengthWMA.exportState(),
        this._halfLengthWMA.exportState(),
        this._rootWMA.exportState(),
      ],
      parent: super.exportState(),
    }
  }

  /**
   * Restore the state of this indicator from a previously exported state
   */
  restoreState(state: LightIndicatorState): void {
    if (!state.parent) {
      throw new Error('Invalid state: parent state is missing')
    }
    if (!state.child || state.child.length < 3) {
      throw new Error('Invalid state: child states are missing')
    }

    this._fullLengthWMA.restoreState(state.child[0])
    this._halfLengthWMA.restoreState(state.child[1])
    this._rootWMA.restoreState(state.child[2])

    super.restoreState(state.parent)
  }
}
