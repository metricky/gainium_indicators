import { LightIndicator, lastIndexOfEnum, round } from '../util'
import { hlcValue } from '../util/candles'
import { HLC } from '../types/candles'

// Define state indices for clarity
enum TRState {
  HIGH_LOW = 0,
}

/**
 * True Range (TR)
 * Type: Volatility / Range Measurement
 *
 * True Range (TR) is a fundamental volatility indicator developed by J. Welles Wilder Jr.
 * in 1978 as part of his Average True Range (ATR) system. TR measures the true volatility
 * of a security by capturing the full range of price movement for each period, including
 * gaps that occur between trading sessions.
 *
 * Unlike simple range (High - Low), True Range accounts for price gaps by considering
 * the previous period's closing price in the calculation. This provides a more accurate
 * measure of actual price movement and volatility, especially in markets that experience
 * overnight gaps or weekend price movements.
 *
 * True Range is the foundation for many important technical indicators, most notably
 * the Average True Range (ATR), which is used for volatility analysis, stop-loss
 * placement, and position sizing. TR itself provides the raw volatility measurement
 * for each individual period.
 *
 * Key Characteristics:
 * - Measures true volatility including price gaps
 * - Always positive (absolute values)
 * - Foundation component for ATR and related indicators
 * - Adapts to different market conditions automatically
 * - Essential for risk management calculations
 *
 * Trading Interpretation:
 * - High TR values: Increased volatility, wider price movements
 * - Low TR values: Decreased volatility, narrow price movements, consolidation
 * - Sudden TR spikes: Potential breakouts or significant events
 * - Declining TR: Market consolidation, potential breakout setup
 * - Consistent high TR: Trending market with strong momentum
 * - Consistent low TR: Range-bound market, low volatility environment
 *
 * Practical Applications:
 * - Volatility measurement for risk assessment
 * - Building block for ATR and volatility-based indicators
 * - Market condition analysis (high/low volatility periods)
 * - Breakout detection through volatility expansion
 * - Position sizing based on current market volatility
 * - Stop-loss distance calculation preparation
 *
 * Market Context Analysis:
 * - Pre-market/After-hours: Captures gap volatility effectively
 * - News Events: Measures volatility impact accurately
 * - Earnings Releases: Quantifies announcement volatility
 * - Market Opens: Includes opening gap measurements
 * - Trend Changes: Often accompanied by TR expansion
 *
 * Implementation Benefits:
 * - Simple, single-period calculation
 * - No smoothing or averaging (raw volatility)
 * - Immediate response to volatility changes
 * - Universal applicability across all timeframes
 * - Essential input for advanced volatility indicators
 *
 * Formula:
 * TR = Maximum of:
 * 1. Current High - Current Low (normal range)
 * 2. |Current High - Previous Close| (upward gap consideration)
 * 3. |Current Low - Previous Close| (downward gap consideration)
 *
 * The formula ensures that price gaps are captured in volatility measurement,
 * providing a complete picture of price movement between periods.
 *
 * Usage Notes:
 * - TR values are in the same units as the underlying price
 * - Higher-priced securities naturally have higher TR values
 * - Compare TR relatively (current vs. historical) rather than absolutely
 * - Often averaged (ATR) for smoother volatility analysis
 * - Essential for any volatility-based trading system
 *
 * Candle Input Type: HLC (High, Low, Close prices required; previous Close needed for gap calculation)
 *
 * @see https://www.investopedia.com/terms/t/true-range.asp
 * @see https://school.stockcharts.com/doku.php?id=technical_indicators:average_true_range_atr
 * @see https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/atr
 */
export class TR extends LightIndicator<number, HLC> {
  /**
   * Creates a new True Range indicator
   *
   * True Range requires no parameters as it calculates the volatility
   * for each individual period. The calculation needs the current
   * period's High, Low, and Close, plus the previous period's Close
   * to account for any price gaps.
   */
  constructor() {
    /**
     * Initialize True Range indicator with LightIndicator base class
     *
     * @param historyLength 2 - Needs current and previous HLC candles.
     *                      Current candle provides High/Low range,
     *                      previous candle's Close is needed for gap calculations
     * @param defaultValue hlcValue - Function to extract HLC data from candle input
     * @param stateSize lastIndexOfEnum(TRState) - State array size from TRState enum.
     *                  Stores: high-low range calculation for efficiency
     * @param fillValue undefined - Uses default LightIndicator behavior
     */
    super(2, hlcValue, lastIndexOfEnum(TRState)) // Use 1 history size and 1 state values
  }

  /**
   * Calculate the true range based on current history and state
   */
  protected calculate(): number {
    const s = this._state
    const h = this._history
    const l = h.last
    const p = h.prev
    // Calculate basic high-low range
    s[TRState.HIGH_LOW] = round(l.high - l.low, 12)

    // If we have a previous candle, calculate true range
    if (h.isFilled) {
      // Calculate true range
      return Math.max(
        s[TRState.HIGH_LOW],
        round(Math.abs(l.high - p.close), 12),
        round(Math.abs(l.low - p.close), 12),
      )
    }

    return s[TRState.HIGH_LOW]
  }
}
