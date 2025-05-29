import { Sum } from '../Sum/Sum'
import { HLC } from '../types/candles'
import { PercentileResult } from '../types/result'
import {
  LightIndicator,
  LightIndicatorState,
  hlcValue,
  lastIndexOfEnum,
} from '../util'
import { PercentileCalculator } from '../util/percentile'

// State indices for the UltimateOscillator
enum UOState {
  FAST = 0, // Fast period
  MIDDLE = 1, // Middle period
  SLOW = 2, // Slow period
  VALUE = 3, // UO value
  BP = 4, // Buying pressure
  TR = 5, // True range
}

/**
 * Ultimate Oscillator (UO)
 * Type: Momentum Oscillator (Multi-Timeframe)
 *
 * The Ultimate Oscillator is an advanced momentum indicator developed by Larry Williams
 * in 1976 that incorporates three different timeframes to provide a more comprehensive
 * view of price momentum. Unlike traditional oscillators that rely on a single timeframe,
 * the Ultimate Oscillator combines short, medium, and long-term price movements to
 * reduce false signals and improve the reliability of momentum readings.
 *
 * The indicator measures buying pressure relative to true range across multiple periods,
 * creating a weighted average that emphasizes shorter timeframes while incorporating
 * longer-term perspective. This multi-timeframe approach helps filter out noise and
 * provides more reliable overbought and oversold signals, particularly in trending markets.
 *
 * Williams designed the Ultimate Oscillator to address the limitations of single-period
 * oscillators, which can generate excessive false signals during strong trends. By
 * incorporating multiple timeframes with different weights, the indicator maintains
 * sensitivity to short-term changes while avoiding the whipsaw action common in
 * other momentum oscillators.
 *
 * Key Characteristics:
 * - Multi-timeframe analysis (typically 7, 14, 28 periods)
 * - Range-bound oscillator (0-100 scale)
 * - Reduced false signals compared to single-period oscillators
 * - Excellent divergence detection capabilities
 * - Weighted combination favoring shorter timeframes
 *
 * Trading Interpretation:
 * - 0-30: Oversold zone, potential buying opportunity
 * - 30-70: Neutral zone, trend continuation likely
 * - 70-100: Overbought zone, potential selling opportunity
 * - Above 70 followed by decline below 50: Sell signal
 * - Below 30 followed by rise above 50: Buy signal
 * - Extreme readings (below 20 or above 80): High-probability reversal zones
 *
 * Williams' Three-Step Method:
 * 1. Bullish Divergence occurs when UO makes higher lows while price makes lower lows
 * 2. UO falls below 30 (oversold condition)
 * 3. UO rises above its prior reaction high (confirmation)
 *
 * The opposite applies for bearish signals with overbought conditions above 70.
 *
 * Advanced Analysis Techniques:
 * - Divergence Analysis: Primary signal generation method
 * - Multiple Timeframe Confirmation: Align with longer-term trends
 * - Failure Swings: Failed attempts to reach new extremes
 * - Momentum Confirmation: Confirm breakouts and trend changes
 * - Support/Resistance: UO can form its own S/R levels
 *
 * Strategy Applications:
 * - Divergence Trading: Primary use case for reversal signals
 * - Overbought/Oversold Trading: Mean reversion in ranging markets
 * - Trend Confirmation: Momentum direction confirms price trends
 * - Entry Timing: Precise timing for position entries
 * - Risk Management: Avoid new positions at extreme readings
 *
 * Market Condition Adaptations:
 * - Trending Markets: Focus on divergences, ignore simple overbought/oversold
 * - Range-bound Markets: Use standard 30/70 levels for reversal trades
 * - Volatile Markets: Multi-timeframe approach provides stability
 * - Low Volatility: May need different period combinations for sensitivity
 *
 * Parameter Guidelines:
 * - Fast Period: 7 (standard), 5-10 (alternative range)
 * - Medium Period: 14 (standard), 10-20 (alternative range)
 * - Slow Period: 28 (standard), 20-35 (alternative range)
 * - Ratio should typically be 1:2:4 for balanced weighting
 *
 * Advantages:
 * - Reduced false signals through multi-timeframe analysis
 * - Excellent divergence detection capabilities
 * - Less prone to whipsaws than single-period oscillators
 * - Works well in both trending and ranging markets
 * - Comprehensive momentum measurement
 *
 * Limitations:
 * - More complex calculation and interpretation
 * - Slower signal generation due to multiple timeframes
 * - Still can generate false signals in choppy markets
 * - Requires confirmation from other indicators
 * - Less intuitive than simple oscillators
 *
 * Formula:
 * - Buying Pressure (BP) = Close - Min(Low, Previous Close)
 * - True Range (TR) = Max(High, Previous Close) - Min(Low, Previous Close)
 * - Average7 = 7-period sum of BP / 7-period sum of TR
 * - Average14 = 14-period sum of BP / 14-period sum of TR
 * - Average28 = 28-period sum of BP / 28-period sum of TR
 * - UO = 100 × [(4 × Average7) + (2 × Average14) + Average28] / (4 + 2 + 1)
 *
 * Candle Input Type: HLC (High, Low, Close prices required; previous Close needed for calculations)
 *
 * @see https://www.investopedia.com/terms/u/ultimateoscillator.asp
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:ultimate_oscillator
 * @see https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/ultimate-oscillator
 */
export class UltimateOscillator extends LightIndicator<PercentileResult, HLC> {
  // Sum instances for BP and TR calculations
  private readonly avgBPFast: Sum
  private readonly avgBPMiddle: Sum
  private readonly avgBPSlow: Sum
  private readonly avgTRFast: Sum
  private readonly avgTRMiddle: Sum
  private readonly avgTRSlow: Sum

  // Percentile calculator for history tracking
  private readonly _percentileCalc?: PercentileCalculator

  /**
   * Creates a new Ultimate Oscillator indicator
   *
   * @param f The fast period - shortest timeframe for momentum analysis (typically 7).
   *          This period provides the most responsive component of the oscillator.
   *          Common values: 5-10, with 7 being the standard
   * @param m The middle period - intermediate timeframe (typically 14).
   *          This period provides balanced sensitivity between fast and slow components.
   *          Common values: 10-20, with 14 being the standard
   * @param s The slow period - longest timeframe for stability (typically 28).
   *          This period provides the smoothing component to reduce false signals.
   *          Common values: 20-35, with 28 being the standard
   * @param percentile Whether to calculate percentile ranking of UO values.
   *                  When enabled, provides additional context by showing where
   *                  current UO stands relative to historical UO values
   * @param percentileLookback Lookback period for percentile calculation.
   *                          Only used when percentile=true. Determines the historical
   *                          window for ranking current UO value
   * @param percentilePercentage Percentile threshold for comparison (0-1).
   *                            Only used when percentile=true. For example, 0.8 means
   *                            checking if current UO is in top 20% of historical values
   */
  constructor(
    f: number,
    m: number,
    s: number,
    percentile?: boolean,
    percentileLookback?: number,
    percentilePercentage?: number,
  ) {
    /**
     * Initialize Ultimate Oscillator with LightIndicator base class
     *
     * @param historyLength 2 - Needs current and previous HLC candles.
     *                      Current candle for High/Low/Close, previous Close for calculations
     * @param defaultValue hlcValue - Function to extract HLC data from candle input
     * @param stateSize lastIndexOfEnum(UOState) - State array size from UOState enum.
     *                  Stores: fast period, middle period, slow period, UO value, buying pressure, true range
     * @param fillValue undefined - Uses default LightIndicator behavior (returns null until ready)
     */
    super(2, hlcValue, lastIndexOfEnum(UOState)) // 2 history entries, 6 state values
    // Store period values in state array
    this._state[UOState.FAST] = f
    this._state[UOState.MIDDLE] = m
    this._state[UOState.SLOW] = s

    // Initialize Sum instances
    this.avgBPFast = new Sum(f)
    this.avgBPMiddle = new Sum(m)
    this.avgBPSlow = new Sum(s)
    this.avgTRFast = new Sum(f)
    this.avgTRMiddle = new Sum(m)
    this.avgTRSlow = new Sum(s)

    // Initialize percentile calculator if needed
    if (percentile && percentileLookback) {
      this._percentileCalc = new PercentileCalculator(
        percentileLookback,
        percentilePercentage,
      )
    }
  }

  /**
   * Calculates UO value from a candle
   *
   * @param candle The current candle
   * @returns The calculated UO value or undefined if not enough data
   */
  calculate(): PercentileResult | null {
    const s = this._state
    const h = this._history
    const l = h.last
    const p = h.prev
    const avgTRFast = this.avgTRFast
    const avgTRMiddle = this.avgTRMiddle
    const avgTRSlow = this.avgTRSlow
    const avgBPFast = this.avgBPFast
    const avgBPMiddle = this.avgBPMiddle
    const avgBPSlow = this.avgBPSlow
    if (!h.isFilled) {
      return null
    }

    s[UOState.BP] = l.close - Math.min(l.low, p.close)
    s[UOState.TR] = Math.max(l.high, p.close) - Math.min(l.low, p.close)

    // Update all sums
    avgBPFast.next(s[UOState.BP])
    avgTRFast.next(s[UOState.TR])
    avgBPMiddle.next(s[UOState.BP])
    avgTRMiddle.next(s[UOState.TR])
    avgBPSlow.next(s[UOState.BP])
    avgTRSlow.next(s[UOState.TR])

    // Check if all sums are stable
    if (
      avgBPFast.result !== null &&
      avgTRFast.result !== null &&
      avgBPMiddle.result !== null &&
      avgTRMiddle.result !== null &&
      avgBPSlow.result !== null &&
      avgTRSlow.result !== null
    ) {
      // Store the result in state
      s[UOState.VALUE] =
        (100 *
          (4 *
            (avgTRFast.result === 0 ? 0 : avgBPFast.result / avgTRFast.result) +
            2 *
              (avgTRMiddle.result === 0
                ? 0
                : avgBPMiddle.result / avgTRMiddle.result) +
            (avgTRSlow.result === 0
              ? 0
              : avgBPSlow.result / avgTRSlow.result))) /
        7

      // Update percentile if needed
      if (this._percentileCalc) {
        if (this._percentileCalc.insert(s[UOState.VALUE])) {
          return {
            value: s[UOState.VALUE],
            percentile: this._percentileCalc.getPercentile(),
          }
        }
      }

      return {
        value: s[UOState.VALUE],
      }
    }

    return null
  }

  /**
   * Export the current state of the indicator
   */
  exportState(): LightIndicatorState {
    return {
      bin: [],
      circ: [],
      child: [
        this.avgBPFast.exportState(),
        this.avgBPMiddle.exportState(),
        this.avgBPSlow.exportState(),
        this.avgTRFast.exportState(),
        this.avgTRMiddle.exportState(),
        this.avgTRSlow.exportState(),
      ],
      parent: super.exportState(),
      percentile: this._percentileCalc?.exportState(),
    }
  }

  /**
   * Restore the indicator state from a previously exported state
   */
  restoreState(state: Record<string, any>): void {
    if (!state.parent) {
      throw new Error('Invalid state: parent state is missing')
    }
    if (!state.child?.length) {
      throw new Error('Invalid state: child state is missing')
    }
    // Restore the state of the sums
    this.avgBPFast.restoreState(state.child[0])
    this.avgBPMiddle.restoreState(state.child[1])
    this.avgBPSlow.restoreState(state.child[2])
    this.avgTRFast.restoreState(state.child[3])
    this.avgTRMiddle.restoreState(state.child[4])
    this.avgTRSlow.restoreState(state.child[5])
    super.restoreState(state.parent)

    // Restore the percentile calculator state if it exists
    if (this._percentileCalc && state.percentile?.length) {
      this._percentileCalc.restoreState(state.percentile)
    }
  }
}
