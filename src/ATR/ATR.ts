import { TR } from '../TR/TR'
import { LightIndicator, LightIndicatorState } from '../util'
import { HLC } from '../types/candles'
import { hlcValue } from '../util/candles'
import { RMA } from '../RMA/RMA'

/**
 * Average True Range (ATR) Indicator
 * Type: Volatility Indicator
 *
 * The ATR was developed by J. Welles Wilder Jr. to measure market volatility. It calculates
 * the average of true ranges over a specified period. The true range is the greatest of the
 * three values: current high minus current low, absolute value of current high minus previous
 * close, or absolute value of current low minus previous close.
 *
 * ATR does not indicate price direction but rather the degree of price volatility. High ATR
 * values indicate high volatility, while low ATR values indicate low volatility. Traders use
 * ATR for position sizing, setting stop-loss levels, and identifying breakout opportunities.
 *
 * The ATR is typically smoothed using Wilder's Moving Average (RMA) to reduce noise and
 * provide a more stable volatility measure.
 *
 * Formula: ATR = RMA(True Range, period)
 * Where True Range = max(High - Low, |High - Previous Close|, |Low - Previous Close|)
 *
 * Candle Input Type: HLC (High, Low, Close)
 *
 * @see https://www.investopedia.com/terms/a/atr.asp
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:average_true_range_atr
 */

export class ATR extends LightIndicator<number, HLC> {
  private readonly tr: TR
  private readonly rma: RMA

  /**
   * Creates a new ATR indicator instance
   *
   * @param interval - Period to calculate ATR over (typically 14)
   */
  constructor(interval: number) {
    /**
     * Initialize the LightIndicator parent class
     * @param historyLength - 1 (only need current candle, as TR component handles history internally)
     * @param defaultValue - hlcValue (default object with zero values, e.g., {high: 0, low: 0, close: 0})
     * @param stateSize - 0 (no additional state storage needed beyond component indicators)
     */
    super(1, hlcValue, 0) // Use 1 history size and 0 state values
    this.tr = new TR()
    this.rma = new RMA(interval)
  }

  /**
   * Calculate the ATR based on current history
   * This method is called by the base class
   */
  protected calculate(): number | null {
    const tr = this.tr
    // Get the true range for this candle
    if (tr.next(this._history.last) === null) {
      return null
    }

    return this.rma.next(tr.result!)
  }

  /**
   * Exports the current state of the indicator
   */
  override exportState(): LightIndicatorState {
    return {
      bin: [],
      circ: [],
      parent: super.exportState(),
      child: [this.tr.exportState(), this.rma.exportState()],
    }
  }

  /**
   * Restores the state from a saved state
   */
  override restoreState(state: LightIndicatorState): void {
    if (!state.parent) {
      throw new Error('Invalid state: parent state is missing')
    }
    if (!state.child?.length) {
      throw new Error('Invalid state: child state is missing')
    }

    this.tr.restoreState(state.child[0])
    this.rma.restoreState(state.child[1])
    super.restoreState(state.parent)
  }
}
