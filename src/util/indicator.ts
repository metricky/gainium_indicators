import { performance } from 'perf_hooks'
import { CircularArray, CircularArrayState } from './array'

/**
 * Lightweight interface for all indicators
 */
export interface ILightIndicator<T = number, I = number> {
  next(value: I): T | null
  preview(value: I): T | null
  get result(): T | null
}

export type LightIndicatorState = {
  bin: Float64Array[]
  circ: CircularArrayState<any, any>[]
  child?: LightIndicatorState[]
  percentile?: CircularArrayState<number, Float64Array>
  parent?: LightIndicatorState
}

/**
 * Ultralight base indicator for high-performance scenarios
 * Optimized for minimal memory footprint with circular buffer and Float64Array for state
 */
export abstract class LightIndicator<T = number, I = number>
  implements ILightIndicator<T, I>
{
  // Pre-allocated circular buffer for history
  protected readonly _history: CircularArray<I>
  // Float64Array for indicator state storage
  protected _state: Float64Array
  protected _result: T | null = null

  //Tick count for performance tracking
  protected _tickCount: number = 0
  protected _tickTotalTime: number = 0

  /**
   * @param historySize Size of the circular buffer for history values
   * @param initialValue Initial value to fill the history with
   * @param stateSize Size of the Float64Array for state (default: 10)
   */
  constructor(
    historySize: number,
    initialValue: I,
    stateSize: number,
    stateInitialValue: number = 0,
  ) {
    this._history = new CircularArray<I>(historySize, initialValue)
    this._state = new Float64Array(stateSize).fill(stateInitialValue)
  }

  /**
   * Updates the indicator with a new value at the given timestamp
   * Uses zero-allocation approach by reusing objects and Float64Array
   */
  next(value: I): T | null {
    // Increment tick count for performance tracking
    this._tickCount++
    this._tickTotalTime -= performance.now()
    // Update history in a circular buffer pattern
    this._history.add(value)
    this._result = this.calculate()
    // Update tick total time
    this._tickTotalTime += performance.now()
    return this._result
  }

  /**
   * Previews next calculation result without modifying internal state
   * Saves and restores the state for non-destructive preview
   */
  preview(value: I): T | null {
    // Save current state
    const savedResult = this._result
    // Save state
    const savedState = this.exportState()

    // Apply the new value
    this._history.add(value)

    // Calculate with the new value
    const previewResult = this.calculate()

    // Restore state
    this.restoreState(savedState)

    // Restore indicator state
    this._result = savedResult

    return previewResult
  }

  /**
   * Returns the latest calculation result
   */
  get result(): T | null {
    return this._result
  }

  /**
   * Return state for performance tracking
   */
  get performanceState() {
    return {
      tickCount: this._tickCount,
      tickTotalTime: this._tickTotalTime,
      average: this._tickCount > 0 ? this._tickTotalTime / this._tickCount : 0,
    }
  }

  /**
   *
   * Restores the state from a saved state
   * @param state State to restore
   */
  restoreState(state: LightIndicatorState): void {
    // Restore the state from a saved state
    this._state.set(state.bin[0])
    this._history.restoreState(state.circ[0])
  }

  /**
   * Exports the current state of the indicator
   * @returns The current state as a Float64Array
   */
  exportState(): LightIndicatorState {
    // Return the state for external access
    return {
      bin: [this._state.slice()],
      circ: [this._history.exportState()],
    }
  }

  /**
   * Calculates the indicator value based on current history
   */
  protected abstract calculate(): T | null
}
