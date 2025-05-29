import { WSMA } from '../WSMA/WSMA'
import { PercentileResult } from '../types/result'
import { gt, eq, PercentileCalculator, lastIndexOfEnum } from '../util'
import { LightIndicator, LightIndicatorState } from '../util/indicator'

// Define state indices for performance and readability
enum RSIState {
  PREV_PRICE = 0, // Previous price value
  HAS_PREV_PRICE = 1, // Flag indicating if we have a previous price (1=true, 0=false)
  GAIN_VALUE = 2, // Current gain value
  LOSS_VALUE = 3, // Current loss value
  RSI_VALUE = 4, // Current RSI value
}

/**
 * Relative Strength Index (RSI)
 * Type: Momentum Oscillator
 *
 * The Relative Strength Index (RSI) is one of the most widely used and respected momentum
 * oscillators in technical analysis, developed by J. Welles Wilder Jr. in 1978. RSI measures
 * the speed and magnitude of recent price changes to evaluate overbought and oversold
 * conditions in asset prices, oscillating between 0 and 100.
 *
 * RSI calculates the ratio of recent upward price movements to recent downward price movements,
 * then normalizes this ratio to create an oscillator. The indicator uses Wilder's smoothing
 * method (Running Moving Average) to calculate average gains and losses, providing a smoother
 * and more reliable signal than simple moving averages.
 *
 * The genius of RSI lies in its ability to identify potential reversal points by highlighting
 * when an asset may be trading at unsustainable levels. Unlike simple price momentum indicators,
 * RSI provides a normalized view that makes it comparable across different securities and
 * time periods, regardless of absolute price levels.
 *
 * Key Features:
 * - Bounded oscillator (0-100 range) for consistent interpretation
 * - Uses Wilder's smoothing for stable, reliable signals
 * - Excellent for divergence analysis with price action
 * - Adaptable to different market conditions and timeframes
 * - Foundation for many other technical indicators and strategies
 *
 * Trading Interpretation:
 * - 0-30: Oversold zone, potential buying opportunity (especially below 20)
 * - 30-70: Neutral zone, trend continuation likely
 * - 70-100: Overbought zone, potential selling opportunity (especially above 80)
 * - RSI crossing 30 upward: Potential end of oversold condition (bullish)
 * - RSI crossing 70 downward: Potential end of overbought condition (bearish)
 * - RSI above 50: Generally bullish momentum
 * - RSI below 50: Generally bearish momentum
 *
 * Advanced Analysis Techniques:
 * - Divergences: RSI moving opposite to price direction signals potential reversals
 * - Failure Swings: RSI failing to confirm new price highs/lows indicates weakness
 * - Centerline Crossovers: RSI crossing 50 confirms momentum direction changes
 * - Multiple Timeframe Analysis: Compare RSI across different timeframes for confluence
 * - Support/Resistance: RSI can form its own support and resistance levels
 *
 * Strategy Applications:
 * - Mean Reversion: Trade reversals from extreme overbought/oversold levels
 * - Trend Confirmation: Use RSI direction to confirm price trend validity
 * - Entry Timing: Enter trades when RSI confirms price action signals
 * - Exit Signals: Close positions when RSI reaches opposite extreme
 * - Risk Management: Avoid new positions when RSI shows conflicting signals
 *
 * Market Condition Adaptations:
 * - Trending Markets: Use 80/20 levels instead of 70/30 for fewer false signals
 * - Range-bound Markets: Standard 70/30 levels work well for reversal trades
 * - Volatile Markets: Consider longer periods (21-30) for smoother signals
 * - Low Volatility: Shorter periods (7-10) may provide more timely signals
 *
 * Formula:
 * - RS = Average Gain / Average Loss (using Wilder's smoothing)
 * - RSI = 100 - (100 / (1 + RS))
 * - Average Gain = RMA of upward price changes over n periods
 * - Average Loss = RMA of downward price changes over n periods
 * - Standard period: 14 (Wilder's original recommendation)
 *
 * Candle Input Type: Numeric (typically Close price, but can use any price series)
 *
 * @see https://www.investopedia.com/terms/r/rsi.asp
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:relative_strength_index_rsi
 * @see https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/rsi
 */
export class RSI extends LightIndicator<PercentileResult> {
  // Component indicators
  private readonly avgGain: WSMA
  private readonly avgLoss: WSMA
  private readonly maxValue = 100

  // Percentile calculator for statistical analysis
  private percentileCalc?: PercentileCalculator

  /**
   * Creates a new RSI indicator
   *
   * @param interval Number of periods to look back for RSI calculation (typically 14).
   *                Wilder's original recommendation was 14 periods, providing a good balance
   *                between sensitivity and smoothness. Common alternatives:
   *                - 7-10: More sensitive, faster signals, more noise
   *                - 21-30: Less sensitive, smoother signals, fewer false signals
   *                - 9: Popular for short-term trading
   *                - 25: Popular for longer-term analysis
   * @param percentile Whether to calculate percentile ranking of RSI values.
   *                  When enabled, provides additional context by showing where
   *                  current RSI stands relative to historical RSI values
   * @param percentileLookback How many periods to use for percentile calculation.
   *                          Only used when percentile=true. Determines the historical
   *                          window for ranking current RSI value (e.g., 100 periods)
   * @param percentilePercentage Percentile value to use for comparison (0-1).
   *                            Only used when percentile=true. For example, 0.8 means
   *                            checking if current RSI is in top 20% of historical values
   */
  constructor(
    public readonly interval: number,
    private percentile?: boolean,
    private percentileLookback?: number,
    private percentilePercentage?: number,
  ) {
    /**
     * Initialize RSI indicator with LightIndicator base class
     *
     * @param historyLength 1 - RSI only needs the current price value for calculation.
     *                      Price changes are calculated from state, not history
     * @param defaultValue 0 - Default numeric value (unused since we return null until ready)
     * @param stateSize lastIndexOfEnum(RSIState) - State array size calculated from RSIState enum.
     *                  Stores: previous price, has-previous-price flag, gain value, loss value, RSI value
     * @param fillValue NaN - Returns NaN when RSI cannot be calculated yet (insufficient data)
     */
    super(1, 0, lastIndexOfEnum(RSIState), NaN)

    // Create component indicators
    this.avgGain = new WSMA(this.interval)
    this.avgLoss = new WSMA(this.interval)

    // Initialize percentile calculator if requested
    if (this.percentile && this.percentileLookback) {
      this.percentileCalc = new PercentileCalculator(this.percentileLookback)
    }
  }

  /**
   * Calculate the RSI value
   */
  protected calculate(): PercentileResult | null {
    const s = this._state
    const currentPrice = this._history.last
    const avgLoss = this.avgLoss
    const avgGain = this.avgGain

    // If this is the first value, just store it and return null
    if (!s[RSIState.HAS_PREV_PRICE]) {
      s[RSIState.PREV_PRICE] = currentPrice
      s[RSIState.HAS_PREV_PRICE] = 1
      return null
    }

    // Calculate gain/loss
    if (gt(currentPrice, s[RSIState.PREV_PRICE])) {
      s[RSIState.GAIN_VALUE] = currentPrice - s[RSIState.PREV_PRICE]
      s[RSIState.LOSS_VALUE] = 0
    } else {
      s[RSIState.GAIN_VALUE] = 0
      s[RSIState.LOSS_VALUE] = s[RSIState.PREV_PRICE] - currentPrice
    }

    // Update moving averages
    avgLoss.next(s[RSIState.LOSS_VALUE])
    avgGain.next(s[RSIState.GAIN_VALUE])

    // Store current price for next calculation
    s[RSIState.PREV_PRICE] = currentPrice

    // Only proceed if we have valid results
    if (avgGain.result !== null && avgLoss.result !== null) {
      // Prevent division by zero
      if (eq(avgLoss.result, 0)) {
        // RSI is 100 when there's no loss
        s[RSIState.RSI_VALUE] = 100

        if (this.percentile && this.percentileCalc) {
          // If using percentile, insert the max RSI value (100)
          this.percentileCalc.insert(s[RSIState.RSI_VALUE])
          return null
        } else if (!this.percentile) {
          return {
            value: s[RSIState.RSI_VALUE],
          }
        }
        return null
      }

      // Calculate RSI
      s[RSIState.RSI_VALUE] =
        this.maxValue - this.maxValue / (avgGain.result / avgLoss.result + 1)

      // Handle percentile calculation if needed
      if (this.percentile && this.percentileCalc && this.percentilePercentage) {
        // Insert the RSI value into the percentile calculator

        if (this.percentileCalc.insert(s[RSIState.RSI_VALUE])) {
          return {
            value: s[RSIState.RSI_VALUE],
            percentile: this.percentileCalc.getPercentile(),
          }
        }
      }

      // Return the result
      return {
        value: s[RSIState.RSI_VALUE],
      }
    }

    return null
  }

  /**
   * Exports the state of the indicator for restoration later
   */
  override exportState(): LightIndicatorState {
    return {
      parent: super.exportState(),
      child: [this.avgGain.exportState(), this.avgLoss.exportState()],
      percentile: this.percentileCalc
        ? this.percentileCalc.exportState()
        : undefined,
      bin: [],
      circ: [],
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
      throw new Error('Invalid state: child state is missing or incomplete')
    }

    // Restore component states
    this.avgGain.restoreState(state.child[0])
    this.avgLoss.restoreState(state.child[1])

    // Restore percentile calculator if used
    if (this.percentileCalc && state.percentile) {
      this.percentileCalc.restoreState(state.percentile)
    }

    // Restore parent state
    super.restoreState(state.parent)
  }
}
