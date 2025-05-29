import { lastIndexOfEnum } from './state'

enum CircularArrayStateEnum {
  INDEX = 0,
  PREV_INDEX = 1,
  FILLED = 2,
}

export interface CircularArrayState<T, A> {
  array: A
  state: Float64Array
  oldValue: T
}

/**
 * Base abstract circular array class containing common functionality
 */
export abstract class BaseCircularArray<T, A> {
  protected _array!: A
  protected _state: Float64Array
  protected _oldValue: T

  /**
   * Creates a new circular array
   * @param _size Size of the circular buffer
   * @param initialValue Initial value to fill the buffer with
   */
  constructor(
    protected readonly _size: number,
    initialValue: T,
  ) {
    this._state = new Float64Array(lastIndexOfEnum(CircularArrayStateEnum))
    this._oldValue = initialValue
  }

  /**
   * Adds a value to the circular buffer and updates indices
   * @param value Value to add
   */
  public add(value: T): boolean {
    const s = this._state
    this._oldValue = this.getValue(s[CircularArrayStateEnum.INDEX])
    this.setValue(s[CircularArrayStateEnum.INDEX], value)
    s[CircularArrayStateEnum.PREV_INDEX] = s[CircularArrayStateEnum.INDEX]
    s[CircularArrayStateEnum.INDEX] =
      (s[CircularArrayStateEnum.INDEX] + 1) % this._size
    if (
      !s[CircularArrayStateEnum.FILLED] &&
      s[CircularArrayStateEnum.INDEX] === 0
    ) {
      s[CircularArrayStateEnum.FILLED] = 1
    }
    return !!s[CircularArrayStateEnum.FILLED]
  }

  /**
   * Gets a value from the array at the specified index
   * @param index Array index
   */
  protected abstract getValue(index: number): T

  /**
   * Sets a value in the array at the specified index
   * @param index Array index
   * @param value Value to set
   */
  protected abstract setValue(index: number, value: T): void

  /**
   * Exports the current state of the circular array
   * @returns Object containing all state needed to restore the array
   */
  public abstract exportState(): CircularArrayState<T, A>

  /**
   * Imports state into the circular array
   * @param state Previously exported state
   */
  public abstract restoreState(state: CircularArrayState<T, A>): void

  /**
   * Current element (at current index)
   */
  get current(): T {
    return this.getValue(this._state[CircularArrayStateEnum.INDEX])
  }

  /**
   * Last added value
   */
  get oldValue(): T {
    return this._oldValue
  }

  /**
   * Last added element (at previous index)
   */
  get last(): T {
    return this.getValue(this._state[CircularArrayStateEnum.PREV_INDEX])
  }

  /**
   * Element before the last added (previous-previous)
   */
  get prev(): T {
    const s = this._state
    return this.getValue(
      (s[CircularArrayStateEnum.PREV_INDEX] - 1 + this._size) % this._size,
    )
  }

  /**
   * Element 2 before the last added (previous-previous-previous)
   */
  get prev2(): T {
    const s = this._state
    return this.getValue(
      (s[CircularArrayStateEnum.PREV_INDEX] - 2 + this._size) % this._size,
    )
  }

  /**
   * Older element
   */
  get older(): T {
    const s = this._state
    return this.getValue(
      (s[CircularArrayStateEnum.PREV_INDEX] + 1) % this._size,
    )
  }

  /**
   * Older element (2nd last)
   */
  get older2(): T {
    const s = this._state
    return this.getValue(
      (s[CircularArrayStateEnum.PREV_INDEX] + 2) % this._size,
    )
  }

  /**
   * Current index for the next addition
   */
  get index(): number {
    return this._state[CircularArrayStateEnum.INDEX]
  }

  /**
   * Previous index where the last value was added
   */
  get prevIndex(): number {
    return this._state[CircularArrayStateEnum.PREV_INDEX]
  }

  /**
   * Whether the buffer has been completely filled at least once
   */
  get isFilled(): boolean {
    return this._state[CircularArrayStateEnum.FILLED] === 1
  }

  /**
   * Raw access to the underlying array (use with caution)
   */
  get array(): A {
    return this._array
  }

  /**
   * Normalized array. 0 - oldest value, size - newest value
   */
  get normalizedArray(): T[] {
    const result: T[] = []
    const s = this._state
    for (let i = 0; i < this._size; i++) {
      result.push(
        this.getValue((s[CircularArrayStateEnum.INDEX] + i) % this._size),
      )
    }
    return result
  }

  /**
   * Size of the circular buffer
   */
  get size(): number {
    return this._size
  }
}

/**
 * Circular array implementation for standard arrays (non-numeric types)
 */
export class CircularArray<T> extends BaseCircularArray<T, T[]> {
  /**
   * Creates a new circular array with standard array implementation
   * @param size Size of the circular buffer
   * @param initialValue Initial value to fill the buffer with
   */
  constructor(size: number, initialValue: T) {
    super(size, initialValue)
    this._array = new Array(size).fill(initialValue)
  }

  /**
   * Gets a value from the array at the specified index
   * @param index Array index
   */
  protected getValue(index: number): T {
    return this._array[index]
  }

  /**
   * Sets a value in the array at the specified index
   * @param index Array index
   * @param value Value to set
   */
  protected setValue(index: number, value: T): void {
    this._array[index] = value
  }

  /**
   * Exports the current state of the circular array
   * @returns Object containing all state needed to restore the array
   */
  public exportState(): CircularArrayState<T, T[]> {
    return {
      array: this._array.slice(),
      state: this._state.slice(),
      oldValue:
        typeof this._oldValue === 'object' && this._oldValue !== null
          ? JSON.parse(JSON.stringify(this._oldValue))
          : this._oldValue,
    }
  }

  /**
   * Imports state into the circular array
   * @param state Previously exported state
   */
  public restoreState(state: CircularArrayState<T, T[]>): void {
    this._state.set(state.state)
    this._array = state.array.slice()
    this._oldValue =
      typeof state.oldValue === 'object' && state.oldValue !== null
        ? JSON.parse(JSON.stringify(state.oldValue))
        : state.oldValue
  }
}

/**
 * Circular array implementation optimized for numeric data using Float64Array
 */
export class Float64CircularArray extends BaseCircularArray<
  number,
  Float64Array
> {
  /**
   * Creates a new circular array with Float64Array implementation
   * @param size Size of the circular buffer
   * @param initialValue Initial value to fill the buffer with
   */
  constructor(size: number, initialValue: number = 0) {
    super(size, initialValue)
    this._array = new Float64Array(size)
    this._array.fill(initialValue)
  }

  /**
   * Gets a value from the array at the specified index
   * @param index Array index
   */
  protected getValue(index: number): number {
    return this._array[index]
  }

  /**
   * Sets a value in the array at the specified index
   * @param index Array index
   * @param value Value to set
   */
  protected setValue(index: number, value: number): void {
    this._array[index] = value
  }

  /**
   * Exports the current state of the circular array
   * @returns Object containing all state needed to restore the array
   */
  public exportState(): CircularArrayState<number, Float64Array> {
    return {
      array: this._array.slice(),
      state: this._state.slice(),
      oldValue: this._oldValue,
    }
  }

  /**
   * Imports state into the circular array
   * @param state Previously exported state
   */
  public restoreState(state: CircularArrayState<number, Float64Array>): void {
    this._state.set(state.state)
    this._array.set(state.array)
    this._oldValue = state.oldValue
  }
}
