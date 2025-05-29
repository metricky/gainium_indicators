import { SMA } from '../SMA/SMA'
import { eq, hlcValue, lastIndexOfEnum } from '../util'
import { LightIndicator, LightIndicatorState } from '../util/indicator'
import { StochasticResult } from '../types/result'
import { HLC } from '../types/candles'
import { Float64CircularArray } from '../util/array'

// Define state indices for performance and readability
enum StochState {
  CURRENT_INDEX = 0, // Current index in circular buffers
  HIGHEST = 1, // Current highest high
  LOWEST = 2, // Current lowest low
  FAST_K = 3, // Fast %K value
  DIVISOR = 4, // Divisor for %K calculation
}

/**
 * Stochastic Oscillator (STOCH)
 * Type: Momentum Oscillator
 *
 * The Stochastic Oscillator is a momentum indicator developed by George C. Lane in the 1950s
 * that compares a security's closing price to its price range over a given time period. This
 * range-bound oscillator (0-100) is based on the observation that in an uptrend, prices tend
 * to close near their recent highs, while in a downtrend, prices tend to close near their
 * recent lows.
 *
 * The indicator consists of two lines: %K (fast stochastic) and %D (slow stochastic). The %K
 * line measures where the current close stands relative to the recent high-low range, while
 * the %D line is a moving average of %K, providing smoother signals and reducing false signals.
 *
 * Lane's original concept was that momentum changes direction before price, making the Stochastic
 * Oscillator particularly valuable for identifying potential reversal points. The oscillator's
 * bounded nature (0-100) makes it excellent for identifying overbought and oversold conditions
 * across different securities and market conditions.
 *
 * Key Components:
 * - Fast %K: Raw stochastic value showing current position within recent range
 * - Slow %K: Smoothed version of Fast %K using moving average
 * - %D: Moving average of Slow %K, providing the signal line
 * - The combination creates a dual-line system for confirmation
 *
 * Trading Interpretation:
 * - 0-20: Oversold zone, potential buying opportunity
 * - 20-80: Neutral zone, trend continuation likely
 * - 80-100: Overbought zone, potential selling opportunity
 * - %K crossing above %D: Bullish signal (especially from oversold levels)
 * - %K crossing below %D: Bearish signal (especially from overbought levels)
 * - Both lines above 50: Generally bullish momentum
 * - Both lines below 50: Generally bearish momentum
 *
 * Advanced Analysis Techniques:
 * - Divergences: Stochastic moving opposite to price indicates potential reversals
 * - Failure Swings: Stochastic failing to confirm new price highs/lows shows weakness
 * - Left and Right Crossovers: %K/%D crossovers in extreme zones provide stronger signals
 * - Set-ups: Look for oversold conditions followed by %K rising above %D
 * - Multiple Timeframe Confirmation: Use stochastic across different timeframes
 *
 * Strategy Applications:
 * - Overbought/Oversold Trading: Buy oversold, sell overbought conditions
 * - Crossover Signals: Trade %K/%D line crossovers for entry/exit timing
 * - Divergence Trading: Trade when stochastic diverges from price action
 * - Trend Confirmation: Use stochastic direction to confirm price trends
 * - Range Trading: Excellent for sideways markets with clear support/resistance
 *
 * Market Condition Adaptations:
 * - Trending Markets: Use extreme levels (10/90) to avoid premature entries
 * - Range-bound Markets: Standard levels (20/80) work well for reversal trades
 * - Volatile Markets: Increase smoothing periods for more stable signals
 * - Low Volatility: Decrease periods for more sensitive signals
 *
 * Parameter Guidelines:
 * - %K Period (n): 5-21, with 14 being standard. Shorter = more sensitive
 * - %K Smoothing (m): 1-5, with 3 being common. Higher = smoother signals
 * - %D Period (p): 3-10, with 3 being standard. Signal line smoothing
 *
 * Formula:
 * - %K = 100 × (Close - Lowest Low) / (Highest High - Lowest Low)
 * - Slow %K = SMA(%K, m periods)
 * - %D = SMA(Slow %K, p periods)
 * - Where ranges are calculated over n periods
 *
 * Performance Optimizations:
 * - Uses circular buffers for efficient high/low tracking
 * - Pre-allocated objects avoid garbage collection
 * - O(1) updates for real-time applications
 * - Zero allocation during normal operation
 *
 * Candle Input Type: HLC (High, Low, Close prices required)
 *
 * @see https://www.investopedia.com/terms/s/stochasticoscillator.asp
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:stochastic_oscillator_fast_slow_and_full
 * @see https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/stochastic-oscillator
 */
export class StochasticOscillator extends LightIndicator<
  StochasticResult,
  HLC
> {
  // Circular buffers for price data
  private readonly highs: Float64CircularArray
  private readonly lows: Float64CircularArray

  // Component indicators for smoothing
  private readonly periodM: SMA // Smooths %K into Slow %K
  private readonly periodP: SMA // Smooths Slow %K into %D

  /**
   * Creates a new Stochastic Oscillator indicator
   *
   * @param n The %K period - number of periods for calculating the high-low range.
   *          This determines the lookback window for finding the highest high and lowest low.
   *          Common values:
   *          - 5: Very sensitive, good for short-term trading
   *          - 9: Fibonacci-based, balanced sensitivity
   *          - 14: Standard setting, good balance of sensitivity and smoothness
   *          - 21: Less sensitive, smoother signals, fewer false signals
   * @param m The %K slowing period - number of periods for smoothing the raw %K into Slow %K.
   *          This applies a simple moving average to the Fast %K to reduce noise.
   *          Common values:
   *          - 1: No smoothing (Fast Stochastic)
   *          - 3: Standard smoothing (Slow Stochastic)
   *          - 5: Heavy smoothing for very smooth signals
   * @param p The %D period - number of periods for the moving average of Slow %K to create %D line.
   *          This is the signal line that provides crossover signals with %K.
   *          Common values:
   *          - 3: Standard setting, responsive signal line
   *          - 5: Smoother signal line, fewer crossovers
   *          - 7: Very smooth, high-confidence signals only
   */
  constructor(
    public readonly n: number,
    public readonly m: number,
    public readonly p: number,
  ) {
    /**
     * Initialize Stochastic Oscillator with LightIndicator base class
     *
     * @param historyLength 1 - Only needs current HLC candle for calculation.
     *                      Historical data is managed by circular buffers
     * @param defaultValue hlcValue - Function to extract HLC data from candle input
     * @param stateSize lastIndexOfEnum(StochState) - State array size from StochState enum.
     *                  Stores: current index, candle count, highest high, lowest low, fast %K, divisor
     * @param fillValue NaN - Returns NaN when insufficient data for calculation
     */
    super(1, hlcValue, lastIndexOfEnum(StochState), NaN)

    // Initialize component indicators
    this.periodM = new SMA(m)
    this.periodP = new SMA(p)

    // Initialize circular buffers
    this.highs = new Float64CircularArray(n, 0)
    this.lows = new Float64CircularArray(n, Number.MAX_VALUE)
  }

  /**
   * Calculate Stochastic Oscillator values
   */
  protected calculate(): StochasticResult | null {
    const s = this._state
    const l = this._history.last
    const highs = this.highs
    const lows = this.lows
    const pm = this.periodM
    const pp = this.periodP

    // Add values to circular buffers
    highs.add(l.high)
    lows.add(l.low)

    if (isNaN(s[StochState.HIGHEST]) || l.high > s[StochState.HIGHEST]) {
      s[StochState.HIGHEST] = l.high
    }

    if (isNaN(s[StochState.LOWEST]) || l.low < s[StochState.LOWEST]) {
      s[StochState.LOWEST] = l.low
    }

    if (
      !isNaN(s[StochState.HIGHEST]) &&
      highs.oldValue === s[StochState.HIGHEST]
    ) {
      // Reset highest high if old value matches current
      s[StochState.HIGHEST] = -Infinity
      for (let i = 0; i < highs.size; i++) {
        if (highs.array[i] && highs.array[i] > s[StochState.HIGHEST]) {
          s[StochState.HIGHEST] = highs.array[i]
        }
      }
    }

    if (
      !isNaN(s[StochState.LOWEST]) &&
      lows.oldValue === s[StochState.LOWEST]
    ) {
      // Reset lowest low if old value matches current
      s[StochState.LOWEST] = Infinity
      for (let i = 0; i < lows.size; i++) {
        if (lows.array[i] && lows.array[i] < s[StochState.LOWEST]) {
          s[StochState.LOWEST] = lows.array[i]
        }
      }
    }

    // Wait for enough data
    if (!highs.isFilled || !lows.isFilled) {
      return null
    }

    // Calculate divisor and prevent division by zero
    s[StochState.DIVISOR] = s[StochState.HIGHEST] - s[StochState.LOWEST]

    // Calculate %K (basic stochastic formula)
    s[StochState.FAST_K] =
      ((l.close - s[StochState.LOWEST]) * 100) /
      (eq(s[StochState.DIVISOR], 0) ? 1 : s[StochState.DIVISOR])

    // Calculate slow %K by applying first moving average
    if (pm.next(s[StochState.FAST_K]) === null) {
      return null
    }

    // Calculate %D by applying second moving average to %K
    if (pp.next(pm.result!) === null) {
      return null
    }

    // Return the results
    return {
      stochK: pm.result!,
      stochD: pp.result!,
    }
  }

  /**
   * Exports the state of the indicator for restoration later
   */
  override exportState(): LightIndicatorState {
    return {
      parent: super.exportState(),
      circ: [this.highs.exportState(), this.lows.exportState()],
      child: [this.periodM.exportState(), this.periodP.exportState()],
      bin: [],
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

    if (!state.circ) {
      throw new Error(
        'Invalid state: circular buffer state is missing or incomplete',
      )
    }

    // Restore component states
    this.periodM.restoreState(state.child[0])
    this.periodP.restoreState(state.child[1])

    // Restore circular buffer states
    this.highs.restoreState(state.circ[0])
    this.lows.restoreState(state.circ[1])

    // Restore parent state
    super.restoreState(state.parent)
  }

  /**
   * Gets the %K value (fast stochastic)
   */
  get fastK(): number {
    return this._state[StochState.FAST_K]
  }

  /**
   * Gets the smoothed %K value
   */
  get slowK(): number {
    return this.periodM.result ?? NaN
  }

  /**
   * Gets the %D value (slow stochastic)
   */
  get slowD(): number {
    return this.periodP.result ?? NaN
  }
}
