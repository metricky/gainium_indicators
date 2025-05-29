import { SMA } from '../SMA/SMA'
import { lastIndexOfEnum } from '../util'
import { LightIndicator } from '../util/indicator'

// Define state indices for clarity
enum WSMAState {
  CURRENT_VALUE = 0,
}

/**
 * Wilder's Smoothed Moving Average (WSMA)
 * Type: Trend-Following / Smoothing
 *
 * The Wilder's Smoothed Moving Average (WSMA), also known as the Modified Exponential
 * Moving Average (MEMA) or Smoothed Moving Average (SMMA), was developed by J. Welles
 * Wilder Jr., the creator of many popular technical indicators including RSI, ATR,
 * and Parabolic SAR. This indicator provides a unique approach to price smoothing
 * that responds more gradually to price changes than traditional exponential moving averages.
 *
 * The WSMA uses a fixed smoothing factor of 1/period, which is significantly smaller
 * than the 2/(period+1) factor used in standard EMAs. This creates a moving average
 * that is much smoother and less reactive to short-term price fluctuations, making
 * it particularly valuable for identifying longer-term trends and filtering out
 * market noise in volatile conditions.
 *
 * Wilder specifically designed this smoothing technique to work with his other
 * indicators, as he believed that traditional moving averages were too sensitive
 * to short-term price movements. The WSMA provides a more stable trend representation
 * while still maintaining sensitivity to significant price changes over time.
 *
 * Key Characteristics:
 * - Extremely smooth response to price changes with minimal whipsaws
 * - Uses 1/period smoothing factor (much smaller than EMA's 2/(period+1))
 * - Excellent noise filtering capabilities
 * - Slower to respond but more reliable trend identification
 * - Foundation for many of Wilder's other technical indicators
 *
 * Trading Interpretation:
 * - Rising WSMA: Established bullish trend with strong momentum
 * - Falling WSMA: Established bearish trend with strong momentum
 * - Price above WSMA: Long-term bullish bias, trend continuation expected
 * - Price below WSMA: Long-term bearish bias, trend continuation expected
 * - WSMA slope change: Significant trend direction change signal
 * - WSMA as support/resistance: Acts as strong dynamic support in uptrends, resistance in downtrends
 * - Crossover signals: Price crossing WSMA indicates potential major trend changes
 *
 * Smoothing Analysis:
 * - Noise Reduction: Extremely effective at filtering out short-term volatility
 * - Trend Persistence: Maintains trend direction longer than other moving averages
 * - Signal Quality: Fewer but higher-quality trend change signals
 * - Lag Characteristics: Slower response time but fewer false signals
 * - Stability: Maintains consistent values during minor price corrections
 *
 * Advanced Analysis Techniques:
 * - Trend Strength Assessment: Steep WSMA slope indicates strong trend momentum
 * - Support/Resistance Levels: WSMA provides reliable dynamic support/resistance
 * - Multiple Timeframes: Use WSMA across timeframes for trend hierarchy
 * - Confluence Analysis: Combine with other Wilder indicators (RSI, ATR, PSAR)
 * - Breakout Confirmation: WSMA direction change confirms trend breakouts
 *
 * Strategy Applications:
 * - Position Trading: Primary tool for long-term trend identification
 * - Trend Following: Enter positions in WSMA direction with high confidence
 * - Risk Management: Use WSMA as trailing stop for trend-following positions
 * - Market Bias: Determine overall market direction for shorter-term strategies
 * - Exit Strategy: Major WSMA direction changes signal position exits
 * - Entry Timing: Wait for price to return to WSMA in trending markets
 *
 * Market Condition Adaptations:
 * - Trending Markets: Excellent primary indicator for trend direction
 * - Volatile Markets: Superior noise filtering reduces false signals
 * - Range-bound Markets: May be slow to respond, combine with oscillators
 * - News-driven Markets: Helps identify if news created sustainable trend changes
 * - Low Volatility: Maintains trend definition when other MAs become choppy
 * - High Volatility: Provides stable reference point during market turbulence
 *
 * Parameter Guidelines:
 * - Short-term: 10-20 periods (still very smooth due to 1/period factor)
 * - Medium-term: 21-50 periods (balanced for swing trading)
 * - Long-term: 50+ periods (excellent for position trading)
 * - Wilder's Original: 14 periods (used in RSI and other Wilder indicators)
 * - Very Long-term: 100+ periods (major trend identification)
 *
 * Advantages:
 * - Exceptional noise filtering with minimal whipsaws
 * - Highly reliable trend identification
 * - Works well in volatile market conditions
 * - Provides strong support/resistance levels
 * - Foundation for other proven technical indicators
 * - Excellent for long-term trend analysis
 * - Reduces emotional trading decisions
 *
 * Limitations:
 * - Very slow to respond to trend changes
 * - May miss short-term trading opportunities
 * - Less effective in fast-moving markets requiring quick responses
 * - Can lag significantly during rapid trend reversals
 * - May not be suitable for short-term trading strategies
 *
 * Synonyms:
 * - Modified Exponential Moving Average (MEMA)
 * - Smoothed Moving Average (SMMA)
 * - Welles Wilder's Smoothing (WWS)
 * - Wilder's Moving Average (WMA)
 *
 * Formula: WSMA(t) = WSMA(t-1) + (Price(t) - WSMA(t-1)) / Period
 * Where: Smoothing Factor = 1/Period
 * Input Type: Numeric (single price value, typically Close)
 *
 * @see https://tlc.thinkorswim.com/center/reference/Tech-Indicators/studies-library/V-Z/WildersSmoothing
 * @see https://www.investopedia.com/terms/m/movingaverage.asp
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:moving_averages
 */
export class WSMA extends LightIndicator {
  private readonly sma: SMA
  private readonly smoothingFactor: number

  /**
   * Creates a Wilder's Smoothed Moving Average indicator
   *
   * @param interval The smoothing period (typically 14, 21, or 50)
   *                 - 14: Wilder's original period, excellent balance
   *                 - 21: Good for swing trading applications
   *                 - 50: Longer-term trend identification
   *                 - Higher values: More smoothing, fewer signals
   */
  constructor(interval: number) {
    // Initialize with historyLength=1 (only needs current value),
    // defaultValue=0 (numeric input), stateSize=lastIndexOfEnum(WSMAState) (stores current WSMA value),
    // fillValue=NaN (until SMA provides initial value)
    super(1, 0, lastIndexOfEnum(WSMAState), NaN) // Only need to track one value, 2 state values
    this.sma = new SMA(interval)
    this.smoothingFactor = 1 / interval
  }

  protected calculate(): number | null {
    const s = this._state
    const sma = this.sma
    const l = this._history.last
    if (isNaN(s[WSMAState.CURRENT_VALUE]) && sma.next(l) !== null) {
      // Once SMA has a result, initialize WSMA with it
      s[WSMAState.CURRENT_VALUE] = sma.result!
      return s[WSMAState.CURRENT_VALUE]
    }

    if (!isNaN(s[WSMAState.CURRENT_VALUE])) {
      // Store the new WSMA value
      s[WSMAState.CURRENT_VALUE] =
        s[WSMAState.CURRENT_VALUE] +
        (l - s[WSMAState.CURRENT_VALUE]) * this.smoothingFactor
      return s[WSMAState.CURRENT_VALUE]
    }

    return null
  }
}
