import { LightIndicator } from '../util/indicator'
import { PCResult } from '../types/result'
import { OHLC } from '../types/candles'
import { ohlcValue } from '../util'

/**
 * Price Channel (PC)
 * Type: Volatility/Breakout Detection Indicator
 *
 * The Price Channel indicator is a volatility-based breakout detection tool that monitors
 * intraday price movements relative to the opening price. It signals when price has moved
 * beyond specified percentage thresholds in either direction, making it valuable for
 * identifying volatility spikes, breakouts from consolidation, and significant intraday moves.
 *
 * This indicator is particularly useful for intraday trading strategies where detecting
 * significant moves early in the session can provide profitable opportunities. By comparing
 * the high and low of each period to the opening price, it captures the full range of
 * price action within each candle.
 *
 * The indicator works by calculating percentage moves from the opening price and triggering
 * boolean signals when these moves exceed predefined thresholds. This approach normalizes
 * volatility detection across different price levels and securities, making it adaptable
 * to various markets and timeframes.
 *
 * Trading Interpretation:
 * - Up Signal (true): High price has moved above open by more than upward threshold
 * - Down Signal (true): Low price has moved below open by more than downward threshold
 * - Both Signals false: Price remains within acceptable volatility range
 * - Both Signals true: Exceptional volatility with wide intraday range
 *
 * Use Cases:
 * - Breakout Detection: Identify when price breaks significant percentage levels
 * - Volatility Filtering: Screen for periods of abnormal price movement
 * - Gap Analysis: Detect significant intraday moves after market opens
 * - Risk Management: Set alerts for excessive volatility in positions
 * - Entry Timing: Wait for volatility confirmation before entering trades
 *
 * Strategy Applications:
 * - Momentum Trading: Enter trades when volatility thresholds are breached
 * - Range Trading: Avoid trading when excessive volatility is detected
 * - News Trading: Detect market reactions to economic announcements
 * - Consolidation Breakouts: Identify exits from sideways price action
 *
 * Formula:
 * - Up Signal = (High - Open) / Open * 100 > upThreshold
 * - Down Signal = (Open - Low) / Open * 100 > downThreshold
 * - Percentage calculations normalize for different price levels
 *
 * Candle Input Type: OHLC (requires Open for baseline, High/Low for range measurement)
 *
 * @see https://www.investopedia.com/terms/v/volatility.asp
 * @see https://www.investopedia.com/terms/b/breakout.asp
 */
export class PC extends LightIndicator<PCResult, OHLC> {
  /**
   * Creates a new Price Channel indicator
   *
   * @param upThreshold Percentage threshold for upward price movement (typically 1-10%).
   *                    When (High - Open) / Open * 100 exceeds this value, up signal triggers.
   *                    Common values: 1-2% (sensitive), 3-5% (moderate), 5-10% (conservative).
   * @param downThreshold Percentage threshold for downward price movement (typically 1-10%).
   *                      When (Open - Low) / Open * 100 exceeds this value, down signal triggers.
   *                      Should match upThreshold for symmetric volatility detection.
   */
  constructor(
    private readonly upThreshold: number,
    private readonly downThreshold: number,
  ) {
    /**
     * Initializes the parent LightIndicator with:
     * @param historyLength 1 - Only needs current candle for intraday range analysis
     * @param defaultValue ohlcValue - Function to extract OHLC candle data for price calculations
     * @param stateSize 0 - No internal state storage needed, calculates directly from candle
     * @param fillValue undefined - Uses default fill behavior, always returns result
     */
    super(1, ohlcValue, 0)
  }

  /**
   * Calculate Price Channel values
   */
  protected calculate(): PCResult | null {
    const l = this._history.last

    return {
      up: !!(Math.abs((l.high - l.open) / l.open) * 100 > this.upThreshold
        ? 1
        : 0),
      down: !!(Math.abs((l.open - l.low) / l.open) * 100 > this.downThreshold
        ? 1
        : 0),
    }
  }
}
