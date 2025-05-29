import { OHLCV } from '../types/candles'
import { PercentileResult } from '../types/result'
import {
  Float64CircularArray,
  PercentileCalculator,
  gte,
  lastIndexOfEnum,
  lte,
  ohlcvValue,
} from '../util'
import { LightIndicator, LightIndicatorState } from '../util/indicator'
import { hlc3 } from '../util/price'

enum MFIState {
  PRICE_CHANGE = 0,
  POSITIVE_SUM = 1,
  NEGATIVE_SUM = 2,
  MFI_VALUE = 3,
}
/**
 * Money Flow Index (MFI)
 * Type: Volume-Weighted Momentum Oscillator
 *
 * The Money Flow Index (MFI) is a volume-weighted momentum oscillator that incorporates both
 * price and volume data to identify overbought and oversold conditions. Often called the
 * "Volume-Weighted RSI," MFI provides a more comprehensive view of market sentiment by
 * considering not just price movements but also the volume behind those movements.
 *
 * Developed by Gene Quong and Avrum Soudack, MFI is particularly valuable because volume
 * often leads price movements. By incorporating volume, MFI can provide earlier warnings
 * of potential reversals compared to price-only oscillators. The indicator ranges from
 * 0 to 100 and uses typical price (HLC/3) multiplied by volume to calculate money flow.
 *
 * The calculation distinguishes between positive money flow (when typical price increases)
 * and negative money flow (when typical price decreases), creating a ratio that reflects
 * the balance between buying and selling pressure backed by actual trading volume.
 *
 * Trading Interpretation:
 * - 0-20: Oversold conditions, potential buying opportunity
 * - 20-30: Still oversold but approaching neutral territory
 * - 30-70: Neutral zone, trend continuation likely
 * - 70-80: Approaching overbought, watch for reversal signals
 * - 80-100: Overbought conditions, potential selling opportunity
 * - Readings above 90 or below 10: Extreme conditions, high reversal probability
 *
 * Signal Generation:
 * - MFI crossing above 20: Potential end of oversold condition (bullish)
 * - MFI crossing below 80: Potential end of overbought condition (bearish)
 * - Divergence Analysis: Price vs MFI divergences signal potential reversals
 * - Failure Swings: MFI failing to reach previous extremes indicates trend weakness
 *
 * Advantages over Price-Only Oscillators:
 * - Volume confirmation reduces false signals
 * - Earlier reversal warnings through volume analysis
 * - Better identification of genuine vs. fake breakouts
 * - More reliable in highly volatile markets
 *
 * Formula:
 * - Typical Price = (High + Low + Close) / 3
 * - Money Flow = Typical Price × Volume
 * - Positive Money Flow = Sum of money flow when typical price increases
 * - Negative Money Flow = Sum of money flow when typical price decreases
 * - Money Flow Ratio = Positive Money Flow / Negative Money Flow
 * - MFI = 100 - (100 / (1 + Money Flow Ratio))
 *
 * Candle Input Type: OHLCV (requires High, Low, Close for typical price and Volume for money flow)
 *
 * @see https://www.investopedia.com/terms/m/mfi.asp
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:money_flow_index_mfi
 * @see https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/mfi
 */
export class MFI extends LightIndicator<PercentileResult, OHLCV> {
  // Circular buffers for data
  private readonly positiveMoneyFlow: Float64CircularArray
  private readonly negativeMoneyFlow: Float64CircularArray
  private readonly typicalPrice: Float64CircularArray

  // Percentile ranking
  private percentileCalc?: PercentileCalculator

  /**
   * Creates a new Money Flow Index (MFI) indicator
   *
   * @param interval Number of periods for MFI calculation (typically 14). This determines
   *                 the lookback period for calculating positive and negative money flow sums.
   *                 Common values: 10 (sensitive), 14 (standard), 20 (smooth), 30 (very smooth).
   *                 Shorter periods increase sensitivity but may generate more false signals.
   * @param percentile Whether to calculate percentile ranking of MFI values for historical context.
   *                   Helps identify extreme readings relative to recent performance.
   * @param percentileLookback Number of periods for percentile calculation (typically 50-200).
   *                           Larger values provide more stable percentile rankings.
   * @param percentilePercentage Percentile level to use for ranking (default: 50 for median).
   *                            Common values: 25, 50, 75, 90 for different analysis thresholds.
   */
  constructor(
    public readonly interval: number,
    percentile?: boolean,
    percentileLookback?: number,
    percentilePercentage?: number,
  ) {
    /**
     * Initializes the parent LightIndicator with:
     * @param historyLength 2 - Needs current and previous OHLCV candles for typical price comparison
     * @param defaultValue ohlcvValue - Function to extract OHLCV candle data for volume and price calculations
     * @param stateSize lastIndexOfEnum(MFIState) - Storage for price_change, positive_sum, negative_sum, mfi_value (4 elements)
     * @param fillValue undefined - Uses default fill behavior, returns null until sufficient data available
     */
    super(2, ohlcvValue, lastIndexOfEnum(MFIState)) // Need to track current and previous OHLCV

    // Pre-allocate arrays for money flow
    this.positiveMoneyFlow = new Float64CircularArray(interval)
    this.negativeMoneyFlow = new Float64CircularArray(interval)
    this.typicalPrice = new Float64CircularArray(2, NaN)

    // Initialize percentile calculator if needed
    if (percentile && percentileLookback) {
      this.percentileCalc = new PercentileCalculator(
        percentileLookback,
        percentilePercentage,
      )
    }
  }

  protected calculate(): PercentileResult | null {
    const s = this._state
    const l = this._history.last
    const tp = this.typicalPrice
    const pmf = this.positiveMoneyFlow
    const nmf = this.negativeMoneyFlow
    // Calculate typical price for current candle

    // Skip first update since we need a previous price
    if (!tp.add(hlc3(l.high, l.low, l.close))) {
      return null
    }

    // Calculate price change from previous to current
    s[MFIState.PRICE_CHANGE] = tp.last - tp.prev

    // Update money flow arrays using circular buffer pattern
    if (lte(s[MFIState.PRICE_CHANGE], 0)) {
      pmf.add(0)
    } else {
      pmf.add(tp.last * l.volume)
    }
    if (gte(s[MFIState.PRICE_CHANGE], 0)) {
      nmf.add(0)
    } else {
      nmf.add(tp.last * l.volume)
    }

    // Calculate sums of positive and negative money flows
    s[MFIState.POSITIVE_SUM] =
      s[MFIState.POSITIVE_SUM] - pmf.oldValue + pmf.last
    s[MFIState.NEGATIVE_SUM] =
      s[MFIState.NEGATIVE_SUM] - nmf.oldValue + nmf.last

    if (!pmf.isFilled || !nmf.isFilled) {
      return null
    }

    // Calculate money flow ratio
    if (s[MFIState.NEGATIVE_SUM] === 0) {
      s[MFIState.MFI_VALUE] = 100 // Prevent division by zero
    } else {
      s[MFIState.MFI_VALUE] =
        100 - 100 / (1 + s[MFIState.POSITIVE_SUM] / s[MFIState.NEGATIVE_SUM])
    }

    // Handle percentile calculation if needed
    if (this.percentileCalc) {
      // Insert the MFI value into the percentile calculator

      if (this.percentileCalc.insert(s[MFIState.MFI_VALUE])) {
        return {
          value: s[MFIState.MFI_VALUE],
          percentile: this.percentileCalc.getPercentile(),
        }
      }
    }

    return {
      value: s[MFIState.MFI_VALUE],
    }
  }

  exportState(): LightIndicatorState {
    return {
      bin: [],
      circ: [
        this.positiveMoneyFlow.exportState(),
        this.negativeMoneyFlow.exportState(),
        this.typicalPrice.exportState(),
      ],
      child: [],
      parent: super.exportState(),
    }
  }

  restoreState(state: LightIndicatorState): void {
    if (!state.parent) {
      throw new Error('Invalid state: parent state is missing')
    }
    if (!state.circ) {
      throw new Error('Invalid state: circular buffer states are missing')
    }

    this.positiveMoneyFlow.restoreState(state.circ[0])
    this.negativeMoneyFlow.restoreState(state.circ[1])
    this.typicalPrice.restoreState(state.circ[2])

    super.restoreState(state.parent)
  }
}
