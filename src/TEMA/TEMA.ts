import { EMA } from '../EMA/EMA'
import { LightIndicator, LightIndicatorState } from '../util/indicator'

/**
 * Triple Exponential Moving Average (TEMA)
 * Type: Trend-Following / Smoothing (Advanced)
 *
 * The Triple Exponential Moving Average (TEMA) is an advanced trend-following indicator
 * developed by Patrick Mulloy in 1994 to address the inherent lag problems of traditional
 * moving averages. TEMA achieves superior responsiveness by applying exponential smoothing
 * three times in succession, then using a mathematical formula to reduce lag while
 * maintaining smoothness.
 *
 * Unlike simple triple smoothing, TEMA uses a sophisticated calculation that combines
 * three EMAs in a way that amplifies recent price movements while filtering out noise.
 * The result is a moving average that responds more quickly to price changes than
 * single or double exponential moving averages, yet remains smooth enough to avoid
 * excessive false signals.
 *
 * TEMA represents one of the most advanced moving average techniques, offering traders
 * a tool that provides earlier trend signals without sacrificing the noise-filtering
 * capabilities that make moving averages valuable. It's particularly effective in
 * trending markets where early signal detection is crucial.
 *
 * Key Characteristics:
 * - Significantly reduced lag compared to traditional moving averages
 * - Maintains smoothness while increasing responsiveness
 * - Better trend change detection than EMA or DEMA
 * - Effective noise filtering with enhanced sensitivity
 * - Superior performance in trending market conditions
 *
 * Trading Interpretation:
 * - Price above TEMA: Bullish trend, consider long positions
 * - Price below TEMA: Bearish trend, consider short positions
 * - TEMA slope upward: Uptrend confirmation
 * - TEMA slope downward: Downtrend confirmation
 * - Price crossing above TEMA: Potential buy signal
 * - Price crossing below TEMA: Potential sell signal
 * - TEMA acting as dynamic support in uptrends
 * - TEMA acting as dynamic resistance in downtrends
 *
 * Advanced Analysis Techniques:
 * - Multiple TEMA periods for trend confluence
 * - TEMA crossovers with other moving averages
 * - Divergence analysis between price and TEMA direction
 * - Support and resistance level identification
 * - Trend strength analysis using TEMA slope
 * - Multiple timeframe TEMA alignment
 *
 * Strategy Applications:
 * - Early trend identification and confirmation
 * - Entry timing for trend-following strategies
 * - Dynamic stop-loss placement using TEMA as support/resistance
 * - Trend change detection with reduced false signals
 * - Swing trading with improved entry/exit timing
 * - Breakout confirmation with responsive trend analysis
 *
 * Market Condition Adaptations:
 * - Trending Markets: Excellent performance with early signals
 * - Volatile Markets: Better than single EMA, still may whipsaw
 * - Range-bound Markets: Use with caution, may generate false signals
 * - News Events: Responds quickly to significant price movements
 * - Different Timeframes: Adapt period based on trading horizon
 *
 * Parameter Guidelines:
 * - Short periods (5-12): Very responsive, suitable for scalping
 * - Medium periods (13-21): Balanced responsiveness, good for swing trading
 * - Long periods (30-50): Smooth trend identification, position trading
 * - Very long periods (100+): Major trend analysis, portfolio management
 *
 * Advantages:
 * - Reduced lag compared to traditional moving averages
 * - Maintains smoothness while increasing sensitivity
 * - Excellent trend change detection
 * - Superior noise filtering capabilities
 * - Works well across different timeframes
 * - Provides earlier signals than EMA or DEMA
 *
 * Limitations:
 * - More complex calculation requires more historical data
 * - Can still generate false signals in sideways markets
 * - May overshoot in volatile conditions
 * - Requires confirmation from other indicators
 * - Less intuitive than simple moving averages
 *
 * Formula:
 * - EMA1 = EMA(Price, Period)
 * - EMA2 = EMA(EMA1, Period)
 * - EMA3 = EMA(EMA2, Period)
 * - TEMA = 3 × (EMA1 - EMA2) + EMA3
 *
 * The formula creates a weighted combination that emphasizes recent price action
 * while maintaining the smoothing benefits of multiple exponential moving averages.
 *
 * Candle Input Type: Numeric (typically Close price, but can use any price series)
 *
 * @see https://www.investopedia.com/terms/t/triple-exponential-moving-average.asp
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:tema
 * @see https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/tema
 */
export class TEMA extends LightIndicator {
  // Component EMAs
  private readonly _innerEMA: EMA
  private readonly _middleEMA: EMA
  private readonly _outerEMA: EMA

  /**
   * Creates a new TEMA indicator
   *
   * @param interval Number of periods for the exponential moving average calculations.
   *                This period is used for all three EMA components in the TEMA formula.
   *                Common values and their characteristics:
   *                - 5-8: Very responsive, suitable for scalping and short-term trading
   *                - 9-12: Fast response, good for day trading and quick trend changes
   *                - 13-21: Balanced sensitivity, popular for swing trading
   *                - 22-30: Smoother signals, suitable for position trading
   *                - 50+: Long-term trend analysis, reduced noise but slower response
   *
   *                Note: TEMA requires 3x the period for full initialization due to
   *                triple smoothing process, so shorter periods are often preferred
   */
  constructor(public readonly interval: number) {
    /**
     * Initialize TEMA indicator with LightIndicator base class
     *
     * @param historyLength 1 - Only needs current price value for calculation.
     *                      Historical data is managed by component EMA indicators
     * @param defaultValue 0 - Default numeric value (unused since calculation depends on EMAs)
     * @param stateSize 0 - No internal state needed, all state managed by component EMAs
     * @param fillValue undefined - Uses default LightIndicator behavior (returns null until ready)
     */
    super(1, 0, 0)
    this._innerEMA = new EMA(interval)
    this._middleEMA = new EMA(interval)
    this._outerEMA = new EMA(interval)
  }

  /**
   * Calculate TEMA based on inner, middle, and outer EMAs
   */
  protected calculate(): number | null {
    // Use state reference for better performance
    const inma = this._innerEMA
    const mma = this._middleEMA
    const oma = this._outerEMA
    // Calculate the inner EMA (EMA of price)
    if (inma.next(this._history.last) === null) {
      return null
    }
    // Calculate the middle EMA (EMA of the first EMA)
    if (mma.next(inma.result!) === null) {
      return null
    }
    // Calculate the outer EMA (EMA of the second EMA)
    if (oma.next(mma.result!) === null) {
      return null
    }
    // Calculate TEMA = 3 * (EMA1 - EMA2) + EMA3 and store in result
    return 3 * (inma.result! - mma.result!) + oma.result!
  }

  /**
   * Export the state of this indicator for persistence
   */
  exportState(): LightIndicatorState {
    return {
      bin: [],
      circ: [],
      child: [
        this._innerEMA.exportState(),
        this._middleEMA.exportState(),
        this._outerEMA.exportState(),
      ],
      parent: super.exportState(),
    }
  }

  /**
   * Restore the state of this indicator from a previously exported state
   */
  restoreState(state: LightIndicatorState): void {
    if (!state.parent) {
      throw new Error('Invalid state: parent state is missing')
    }
    if (!state.child || state.child.length < 3) {
      throw new Error('Invalid state: child states are missing')
    }

    this._innerEMA.restoreState(state.child[0])
    this._middleEMA.restoreState(state.child[1])
    this._outerEMA.restoreState(state.child[2])

    super.restoreState(state.parent)
  }
}
