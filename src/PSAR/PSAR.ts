import { LightIndicator } from '../util/indicator'
import { HLC } from '../types/candles'
import { hlcValue, lastIndexOfEnum } from '../util'

// Define state indices for performance and readability
enum PSARState {
  RESULT = 0, // Current SAR value
  ACCELERATION = 1, // Current acceleration factor
  IS_BELOW = 2, // Is SAR below price (uptrend) flag: 1 = true, 0 = false
  MAX_MIN = 3, // Extreme point (EP)
  IS_FIRST_TREND = 4, // Flag for first bar of new trend

  // Previous candles data
  PREV2_HIGH = 5, // High from two candles ago
  PREV2_LOW = 6, // Low from two candles ago

  // Candle counter for initialization
  CANDLE_COUNT = 7, // Number of candles processed
}

/**
 * Parabolic SAR (PSAR)
 * Type: Trend-Following/Trend Reversal Indicator
 *
 * The Parabolic SAR (Stop and Reverse) is a sophisticated trend-following indicator developed
 * by J. Welles Wilder Jr. in 1978. It serves dual purposes: identifying trend direction and
 * providing dynamic stop-loss levels that adjust based on price momentum. The indicator's
 * unique parabolic acceleration system makes it particularly effective at capturing trending
 * moves while providing early warnings of potential trend reversals.
 *
 * PSAR calculates a series of dots that appear either above or below price action. When dots
 * are below price, it indicates an uptrend; when above, a downtrend. The distance between
 * the SAR value and price dynamically adjusts based on the Acceleration Factor (AF), which
 * increases as the trend strengthens, creating the characteristic parabolic curve.
 *
 * The indicator's genius lies in its acceleration mechanism: it starts conservatively with
 * a small acceleration factor and gradually increases speed as the trend continues and new
 * extreme points are reached. This allows traders to stay with strong trends while tightening
 * stops as momentum builds.
 *
 * Trading Interpretation:
 * - SAR below price: Uptrend confirmed, potential long positions
 * - SAR above price: Downtrend confirmed, potential short positions
 * - SAR flip from below to above: Trend reversal signal (sell/exit long)
 * - SAR flip from above to below: Trend reversal signal (buy/exit short)
 * - Increasing SAR slope: Accelerating trend momentum
 * - Decreasing SAR slope: Decelerating trend momentum
 *
 * Key Features:
 * - Dynamic Stop-Loss System: SAR values serve as trailing stops
 * - Acceleration Mechanism: AF increases with trend strength up to maximum
 * - Time-Based Exits: Forces position evaluation at regular intervals
 * - Trend Continuity: Stays with trends until definitive reversal
 * - Early Reversal Detection: Sensitive to momentum changes
 *
 * Strategy Applications:
 * - Trend Following: Enter trades in direction of SAR indication
 * - Stop-Loss Placement: Use SAR values as dynamic trailing stops
 * - Exit Timing: Close positions when SAR reverses
 * - Trend Confirmation: Validate other signals with SAR direction
 * - Momentum Analysis: Monitor acceleration changes for trend strength
 *
 * Limitations:
 * - Whipsaw prone in sideways markets
 * - Less effective during low volatility periods
 * - Can generate late signals in very fast reversals
 * - Best suited for trending markets with clear momentum
 *
 * Formula:
 * - SAR[tomorrow] = SAR[today] + AF × (EP - SAR[today])
 * - AF starts at 0.02, increases by 0.02 for each new extreme, max 0.20
 * - EP = Extreme Point (highest high in uptrend, lowest low in downtrend)
 * - Reversal occurs when price crosses SAR value
 *
 * Candle Input Type: HLC (High, Low, Close required for trend analysis and extreme points)
 *
 * @see https://www.investopedia.com/terms/p/parabolicindicator.asp
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:parabolic_sar
 * @see https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/parabolic-sar
 */
export class PSAR extends LightIndicator<number, HLC> {
  /**
   * Creates a new Parabolic SAR (PSAR) indicator
   *
   * @param start Starting acceleration factor (default: 0.02). This is the initial AF value
   *              when a new trend begins. Lower values (0.01-0.015) create more conservative
   *              signals with tighter stops, while higher values (0.025-0.03) are more aggressive.
   *              Standard Wilder setting is 0.02 for balanced sensitivity.
   * @param inc Acceleration factor increment (default: 0.02). This amount is added to AF
   *            each time a new extreme point is reached during the trend. Smaller increments
   *            (0.01-0.015) slow acceleration for smoother signals, larger increments
   *            (0.025-0.04) increase acceleration for faster trend following.
   * @param max Maximum acceleration factor (default: 0.2). This caps the AF to prevent
   *            excessive acceleration that could cause premature reversals. Common range:
   *            0.15-0.25. Lower max values (0.1-0.15) for conservative approach, higher
   *            values (0.25-0.3) for aggressive trend following.
   */
  constructor(
    private readonly start: number = 0.02,
    private readonly inc: number = 0.02,
    private readonly max: number = 0.2,
  ) {
    /**
     * Initializes the parent LightIndicator with:
     * @param historyLength 3 - Needs current candle plus 2 previous candles for SAR limit calculations
     * @param defaultValue hlcValue - Function to extract HLC candle data for high/low/close analysis
     * @param stateSize lastIndexOfEnum(PSARState) - Storage for result, acceleration, trend flags, extreme points (8 elements)
     * @param fillValue 0 - Returns 0 during initialization until sufficient candles available
     */
    super(3, hlcValue, lastIndexOfEnum(PSARState), 0)
  }

  /**
   * Calculate Parabolic SAR value
   */
  protected calculate(): number | null {
    const s = this._state

    // Update candle count
    s[PSARState.CANDLE_COUNT]++

    // Need at least 2 candles to start calculation
    if (s[PSARState.CANDLE_COUNT] < 2) {
      return null
    }

    const h = this._history
    const l = h.last
    const p = h.prev
    const pp = h.prev2

    // On second candle, initialize trend
    if (s[PSARState.CANDLE_COUNT] === 2) {
      // Determine initial trend direction
      if (l.close > p.low) {
        // Using close vs low as a simple way to determine trend
        // Uptrend (SAR below price)
        s[PSARState.IS_BELOW] = 1
        s[PSARState.MAX_MIN] = l.high
        s[PSARState.RESULT] = p.low
      } else {
        // Downtrend (SAR above price)
        s[PSARState.IS_BELOW] = 0
        s[PSARState.MAX_MIN] = l.low
        s[PSARState.RESULT] = p.high
      }
      s[PSARState.IS_FIRST_TREND] = 1
      s[PSARState.ACCELERATION] = this.start
    } else {
      // Not first trend candle
      s[PSARState.IS_FIRST_TREND] = 0
    }

    // Get reference to previous candles
    const c2 = s[PSARState.CANDLE_COUNT] > 2 ? pp : p // Two candles ago

    // Calculate SAR value with current acceleration
    s[PSARState.RESULT] +=
      s[PSARState.ACCELERATION] * (s[PSARState.MAX_MIN] - s[PSARState.RESULT])

    // Check for trend reversal
    if (s[PSARState.IS_BELOW] === 1) {
      // Current trend is up (SAR below price)
      if (s[PSARState.RESULT] > l.low) {
        // Reverse to downtrend
        s[PSARState.IS_FIRST_TREND] = 1
        s[PSARState.IS_BELOW] = 0
        s[PSARState.RESULT] = Math.max(s[PSARState.MAX_MIN], l.high)
        s[PSARState.MAX_MIN] = l.low
        s[PSARState.ACCELERATION] = this.start
      }
    } else {
      // Current trend is down (SAR above price)
      if (s[PSARState.RESULT] < l.high) {
        // Reverse to uptrend
        s[PSARState.IS_FIRST_TREND] = 1
        s[PSARState.IS_BELOW] = 1
        s[PSARState.RESULT] = Math.min(s[PSARState.MAX_MIN], l.low)
        s[PSARState.MAX_MIN] = l.high
        s[PSARState.ACCELERATION] = this.start
      }
    }

    // If not a trend reversal, check for new extreme point
    if (s[PSARState.IS_FIRST_TREND] === 0) {
      if (s[PSARState.IS_BELOW] === 1) {
        // Uptrend - check for new high
        if (l.high > s[PSARState.MAX_MIN]) {
          s[PSARState.MAX_MIN] = l.high
          s[PSARState.ACCELERATION] = Math.min(
            (s[PSARState.ACCELERATION] || this.start) + this.inc,
            this.max,
          )
        }
      } else {
        // Downtrend - check for new low
        if (l.low < s[PSARState.MAX_MIN]) {
          s[PSARState.MAX_MIN] = l.low
          s[PSARState.ACCELERATION] = Math.min(
            (s[PSARState.ACCELERATION] || this.start) + this.inc,
            this.max,
          )
        }
      }
    }

    // Apply SAR value limits based on prior candles
    if (s[PSARState.IS_BELOW] === 1) {
      // Uptrend - SAR can't be above prior lows
      s[PSARState.RESULT] = Math.min(s[PSARState.RESULT], p.low)
      if (s[PSARState.CANDLE_COUNT] > 2) {
        s[PSARState.RESULT] = Math.min(s[PSARState.RESULT], c2.low)
      }
    } else {
      // Downtrend - SAR can't be below prior highs
      s[PSARState.RESULT] = Math.max(s[PSARState.RESULT], p.high)
      if (s[PSARState.CANDLE_COUNT] > 2) {
        s[PSARState.RESULT] = Math.max(s[PSARState.RESULT], c2.high)
      }
    }

    return s[PSARState.RESULT]
  }
}
