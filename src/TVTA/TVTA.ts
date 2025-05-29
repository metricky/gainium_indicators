import { SMA } from '../SMA/SMA'
import { EMA } from '../EMA/EMA'
import { RSI } from '../RSI/RSI'
import { StochasticOscillator } from '../STOCH/StochasticOscillator'
import { CCI } from '../CCI/CCI'
import { ADX } from '../ADX/ADX'
import { AO } from '../AO/AO'
import { MACD } from '../MACD/MACD'
import { StochasticRSI } from '../STOCH/StochasticRSI'
import { WilliamsR } from '../WR/WR'
import { BullBear } from '../BullBear/BullBear'
import { UltimateOscillator } from '../UO/UO'
import { IchimokuCloud } from '../Ichimoku/IC'
import { VWMA } from '../VWMA/VWMA'
import { HMA } from '../HMA/HMA'
import { MOM } from '../MOM/MOM'
import {
  gt,
  lt,
  LightIndicator,
  LightIndicatorState,
  crossover,
  crossunder,
  ohlcvValue,
  lastIndexOfEnum,
} from '../util'
import { OHLCV } from '../types/candles'
import { Float64CircularArray } from '../util/array'

// Define state indices for better performance and readability
enum TVTAState {
  RESULT = 0, // Current TVTA result value
  TOTAL_POINTS = 1, // Total points from all indicators
  PREV_POINTS = 2, // Previous total points value
}

/**
 * TradingView Technical Analysis (TVTA) - Composite Rating System
 * Type: Composite / Multi-Indicator / Consensus Analysis
 *
 * The TradingView Technical Analysis (TVTA) indicator is a comprehensive composite
 * rating system that aggregates signals from multiple technical indicators to provide
 * an overall market sentiment assessment. This sophisticated system combines insights
 * from 26+ individual indicators spanning trend analysis, momentum oscillators, and
 * volume analysis to deliver a unified market direction rating.
 *
 * Developed to address the challenge of conflicting signals from individual indicators,
 * TVTA employs a democratic voting system where each component indicator contributes
 * a weighted vote (+1 for bullish, -1 for bearish, 0 for neutral). The final rating
 * represents the consensus view of multiple analytical approaches, reducing the noise
 * and false signals inherent in single-indicator analysis.
 *
 * The system incorporates indicators from all major technical analysis categories:
 * - Moving Averages (7 SMAs + 7 EMAs): Trend direction consensus
 * - Momentum Oscillators (RSI, Stochastic, CCI, Williams %R, Stochastic RSI): Overbought/oversold conditions
 * - Trend Strength (ADX, Awesome Oscillator, Momentum): Trend quality assessment
 * - Divergence Analysis (MACD): Price-momentum relationships
 * - Market Structure (Ichimoku Cloud): Multi-dimensional trend analysis
 * - Volume Confirmation (VWMA): Volume-weighted price validation
 * - Advanced Smoothing (HMA): Reduced-lag trend identification
 * - Market Power (Bull/Bear Power, Ultimate Oscillator): Buying/selling pressure
 *
 * Key Characteristics:
 * - Aggregates 26+ technical indicators for comprehensive market analysis
 * - Democratic voting system reduces individual indicator bias
 * - Configurable threshold levels for strong buy/sell signals
 * - Optional entry/exit point mode for precise timing
 * - Real-time consensus calculation with historical context
 * - Robust against single indicator failures or anomalies
 *
 * Trading Interpretation:
 * - 0: Neutral - Mixed signals, no clear directional bias, wait for clarity
 * - 1: Buy - Moderately bullish consensus, consider long positions with confirmation
 * - 2: Strong Buy - Strong bullish consensus, high-probability long opportunities
 * - 3: Sell - Moderately bearish consensus, consider short positions with confirmation
 * - 4: Strong Sell - Strong bearish consensus, high-probability short opportunities
 * - 5: No Action - Entry/exit mode only, insufficient signal change for action
 *
 * Consensus Analysis:
 * - Strong signals (2/4): Multiple indicators align, high confidence trades
 * - Moderate signals (1/3): Majority agreement, proceed with caution
 * - Neutral (0): Conflicting signals, avoid directional bias
 * - No action (5): Signal persistence, avoid overtrading
 *
 * Component Indicator Categories:
 * 1. Trend Following (14 indicators):
 *    - SMA: 5, 10, 20, 30, 50, 100, 200 periods
 *    - EMA: 5, 10, 20, 30, 50, 100, 200 periods
 *    Each compares current price to moving average level
 *
 * 2. Momentum Oscillators (5 indicators):
 *    - RSI(14): 70/30 overbought/oversold levels
 *    - Stochastic(14,3,3): 80/20 extreme levels
 *    - CCI(20): ±100 threshold levels
 *    - Williams %R(14): -20/-80 threshold levels
 *    - Stochastic RSI(14,14,3,3): 80/20 extreme levels
 *
 * 3. Trend Strength & Direction (3 indicators):
 *    - ADX(14): Crossover analysis with 20 threshold
 *    - Awesome Oscillator(5,34): Zero line and momentum direction
 *    - Momentum(10): Rate of change comparison
 *
 * 4. Advanced Analysis (4 indicators):
 *    - MACD(12,26,9): Histogram momentum changes
 *    - Bull/Bear Power(30): Market pressure assessment
 *    - Ultimate Oscillator(7,14,28): Multi-timeframe momentum
 *    - Ichimoku Cloud: Price vs baseline comparison
 *
 * 5. Volume & Smoothed Trends (2 indicators):
 *    - VWMA(20): Volume-weighted price trend
 *    - HMA(9): Reduced-lag trend following
 *
 * Advanced Analysis Techniques:
 * - Signal Strength Assessment: Strong signals require threshold breach (default: ±15 points)
 * - Consensus Quality: Higher absolute scores indicate stronger agreement
 * - Signal Persistence: Entry/exit mode prevents overtrading on minor changes
 * - Component Analysis: Individual indicator examination for signal validation
 * - Threshold Optimization: Adjust levels based on market volatility and timeframe
 *
 * Strategy Applications:
 * - Portfolio Allocation: Use strong signals for position sizing decisions
 * - Market Timing: Enter markets during strong consensus periods
 * - Risk Management: Reduce exposure during neutral or conflicting signals
 * - Trend Confirmation: Validate individual indicator signals with consensus
 * - Entry/Exit System: Use precise mode for systematic trading signals
 * - Multiple Timeframes: Apply across timeframes for hierarchical analysis
 *
 * Market Condition Adaptations:
 * - Trending Markets: Strong signals (2/4) highly reliable for trend following
 * - Range-bound Markets: Moderate signals (1/3) better for mean reversion
 * - High Volatility: Increase threshold levels to reduce noise
 * - Low Volatility: Standard thresholds may be sufficient
 * - News Events: Monitor for rapid consensus changes
 * - Market Transitions: Neutral signals often precede regime changes
 *
 * Parameter Guidelines:
 * - checkLevel (Threshold):
 *   - Conservative: 18-20 (fewer but higher quality signals)
 *   - Balanced: 15 (default, good signal frequency)
 *   - Aggressive: 10-12 (more signals, higher noise)
 *   - Very Aggressive: 5-8 (frequent signals, requires filtering)
 *
 * - useAsEntryExitPoints:
 *   - false: Continuous rating system for general market assessment
 *   - true: Precise entry/exit signals with signal change requirements
 *
 * Mode Comparison:
 * - Continuous Mode: Real-time market sentiment, good for discretionary trading
 * - Entry/Exit Mode: Systematic signals, prevents overtrading, requires signal transitions
 *
 * Advantages:
 * - Comprehensive multi-indicator analysis reduces single-point failures
 * - Democratic voting system provides balanced market assessment
 * - Robust against individual indicator malfunctions or extreme readings
 * - Configurable sensitivity for different trading styles and market conditions
 * - Incorporates multiple analytical methodologies (trend, momentum, volume)
 * - Reduces emotional trading decisions through systematic consensus
 * - Excellent for confirming trading ideas from other sources
 *
 * Limitations:
 * - Complex calculation requires significant computational resources
 * - May lag during rapid market transitions due to consensus requirement
 * - Threshold optimization needed for different markets and timeframes
 * - Can produce conflicting signals during market regime changes
 * - Requires understanding of component indicators for troubleshooting
 * - May be overly conservative during trending markets if threshold too high
 *
 * Implementation Details:
 * - Point System: Each indicator contributes ±1 or 0 to total score
 * - Maximum possible score: ±26 points (all indicators aligned)
 * - Typical strong signal range: ±15 to ±20 points
 * - Neutral zone: -threshold < score < +threshold
 * - Real-time calculation with historical context for momentum indicators
 *
 * Formula: TVTA = f(∑(Indicator_i × Weight_i)) where Weight = ±1 or 0
 * Input Type: OHLCV (requires complete candle data for all component indicators)
 *
 * @see https://www.tradingview.com/support/solutions/43000521824-about-technical-ratings/
 * @see https://www.investopedia.com/terms/t/technical-analysis-of-stocks-and-trends.asp
 * @see https://school.stockcharts.com/doku.php?id=overview:technical_analysis
 */
export class TVTA extends LightIndicator<number, OHLCV> {
  static readonly RSI_BAND_1 = 70 // RSI upper band for buy/sell signals
  static readonly RSI_BAND_2 = 30 // RSI lower band for buy/sell signals
  static readonly STOCH_H0 = 80 // Stochastic upper band for buy/sell signals
  static readonly STOCH_H1 = 20 // Stochastic lower band for buy/sell signals
  static readonly CCI_BAND_1 = 100 // CCI upper band for buy/sell signals
  static readonly CCI_BAND_2 = -100 // CCI lower band for buy/sell signals
  static readonly ADX_LINE = 20 // ADX threshold for trend strength
  static readonly WR_BAND_1 = -20 // Williams %R upper band for buy/sell signals
  static readonly WR_BAND_2 = -80 // Williams %R lower band for buy/sell signals
  static readonly UO_BAND_1 = 70 // Ultimate Oscillator upper band for buy/sell signals
  static readonly UO_BAND_0 = 30 // Ultimate Oscillator lower band for buy/sell signals
  // Moving averages
  private readonly sma5: SMA
  private readonly sma10: SMA
  private readonly sma20: SMA
  private readonly sma30: SMA
  private readonly sma50: SMA
  private readonly sma100: SMA
  private readonly sma200: SMA
  private readonly ema5: EMA
  private readonly ema10: EMA
  private readonly ema20: EMA
  private readonly ema30: EMA
  private readonly ema50: EMA
  private readonly ema100: EMA
  private readonly ema200: EMA

  // Oscillators
  private readonly rsi: RSI
  private readonly stoch: StochasticOscillator
  private readonly cci: CCI
  private readonly adx: ADX
  private readonly ao: AO
  private readonly mom: MOM
  private readonly macd: MACD
  private readonly stochRsi: StochasticRSI
  private readonly williamsR: WilliamsR
  private readonly bbp: BullBear
  private readonly uo: UltimateOscillator
  private readonly ic: IchimokuCloud
  private readonly vwma: VWMA
  private readonly hma: HMA

  // Circular buffers for historical data
  private readonly adxPlusHistory: Float64CircularArray
  private readonly adxMinusHistory: Float64CircularArray
  private readonly aoHistory: Float64CircularArray
  private readonly momHistory: Float64CircularArray
  private readonly macdHistory: Float64CircularArray
  private readonly pointsHistory: Float64CircularArray

  /**
   * Creates a new TVTA indicator
   *
   * @param checkLevel Threshold level for strong buy/sell signals (default: 15)
   * @param useAsEntryExitPoints Whether to use as entry/exit points (returns 5 for no action)
   * @param logPrefix Optional prefix for console logs (empty to disable logging)
   */
  constructor(
    private readonly checkLevel: number = 15,
    private readonly useAsEntryExitPoints: boolean = false,
  ) {
    // Initialize with state array for result and calculations
    super(1, ohlcvValue, lastIndexOfEnum(TVTAState), NaN)

    // Initialize all component indicators
    // Moving averages
    this.sma5 = new SMA(5)
    this.sma10 = new SMA(10)
    this.sma20 = new SMA(20)
    this.sma30 = new SMA(30)
    this.sma50 = new SMA(50)
    this.sma100 = new SMA(100)
    this.sma200 = new SMA(200)
    this.ema5 = new EMA(5)
    this.ema10 = new EMA(10)
    this.ema20 = new EMA(20)
    this.ema30 = new EMA(30)
    this.ema50 = new EMA(50)
    this.ema100 = new EMA(100)
    this.ema200 = new EMA(200)

    // Oscillators
    this.rsi = new RSI(14)
    this.stoch = new StochasticOscillator(14, 3, 3)
    this.cci = new CCI(20, 'close')
    this.adx = new ADX(14)
    this.ao = new AO(5, 34)
    this.mom = new MOM(10, 'close')
    this.macd = new MACD(new EMA(12), new EMA(26), new EMA(9))
    this.stochRsi = new StochasticRSI(14, 14, 3, 3)
    this.williamsR = new WilliamsR(14)
    this.bbp = new BullBear(30)
    this.uo = new UltimateOscillator(7, 14, 28)
    this.ic = new IchimokuCloud(9, 26, 52, 26)
    this.vwma = new VWMA(20)
    this.hma = new HMA(9)

    // Initialize circular buffers for history
    this.adxPlusHistory = new Float64CircularArray(2, 0)
    this.adxMinusHistory = new Float64CircularArray(2, 0)
    this.aoHistory = new Float64CircularArray(2, 0)
    this.momHistory = new Float64CircularArray(2, 0)
    this.macdHistory = new Float64CircularArray(2, 0)
    this.pointsHistory = new Float64CircularArray(2, 0)
  }

  /**
   * Calculate TVTA value based on all component indicators
   */
  protected calculate(): number | null {
    const s = this._state
    const l = this._history.last
    const c = l.close

    // Calculate all component indicators
    // Moving averages
    this.sma5.next(c)
    this.sma10.next(c)
    this.sma20.next(c)
    this.sma30.next(c)
    this.sma50.next(c)
    this.sma100.next(c)
    this.sma200.next(c)
    this.ema5.next(c)
    this.ema10.next(c)
    this.ema20.next(c)
    this.ema30.next(c)
    this.ema50.next(c)
    this.ema100.next(c)
    this.ema200.next(c)

    // Oscillators and other indicators
    this.rsi.next(c)
    this.stoch.next(l)
    this.cci.next(l)
    this.adx.next(l)
    this.ao.next(l)
    this.mom.next(l)
    this.macd.next(c)
    this.stochRsi.next(l)
    this.williamsR.next(l)
    this.bbp.next(l)
    this.uo.next(l)
    this.ic.next(l)
    this.vwma.next(l)
    this.hma.next(c)
    if (
      this.sma5.result === null ||
      this.sma10.result === null ||
      this.sma20.result === null ||
      this.sma30.result === null ||
      this.sma50.result === null ||
      this.sma100.result === null ||
      this.sma200.result === null ||
      this.ema5.result === null ||
      this.ema10.result === null ||
      this.ema20.result === null ||
      this.ema30.result === null ||
      this.ema50.result === null ||
      this.ema100.result === null ||
      this.ema200.result === null ||
      this.rsi.result === null ||
      this.stoch.result === null ||
      this.cci.result === null ||
      this.adx.result === null ||
      this.ao.result === null ||
      this.mom.result === null ||
      this.macd.result === null ||
      this.stochRsi.result === null ||
      this.williamsR.result === null ||
      this.bbp.result === null ||
      this.uo.result === null ||
      this.ic.result === null ||
      this.vwma.result === null ||
      this.hma.result === null
    ) {
      return null
    }

    // Store ADX plus/minus DI values
    this.adxPlusHistory.add(this.adx.pdi)
    this.adxMinusHistory.add(this.adx.mdi)

    // Store AO history
    this.aoHistory.add(this.ao.result!.value)

    // Store MOM history
    this.momHistory.add(this.mom.result!.value)

    // Store MACD histogram history
    this.macdHistory.add(this.macd.result!.histogram)

    s[TVTAState.TOTAL_POINTS] = 0 // Reset result before calculation
    // Calculate individual indicator signals
    // SMAs comparison to price
    s[TVTAState.TOTAL_POINTS] += gt(c, this.sma5.result!) ? 1 : -1
    s[TVTAState.TOTAL_POINTS] += gt(c, this.sma10.result!) ? 1 : -1
    s[TVTAState.TOTAL_POINTS] += gt(c, this.sma20.result!) ? 1 : -1
    s[TVTAState.TOTAL_POINTS] += gt(c, this.sma30.result!) ? 1 : -1
    s[TVTAState.TOTAL_POINTS] += gt(c, this.sma50.result!) ? 1 : -1
    s[TVTAState.TOTAL_POINTS] += gt(c, this.sma100.result!) ? 1 : -1
    s[TVTAState.TOTAL_POINTS] += gt(c, this.sma200.result!) ? 1 : -1

    // EMAs comparison to price
    s[TVTAState.TOTAL_POINTS] += gt(c, this.ema5.result!) ? 1 : -1
    s[TVTAState.TOTAL_POINTS] += gt(c, this.ema10.result!) ? 1 : -1
    s[TVTAState.TOTAL_POINTS] += gt(c, this.ema20.result!) ? 1 : -1
    s[TVTAState.TOTAL_POINTS] += gt(c, this.ema30.result!) ? 1 : -1
    s[TVTAState.TOTAL_POINTS] += gt(c, this.ema50.result!) ? 1 : -1
    s[TVTAState.TOTAL_POINTS] += gt(c, this.ema100.result!) ? 1 : -1
    s[TVTAState.TOTAL_POINTS] += gt(c, this.ema200.result!) ? 1 : -1

    // RSI band analysis
    s[TVTAState.TOTAL_POINTS] += gt(this.rsi.result!.value, TVTA.RSI_BAND_1)
      ? -1
      : lt(this.rsi.result!.value, TVTA.RSI_BAND_2)
        ? 1
        : 0

    // Stochastic oscillator analysis
    s[TVTAState.TOTAL_POINTS] += gt(this.stoch.result!.stochK, TVTA.STOCH_H0)
      ? -1
      : lt(this.stoch.result!.stochK, TVTA.STOCH_H1)
        ? 1
        : 0

    // CCI analysis
    s[TVTAState.TOTAL_POINTS] += gt(this.cci.result!.value, TVTA.CCI_BAND_1)
      ? -1
      : lt(this.cci.result!.value, TVTA.CCI_BAND_2)
        ? 1
        : 0

    // ADX analysis
    // Create arrays for crossover calculations using last and previous values

    s[TVTAState.TOTAL_POINTS] +=
      gt(this.adx.result!.value, TVTA.ADX_LINE) &&
      crossover(this.adxPlusHistory.array, this.adxMinusHistory.array)
        ? 1
        : gt(this.adx.result!.value, TVTA.ADX_LINE) &&
            crossunder(this.adxPlusHistory.array, this.adxMinusHistory.array)
          ? -1
          : 0

    // Awesome Oscillator analysis
    s[TVTAState.TOTAL_POINTS] +=
      gt(this.ao.result!.value, 0) &&
      gt(this.ao.result!.value, this.aoHistory.prev)
        ? 1
        : lt(this.ao.result!.value, 0) &&
            lt(this.ao.result!.value, this.aoHistory.prev)
          ? -1
          : 0

    // MOM analysis
    s[TVTAState.TOTAL_POINTS] += gt(
      this.mom.result!.value,
      this.momHistory.prev,
    )
      ? 1
      : lt(this.mom.result!.value, this.momHistory.prev)
        ? -1
        : 0

    // MACD analysis
    s[TVTAState.TOTAL_POINTS] += gt(
      this.macd.result!.histogram,
      this.macdHistory.prev,
    )
      ? 1
      : -1

    // Stochastic RSI analysis
    s[TVTAState.TOTAL_POINTS] += gt(this.stochRsi.result!.stochK, TVTA.STOCH_H0)
      ? -1
      : lt(this.stochRsi.result!.stochK, TVTA.STOCH_H1)
        ? 1
        : 0

    // Williams %R analysis
    s[TVTAState.TOTAL_POINTS] += gt(
      this.williamsR.result!.value,
      TVTA.WR_BAND_1,
    )
      ? -1
      : lt(this.williamsR.result!.value, TVTA.WR_BAND_2)
        ? 1
        : 0

    // Bull/Bear power analysis
    s[TVTAState.TOTAL_POINTS] += gt(this.bbp.result!, 0) ? 1 : -1

    // Ultimate Oscillator analysis
    s[TVTAState.TOTAL_POINTS] += gt(this.uo.result!.value, TVTA.UO_BAND_1)
      ? 1
      : lt(this.uo.result!.value, TVTA.UO_BAND_0)
        ? -1
        : 0

    // Ichimoku Cloud analysis
    s[TVTAState.TOTAL_POINTS] += gt(c, this.ic.result!.baseLine) ? 1 : -1

    // VWMA analysis
    s[TVTAState.TOTAL_POINTS] += gt(c, this.vwma.result!) ? 1 : -1

    // HMA analysis
    s[TVTAState.TOTAL_POINTS] += gt(c, this.hma.result!) ? 1 : -1

    // Store current and shift previous points
    s[TVTAState.PREV_POINTS] = this.pointsHistory.last
    this.pointsHistory.add(s[TVTAState.TOTAL_POINTS])

    // Calculate TVTA result based on accumulated points
    if (this.useAsEntryExitPoints) {
      // Entry/exit mode uses stricter conditions
      s[TVTAState.RESULT] =
        s[TVTAState.TOTAL_POINTS] >= this.checkLevel &&
        s[TVTAState.PREV_POINTS] <= 0
          ? 2 // Strong buy - points threshold reached with previous non-positive
          : s[TVTAState.TOTAL_POINTS] < this.checkLevel &&
              s[TVTAState.TOTAL_POINTS] > 0 &&
              s[TVTAState.PREV_POINTS] <= 0
            ? 1 // Buy - positive but below threshold, with previous non-positive
            : s[TVTAState.TOTAL_POINTS] <= -this.checkLevel &&
                s[TVTAState.PREV_POINTS] >= 0
              ? 4 // Strong sell - negative threshold reached with previous non-negative
              : s[TVTAState.TOTAL_POINTS] > -this.checkLevel &&
                  s[TVTAState.TOTAL_POINTS] < 0 &&
                  s[TVTAState.PREV_POINTS] >= 0
                ? 3 // Sell - negative but above threshold, with previous non-negative
                : s[TVTAState.TOTAL_POINTS] === 0
                  ? 0 // Neutral - exactly zero points
                  : 5 // No action - doesn't meet any criteria for entry/exit
    } else {
      // Normal mode uses simpler conditions based only on points
      s[TVTAState.RESULT] =
        s[TVTAState.TOTAL_POINTS] >= this.checkLevel
          ? 2 // Strong buy
          : s[TVTAState.TOTAL_POINTS] > 0 &&
              s[TVTAState.TOTAL_POINTS] < this.checkLevel
            ? 1 // Buy
            : s[TVTAState.TOTAL_POINTS] <= -this.checkLevel
              ? 4 // Strong sell
              : s[TVTAState.TOTAL_POINTS] < 0 &&
                  s[TVTAState.TOTAL_POINTS] > -this.checkLevel
                ? 3 // Sell
                : 0 // Neutral
    }

    return s[TVTAState.RESULT]
  }

  /**
   * Export indicator state
   */
  override exportState(): LightIndicatorState {
    return {
      parent: super.exportState(),
      child: [
        this.sma5.exportState(),
        this.sma10.exportState(),
        this.sma20.exportState(),
        this.sma30.exportState(),
        this.sma50.exportState(),
        this.sma100.exportState(),
        this.sma200.exportState(),
        this.ema5.exportState(),
        this.ema10.exportState(),
        this.ema20.exportState(),
        this.ema30.exportState(),
        this.ema50.exportState(),
        this.ema100.exportState(),
        this.ema200.exportState(),
        this.rsi.exportState(),
        this.stoch.exportState(),
        this.cci.exportState(),
        this.adx.exportState(),
        this.ao.exportState(),
        this.mom.exportState(),
        this.macd.exportState(),
        this.stochRsi.exportState(),
        this.williamsR.exportState(),
        this.bbp.exportState(),
        this.uo.exportState(),
        this.ic.exportState(),
        this.vwma.exportState(),
        this.hma.exportState(),
      ],
      circ: [
        this.adxPlusHistory.exportState(), // ADX Plus DI history
        this.adxMinusHistory.exportState(), // ADX Minus DI history
        this.aoHistory.exportState(), // AO history
        this.momHistory.exportState(), // MOM history
        this.macdHistory.exportState(), // MACD histogram history
        this.pointsHistory.exportState(), // Total points history
      ],
      bin: [], // No binary state needed
    }
  }

  /**
   * Restore indicator state
   */
  override restoreState(state: LightIndicatorState): void {
    if (!state.parent) {
      throw new Error('Invalid state: parent state is missing')
    }

    if (!state.child) {
      throw new Error('Invalid state: child state is missing or incomplete')
    }

    if (!state.circ) {
      throw new Error('Invalid state: circular buffer states are missing')
    }

    // Restore circular arrays
    this.adxPlusHistory.restoreState(state.circ[1])
    this.adxMinusHistory.restoreState(state.circ[2])
    this.aoHistory.restoreState(state.circ[3])
    this.momHistory.restoreState(state.circ[4])
    this.macdHistory.restoreState(state.circ[5])
    this.pointsHistory.restoreState(state.circ[6])

    // Restore component indicators
    this.sma5.restoreState(state.child[0])
    this.sma10.restoreState(state.child[1])
    this.sma20.restoreState(state.child[2])
    this.sma30.restoreState(state.child[3])
    this.sma50.restoreState(state.child[4])
    this.sma100.restoreState(state.child[5])
    this.sma200.restoreState(state.child[6])
    this.ema5.restoreState(state.child[7])
    this.ema10.restoreState(state.child[8])
    this.ema20.restoreState(state.child[9])
    this.ema30.restoreState(state.child[10])
    this.ema50.restoreState(state.child[11])
    this.ema100.restoreState(state.child[12])
    this.ema200.restoreState(state.child[13])
    this.rsi.restoreState(state.child[14])
    this.stoch.restoreState(state.child[15])
    this.cci.restoreState(state.child[16])
    this.adx.restoreState(state.child[17])
    this.ao.restoreState(state.child[18])
    this.mom.restoreState(state.child[19])
    this.macd.restoreState(state.child[20])
    this.stochRsi.restoreState(state.child[21])
    this.williamsR.restoreState(state.child[22])
    this.bbp.restoreState(state.child[23])
    this.uo.restoreState(state.child[24])
    this.ic.restoreState(state.child[25])
    this.vwma.restoreState(state.child[26])
    this.hma.restoreState(state.child[27])

    // Restore parent state (must be called last)
    super.restoreState(state.parent)
  }
}
