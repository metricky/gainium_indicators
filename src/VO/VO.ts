import { EMA } from '../EMA/EMA'
import { round } from '../util/math'
import { LightIndicator, LightIndicatorState } from '../util/indicator'
import { PercentileCalculator } from '../util/percentile'
import { PercentileResult } from '../types/result'
import { lastIndexOfEnum } from '../util'

// Define state indices for VO
enum VOState {
  VALUE = 0, // Current VO value
}

/**
 * Volume Oscillator (VO)
 * Type: Volume Analysis / Momentum (Volume-Based)
 *
 * The Volume Oscillator is a technical indicator that measures the relationship between
 * two volume-based moving averages to identify volume momentum and potential trend
 * changes. It calculates the percentage difference between a short-term and long-term
 * exponential moving average of volume, providing insights into the underlying strength
 * or weakness of price movements through volume analysis.
 *
 * Volume is often considered a leading indicator of price movement, as significant
 * volume changes typically precede major price movements. The Volume Oscillator
 * helps traders identify when volume patterns are shifting, which can signal
 * potential trend reversals, breakouts, or continuation patterns before they
 * become apparent in price action alone.
 *
 * The oscillator fluctuates around a zero line, with positive values indicating
 * that recent volume (short-term EMA) is above the longer-term average, suggesting
 * increasing volume momentum. Negative values indicate decreasing volume momentum,
 * which may signal weakening interest in the current price trend.
 *
 * Key Characteristics:
 * - Volume-based momentum oscillator centered around zero
 * - Uses exponential moving averages for responsive volume analysis
 * - Provides early warning signals through volume pattern changes
 * - Excellent for confirming price movements and identifying divergences
 * - Helps distinguish between strong and weak price movements
 *
 * Trading Interpretation:
 * - Positive values (>0): Volume momentum is bullish, increasing participation
 * - Negative values (<0): Volume momentum is bearish, decreasing participation
 * - Rising VO: Increasing volume momentum, strengthening current trend
 * - Falling VO: Decreasing volume momentum, potential trend weakness
 * - VO crossing above zero: Bullish volume signal, potential uptrend
 * - VO crossing below zero: Bearish volume signal, potential downtrend
 * - Extreme readings: Very high/low values may indicate oversold/overbought conditions
 *
 * Volume-Price Relationship Analysis:
 * - Rising prices + Rising VO: Strong bullish trend confirmation
 * - Rising prices + Falling VO: Bearish divergence, potential reversal warning
 * - Falling prices + Falling VO: Strong bearish trend confirmation
 * - Falling prices + Rising VO: Bullish divergence, potential reversal warning
 * - Breakouts + Rising VO: High-probability breakout confirmation
 * - Breakouts + Falling VO: Weak breakout, potential false signal
 *
 * Advanced Analysis Techniques:
 * - Divergence Analysis: Primary signal when VO diverges from price direction
 * - Zero Line Crossovers: Trend change confirmation signals
 * - Volume Spike Detection: Identify unusual volume activity
 * - Trend Strength Assessment: Measure the volume support behind price trends
 * - Breakout Confirmation: Validate price breakouts with volume momentum
 *
 * Strategy Applications:
 * - Trend Confirmation: Confirm price trends with volume momentum
 * - Divergence Trading: Trade when VO diverges from price action
 * - Breakout Trading: Confirm breakouts with volume momentum
 * - Entry Timing: Enter positions when volume momentum supports price direction
 * - Exit Signals: Exit when volume momentum weakens (VO divergence)
 * - Risk Management: Avoid trades when volume momentum conflicts with price
 *
 * Market Condition Adaptations:
 * - Trending Markets: Focus on VO direction to confirm trend strength
 * - Range-bound Markets: Use zero line crossovers for directional bias
 * - Volatile Markets: Volume analysis helps distinguish real moves from noise
 * - Low Volume Periods: VO may be less reliable, combine with other indicators
 * - News Events: Monitor VO spikes for volume-driven price movements
 *
 * Parameter Guidelines:
 * - Short Period: 5-14 (common: 7, 10, 12) - more responsive to recent volume
 * - Long Period: 21-50 (common: 21, 25, 30) - provides volume baseline
 * - Ratio: Typically 1:2 to 1:3 (e.g., 12/25, 10/30) for balanced sensitivity
 * - Shorter periods: More sensitive, faster signals, more noise
 * - Longer periods: Smoother signals, fewer false signals, slower response
 *
 * Advantages:
 * - Provides volume-based confirmation of price movements
 * - Early warning system through volume momentum changes
 * - Excellent for divergence analysis
 * - Helps identify strong vs. weak price movements
 * - Useful across different market conditions and timeframes
 * - Simple interpretation with clear directional signals
 *
 * Limitations:
 * - Less effective in markets with consistently low volume
 * - Can generate false signals during volume spikes unrelated to trends
 * - Requires volume data (not applicable to some markets/instruments)
 * - May lag during sudden volume changes
 * - Should be combined with price-based indicators for confirmation
 *
 * Formula:
 * - Short EMA = EMA(Volume, Short Period)
 * - Long EMA = EMA(Volume, Long Period)
 * - VO = ((Short EMA - Long EMA) / Long EMA) × 100
 *
 * The percentage calculation allows for easy interpretation and comparison
 * across different securities regardless of their absolute volume levels.
 *
 * Candle Input Type: Numeric (Volume data required)
 *
 * @see https://www.investopedia.com/terms/v/volume-oscillator.asp
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:volume_oscillator
 */
export class VO extends LightIndicator<PercentileResult, number> {
  // Component indicators
  private readonly shortEma: EMA
  private readonly longEma: EMA

  // Optional percentile calculator
  private readonly percentileCalc?: PercentileCalculator

  /**
   * Creates a new Volume Oscillator indicator
   *
   * @param shortlen Period for the short-term EMA of volume (typically 5-14).
   *                This determines the responsiveness to recent volume changes.
   *                Common values:
   *                - 5-7: Very responsive, good for short-term trading
   *                - 10-12: Balanced sensitivity, popular for swing trading
   *                - 14: Standard setting for intermediate-term analysis
   * @param longlen Period for the long-term EMA of volume (typically 21-50).
   *               This provides the volume baseline for comparison.
   *               Common values:
   *               - 21-25: Intermediate baseline, good balance
   *               - 30: Standard setting for longer-term context
   *               - 50: Longer-term baseline, smoother signals
   * @param percentile Whether to calculate percentile ranking of VO values.
   *                  When enabled, provides additional context by showing where
   *                  current VO stands relative to historical VO values
   * @param percentileLookback Lookback period for percentile calculation.
   *                          Only used when percentile=true. Determines the historical
   *                          window for ranking current VO value
   * @param percentilePercentage Percentile threshold for comparison (0-1).
   *                            Only used when percentile=true. For example, 0.8 means
   *                            checking if current VO is in top 20% of historical values
   */
  constructor(
    public readonly shortlen: number,
    public readonly longlen: number,
    private readonly percentile?: boolean,
    private readonly percentileLookback?: number,
    private readonly percentilePercentage?: number,
  ) {
    /**
     * Initialize Volume Oscillator with LightIndicator base class
     *
     * @param historyLength 1 - Only needs current volume value for calculation.
     *                      Historical data is managed by component EMA indicators
     * @param defaultValue 0 - Default numeric value for volume data
     * @param stateSize lastIndexOfEnum(VOState) - State array size from VOState enum.
     *                  Stores: current VO value
     * @param fillValue undefined - Uses default LightIndicator behavior (returns null until ready)
     */
    super(1, 0, lastIndexOfEnum(VOState))

    // Initialize component indicators
    this.shortEma = new EMA(this.shortlen)
    this.longEma = new EMA(this.longlen)

    // Initialize percentile calculator if needed
    if (this.percentile && this.percentileLookback) {
      this.percentileCalc = new PercentileCalculator(
        this.percentileLookback,
        this.percentilePercentage,
      )
    }
  }

  /**
   * Calculate VO based on short and long EMAs of volume
   */
  protected calculate(): PercentileResult | null {
    const s = this._state
    const volume = this._history.last
    const shortEma = this.shortEma
    const longEma = this.longEma

    // Calculate EMAs
    shortEma.next(volume)
    longEma.next(volume)
    if (shortEma.result === null || longEma.result === null) {
      return null
    }

    // Calculate Volume Oscillator: ((Short EMA - Long EMA) / Long EMA) * 100
    s[VOState.VALUE] = round(
      100 * ((shortEma.result! - longEma.result!) / longEma.result!),
    )

    // Calculate percentile if needed
    if (this.percentileCalc) {
      if (this.percentileCalc.insert(s[VOState.VALUE])) {
        return {
          value: s[VOState.VALUE],
          percentile: this.percentileCalc.getPercentile(),
        }
      }
    }

    return {
      value: s[VOState.VALUE],
    }
  }

  /**
   * Export indicator state
   */
  override exportState(): LightIndicatorState {
    return {
      bin: [],
      circ: [],
      child: [this.shortEma.exportState(), this.longEma.exportState()],
      parent: super.exportState(),
      percentile: this.percentileCalc?.exportState(),
    }
  }

  /**
   * Restore indicator state
   */
  override restoreState(state: LightIndicatorState): void {
    if (!state.parent) {
      throw new Error('Invalid state: parent state is missing')
    }

    if (!state.child) {
      throw new Error('Invalid state: child state is missing')
    }

    // Restore component indicators
    this.shortEma.restoreState(state.child[0])
    this.longEma.restoreState(state.child[1])

    // Restore percentile calculator if available
    if (this.percentileCalc && state.percentile) {
      this.percentileCalc.restoreState(state.percentile)
    }

    // Restore parent state
    super.restoreState(state.parent)
  }
}
