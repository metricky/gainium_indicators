import {
  LightIndicator,
  LightIndicatorState,
  lastIndexOfEnum,
  ohlcValue,
} from '../util'
import { OHLC } from '../types/candles'
import { PercentileResult } from '../types/result'
import { PercentileCalculator } from '../util/percentile'
import { hl2, hlc3, ohlc4 } from '../util/price'

type SourceType = 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4'

// State indices for the MOM indicator
enum MOMState {
  VALUE = 0, // Current momentum value
}

/**
 * Momentum Indicator (MOM / MTM)
 * Type: Momentum/Rate of Change Indicator
 *
 * The Momentum indicator (also known as Momentum or Rate of Change) is one of the simplest
 * and most fundamental momentum oscillators in technical analysis. It measures the rate of
 * change in price over a specified time period by calculating the difference between the
 * current price and the price n periods ago.
 *
 * Unlike percentage-based rate of change indicators, Momentum provides absolute price
 * differences, making it particularly useful for comparing momentum across similar price
 * ranges. The indicator oscillates around zero, with positive values indicating upward
 * momentum and negative values indicating downward momentum.
 *
 * Momentum is especially valuable because it's a leading indicator that often changes
 * direction before the underlying price trend. This characteristic makes it excellent
 * for early trend change detection and momentum confirmation in trending markets.
 *
 * The indicator supports multiple price sources (close, open, high, low, hl2, hlc3, ohlc4)
 * allowing for flexible analysis based on different price components and reducing noise
 * through price averaging techniques.
 *
 * Trading Interpretation:
 * - Positive Values: Current price > price n periods ago (bullish momentum)
 * - Negative Values: Current price < price n periods ago (bearish momentum)
 * - Zero Line: Current price = price n periods ago (neutral momentum)
 * - Increasing Values: Accelerating upward momentum
 * - Decreasing Values: Decelerating momentum or increasing downward pressure
 * - Extreme Values: Potential overbought/oversold conditions
 *
 * Signal Generation:
 * - Zero Line Crossovers: Primary trend change signals
 * - Momentum crossing above zero: Bullish signal
 * - Momentum crossing below zero: Bearish signal
 * - Divergence Analysis: Price vs momentum divergences indicate potential reversals
 * - Momentum Peaks/Troughs: Early warnings of trend exhaustion
 *
 * Strategy Applications:
 * - Trend Confirmation: Validate price movements with momentum alignment
 * - Early Warning System: Detect momentum shifts before price changes
 * - Overbought/Oversold: Identify extreme momentum conditions
 * - Divergence Trading: Trade momentum-price divergences for reversals
 *
 * Formula: MOM = Current Price - Price[n periods ago]
 * Where n is the lookback period and price source is configurable
 *
 * Candle Input Type: OHLC (supports all standard price components and averages)
 *
 * @see https://en.wikipedia.org/wiki/Momentum_(technical_analysis)
 * @see https://www.investopedia.com/terms/m/momentum.asp
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:momentum
 */
export class MOM extends LightIndicator<PercentileResult, OHLC> {
  // Percentile calculator for percentile tracking
  private readonly _percentileCalc?: PercentileCalculator

  /**
   * Creates a new Momentum indicator
   *
   * @param interval Period to calculate momentum over (typically 10-30). This determines
   *                 how far back to look when comparing current price to historical price.
   *                 Common values: 10 (short-term), 14 (standard), 20 (medium-term), 30 (long-term).
   *                 Shorter periods are more sensitive but generate more signals.
   * @param source Price source from candle ('close', 'open', 'high', 'low', 'hl2', 'hlc3', 'ohlc4').
   *               'close' is most common, 'hlc3' reduces noise, 'hl2' focuses on range midpoint.
   * @param percentile Whether to calculate percentile rank of momentum values for historical context.
   *                   Helps identify extreme momentum readings relative to recent performance.
   * @param percentileLookback Lookback period for percentile calculation (typically 50-200).
   *                           Larger values provide more stable percentile rankings.
   * @param percentilePercentage Percentile percentage to use for ranking (default: 50 for median).
   *                            Common values: 25, 50, 75, 90 for different threshold analysis.
   */
  constructor(
    interval: number,
    private readonly _source: SourceType,
    percentile?: boolean,
    percentileLookback?: number,
    percentilePercentage?: number,
  ) {
    /**
     * Initializes the parent LightIndicator with:
     * @param historyLength interval - Needs historical data equal to momentum period for comparison
     * @param defaultValue ohlcValue - Function to extract OHLC candle data for price source selection
     * @param stateSize lastIndexOfEnum(MOMState) - Storage for momentum value (1 element)
     * @param fillValue undefined - Uses default fill behavior, returns null until history filled
     */
    super(interval + 1, ohlcValue, lastIndexOfEnum(MOMState))

    // Initialize percentile calculator if needed
    if (percentile && percentileLookback) {
      this._percentileCalc = new PercentileCalculator(
        percentileLookback,
        percentilePercentage,
      )
    }
  }

  /**
   * Called by the parent class in next() to calculate indicator value
   * based on current history
   *
   * @returns Momentum calculation result or null if not enough data
   */
  protected calculate(): PercentileResult | null {
    const s = this._state
    const h = this._history
    // Need to wait until we have enough data
    if (!h.isFilled) {
      return null
    }

    // Store the momentum value in state
    s[MOMState.VALUE] =
      this.getPriceFromSource(h.last) - this.getPriceFromSource(h.older)

    // Update percentile if needed
    if (this._percentileCalc) {
      if (this._percentileCalc.insert(s[MOMState.VALUE])) {
        return {
          value: s[MOMState.VALUE],
          percentile: this._percentileCalc.getPercentile(),
        }
      }
    }

    return {
      value: s[MOMState.VALUE],
    }
  }

  /**
   * Extract price value from candle based on source type
   *
   * @param candle The price candle
   * @returns Price value based on selected source
   */
  private getPriceFromSource(candle: OHLC): number {
    switch (this._source) {
      case 'close':
        return candle.close
      case 'open':
        return candle.open
      case 'high':
        return candle.high
      case 'low':
        return candle.low
      case 'hl2':
        return hl2(candle.high, candle.low)
      case 'hlc3':
        return hlc3(candle.high, candle.low, candle.close)
      case 'ohlc4':
        return ohlc4(candle.open, candle.high, candle.low, candle.close)
      default:
        return candle.close
    }
  }

  /**
   * Export the current state of the indicator
   */
  exportState(): LightIndicatorState {
    return {
      bin: [],
      circ: [],
      child: [],
      parent: super.exportState(),
      percentile: this._percentileCalc?.exportState(),
    }
  }

  /**
   * Restore the indicator state from a previously exported state
   */
  restoreState(state: any): void {
    if (!state.parent) {
      throw new Error('Invalid state: parent state is missing')
    }
    // Restore the state of the parent class
    super.restoreState(state.parent)

    // Restore the percentile calculator state if it exists
    if (this._percentileCalc && state.percentile?.length) {
      this._percentileCalc.restoreState(state.percentile)
    }
  }
}
