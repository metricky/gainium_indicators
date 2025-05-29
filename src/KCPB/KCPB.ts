import { LightIndicator, LightIndicatorState } from '../util/indicator'
import { PercentileResult } from '../types/result'
import { OHLCV } from '../types/candles'
import { KeltnerChannel } from '../KC/KC'
import { PercentileCalculator, lastIndexOfEnum, ohlcvValue } from '../util'

// Define state indices for performance and readability
enum KCPBState {
  BANDWIDTH = 0,
  VALUE = 1, // %B value
}

/**
 * Keltner Channel Percent B (KCPB)
 * Type: Oscillator/Volatility Indicator
 *
 * Keltner Channel %B is a momentum oscillator that shows where the current price
 * is positioned relative to the Keltner Channel bands. Similar to Bollinger Bands %B,
 * this indicator normalizes price position within the channel, making it easier to
 * identify overbought and oversold conditions across different securities and timeframes.
 *
 * The indicator oscillates around 0.5 (middle of the channel) and typically ranges
 * between 0 and 1, though it can exceed these bounds when price breaks through the
 * channel bands. This normalized approach makes it excellent for comparative analysis
 * and systematic trading strategies that rely on relative price positioning.
 *
 * KCPB is particularly useful because it combines the trend-following characteristics
 * of Keltner Channels with the oscillating nature of normalized indicators, providing
 * both trend context and momentum signals in a single measure.
 *
 * Trading Interpretation:
 * - 0.0-0.2: Price near lower band, potentially oversold conditions
 * - 0.2-0.4: Price in lower half of channel, below-average positioning
 * - 0.4-0.6: Price near middle of channel, neutral positioning
 * - 0.6-0.8: Price in upper half of channel, above-average positioning
 * - 0.8-1.0: Price near upper band, potentially overbought conditions
 * - Above 1.0: Price has broken above upper band, strong upward momentum
 * - Below 0.0: Price has broken below lower band, strong downward momentum
 *
 * Strategy Applications:
 * - Mean Reversion: Trade reversals when values reach extreme levels (0/1)
 * - Breakout Trading: Enter positions when values exceed 1.0 or fall below 0.0
 * - Trend Confirmation: Use with price action to confirm trend strength
 * - Range Trading: Buy near 0.2, sell near 0.8 in sideways markets
 *
 * Formula: KCPB = (Close - KC Lower Band) / (KC Upper Band - KC Lower Band)
 * Where KC bands are derived from Keltner Channel calculation
 *
 * Candle Input Type: OHLCV (Open, High, Low, Close, Volume) - passed through to underlying Keltner Channel
 *
 * @see https://www.investopedia.com/terms/k/keltnerchannel.asp
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:keltner_channels
 */
export class KeltnerChannelPB extends LightIndicator<PercentileResult, OHLCV> {
  private readonly kc: KeltnerChannel
  private percentileCalc?: PercentileCalculator

  /**
   * Creates a new Keltner Channel %B indicator
   *
   * @param kc The Keltner Channel indicator to use for band calculations. This KC instance
   *           should be properly configured with desired period and multiplier settings.
   * @param percentile Whether to calculate percentile ranking for the %B values. When enabled,
   *                   provides additional context about current reading relative to historical values.
   * @param percentileLookback Number of periods for percentile calculation (typically 50-200).
   *                           Only used when percentile is true. Larger values provide more stable
   *                           percentile rankings but reduce sensitivity to recent changes.
   * @param percentilePercentage Percentile level to use for ranking (default: 50 for median).
   *                            Common values: 25, 50, 75, 90 for different percentile thresholds.
   */
  constructor(
    kc: KeltnerChannel,
    percentile?: boolean,
    percentileLookback?: number,
    percentilePercentage?: number,
  ) {
    /**
     * Initializes the parent LightIndicator with:
     * @param historyLength 1 - Only needs current candle since KC does historical processing
     * @param defaultValue ohlcvValue - Function to extract OHLCV candle data for processing
     * @param stateSize lastIndexOfEnum(KCPBState) - Storage for bandwidth and %B value (2 elements)
     * @param fillValue NaN - Returns NaN during initialization until KC is ready
     */
    super(1, ohlcvValue, lastIndexOfEnum(KCPBState), NaN)

    // Store reference to the KC indicator
    this.kc = kc

    // Initialize percentile calculator if needed
    if (percentile && percentileLookback) {
      this.percentileCalc = new PercentileCalculator(
        percentileLookback,
        percentilePercentage,
      )
    }
  }

  /**
   * Calculate Keltner Channel %B value
   */
  protected calculate(): PercentileResult | null {
    const s = this._state
    const l = this._history.last
    const kc = this.kc

    // Update the KC indicator with current candle
    if (kc.next(l) === null) {
      return null
    }

    s[KCPBState.BANDWIDTH] = kc.result!.upper - kc.result!.lower

    // Calculate %B - position of price relative to bands
    s[KCPBState.VALUE] =
      s[KCPBState.BANDWIDTH] === 0
        ? 0.5
        : (l.close - kc.result!.lower) / s[KCPBState.BANDWIDTH]

    // Handle percentile calculation if needed
    if (this.percentileCalc) {
      if (this.percentileCalc.insert(s[KCPBState.VALUE])) {
        return {
          value: s[KCPBState.VALUE],
          percentile: this.percentileCalc.getPercentile(),
        }
      }
    }

    return {
      value: s[KCPBState.VALUE],
    }
  }

  /**
   * Exports the state of the indicator for restoration later
   */
  override exportState(): LightIndicatorState {
    return {
      bin: [],
      circ: [],
      parent: super.exportState(),
      child: [this.kc.exportState()],
      percentile: this.percentileCalc?.exportState(),
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

    if (!state.child?.length) {
      throw new Error('Invalid state: child states are missing')
    }

    // Restore KC indicator state
    this.kc.restoreState(state.child[0])

    // Restore percentile calculator if applicable
    if (this.percentileCalc && state.percentile) {
      this.percentileCalc.restoreState(state.percentile)
    }

    // Restore parent state
    super.restoreState(state.parent)
  }
}
