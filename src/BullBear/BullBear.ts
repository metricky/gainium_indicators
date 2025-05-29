import { SMA } from '../SMA/SMA'
import { OHLC } from '../types/candles'
import { lt, gt, eq, ohlcValue, lastIndexOfEnum } from '../util'
import { LightIndicator, LightIndicatorState } from '../util/indicator'

// Define state indices for clarity
enum BBState {
  HML = 0, // high minus low
  HMLC = 1, // high minus last close
  HMC = 2, // high minus close
  HMO = 3, // high minus open
  CML = 4, // close minus low
  OML = 5, // open minus low
  OMPC = 6, // open minus previous close
  PCMO = 7, // previous close minus open
  LCML = 8, // last close minus low
  R1 = 9, // helper variable
  R2 = 10, // helper variable
  BULL = 11, // bull strength
  BEAR = 12, // bear strength
}

/**
 * BullBear Power Indicator
 * Type: Market Sentiment/Momentum Indicator
 *
 * The BullBear indicator measures the relative strength of bullish versus bearish market
 * pressure by analyzing various price relationships within and between candles. It calculates
 * separate bull and bear strength values based on complex conditional logic that considers
 * the relationships between open, high, low, close, and previous close prices.
 *
 * The indicator evaluates multiple price scenarios to determine:
 * - Bull strength: measures upward pressure based on candle structure and price gaps
 * - Bear strength: measures downward pressure based on candle structure and price gaps
 * - Final value: smoothed difference between bull and bear strength using SMA
 *
 * Positive values indicate bullish dominance, while negative values suggest bearish control.
 * The magnitude of the value indicates the strength of the respective sentiment. This indicator
 * is particularly useful for identifying market momentum shifts and confirming trend direction.
 *
 * The calculation considers various candle patterns including doji candles, gaps, and the
 * relationship between current and previous price levels to provide a comprehensive view
 * of market pressure dynamics.
 *
 * Formula: BullBear = SMA(Bull Strength - Bear Strength, period)
 * Where Bull/Bear Strength calculations involve complex conditional logic based on OHLC relationships
 *
 * Candle Input Type: OHLC (Open, High, Low, Close)
 *
 * @see https://www.investopedia.com/terms/s/sentiment.asp
 * @see https://www.investopedia.com/terms/m/momentum.asp
 */
export class BullBear extends LightIndicator<number, OHLC> {
  // Constants
  private static readonly REQUIRED_HISTORY = 2

  // SMA component for smoothing
  private readonly sma: SMA

  /**
   * Creates a new BullBear indicator instance
   *
   * @param interval - Period for SMA smoothing of the bull-bear differential (typically 13-21)
   */
  constructor(interval: number) {
    /**
     * Initialize the LightIndicator parent class
     * @param historyLength - REQUIRED_HISTORY (2) (need current and previous candle for gap analysis)
     * @param defaultValue - ohlcValue (default object with zero values, e.g., {open: 0, high: 0, low: 0, close: 0})
     * @param stateSize - lastIndexOfEnum(BBState) (size of Float64Array to store all calculation states)
     */
    super(BullBear.REQUIRED_HISTORY, ohlcValue, lastIndexOfEnum(BBState)) // 2 bars history, 13 state values
    this.sma = new SMA(interval)
  }

  /**
   * Calculate BullBear based on current history
   */
  protected calculate(): number | null {
    const s = this._state
    const h = this._history
    const l = h.last
    const p = h.prev
    // If we don't have enough history, wait for more data
    if (!h.isFilled) {
      return null
    }

    // Calculate price differences
    s[BBState.HML] = l.high - l.low
    s[BBState.HMLC] = l.high - p.close
    s[BBState.HMC] = l.high - l.close
    s[BBState.HMO] = l.high - l.open
    s[BBState.CML] = l.close - l.low
    s[BBState.OML] = l.open - l.low
    s[BBState.LCML] = p.close - l.low
    s[BBState.OMPC] = l.open - p.close
    s[BBState.PCMO] = p.close - l.open

    // Calculate conditional variables R1 and R2
    s[BBState.R1] = lt(p.close, l.open)
      ? gt(s[BBState.OMPC], s[BBState.HML])
        ? s[BBState.OMPC]
        : s[BBState.HML]
      : s[BBState.HML]

    s[BBState.R2] = gt(p.close, l.open)
      ? gt(s[BBState.PCMO], s[BBState.HML])
        ? s[BBState.PCMO]
        : s[BBState.HML]
      : s[BBState.HML]

    // Calculate bull strength using multiple conditionals
    s[BBState.BULL] = eq(l.close, l.open)
      ? eq(s[BBState.HMC], s[BBState.CML])
        ? gt(p.close, l.open)
          ? gt(s[BBState.HMO], s[BBState.CML])
            ? s[BBState.HMO]
            : s[BBState.CML]
          : s[BBState.R1]
        : gt(s[BBState.HMC], s[BBState.CML])
          ? gt(p.close, l.open)
            ? gt(s[BBState.HMLC], s[BBState.CML])
              ? s[BBState.HMLC]
              : s[BBState.CML]
            : s[BBState.HMO]
          : s[BBState.R1]
      : lt(l.close, l.open)
        ? lt(p.close, l.open)
          ? gt(s[BBState.HMLC], s[BBState.CML])
            ? s[BBState.HMLC]
            : s[BBState.CML]
          : gt(s[BBState.HMO], s[BBState.CML])
            ? s[BBState.HMO]
            : s[BBState.CML]
        : s[BBState.R1]

    // Calculate bear strength using multiple conditionals
    s[BBState.BEAR] = eq(l.close, l.open)
      ? eq(s[BBState.HMC], s[BBState.CML])
        ? lt(p.close, l.open)
          ? gt(s[BBState.OML], s[BBState.HMC])
            ? s[BBState.OML]
            : s[BBState.HMC]
          : s[BBState.R2]
        : gt(s[BBState.HMC], s[BBState.CML])
          ? s[BBState.R2]
          : gt(p.close, l.open)
            ? gt(s[BBState.LCML], s[BBState.HMC])
              ? s[BBState.LCML]
              : s[BBState.HMC]
            : s[BBState.OML]
      : lt(l.close, l.open)
        ? s[BBState.R2]
        : gt(p.close, l.open)
          ? gt(s[BBState.LCML], s[BBState.HMC])
            ? s[BBState.LCML]
            : s[BBState.HMC]
          : gt(s[BBState.OML], s[BBState.HMC])
            ? s[BBState.OML]
            : s[BBState.HMC]

    // Update the SMA with the differential between bull and bear strength
    return this.sma.next(s[BBState.BULL] - s[BBState.BEAR])
  }

  /**
   * Export the indicator state
   */
  exportState(): LightIndicatorState {
    return {
      bin: [],
      circ: [],
      child: [this.sma.exportState()],
      parent: super.exportState(),
    }
  }

  /**
   * Restore the indicator state
   */
  restoreState(state: LightIndicatorState): void {
    if (!state.parent) {
      throw new Error('Invalid state: parent state is missing')
    }
    if (!state.child?.length) {
      throw new Error('Invalid state: child state is missing')
    }
    // Restore the state of the SMA
    this.sma.restoreState(state.child[0])
    // Restore the parent state
    super.restoreState(state.parent)
  }
}
