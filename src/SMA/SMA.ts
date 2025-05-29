import { lastIndexOfEnum } from '../util'
import { LightIndicator } from '../util/indicator'

// Define state indices for clarity
enum SMAState {
  ROLLING_SUM = 0,
}

/**
 * Simple Moving Average (SMA)
 * Type: Trend-Following / Smoothing
 *
 * The Simple Moving Average (SMA) is one of the most fundamental and widely used technical
 * indicators in financial analysis. It represents the arithmetic mean of a security's price
 * over a specified number of periods, providing a smoothed price line that filters out
 * short-term price fluctuations to reveal the underlying trend direction.
 *
 * The SMA treats all price points within the calculation period equally, giving each data
 * point the same weight (1/n where n is the period). This equal weighting characteristic
 * makes the SMA slower to respond to recent price changes compared to weighted moving
 * averages like EMA, but also makes it less susceptible to false signals from temporary
 * price spikes or dips.
 *
 * As the foundation of moving average analysis, SMA serves as a building block for many
 * other technical indicators and trading systems. Its simplicity and reliability have
 * made it a staple in both manual and algorithmic trading strategies for decades.
 *
 * Key Characteristics:
 * - Equal weighting of all data points in the calculation period
 * - Smooth trend identification with reduced noise
 * - Lagging indicator (reacts after price changes occur)
 * - Forms dynamic support and resistance levels
 * - Foundation for many other technical indicators
 *
 * Trading Interpretation:
 * - Price above SMA: Generally bullish trend
 * - Price below SMA: Generally bearish trend
 * - SMA slope upward: Uptrend confirmation
 * - SMA slope downward: Downtrend confirmation
 * - Price crossing above SMA: Potential buy signal
 * - Price crossing below SMA: Potential sell signal
 * - Multiple SMA crossovers: Golden Cross (bullish) / Death Cross (bearish)
 *
 * Common Applications:
 * - Trend identification and confirmation
 * - Dynamic support and resistance levels
 * - Entry and exit signal generation
 * - Filtering trades (trade only in direction of SMA trend)
 * - Multiple timeframe analysis
 * - Moving average crossover systems
 *
 * Popular Period Settings:
 * - 10, 20, 50: Short to medium-term trends
 * - 100, 200: Long-term trends and major support/resistance
 * - 9, 21: Fibonacci-based periods
 * - 5, 13, 21: Short-term trading systems
 *
 * Advantages:
 * - Simple to calculate and understand
 * - Effective trend identification
 * - Reduces market noise
 * - Works well in trending markets
 * - Widely accepted and used by traders
 *
 * Limitations:
 * - Lagging nature (late signals)
 * - Poor performance in sideways markets
 * - Equal weighting may not reflect current market conditions
 * - Prone to whipsaws in choppy markets
 *
 * Formula:
 * SMA = (Sum of closing prices over n periods) / n
 * Where n = number of periods in the moving average
 *
 * Implementation uses rolling sum for O(1) efficiency:
 * Rolling Sum = Previous Sum - Oldest Price + Newest Price
 * SMA = Rolling Sum / Period Count
 *
 * Candle Input Type: Numeric (typically Close price, but can use any price series)
 *
 * @see https://www.investopedia.com/terms/s/sma.asp
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:moving_averages
 * @see https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/sma
 */
export class SMA extends LightIndicator {
  /**
   * Creates a new SMA indicator
   *
   * @param interval Number of periods to include in the moving average calculation.
   *                Common values:
   *                - 5-10: Very short-term, highly responsive but noisy
   *                - 20: Short-term trend, popular for day trading
   *                - 50: Medium-term trend, commonly used for swing trading
   *                - 100: Longer-term trend analysis
   *                - 200: Long-term trend, major support/resistance level
   *                - 9, 21: Fibonacci-based periods for harmonic analysis
   */
  constructor(private readonly interval: number) {
    /**
     * Initialize SMA indicator with LightIndicator base class
     *
     * @param historyLength interval - Needs full interval of price data to calculate SMA
     * @param defaultValue 0 - Default numeric value for rolling sum initialization
     * @param stateSize 1 - Single state value to store the rolling sum for O(1) calculation efficiency
     * @param fillValue undefined - Uses default LightIndicator behavior (returns null until filled)
     */
    super(interval, 0, lastIndexOfEnum(SMAState))
  }

  protected calculate(): number | null {
    const s = this._state
    const h = this._history
    // Save the new rolling sum to state
    s[SMAState.ROLLING_SUM] = s[SMAState.ROLLING_SUM] - h.oldValue + h.last

    // O(1) calculation using the rolling sum
    return h.isFilled ? s[SMAState.ROLLING_SUM] / this.interval : null
  }
}
