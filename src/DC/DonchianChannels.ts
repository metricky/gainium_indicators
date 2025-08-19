import { HLC } from '../types/candles'
import { DCResult } from '../types/result'
import { LightIndicator, LightIndicatorState } from '../util/indicator'
import { hlcValue } from '../util/candles'
import { Extremum } from '../Extremum/Extremum'

/**
 * Donchian Channels Indicator
 * Type: Volatility/Trend-Following Indicator
 *
 * Donchian Channels were developed by Richard Donchian, often called the "father of
 * trend following." The indicator creates a channel by plotting the highest high and
 * lowest low over a specified lookback period. This creates three key levels: the
 * upper channel (highest high), lower channel (lowest low), and middle line (basis)
 * which is the average of the two extremes.
 *
 * The Donchian Channel is widely used by trend followers and breakout traders as it
 * provides clear support and resistance levels based on recent price action. It's
 * particularly effective in trending markets and forms the foundation of many
 * systematic trading strategies, including the famous Turtle Trading System.
 *
 * Trading Interpretation:
 * - Upper Channel: Acts as dynamic resistance; breakouts above may signal uptrend continuation
 * - Lower Channel: Acts as dynamic support; breakdowns below may signal downtrend continuation
 * - Middle Line (Basis): Often used as a trend filter or mean reversion level
 * - Channel Width: Wider channels indicate higher volatility, narrower channels suggest consolidation
 * - Price touching extremes: May indicate potential breakout or reversal points
 *
 * The channels adapt to market volatility and provide context-sensitive support and
 * resistance levels. In trending markets, price tends to ride along one edge of the
 * channel, while in ranging markets, price oscillates between the upper and lower bounds.
 *
 * Formula:
 * - Upper Channel = Highest High over N periods
 * - Lower Channel = Lowest Low over N periods
 * - Middle Line (Basis) = (Upper Channel + Lower Channel) / 2
 *
 * Candle Input Type: HLC (High, Low, Close) - uses high/low for extremes, close for current price reference
 *
 * @see https://www.investopedia.com/terms/d/donchianchannels.asp
 * @see https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/donchian-channel
 */
export class DonchianChannels extends LightIndicator<DCResult, HLC> {
  private readonly extremum: Extremum
  /**
   * Creates a new Donchian Channels indicator instance
   *
   * @param length - Lookback period for channel calculation (typically 20-55 periods, with 20 being common for shorter-term and 55 for longer-term analysis)
   */
  constructor(length: number) {
    /**
     * Initialize the LightIndicator parent class
     * @param historyLength - length (need full lookback period to find highest high and lowest low)
     * @param defaultValue - hlcValue (default object with zero values, e.g., {high: 0, low: 0, close: 0})
     * @param stateSize - 0 (size of Float64Array to store calculation states)
     */
    super(length, hlcValue, 0) // length history entries, 0 state values
    this.extremum = new Extremum(length)
  }

  /**
   * Calculate Donchian Channels based on current history
   */
  protected calculate(): DCResult | null {
    const l = this._history.last
    const e = this.extremum
    let r: DCResult | null = null
    if (e.result) {
      r = {
        high: e.result!.highest,
        low: e.result!.lowest,
        basis: (e.result!.highest + e.result!.lowest) / 2,
        price: l.close,
      }
    }
    e.next(l)

    // Return the result
    return r
  }

  exportState(): LightIndicatorState {
    return {
      bin: [],
      circ: [],
      child: [this.extremum.exportState()],
      parent: super.exportState(),
    }
  }

  restoreState(state: LightIndicatorState): void {
    if (!state.parent) {
      throw new Error('Invalid state: parent state is missing')
    }
    if (!state.child) {
      throw new Error('Invalid state: child state is missing')
    }
    this.extremum.restoreState(state.child[0])
    super.restoreState(state.parent)
  }
}
