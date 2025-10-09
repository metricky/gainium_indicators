import { LightIndicator, LightIndicatorState } from '../util/indicator'
import { OBFVGResult } from '../types/result'
import { OHLC } from '../types/candles'
import { Float64CircularArray } from '../util/array'
import { lastIndexOfEnum, ohlcValue } from '../util'

// Define state indices for performance and readability
enum OBFVGState {
  BAR_DELTA_PERCENT = 0, // Percentage change from open to close for the previous bar
  ROLLING_SUM = 1, // Running sum of absolute bar delta percentages
  COUNTER = 2, // Count of bars processed for rolling average calculation
  LAST_2_HIGH = 3, // High price from 2 bars ago (3rd candle back)
  LAST_2_LOW = 4, // Low price from 2 bars ago (3rd candle back)
  THRESHOLD = 5, // Dynamic threshold based on average volatility * 2
  BULLISH_FVG = 6, // Flag indicating bullish Fair Value Gap detected (1=true, 0=false)
  BEARISH_FVG = 7, // Flag indicating bearish Fair Value Gap detected (1=true, 0=false)
  RESULT_LOWER = 8, // Lower boundary of the detected Fair Value Gap
  RESULT_MIDDLE = 9, // Middle line of the detected Fair Value Gap
  RESULT_HIGHER = 10, // Upper boundary of the detected Fair Value Gap
  RESULT_SIDE = 11, // Direction of FVG: 1=bullish, -1=bearish, NaN=none
  TRIGGER_COUNTER = 12, // Counter for how long to extend FVG lines after detection
}

/**
 * Order Blocks & Fair Value Gaps (OBFVG)
 * Type: Price Action / Market Structure Indicator
 *
 * The Order Blocks & Fair Value Gaps (OBFVG) indicator identifies institutional trading patterns
 * and market inefficiencies using Smart Money Concepts (SMC) principles. Currently implements
 * Fair Value Gap (FVG) detection with plans to expand to Order Blocks identification.
 *
 * Fair Value Gaps represent areas where price moves so aggressively that it creates an imbalance
 * or "gap" in the market structure. These gaps often act as magnetic zones where price tends to
 * return to fill the inefficiency, making them powerful levels for entries, targets, and
 * stop-loss placement in institutional trading strategies.
 *
 * The indicator uses dynamic volatility-based thresholds to filter out noise and focus on
 * significant market moves that create meaningful Fair Value Gaps. This adaptive approach
 * ensures the indicator works across different market conditions and timeframes while
 * maintaining relevance to current market volatility.
 *
 * Key Features:
 * - Dynamic volatility-based threshold calculation (2x average bar range)
 * - Bullish and Bearish Fair Value Gap detection
 * - Gap boundary visualization (upper, middle, lower levels)
 * - Time-based gap extension for ongoing relevance
 * - Adaptive to market volatility and timeframe
 * - Foundation for Smart Money Concepts trading strategies
 *
 * Fair Value Gap Formation:
 * - Bullish FVG: 3-candle pattern where current low > high from 2 candles ago
 * - Bearish FVG: 3-candle pattern where current high < low from 2 candles ago
 * - Must be accompanied by significant directional price movement
 * - Volatility threshold prevents false signals during low-activity periods
 *
 * Trading Interpretation:
 * - Bullish FVG: Potential support zone, look for buying opportunities on retest
 * - Bearish FVG: Potential resistance zone, look for selling opportunities on retest
 * - Gap Middle: Often acts as the strongest support/resistance level
 * - Gap Fill: Price returning to gap area often provides high-probability setups
 * - Multiple Timeframes: Confirm FVGs across different timeframes for stronger signals
 *
 * Strategic Applications:
 * - Entry Zones: Use FVG boundaries as entry points for continuation trades
 * - Target Levels: Opposite side FVGs serve as natural target areas
 * - Stop Loss Placement: Place stops beyond FVG boundaries for protection
 * - Trend Confirmation: FVG direction often confirms underlying trend strength
 * - Market Structure: Helps identify shift in market sentiment and institutional flow
 *
 * Advanced Techniques:
 * - Confluence Trading: Combine FVGs with other SMC concepts (Order Blocks, MSS, etc.)
 * - Volume Confirmation: Higher volume during FVG formation increases significance
 * - Time-based Analysis: Fresh FVGs typically more relevant than older ones
 * - Partial Fills: Monitor how price interacts with different gap levels
 * - Rejection Patterns: Strong rejection from FVG boundaries confirms their validity
 *
 * Market Context Considerations:
 * - Trending Markets: FVGs often act as continuation zones in direction of trend
 * - Range Markets: FVGs become key reversal zones at range boundaries
 * - High Impact News: Major news events can create significant FVGs
 * - Session Changes: FVGs formed during session overlaps often more significant
 * - Liquidity Events: FVGs frequently form around stop-loss hunting activities
 *
 * Configuration:
 * - Lookback Period: 1000 bars for volatility threshold calculation
 * - Extension Period: 10 bars after detection for gap visibility
 * - Volatility Multiplier: 2x average bar movement for threshold
 * - Pattern Recognition: 3-candle lookback for gap identification
 *
 * Formula:
 * - Bar Delta = (Close - Open) / Open * 100
 * - Volatility Threshold = (Rolling Average of |Bar Delta|) * 2
 * - Bullish FVG: Low > High[2] AND Close[1] > High[2] AND Bar Delta[1] > Threshold
 * - Bearish FVG: High < Low[2] AND Close[1] < Low[2] AND |Bar Delta[1]| > Threshold
 * - Gap Boundaries: Upper = Current Low/High, Lower = High/Low[2], Middle = (Upper + Lower) / 2
 *
 * Candle Input Type: OHLC (Open, High, Low, Close data required for complete analysis)
 *
 * @see https://www.babypips.com/learn/forex/fair-value-gaps
 * @see https://www.tradingview.com/script/smart-money-concepts/
 * @see https://www.youtube.com/results?search_query=fair+value+gap+trading
 */
export class OBFVG extends LightIndicator<OBFVGResult, OHLC> {
  // Configuration constants
  static lookbackPeriod = 1000 // Period for calculating volatility-based threshold
  static extend = 10 // Number of bars to extend FVG visualization after detection

  // Circular arrays for efficient price history management
  private readonly highValues: Float64CircularArray // Stores last 3 high prices
  private readonly lowValues: Float64CircularArray // Stores last 3 low prices
  private readonly closeValues: Float64CircularArray // Stores last 2 close prices
  private readonly openValues: Float64CircularArray // Stores last 2 open prices
  private readonly absValues: Float64CircularArray // Rolling window of absolute bar movements

  /**
   * Creates a new OBFVG indicator
   *
   * The indicator automatically configures itself with optimal settings for Fair Value Gap
   * detection across different market conditions. No parameters are required as the
   * algorithm uses adaptive thresholds based on recent market volatility.
   */
  constructor() {
    /**
     * Initialize OBFVG indicator with LightIndicator base class
     *
     * @param historyLength 1 - OBFVG only needs current OHLC bar for calculation.
     *                      Historical price comparisons handled by circular arrays
     * @param defaultValue ohlcValue - Default OHLC value structure (unused since we return null until ready)
     * @param stateSize lastIndexOfEnum(OBFVGState) - State array size calculated from OBFVGState enum.
     *                  Stores all calculation variables and intermediate results
     * @param fillValue NaN - Returns NaN when FVG cannot be calculated yet (insufficient data)
     */
    super(1, ohlcValue, lastIndexOfEnum(OBFVGState), NaN)

    // Initialize circular arrays for price history management
    this.highValues = new Float64CircularArray(3, NaN) // Need 3 bars for FVG pattern recognition
    this.lowValues = new Float64CircularArray(3, NaN) // Need 3 bars for FVG pattern recognition
    this.closeValues = new Float64CircularArray(2, NaN) // Need previous close for bar delta calculation
    this.openValues = new Float64CircularArray(2, NaN) // Need previous open for bar delta calculation
    this.absValues = new Float64CircularArray(OBFVG.lookbackPeriod, NaN) // Rolling window for volatility threshold
  }

  /**
   * Calculate Fair Value Gaps using Smart Money Concepts methodology
   *
   * The calculation process follows these key steps:
   * 1. Store current OHLC data in circular arrays for pattern recognition
   * 2. Calculate percentage movement of the previous bar (bar delta)
   * 3. Maintain rolling average of absolute bar movements for volatility threshold
   * 4. Detect 3-candle FVG patterns (current vs 2 bars ago)
   * 5. Validate pattern against dynamic volatility threshold
   * 6. Generate FVG boundaries and manage visualization timing
   *
   * @returns OBFVGResult containing FVG levels or null if insufficient data
   */
  protected calculate(): OBFVGResult | null {
    const s = this._state
    const { open, high, low, close } = this._history.last

    // Store current OHLC values in circular arrays for pattern recognition
    this.closeValues.add(close)
    this.openValues.add(open)
    this.highValues.add(high)
    this.lowValues.add(low)

    // Wait until we have sufficient data for 3-candle pattern analysis
    if (
      !this.closeValues.isFilled ||
      !this.openValues.isFilled ||
      !this.highValues.isFilled ||
      !this.lowValues.isFilled
    ) {
      return null
    }

    // Extract previous bar's OHLC values for bar delta calculation
    const { prev: lastClose } = this.closeValues
    const { prev: lastOpen } = this.openValues

    // Store key price levels from 2 bars ago (3rd candle) for FVG pattern detection
    s[OBFVGState.LAST_2_HIGH] = this.highValues.prev2
    s[OBFVGState.LAST_2_LOW] = this.lowValues.prev2

    // Calculate percentage movement of the previous bar (directional strength)
    s[OBFVGState.BAR_DELTA_PERCENT] = (lastClose - lastOpen) / (lastOpen * 100)

    // Add absolute bar movement to rolling window for volatility threshold calculation
    this.absValues.add(Math.abs(s[OBFVGState.BAR_DELTA_PERCENT]))

    // Initialize rolling sum and counter for volatility calculation on first run
    if (isNaN(s[OBFVGState.ROLLING_SUM])) {
      s[OBFVGState.ROLLING_SUM] = 0
    }
    if (isNaN(s[OBFVGState.COUNTER])) {
      s[OBFVGState.COUNTER] = 0
    }

    // Update rolling statistics for dynamic threshold calculation
    s[OBFVGState.ROLLING_SUM] += this.absValues.last
    s[OBFVGState.COUNTER]++

    // Maintain rolling window by removing oldest value when at capacity
    if (s[OBFVGState.COUNTER] > OBFVG.lookbackPeriod) {
      s[OBFVGState.ROLLING_SUM] -= this.absValues.oldValue || 0
      s[OBFVGState.COUNTER] = OBFVG.lookbackPeriod
    }

    // Calculate dynamic volatility threshold (2x average bar movement)
    // This ensures FVG detection adapts to current market conditions
    s[OBFVGState.THRESHOLD] =
      (s[OBFVGState.ROLLING_SUM] / s[OBFVGState.COUNTER]) * 2

    // Detect Bullish Fair Value Gap pattern:
    // 1. Current low is above the high from 2 bars ago (gap formation)
    // 2. Previous bar closed above the high from 2 bars ago (directional confirmation)
    // 3. Previous bar movement exceeds volatility threshold (significance filter)
    s[OBFVGState.BULLISH_FVG] = Number(
      low > s[OBFVGState.LAST_2_HIGH] &&
        lastClose > s[OBFVGState.LAST_2_HIGH] &&
        s[OBFVGState.BAR_DELTA_PERCENT] > s[OBFVGState.THRESHOLD],
    )

    // Detect Bearish Fair Value Gap pattern:
    // 1. Current high is below the low from 2 bars ago (gap formation)
    // 2. Previous bar closed below the low from 2 bars ago (directional confirmation)
    // 3. Previous bar movement (absolute) exceeds volatility threshold (significance filter)
    s[OBFVGState.BEARISH_FVG] = Number(
      high < s[OBFVGState.LAST_2_LOW] &&
        lastClose < s[OBFVGState.LAST_2_LOW] &&
        -s[OBFVGState.BAR_DELTA_PERCENT] > s[OBFVGState.THRESHOLD],
    )

    // Handle Fair Value Gap lifecycle and visualization management
    if (
      isNaN(s[OBFVGState.TRIGGER_COUNTER]) &&
      (s[OBFVGState.BULLISH_FVG] || s[OBFVGState.BEARISH_FVG])
    ) {
      // New FVG detected - initialize visualization counter and set boundaries
      s[OBFVGState.TRIGGER_COUNTER] = 1

      if (s[OBFVGState.BULLISH_FVG]) {
        // Bullish FVG boundaries: gap between high[2] and current low
        s[OBFVGState.RESULT_LOWER] = s[OBFVGState.LAST_2_HIGH] // Lower boundary (old high)
        s[OBFVGState.RESULT_HIGHER] = low // Upper boundary (current low)
        s[OBFVGState.RESULT_SIDE] = 1 // Mark as bullish FVG
      }

      if (s[OBFVGState.BEARISH_FVG]) {
        // Bearish FVG boundaries: gap between low[2] and current high
        s[OBFVGState.RESULT_HIGHER] = s[OBFVGState.LAST_2_LOW] // Upper boundary (old low)
        s[OBFVGState.RESULT_LOWER] = high // Lower boundary (current high)
        s[OBFVGState.RESULT_SIDE] = -1 // Mark as bearish FVG
      }

      // Calculate middle line of the FVG (often the most significant level)
      s[OBFVGState.RESULT_MIDDLE] =
        (s[OBFVGState.RESULT_LOWER] + s[OBFVGState.RESULT_HIGHER]) / 2
    } else if (
      !isNaN(s[OBFVGState.TRIGGER_COUNTER]) &&
      s[OBFVGState.TRIGGER_COUNTER] >= OBFVG.extend
    ) {
      // FVG visualization period expired - clear all FVG data
      s[OBFVGState.TRIGGER_COUNTER] = NaN
      s[OBFVGState.RESULT_LOWER] = NaN
      s[OBFVGState.RESULT_MIDDLE] = NaN
      s[OBFVGState.RESULT_HIGHER] = NaN
      s[OBFVGState.RESULT_SIDE] = NaN
    } else if (!isNaN(s[OBFVGState.TRIGGER_COUNTER])) {
      // Continue extending FVG visualization - increment counter
      s[OBFVGState.TRIGGER_COUNTER]++
    }

    // Return FVG result structure with appropriate values based on current state
    return {
      // Bullish FVG levels (only populated when bullish FVG is active)
      bullishFVGHigh:
        s[OBFVGState.RESULT_SIDE] === 1 ? s[OBFVGState.RESULT_HIGHER] : NaN,
      bullishFVGLow:
        s[OBFVGState.RESULT_SIDE] === 1 ? s[OBFVGState.RESULT_LOWER] : NaN,
      bullishFVGMiddle:
        s[OBFVGState.RESULT_SIDE] === 1 ? s[OBFVGState.RESULT_MIDDLE] : NaN,

      // Bearish FVG levels (only populated when bearish FVG is active)
      bearishFVGHigh:
        s[OBFVGState.RESULT_SIDE] === -1 ? s[OBFVGState.RESULT_HIGHER] : NaN,
      bearishFVGLow:
        s[OBFVGState.RESULT_SIDE] === -1 ? s[OBFVGState.RESULT_LOWER] : NaN,
      bearishFVGMiddle:
        s[OBFVGState.RESULT_SIDE] === -1 ? s[OBFVGState.RESULT_MIDDLE] : NaN,

      // Current price for reference and additional analysis
      price: close,
    }
  }

  /**
   * Export the state of the indicator for persistence and restoration
   *
   * Captures all internal state including circular arrays containing price history,
   * calculation state variables, and FVG detection parameters. This allows the
   * indicator to be saved and restored without losing context or requiring
   * recalculation from the beginning.
   *
   * @returns LightIndicatorState containing all necessary state data
   */
  override exportState(): LightIndicatorState {
    return {
      parent: super.exportState(),
      circ: [
        this.highValues.exportState(),
        this.lowValues.exportState(),
        this.closeValues.exportState(),
        this.openValues.exportState(),
        this.absValues.exportState(),
      ],
      bin: [],
    }
  }

  /**
   * Restore the state of the indicator from previously exported state
   *
   * Reconstructs all internal state including price history, calculation variables,
   * and FVG detection context. This enables seamless continuation of indicator
   * calculations from any saved state without data loss or recalculation.
   *
   * @param state Previously exported LightIndicatorState to restore from
   * @throws Error if state structure is invalid or missing required components
   */
  override restoreState(state: LightIndicatorState): void {
    if (!state.parent) {
      throw new Error('Invalid state: parent state is missing')
    }

    if (!state.circ) {
      throw new Error('Invalid state: circular buffer states are missing')
    }

    if (!state.bin) {
      throw new Error('Invalid state: pivot calculator states are missing')
    }

    // Restore circular buffer states (Note: indices should match exportState order)
    this.highValues.restoreState(state.circ[0])
    this.lowValues.restoreState(state.circ[1])
    this.closeValues.restoreState(state.circ[2])
    this.openValues.restoreState(state.circ[3])
    this.absValues.restoreState(state.circ[4])

    // Restore parent state
    super.restoreState(state.parent)
  }
}
