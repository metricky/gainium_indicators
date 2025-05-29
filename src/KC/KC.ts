import { LightIndicator, LightIndicatorState } from '../util/indicator'
import { BandsResult } from '../types/result'
import { OHLCV } from '../types/candles'
import { EMA } from '../EMA/EMA'
import { ATR } from '../ATR/ATR'
import { ohlcvValue } from '../util'
import { SMA } from '../SMA/SMA'
import { TR } from '../TR/TR'
import { RMA } from '../RMA/RMA'

/**
 * Keltner Channel (KC)
 * Type: Volatility
 *
 * Keltner Channels are volatility-based bands that are placed on either side of
 * a moving average. Keltner Channels are similar to Bollinger Bands in that they
 * can be used to identify overbought and oversold conditions.
 *
 * The bands are typically set two Average True Range values above and below the moving average.
 *
 * @see https://www.investopedia.com/terms/k/keltnerchannel.asp
 */
export class KeltnerChannel extends LightIndicator<BandsResult, OHLCV> {
  // Child indicators
  private readonly ma: EMA | SMA
  private readonly range: ATR | TR | RMA

  /**
   * Creates a new Keltner Channel (KC) indicator instance
   *
   * @param length - Period for the moving average calculation (typically 14-20 periods)
   * @param mult - Multiplier for the bands distance from the middle line (typically 1.5-2.5, default: 2)
   * @param maType - Type of moving average to use for the middle line ('EMA' or 'SMA')
   * @param rangeType - Type of range calculation to use ('ATR', 'TR', or 'RMA')
   * @param rangeLength - Period for the range calculation (default: same as length parameter)
   */
  constructor(
    length: number,
    private readonly mult: number = 2,
    maType: string,
    private readonly rangeType: string,
    rangeLength: number = length,
  ) {
    /**
     * Initialize the LightIndicator parent class
     * @param historyLength - 1 (only need current candle as child indicators handle their own history)
     * @param defaultValue - ohlcvValue (default object with zero values, e.g., {open: 0, high: 0, low: 0, close: 0, volume: 0})
     * @param stateSize - 0 (no additional state storage needed as calculations are handled by child indicators)
     */
    super(1, ohlcvValue, 0)

    // Initialize component indicators
    this.ma = this.returnMaInstance(maType.toUpperCase(), length)
    this.rangeType = rangeType.toUpperCase()
    this.range = this.returnRangeInstance(length, rangeLength)
  }

  private returnMaInstance(maType: string, maInterval: number) {
    return maType === 'EMA' ? new EMA(maInterval) : new SMA(maInterval)
  }

  private returnRangeInstance(length: number, rangeLength: number) {
    return this.rangeType === 'ATR'
      ? new ATR(rangeLength)
      : this.rangeType === 'TR'
        ? new TR()
        : new RMA(length)
  }

  private updateRangeInstance(value: OHLCV) {
    if (this.rangeType === 'ATR' || this.rangeType === 'TR') {
      return (this.range as ATR | TR).next(value)
    }
    return (this.range as RMA).next(value.high - value.low)
  }

  /**
   * Calculate Keltner Channels
   */
  protected calculate(): BandsResult | null {
    const l = this._history.last
    const ma = this.ma
    const range = this.range

    // Update component indicators
    ma.next(l.close)
    this.updateRangeInstance(l)

    // If we don't have enough data yet, return null
    if (ma.result === null || range.result === null) {
      return null
    }
    const rxm = range.result * this.mult
    return {
      upper: ma.result + rxm,
      middle: ma.result,
      lower: ma.result - rxm,
    }
  }

  /**
   * Exports the state of the indicator for restoration later
   */
  override exportState(): LightIndicatorState {
    return {
      bin: [],
      circ: [],
      child: [this.ma.exportState(), this.range.exportState()],
      parent: super.exportState(),
    }
  }

  /**
   * Restores the state of the indicator
   * @param state Previously exported state
   */
  override restoreState(state: LightIndicatorState): void {
    if (!state.parent) {
      throw new Error('Invalid state: parent state is missing')
    }

    if (!state.child) {
      throw new Error('Invalid state: child states are missing')
    }

    // Restore component indicators
    this.ma.restoreState(state.child[0])
    this.range.restoreState(state.child[1])

    // Restore parent state
    super.restoreState(state.parent)
  }
}
