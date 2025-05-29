import { LightIndicator, LightIndicatorState } from '../util/indicator'
import { PivotResult } from '../types/result'
import { HLC } from '../types/candles'
import { Float64CircularArray } from '../util/array'
import { PivotCalculator } from '../util/pivot'
import { hlcValue, lastIndexOfEnum } from '../util'

// Define state indices for performance and readability
enum SupportResistanceState {
  PIVOT_HIGH = 0, // Current pivot high value
  PIVOT_LOW = 1, // Current pivot low value
  PREV_PIVOT_HIGH = 2, // Previous pivot high value
  PREV_PIVOT_LOW = 3, // Previous pivot low value
}

/**
 * Support Resistance Indicator
 *
 * Uses pivot points to identify support and resistance levels.
 * Support and resistance levels are key price levels where the price tends
 * to find support (stop falling) or resistance (stop rising).
 */
export class SupportResistance extends LightIndicator<PivotResult, HLC> {
  // Circular buffers for high and low values
  private readonly highValues: Float64CircularArray
  private readonly lowValues: Float64CircularArray

  // Pivot point calculators
  private readonly pivotHighCalculator: PivotCalculator
  private readonly pivotLowCalculator: PivotCalculator

  /**
   * Constructs a Support Resistance indicator.
   *
   * @param leftBars Left bar offset for pivot calculation
   * @param rightBars Right bars offset for pivot calculation
   */
  constructor(
    public readonly leftBars: number,
    public readonly rightBars: number,
  ) {
    // Initialize the base class with state array
    super(1, hlcValue, lastIndexOfEnum(SupportResistanceState), NaN)

    const range = this.leftBars + this.rightBars

    // Initialize circular buffers
    this.highValues = new Float64CircularArray(range + 1, NaN)
    this.lowValues = new Float64CircularArray(range + 1, NaN)

    // Initialize pivot calculators
    this.pivotHighCalculator = new PivotCalculator(leftBars, rightBars, 'high')
    this.pivotLowCalculator = new PivotCalculator(leftBars, rightBars, 'low')
  }

  /**
   * Calculate support and resistance levels
   */
  protected calculate(): PivotResult | null {
    const s = this._state
    const l = this._history.last
    const hv = this.highValues
    const lv = this.lowValues

    // Add current high and low values to circular buffers
    hv.add(l.high)
    lv.add(l.low)

    // Calculate pivot points
    s[SupportResistanceState.PIVOT_HIGH] = this.pivotHighCalculator.calculate(
      hv.normalizedArray,
    )

    s[SupportResistanceState.PIVOT_LOW] = this.pivotLowCalculator.calculate(
      lv.normalizedArray,
    )

    // Use previous values if current pivots are not valid
    if (
      isNaN(s[SupportResistanceState.PIVOT_HIGH]) &&
      !isNaN(s[SupportResistanceState.PREV_PIVOT_HIGH])
    ) {
      s[SupportResistanceState.PIVOT_HIGH] =
        s[SupportResistanceState.PREV_PIVOT_HIGH]
    }

    if (
      isNaN(s[SupportResistanceState.PIVOT_LOW]) &&
      !isNaN(s[SupportResistanceState.PREV_PIVOT_LOW])
    ) {
      s[SupportResistanceState.PIVOT_LOW] =
        s[SupportResistanceState.PREV_PIVOT_LOW]
    }

    // Store current pivots for next calculation
    s[SupportResistanceState.PREV_PIVOT_HIGH] =
      s[SupportResistanceState.PIVOT_HIGH]
    s[SupportResistanceState.PREV_PIVOT_LOW] =
      s[SupportResistanceState.PIVOT_LOW]

    // Check if we have valid values
    if (
      !isNaN(s[SupportResistanceState.PIVOT_HIGH]) &&
      !isNaN(s[SupportResistanceState.PIVOT_LOW])
    ) {
      return {
        high: s[SupportResistanceState.PIVOT_HIGH],
        low: s[SupportResistanceState.PIVOT_LOW],
        price: l.close,
      }
    }

    return null
  }

  /**
   * Export the state of the indicator
   */
  override exportState(): LightIndicatorState {
    return {
      parent: super.exportState(),
      circ: [this.highValues.exportState(), this.lowValues.exportState()],
      bin: [],
    }
  }

  /**
   * Restore the state of the indicator
   */
  override restoreState(state: LightIndicatorState): void {
    if (!state.parent) {
      throw new Error('Invalid state: parent state is missing')
    }

    if (!state.circ) {
      throw new Error('Invalid state: circular buffer states are missing')
    }

    if (!state.bin) {
      throw new Error('Invalid state: pivot calculator states are missing')
    }

    // Restore circular buffer states
    this.highValues.restoreState(state.circ[1])
    this.lowValues.restoreState(state.circ[2])

    // Restore parent state
    super.restoreState(state.parent)
  }
}
