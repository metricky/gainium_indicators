import { HLC } from '../types/candles'
import {
  Float64CircularArray,
  hlcValue,
  lastIndexOfEnum,
  LightIndicator,
  LightIndicatorState,
} from '../util'

// Define state indices for clarity
enum ATHState {
  ATH_VALUE = 0,
}

/**
 * All-Time High (ATH) Drawdown Indicator
 * Type: Volatility/Risk Assessment Indicator
 *
 * The ATH indicator tracks the highest price over a specified lookback period and calculates
 * the current drawdown percentage from that high. This indicator is useful for risk management
 * and understanding how far the current price has fallen from recent peaks.
 *
 * A drawdown is expressed as a negative percentage, showing how much the current low price
 * has declined from the highest high within the lookback period. The closer to 0%, the closer
 * the current price is to the all-time high. Larger negative values indicate deeper drawdowns.
 *
 * This indicator is particularly useful for position sizing, stop-loss placement, and
 * understanding market volatility patterns.
 *
 * Formula: ATH Drawdown = ((Current Low / ATH) - 1) × 100
 * Where ATH = Highest High over lookback period
 *
 * Candle Input Type: HLC (High, Low, Close)
 *
 * @see https://www.investopedia.com/terms/d/drawdown.asp
 * @see https://www.investopedia.com/terms/a/all-time-high.asp
 */
export class ATH extends LightIndicator<number, HLC> {
  // Store high values in a Float64Array for better performance
  private readonly high: Float64CircularArray

  /**
   * Creates a new ATH indicator instance
   *
   * @param lookback - The number of periods to look back for tracking the highest high value
   */
  constructor(lookback: number) {
    /**
     * Initialize the LightIndicator parent class
     * @param historyLength - 1 (only need current candle for high/low values)
     * @param defaultValue - hlcValue (default object with zero values, e.g., {high: 0, low: 0, close: 0})
     * @param stateSize - lastIndexOfEnum(AOState) (size of Float64Array to store ATH value state)
     */
    super(1, hlcValue, lastIndexOfEnum(ATHState)) // We only need to track current candle, 1 state value
    this.high = new Float64CircularArray(lookback)
  }

  protected calculate(): number {
    const s = this._state
    const l = this._history.last
    const high = this.high
    high.add(l.high)

    if (high.last > s[ATHState.ATH_VALUE]) {
      s[ATHState.ATH_VALUE] = high.last
    }
    if (high.oldValue === s[ATHState.ATH_VALUE]) {
      s[ATHState.ATH_VALUE] = -Infinity
      for (let i = 0; i < high.size; i++) {
        if (high.array[i] > s[ATHState.ATH_VALUE]) {
          s[ATHState.ATH_VALUE] = high.array[i]
        }
      }
    }

    return (l.low / s[ATHState.ATH_VALUE] - 1) * 100
  }

  override exportState(): LightIndicatorState {
    // Export the state of the high array
    return {
      bin: [],
      circ: [this.high.exportState()],
      parent: super.exportState(),
    }
  }

  override restoreState(state: LightIndicatorState): void {
    if (!state.parent) {
      throw new Error('Invalid state: parent state is missing')
    }
    if (!state.circ?.length) {
      throw new Error('Invalid state: circ state is missing')
    }
    // Restore the state of the high array
    this.high.restoreState(state.circ[0])
    super.restoreState(state.parent)
  }
}
