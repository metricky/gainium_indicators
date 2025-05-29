import { SMA } from '../SMA/SMA'
import { HL } from '../types/candles'
import { hlValue } from '../util'
import { LightIndicator, LightIndicatorState } from '../util/indicator'

/**
 * Average Daily Range (ADR) Indicator
 * Type: Volatility Indicator
 *
 * The Average Daily Range (ADR) measures the average volatility of a security by calculating
 * the mean of the high-low ranges over a specified period. This indicator helps traders
 * understand the typical price movement range and can be used for setting profit targets
 * and stop losses.
 *
 * The ADR is calculated by taking the simple moving average of the daily ranges (High - Low).
 * A higher ADR indicates higher volatility, while a lower ADR suggests lower volatility.
 *
 * Formula: ADR = SMA(High - Low, period)
 *
 * Candle Input Type: HL (High, Low)
 *
 * @see https://www.investopedia.com/terms/a/atr.asp
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:average_true_range_atr
 */
export class ADR extends LightIndicator<number, HL> {
  private readonly sma: SMA

  /**
   * Creates a new ADR indicator instance
   *
   * @param interval - The period for calculating the average (number of candles to include in SMA calculation)
   */
  constructor(interval: number) {
    /**
     * Initialize the LightIndicator parent class
     * @param historyLength - 1 (only need to track one candle for current high-low calculation)
     * @param defaultValue - hlValue (default object with zero values, e.g., {high: 0, low: 0})
     * @param stateSize - 0 (no additional state storage needed beyond history)
     */
    super(1, hlValue, 0) // Only need to track one candle, state size 0
    this.sma = new SMA(interval)
  }

  protected calculate(): number | null {
    const l = this._history.last
    return this.sma.next(l.high - l.low)
  }

  override exportState(): LightIndicatorState {
    return {
      bin: [],
      circ: [],
      parent: super.exportState(),
      child: [this.sma.exportState()],
    }
  }

  override restoreState(state: LightIndicatorState): void {
    if (!state.parent) {
      throw new Error('Invalid state: parent state is missing')
    }
    if (!state.child?.length) {
      throw new Error('Invalid state: child state is missing')
    }
    this.sma.restoreState(state.child[0])
    super.restoreState(state.parent)
  }
}
