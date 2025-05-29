import { HLC } from '../types/candles'
import { PercentileResult } from '../types/result'
import { gt, hlcValue, lastIndexOfEnum, PercentileCalculator } from '../util'
import { LightIndicator, LightIndicatorState } from '../util/indicator'
import { WSMA } from '../WSMA/WSMA'

// Define state indices for performance and readability
enum ADXState {
  PDI = 0,
  MDI = 1,
  HIGHER_HIGH = 2,
  LOWER_LOW = 3,
  PMOVE = 4,
  MMOVE = 5,
  TRUE_RANGE = 6,
  DM_SUM = 7,
  DX_VALUE = 8,
}

/**
 * Average Directional Index (ADX) Indicator
 * Type: Trend Strength Indicator
 *
 * The ADX was developed by J. Welles Wilder Jr. and measures the strength of a trend without
 * regard to its direction. It is derived from the Directional Movement Index (DMI) which
 * includes the Plus Directional Indicator (+DI) and Minus Directional Indicator (-DI).
 *
 * ADX values range from 0 to 100. Generally, ADX readings below 20 indicate trend weakness,
 * readings above 40 indicate trend strength, and values above 50 suggest a strong trend.
 * ADX values of 75-100 signal an extremely strong trend.
 *
 * When +DI is above -DI, there is more upward pressure than downward pressure in the market.
 * When -DI is above +DI, there is more downward pressure than upward pressure.
 *
 * Formula:
 * - True Range (TR) = max(High - Low, |High - Previous Close|, |Low - Previous Close|)
 * - +DM = High - Previous High (when > 0 and > -DM), else 0
 * - -DM = Previous Low - Low (when > 0 and > +DM), else 0
 * - +DI = 100 × (Smoothed +DM / Smoothed TR)
 * - -DI = 100 × (Smoothed -DM / Smoothed TR)
 * - DX = 100 × (|+DI - -DI| / (+DI + -DI))
 * - ADX = Smoothed DX
 *
 * Candle Input Type: HLC (High, Low, Close)
 *
 * @see https://www.investopedia.com/terms/a/adx.asp
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:average_directional_index_adx
 */
export class ADX extends LightIndicator<PercentileResult, HLC> {
  // Components for DX calculation
  private readonly atrSum: WSMA
  private readonly upMoveSum: WSMA
  private readonly downMoveSum: WSMA
  private readonly adxSmoothing: WSMA

  // Percentile ranking
  private percentileCalc?: PercentileCalculator

  /**
   * Creates a new ADX indicator instance
   *
   * @param interval - The period for smoothing calculations (typically 14)
   * @param percentile - Whether to calculate percentile ranking (optional)
   * @param percentileLookback - Number of periods for percentile calculation (optional)
   * @param percentilePercentage - Percentile threshold percentage (optional)
   */
  constructor(
    interval: number,
    percentile?: boolean,
    percentileLookback?: number,
    percentilePercentage?: number,
  ) {
    /**
     * Initialize the LightIndicator parent class
     * @param historyLength - 2 (need current and previous candle for directional movement calculation)
     * @param defaultValue - hlcValue (default object with zero values, e.g., {high: 0, low: 0, close: 0})
     * @param stateSize - lastIndexOfEnum(ADXState) (size of Float64Array to store ADX calculation states)
     */
    super(2, hlcValue, lastIndexOfEnum(ADXState)) // We need 2 candles for directional movement, multiple state values

    // Initialize component indicators
    this.upMoveSum = new WSMA(interval)
    this.downMoveSum = new WSMA(interval)
    this.atrSum = new WSMA(interval)
    this.adxSmoothing = new WSMA(interval)

    // Initialize percentile calculator if needed
    if (percentile && percentileLookback) {
      this.percentileCalc = new PercentileCalculator(
        percentileLookback,
        percentilePercentage,
      )
    }
  }

  // Get +DI value
  get pdi(): number {
    return this._state[ADXState.PDI]
  }

  // Get -DI value
  get mdi(): number {
    return this._state[ADXState.MDI]
  }

  protected calculate(): PercentileResult | null {
    const h = this._history

    if (!h.isFilled) {
      return null
    }
    const s = this._state
    const last = h.last
    const prev = h.prev
    const atr = this.atrSum
    const upMoveSum = this.upMoveSum
    const downMoveSum = this.downMoveSum
    const adxSmoothing = this.adxSmoothing

    s[ADXState.TRUE_RANGE] = Math.max(
      last.high - last.low,
      Math.abs(last.high - prev.close),
      Math.abs(last.low - prev.close),
    )

    // Calculate directional movement
    s[ADXState.HIGHER_HIGH] = last.high - prev.high
    s[ADXState.LOWER_LOW] = prev.low - last.low

    // Plus Directional Movement (+DM)
    s[ADXState.PMOVE] =
      gt(s[ADXState.HIGHER_HIGH], 0) &&
      gt(s[ADXState.HIGHER_HIGH], s[ADXState.LOWER_LOW])
        ? s[ADXState.HIGHER_HIGH]
        : 0

    // Minus Directional Movement (-DM)
    s[ADXState.MMOVE] =
      gt(s[ADXState.LOWER_LOW], 0) &&
      gt(s[ADXState.LOWER_LOW], s[ADXState.HIGHER_HIGH])
        ? s[ADXState.LOWER_LOW]
        : 0

    // If we don't have enough data yet, return null
    atr.next(s[ADXState.TRUE_RANGE])
    upMoveSum.next(s[ADXState.PMOVE])
    downMoveSum.next(s[ADXState.MMOVE])
    if (
      atr.result === null ||
      upMoveSum.result === null ||
      downMoveSum.result === null
    ) {
      return null
    }

    // Calculate +DI and -DI
    if (atr.result === 0) {
      s[ADXState.PDI] = 0
      s[ADXState.MDI] = 0
      s[ADXState.DX_VALUE] = 0
    } else {
      s[ADXState.PDI] = (upMoveSum.result! / atr.result) * 100
      s[ADXState.MDI] = (downMoveSum.result! / atr.result) * 100

      // Calculate DX
      s[ADXState.DM_SUM] = s[ADXState.PDI] + s[ADXState.MDI]

      if (s[ADXState.DM_SUM] === 0) {
        s[ADXState.DX_VALUE] = 0
      } else {
        s[ADXState.DX_VALUE] =
          (Math.abs(s[ADXState.PDI] - s[ADXState.MDI]) / s[ADXState.DM_SUM]) *
          100
      }
    }

    if (adxSmoothing.next(s[ADXState.DX_VALUE]) === null) {
      return null
    }

    // Handle percentile calculation if needed
    if (this.percentileCalc) {
      if (this.percentileCalc.insert(adxSmoothing.result!)) {
        return {
          value: adxSmoothing.result!,
          percentile: this.percentileCalc.getPercentile(),
        }
      }
    }

    return {
      value: adxSmoothing.result!,
    }
  }

  override exportState(): LightIndicatorState {
    return {
      bin: [],
      circ: [],
      parent: super.exportState(),
      child: [
        this.atrSum.exportState(),
        this.upMoveSum.exportState(),
        this.downMoveSum.exportState(),
        this.adxSmoothing.exportState(),
      ],
      percentile: this.percentileCalc?.exportState(),
    }
  }

  override restoreState(state: LightIndicatorState): void {
    if (!state.parent) {
      throw new Error('Invalid state: parent state is missing')
    }
    if (!state.child?.length) {
      throw new Error('Invalid state: child state is missing')
    }
    this.atrSum.restoreState(state.child[0])
    this.upMoveSum.restoreState(state.child[1])
    this.downMoveSum.restoreState(state.child[2])
    this.adxSmoothing.restoreState(state.child[3])
    if (this.percentileCalc && state.percentile) {
      this.percentileCalc.restoreState(state.percentile)
    }
    super.restoreState(state.parent)
  }
}
