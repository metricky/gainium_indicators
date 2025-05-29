import { EMA, SMA, WMA, DEMA, TEMA, VWMA, HMA, RMA } from '../'
import {
  Float64CircularArray,
  lastIndexOfEnum,
  ohlcvValue,
  stDev,
} from '../util'
import { LightIndicator, LightIndicatorState } from '../util/indicator'
import { OHLCV } from '../types/candles'
import { BandsResult } from '../types/result'

type MAType = EMA | SMA | WMA | DEMA | TEMA | VWMA | HMA | RMA

// Define state indices for performance and readability
enum BBState {
  MIDDLE_VALUE = 0,
  STDEV_VALUE = 1,
}

/**
 * Bollinger Bands (BBANDS) Indicator
 * Type: Volatility Indicator
 *
 * Bollinger Bands were developed by John A. Bollinger and consist of three lines: a middle line
 * (moving average) and two volatility bands (upper and lower) placed at a specified number of
 * standard deviations above and below the middle line. The bands expand and contract based on
 * market volatility.
 *
 * The bands help identify overbought and oversold conditions. When prices touch the upper band,
 * the security may be overbought; when they touch the lower band, it may be oversold. Narrow
 * bands indicate low volatility and potential breakouts, while wide bands suggest high volatility.
 *
 * Common patterns include "M" formations (bearish) at the upper band and "W" formations (bullish)
 * at the lower band. The %B indicator can be used to determine where price is relative to the bands.
 *
 * Formula:
 * - Middle Band = Moving Average (typically 20-period SMA)
 * - Upper Band = Middle Band + (multiplier × Standard Deviation)
 * - Lower Band = Middle Band - (multiplier × Standard Deviation)
 * - Standard multiplier = 2
 *
 * Candle Input Type: OHLCV (Open, High, Low, Close, Volume)
 *
 * @see https://www.investopedia.com/terms/b/bollingerbands.asp
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:bollinger_bands
 */
export class BollingerBands extends LightIndicator<BandsResult, OHLCV> {
  private readonly prices: Float64CircularArray
  private readonly ma: MAType

  private readonly maType: string

  /**
   * Creates a new Bollinger Bands indicator instance
   *
   * @param interval - Period for standard deviation calculation (typically 20)
   * @param deviationMultiplier - Number of standard deviations for band calculation (typically 2.0)
   * @param maType - Type of moving average to use ('SMA', 'EMA', 'WMA', 'DEMA', 'TEMA', 'VWMA', 'HMA', 'RMA')
   * @param maInterval - Period for the moving average calculation
   */
  constructor(
    interval: number,
    private readonly deviationMultiplier: number = 2,
    maType: string,
    maInterval: number,
  ) {
    /**
     * Initialize the LightIndicator parent class
     * @param historyLength - 1 (only need current candle for price data)
     * @param defaultValue - ohlcvValue (default object with zero values, e.g., {open: 0, high: 0, low: 0, close: 0, volume: 0})
     * @param stateSize - lastIndexOfEnum(BBState) (size of Float64Array to store middle value and standard deviation)
     */
    super(1, ohlcvValue, lastIndexOfEnum(BBState)) // 2 state values as defined in BBState enum
    this.prices = new Float64CircularArray(interval, 0)
    this.ma = this.createMAInstance(maType.toUpperCase(), maInterval)
    this.maType = maType.toUpperCase()
  }

  protected calculate(): BandsResult | null {
    const s = this._state
    const l = this._history.last
    const p = this.prices
    // Update the prices buffer
    p.add(l.close)

    // Get the middle value from the MA indicator
    if (this.updateMA(l) !== null) {
      s[BBState.MIDDLE_VALUE] = this.ma.result!
      s[BBState.STDEV_VALUE] = stDev(p.array)
      return {
        lower:
          s[BBState.MIDDLE_VALUE] -
          s[BBState.STDEV_VALUE] * this.deviationMultiplier,
        middle: s[BBState.MIDDLE_VALUE],
        upper:
          s[BBState.MIDDLE_VALUE] +
          s[BBState.STDEV_VALUE] * this.deviationMultiplier,
      }
    }
    return null
  }

  /**
   * Creates the appropriate Moving Average instance based on the type
   */
  private createMAInstance(maType: string, maInterval: number): MAType {
    switch (maType) {
      case 'EMA':
        return new EMA(maInterval)
      case 'SMA':
        return new SMA(maInterval)
      case 'WMA':
        return new WMA(maInterval)
      case 'DEMA':
        return new DEMA(maInterval)
      case 'TEMA':
        return new TEMA(maInterval)
      case 'VWMA':
        return new VWMA(maInterval)
      case 'HMA':
        return new HMA(maInterval)
      case 'RMA':
        return new RMA(maInterval)
      default:
        return new EMA(maInterval)
    }
  }

  /**
   * Updates the MA instance with the appropriate data
   */
  private updateMA(candle: OHLCV): number | null {
    switch (this.maType) {
      case 'EMA':
      case 'SMA':
      case 'WMA':
      case 'DEMA':
      case 'TEMA':
      case 'HMA':
      case 'RMA':
        return (this.ma as EMA | SMA | WMA | DEMA | TEMA | HMA | RMA).next(
          candle.close,
        )
      default:
        return (this.ma as any).next(candle)
    }
  }

  override exportState(): LightIndicatorState {
    return {
      bin: [],
      circ: [this.prices.exportState()],
      child: [this.ma.exportState()],
      parent: super.exportState(),
    }
  }

  override restoreState(state: LightIndicatorState): void {
    if (!state.parent) {
      throw new Error('Invalid state: parent state is missing')
    }
    if (!state.child?.length) {
      throw new Error('Invalid state: child state is missing')
    }
    this.prices.restoreState(state.circ[0])
    this.ma.restoreState(state.child[0])
    super.restoreState(state.parent)
  }
}
