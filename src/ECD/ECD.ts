import { OHLC } from '../types/candles'
import { LightIndicator, ohlcValue } from '../util'

/**
 * Engulfing Candle Detector (ECD)
 * Type: Candlestick Pattern Recognition Indicator
 *
 * The Engulfing Candle Detector identifies bullish and bearish engulfing patterns,
 * which are powerful reversal candlestick formations in technical analysis. These
 * patterns occur when a candle's body completely engulfs the body of the previous
 * candle, suggesting a potential shift in market sentiment and momentum.
 *
 * An engulfing pattern consists of two candles where the second candle's body
 * completely encompasses the first candle's body. The pattern's significance
 * is enhanced when it occurs after a sustained move in one direction and is
 * often considered a strong reversal signal, especially when accompanied by
 * high volume.
 *
 * Pattern Types Detected:
 * - Bullish Engulfing (returns 2): A larger bullish candle engulfs a smaller bearish candle
 *   - Previous candle: bearish (close < open)
 *   - Current candle: bullish (close > open) and completely engulfs previous body
 *   - Signals potential bullish reversal from downtrend
 *
 * - Bearish Engulfing (returns 1): A larger bearish candle engulfs a smaller bullish candle
 *   - Previous candle: bullish (close > open)
 *   - Current candle: bearish (close < open) and completely engulfs previous body
 *   - Signals potential bearish reversal from uptrend
 *
 * Trading Interpretation:
 * - Reversal Signals: Strong indication of trend reversal when appearing at key levels
 * - Entry Points: Can be used for contrarian entries after confirmation
 * - Stop Loss Placement: Logical stops can be placed beyond the engulfing candle
 * - Volume Confirmation: Patterns are more reliable when accompanied by high volume
 * - Market Context: More significant when occurring at support/resistance levels
 *
 * The detector provides a simple yet effective way to identify these important
 * reversal patterns automatically, helping traders spot potential turning points
 * in price action without manual chart analysis.
 *
 * Formula: Logical comparison of OHLC values between consecutive candles
 * - Bullish: current.open ≤ prev.close AND current.open < prev.open AND current.close > prev.open
 * - Bearish: current.open ≥ prev.close AND current.open > prev.open AND current.close < prev.open
 *
 * Candle Input Type: OHLC (Open, High, Low, Close) - requires full candle data for body comparison
 *
 * @see https://www.investopedia.com/terms/e/engulfingpattern.asp
 * @see https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/engulfing-pattern
 */
export class ECD extends LightIndicator<number, OHLC> {
  /**
   * Creates a new Engulfing Candle Detector instance
   * No parameters required as the pattern detection is standardized
   */
  constructor() {
    /**
     * Initialize the LightIndicator parent class
     * @param historyLength - 2 (need current and previous candle for pattern comparison)
     * @param defaultValue - ohlcValue (default object with zero values, e.g., {open: 0, high: 0, low: 0, close: 0})
     * @param stateSize - 0 (no additional state storage needed as pattern detection is stateless)
     */
    // Use 2 as history size, an OHLC object as initial value
    super(2, ohlcValue, 0)
  }

  /**
   * Calculate the ECD value based on current history
   * Returns:
   * - 0: No pattern
   * - 1: Bearish engulfing pattern
   * - 2: Bullish engulfing pattern
   */
  protected calculate(): number | null {
    const h = this._history
    // Need at least 2 candles for pattern detection
    if (!h.isFilled) {
      return null
    }
    // Get the current and previous candles
    const l = h.last
    const p = h.prev

    // Return the result
    // Check for bullish engulfing pattern
    return l.open <= p.close && l.open < p.open && l.close > p.open
      ? 2
      : // Check for bearish engulfing pattern
        l.open >= p.close && l.open > p.open && l.close < p.open
        ? 1
        : 0
  }
}
