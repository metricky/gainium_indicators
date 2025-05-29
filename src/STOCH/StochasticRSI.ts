import { RSI } from '../RSI/RSI'
import { StochasticOscillator } from './StochasticOscillator'
import { LightIndicator, LightIndicatorState } from '../util/indicator'
import { StochasticResult } from '../types/result'
import { HLC } from '../types/candles'
import { hlcValue } from '../util'

/**
 * Stochastic RSI (STOCHRSI)
 * Type: Momentum Oscillator (Hybrid)
 *
 * The Stochastic RSI is an advanced momentum oscillator developed by Tushar S. Chande and
 * Stanley Kroll in 1994. It combines the power of two popular indicators: the Relative
 * Strength Index (RSI) and the Stochastic Oscillator. By applying the stochastic formula
 * to RSI values instead of price values, it creates a more sensitive and responsive
 * oscillator that ranges from 0 to 100.
 *
 * The innovation of Stochastic RSI lies in addressing the limitation of traditional RSI,
 * which can remain in overbought or oversold territory for extended periods during strong
 * trends. The Stochastic RSI provides more frequent and earlier signals by measuring where
 * the current RSI value stands relative to its recent high-low range, creating an oscillator
 * that moves more dynamically between extreme levels.
 *
 * This hybrid indicator maintains the momentum-measuring capabilities of RSI while adding
 * the range-bound characteristics of the Stochastic Oscillator, resulting in an indicator
 * that is particularly effective for identifying short-term reversal points and providing
 * precise entry/exit timing in both trending and ranging markets.
 *
 * Key Characteristics:
 * - Combines RSI momentum analysis with Stochastic range positioning
 * - More sensitive than either RSI or Stochastic alone
 * - Provides faster signals with increased frequency
 * - Excellent for short-term trading and precise timing
 * - Works well in both trending and sideways markets
 *
 * Trading Interpretation:
 * - 0-20: Oversold zone, potential buying opportunity
 * - 20-80: Neutral zone, trend continuation likely
 * - 80-100: Overbought zone, potential selling opportunity
 * - %K crossing above %D from oversold: Strong bullish signal
 * - %K crossing below %D from overbought: Strong bearish signal
 * - Extreme readings (above 90 or below 10): High-probability reversal zones
 * - Both lines rising: Bullish momentum strengthening
 * - Both lines falling: Bearish momentum strengthening
 *
 * Advanced Analysis Techniques:
 * - Divergences: Stochastic RSI diverging from price action signals potential reversals
 * - Hidden Divergences: Continuation patterns in trending markets
 * - Extreme Zone Reversals: Look for reversals from 0-10 and 90-100 zones
 * - Multiple Timeframe Analysis: Confirm signals across different timeframes
 * - Failure Swings: Failed attempts to reach new extremes indicate momentum shifts
 *
 * Strategy Applications:
 * - Scalping: Excellent for short-term entries and exits
 * - Swing Trading: Identify intermediate-term reversal points
 * - Trend Confirmation: Use direction to confirm price trend validity
 * - Divergence Trading: Trade when indicator diverges from price action
 * - Overbought/Oversold Trading: Mean reversion strategies in ranging markets
 * - Breakout Confirmation: Confirm breakouts with momentum direction
 *
 * Market Condition Adaptations:
 * - Trending Markets: Focus on extreme readings (10/90) for reversal signals
 * - Range-bound Markets: Use standard levels (20/80) for reversal trades
 * - Volatile Markets: Increase RSI period for smoother base calculation
 * - Low Volatility: Decrease stochastic periods for more sensitive signals
 * - News Events: Be cautious of false signals during high-impact events
 *
 * Parameter Guidelines:
 * - RSI Period: 14 (standard), 21 (smoother), 7 (more sensitive)
 * - Stochastic %K Period: 14 (standard), 21 (smoother), 9 (faster)
 * - Stochastic %K Slowing: 3 (standard), 1 (no smoothing), 5 (heavy smoothing)
 * - Stochastic %D Period: 3 (standard), 5 (smoother signals)
 *
 * Advantages:
 * - More responsive than traditional RSI
 * - Provides earlier signals than standard oscillators
 * - Excellent for timing entries and exits
 * - Works well across different market conditions
 * - Combines strengths of two proven indicators
 *
 * Limitations:
 * - Can be overly sensitive, generating false signals
 * - Requires confirmation from other indicators
 * - May whipsaw in choppy markets
 * - Complex calculation may lag in real-time applications
 *
 * Formula:
 * 1. Calculate RSI over specified period
 * 2. Apply Stochastic formula to RSI values:
 *    - StochRSI = (RSI - RSI_Min) / (RSI_Max - RSI_Min) × 100
 *    - Where RSI_Min and RSI_Max are over the stochastic period
 * 3. Smooth with moving averages to create %K and %D lines
 *
 * Candle Input Type: HLC (Close price for RSI, then processed as HLC for Stochastic)
 *
 * @see https://www.investopedia.com/terms/s/stochrsi.asp
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:stochrsi
 * @see https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/stochastic-rsi
 */
export class StochasticRSI extends LightIndicator<StochasticResult, HLC> {
  // Component indicators
  private readonly stoch: StochasticOscillator
  private readonly rsi: RSI

  // Pre-allocated HLC object for passing RSI values to Stochastic
  private readonly rsiHLC: HLC = {
    high: 0,
    low: 0,
    close: 0,
  }

  private readonly export_rsiHLC: HLC = {
    high: NaN,
    low: NaN,
    close: NaN,
  }

  /**
   * Creates a new Stochastic RSI indicator
   *
   * @param interval The period length for the RSI calculation (typically 14).
   *                This determines the lookback period for the underlying RSI component.
   *                Common values:
   *                - 7: More sensitive RSI base, faster signals
   *                - 14: Standard RSI period, balanced sensitivity
   *                - 21: Smoother RSI base, fewer false signals
   *                - 30: Very smooth RSI for longer-term analysis
   * @param n The %K period for stochastic calculation (typically 14).
   *          This determines how many RSI values are used to calculate the stochastic range.
   *          Common values:
   *          - 9: More sensitive stochastic, faster crossovers
   *          - 14: Standard stochastic period
   *          - 21: Smoother stochastic, fewer whipsaws
   * @param m The %K slowing period (typically 3).
   *          Smooths the raw stochastic %K line to reduce noise.
   *          Common values:
   *          - 1: No smoothing (fast stochastic RSI)
   *          - 3: Standard smoothing
   *          - 5: Heavy smoothing for very stable signals
   * @param p The %D period (typically 3).
   *          Moving average period for creating the %D signal line.
   *          Common values:
   *          - 3: Standard signal line
   *          - 5: Smoother signal line, fewer crossovers
   *          - 7: Very smooth signal for high-confidence signals
   */
  constructor(
    public readonly interval: number,
    public readonly n: number,
    public readonly m: number,
    public readonly p: number,
  ) {
    /**
     * Initialize Stochastic RSI with LightIndicator base class
     *
     * @param historyLength 1 - Only needs current HLC candle for calculation.
     *                      Component indicators manage their own history
     * @param defaultValue hlcValue - Function to extract HLC data from candle input
     * @param stateSize 0
     */
    super(1, hlcValue, 0)

    // Initialize component indicators
    this.stoch = new StochasticOscillator(n, m, p)
    this.rsi = new RSI(interval)
  }

  /**
   * Calculate Stochastic RSI values
   */
  protected calculate(): StochasticResult | null {
    const rsi = this.rsi
    const stoch = this.stoch

    // First calculate RSI
    if (rsi.next(this._history.last.close) === null) {
      return null
    }

    const v = rsi.result!.value

    // Update the pre-allocated HLC object with RSI values
    this.rsiHLC.high = v
    this.rsiHLC.low = v
    this.rsiHLC.close = v

    // Pass to stochastic
    if (stoch.next(this.rsiHLC) === null) {
      return null
    }

    return stoch.result
  }

  /**
   * Exports the state of the indicator for restoration later
   */
  override exportState(): LightIndicatorState {
    this.export_rsiHLC.high = +`${this.rsiHLC.high}`
    this.export_rsiHLC.low = +`${this.rsiHLC.low}`
    this.export_rsiHLC.close = +`${this.rsiHLC.close}`
    return {
      parent: super.exportState(),
      child: [this.rsi.exportState(), this.stoch.exportState()],
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
    this.rsi.restoreState(state.child[0])
    this.stoch.restoreState(state.child[1])

    // Restore parent state
    super.restoreState(state.parent)

    // Restore pre-allocated HLC object
    this.rsiHLC.high = +`${this.export_rsiHLC.high}`
    this.rsiHLC.low = +`${this.export_rsiHLC.low}`
    this.rsiHLC.close = +`${this.export_rsiHLC.close}`
  }

  /**
   * Gets the %K value (fast stochastic)
   */
  get stochK(): number {
    return this.stoch.result?.stochK ?? NaN
  }

  /**
   * Gets the %D value (slow stochastic)
   */
  get stochD(): number {
    return this.stoch.result?.stochD ?? NaN
  }
}
