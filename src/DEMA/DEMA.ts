import { EMA } from '../EMA/EMA'
import { LightIndicator, LightIndicatorState } from '../util/indicator'

/**
 * Double Exponential Moving Average (DEMA)
 * Type: Trend-Following/Smoothing Indicator
 *
 * The Double Exponential Moving Average (DEMA) was developed by Patrick G. Mulloy in 1994
 * to address the inherent lag problems in traditional moving averages. DEMA applies a
 * double smoothing technique that significantly reduces lag while maintaining smoothness,
 * making it more responsive to recent price changes than single EMAs.
 *
 * Unlike simply doubling an EMA value, DEMA uses a sophisticated calculation that applies
 * exponential smoothing twice: first to the price data, then to the resulting EMA. The
 * final DEMA value subtracts the double-smoothed EMA from twice the single EMA, effectively
 * removing much of the lag while preserving the smoothing characteristics.
 *
 * Trading Interpretation:
 * - Trend Direction: Price above DEMA suggests uptrend, below suggests downtrend
 * - Entry/Exit Signals: Crossovers between price and DEMA can signal trend changes
 * - Slope Analysis: Rising DEMA indicates bullish momentum, falling indicates bearish
 * - Support/Resistance: DEMA often acts as dynamic support in uptrends and resistance in downtrends
 * - Reduced Lag: More responsive than simple EMA, providing earlier signals
 * - Less Whipsaws: Better smoothing than faster MAs, reducing false signals in choppy markets
 *
 * DEMA is particularly useful for trend-following strategies where quick response to
 * genuine trend changes is crucial, while filtering out minor price fluctuations. It's
 * commonly used in combination with other indicators for confirmation and in automated
 * trading systems where lag reduction is critical.
 *
 * Formula: DEMA = 2 × EMA(price, period) - EMA(EMA(price, period), period)
 * Where the second EMA is applied to the first EMA result
 *
 * Candle Input Type: Single Price Value (typically Close price)
 *
 * @see https://www.investopedia.com/terms/d/double-exponential-moving-average.asp
 * @see https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/dema
 */
export class DEMA extends LightIndicator {
  // Component EMAs
  private readonly innerEMA: EMA
  private readonly outerEMA: EMA

  /**
   * Creates a new DEMA indicator instance
   *
   * @param interval - Period for EMA calculations (typically 9-21 periods, with 14 being common for balanced responsiveness and smoothness)
   */
  constructor(interval: number) {
    /**
     * Initialize the LightIndicator parent class
     * @param historyLength - 1 (only need current price value for EMA calculations)
     * @param defaultValue - 0 (default numeric value for price input)
     * @param stateSize - 0 (no additional state storage needed as calculations are handled by child EMAs)
     */
    super(1, 0, 0) // 1 history entry, 0 state values

    // Initialize component EMAs
    this.innerEMA = new EMA(interval)
    this.outerEMA = new EMA(interval)
  }

  /**
   * Calculate DEMA based on inner and outer EMAs
   */
  protected calculate(): number | null {
    const inma = this.innerEMA
    const oma = this.outerEMA
    // First calculate the inner EMA
    if (inma.next(this._history.last) === null) {
      return null
    }
    // Calculate the outer EMA (EMA of the EMA)
    if (oma.next(inma.result!) === null) {
      return null
    }

    return 2 * inma.result! - oma.result!
  }

  /**
   * Export the indicator state
   */
  exportState(): LightIndicatorState {
    return {
      bin: [],
      circ: [],
      child: [this.innerEMA.exportState(), this.outerEMA.exportState()],
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

    // Restore the inner and outer EMAs
    this.innerEMA.restoreState(state.child[0])
    this.outerEMA.restoreState(state.child[1])

    // Restore the parent state
    super.restoreState(state.parent)
  }
}
