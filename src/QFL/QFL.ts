import { gt, eq, LightIndicator, hlValue, lastIndexOfEnum } from '../util'
import { QFLResult } from '../types/result'
import { HL } from '../types/candles'
import { Float64CircularArray } from '../util/array'
import { LightIndicatorState } from '../util/indicator'

enum QFLState {
  OFFSET_HIGH = 0,
  LOWEST_LOW = 1,
  BASE = 2,
  PREV_BASE = 3,
  NEW_BASE = 4,
  HIGHEST_HIGH = 5,
}

/**
 * QFL (Quantum Fractal Levels)
 * Type: Support/Resistance/Pattern Recognition Indicator
 *
 * QFL (Quantum Fractal Levels) is a sophisticated pattern recognition indicator that identifies
 * significant support levels (bases) in the market and detects potential breakout opportunities
 * from these established bases. The indicator combines fractal pattern analysis with percentage-based
 * confirmation criteria to create a comprehensive base-and-breakout detection system.
 *
 * The QFL methodology works by identifying fractal lows that form potential support levels,
 * then confirming these levels as valid "bases" when price demonstrates sufficient upward movement
 * (pump) from the low. Once a base is established, the indicator monitors for potential trading
 * opportunities when price returns to test the base and shows signs of rejection or continuation.
 *
 * The indicator's strength lies in its ability to automatically identify key support levels that
 * often serve as significant decision points in market structure. By quantifying the requirements
 * for base formation and breakout confirmation, QFL removes much of the subjectivity from
 * support/resistance identification and provides objective entry criteria.
 *
 * Key Components:
 * - Base Detection: Identifies fractal lows that qualify as significant support levels
 * - Pump Confirmation: Validates bases through upward movement requirements
 * - Base Crack Detection: Monitors for breakdown below established bases
 * - Action Signals: Combines pump and crack criteria for trading opportunities
 *
 * Trading Interpretation:
 * - New Base Detected: Fractal low confirmed as significant support level
 * - Action Signal True: Base has pumped and is now cracking (potential trade setup)
 * - Action Signal False: Conditions not met for trade entry
 * - Base Value: Current active support level for reference
 *
 * Strategy Applications:
 * - Support Level Trading: Use identified bases for support/resistance analysis
 * - Breakout Trading: Enter trades when base crack conditions are met
 * - Risk Management: Use base levels for stop-loss placement
 * - Market Structure: Identify key structural support levels
 * - Confluence Analysis: Combine with other indicators for enhanced signals
 *
 * Advantages:
 * - Objective base identification removes subjective interpretation
 * - Combines pattern recognition with quantitative confirmation
 * - Provides clear entry and exit criteria
 * - Adapts to different market conditions and volatility levels
 *
 * Formula Logic:
 * - Base Formation: Fractal low + subsequent pump percentage confirmation
 * - Action Signal = (Pump from Base > pump%) AND (Base Crack > baseCrack%)
 * - Pump = (Highest High - Base) / Base
 * - Base Crack = (Base - Current Low) / Base
 *
 * Candle Input Type: HL (High, Low required for fractal and range analysis)
 *
 * @see https://www.tradingview.com/script/oUobIEo1-QFL-Base-and-Breakout-Finder/
 * @see https://www.youtube.com/results?search_query=QFL+trading+strategy
 */
export class QFL extends LightIndicator<QFLResult, HL> {
  private readonly highArray: Float64CircularArray
  private readonly lowArray: Float64CircularArray
  private readonly highHistory: Float64CircularArray
  private readonly lowHistory: Float64CircularArray
  private readonly pumpPeriods: number
  /**
   * Creates a new QFL (Quantum Fractal Levels) indicator
   *
   * @param basePeriods Number of periods to look for a low that may form a new base (typically 10-50).
   *                    This determines the fractal lookback for identifying significant lows.
   *                    Larger values identify more significant bases but may miss shorter-term opportunities.
   *                    Common values: 20 (sensitive), 30 (balanced), 50 (conservative).
   * @param pumpPeriods Number of periods the pump must be sustained above the low to confirm a new base
   *                    (typically 5-20, must be less than basePeriods). This ensures the base has
   *                    sufficient follow-through to be considered valid. Shorter periods for faster
   *                    confirmation, longer periods for stronger validation.
   * @param pump Deal start condition - minimum pump percentage from base required (typically 0.02-0.10).
   *             This is the percentage gain from the base that confirms upward momentum.
   *             Lower values (2-3%) for sensitive detection, higher values (5-10%) for stronger confirmation.
   * @param baseCrack Deal start condition - minimum base crack percentage required (typically 0.005-0.03).
   *                  This is the percentage breakdown below the base that triggers action signals.
   *                  Lower values (0.5-1%) for early signals, higher values (2-3%) for confirmed breaks.
   */
  constructor(
    public readonly basePeriods: number,
    _pumpPeriods: number,
    public readonly pump: number,
    public readonly baseCrack: number,
  ) {
    /**
     * Initializes the parent LightIndicator with:
     * @param historyLength 1 - Only needs current candle as fractal analysis uses internal circular buffers
     * @param defaultValue hlValue - Function to extract HL candle data for high/low fractal analysis
     * @param stateSize lastIndexOfEnum(QFLState) - Storage for offset_high, lowest_low, base, prev_base, candle_count, new_base, highest_high (7 elements)
     * @param fillValue NaN - Returns NaN during initialization until sufficient fractal data available
     */
    super(1, hlValue, lastIndexOfEnum(QFLState), NaN)

    // Ensure pumpPeriods is valid
    this.pumpPeriods =
      _pumpPeriods >= this.basePeriods ? this.basePeriods - 1 : _pumpPeriods

    // Initialize circular arrays for storing values
    this.highArray = new Float64CircularArray(this.pumpPeriods)
    this.lowArray = new Float64CircularArray(this.basePeriods)
    this.highHistory = new Float64CircularArray(2)
    this.lowHistory = new Float64CircularArray(this.pumpPeriods + 1)
  }

  protected calculate(): QFLResult | null {
    const s = this._state
    const l = this._history.last
    const ha = this.highArray
    const la = this.lowArray
    const lh = this.lowHistory
    const hh = this.highHistory

    // Track highest high and lowest low
    if (isNaN(s[QFLState.OFFSET_HIGH]) || l.high > s[QFLState.OFFSET_HIGH]) {
      s[QFLState.OFFSET_HIGH] = l.high
    }
    if (isNaN(s[QFLState.LOWEST_LOW]) || l.low < s[QFLState.LOWEST_LOW]) {
      s[QFLState.LOWEST_LOW] = l.low
    }
    // Add values to circular arrays
    ha.add(l.high)
    la.add(l.low)

    if (
      !isNaN(s[QFLState.OFFSET_HIGH]) &&
      ha.oldValue === s[QFLState.OFFSET_HIGH]
    ) {
      s[QFLState.OFFSET_HIGH] = -Infinity
      for (let i = 0; i < ha.size; i++) {
        if (ha.array[i] && ha.array[i] > s[QFLState.OFFSET_HIGH]) {
          s[QFLState.OFFSET_HIGH] = ha.array[i]
        }
      }
    }
    if (
      !isNaN(s[QFLState.LOWEST_LOW]) &&
      la.oldValue === s[QFLState.LOWEST_LOW]
    ) {
      s[QFLState.LOWEST_LOW] = Infinity
      for (let i = 0; i < la.size; i++) {
        if (la.array[i] && la.array[i] < s[QFLState.LOWEST_LOW]) {
          s[QFLState.LOWEST_LOW] = la.array[i]
        }
      }
    }

    // Wait until both arrays are filled
    if (!ha.isFilled || !la.isFilled) {
      return null
    }

    // Determine if there's a new base
    s[QFLState.NEW_BASE] = Number(
      gt(lh.older, lh.older2) && eq(lh.older2, s[QFLState.LOWEST_LOW]),
    )

    // Add to lowHistory
    lh.add(s[QFLState.LOWEST_LOW])

    // If we don't have enough data yet, return null
    if (!lh.isFilled) {
      return null
    }

    // Set base value
    s[QFLState.BASE] = NaN
    if (s[QFLState.NEW_BASE]) {
      // New base detected
      s[QFLState.BASE] = s[QFLState.LOWEST_LOW]
    } else if (!isNaN(s[QFLState.PREV_BASE])) {
      // Use previous base
      s[QFLState.BASE] = s[QFLState.PREV_BASE]
    }
    // Update state
    s[QFLState.PREV_BASE] = s[QFLState.BASE]

    s[QFLState.HIGHEST_HIGH] =
      s[QFLState.NEW_BASE] || (hh.isFilled && gt(l.high, hh.last))
        ? s[QFLState.OFFSET_HIGH]
        : hh.last

    // Store current high in history
    hh.add(s[QFLState.HIGHEST_HIGH])
    return {
      action:
        gt(
          (s[QFLState.HIGHEST_HIGH] - s[QFLState.BASE]) / s[QFLState.BASE],
          this.pump,
        ) && gt((s[QFLState.BASE] - l.low) / s[QFLState.BASE], this.baseCrack),
      base: s[QFLState.BASE],
    }
  }

  /**
   * Exports the state of the indicator for restoration later
   */
  override exportState(): LightIndicatorState {
    return {
      parent: super.exportState(),
      circ: [
        this.highArray.exportState(),
        this.lowArray.exportState(),
        this.highHistory.exportState(),
        this.lowHistory.exportState(),
      ],
      child: [],
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
    if (!state.circ || state.circ.length < 4) {
      throw new Error(
        'Invalid state: circular buffer state is missing or incomplete',
      )
    }

    // Restore circular arrays if available

    this.highArray.restoreState(state.circ[0])
    this.lowArray.restoreState(state.circ[1])
    this.highHistory.restoreState(state.circ[2])
    this.lowHistory.restoreState(state.circ[3])

    super.restoreState(state.parent)
  }
}
