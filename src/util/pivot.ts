/**
 * PivotCalculator - An optimized class for pivot point calculation
 * Uses Float64Array for maximum performance and zero allocations during calculations
 */
export class PivotCalculator {
  // Pre-allocated arrays for reverse data and working buffer
  private readonly _buffer: Float64Array

  private readonly range: number
  private readonly isHighType: boolean

  /**
   * Creates a new PivotCalculator
   *
   * @param leftBars Number of bars to the left of the pivot
   * @param rightBars Number of bars to the right of the pivot
   * @param type Type of pivot to detect ('high' or 'low')
   */
  constructor(
    leftBars: number,
    private readonly rightBars: number,
    type: 'high' | 'low' = 'high',
  ) {
    // Initialize state array
    this.isHighType = type === 'high'
    this.range = leftBars + rightBars

    // Initialize buffer for calculations - needs to hold the total range of data
    this._buffer = new Float64Array(leftBars + rightBars + 1)
  }

  /**
   * Calculate pivot point from array
   *
   * @param array Array of prices
   * @returns Pivot value or NaN if no pivot detected
   */
  calculate(array: number[] | Float64Array): number {
    const { range, rightBars, isHighType } = this

    // Make sure we have enough data
    if (array.length <= range) {
      return NaN
    }

    // Copy reversed data to our buffer (more efficient than creating a new array)
    for (let i = 0; i <= range; i++) {
      this._buffer[i] = array[array.length - 1 - i]
    }

    // Check if we have valid data at our leftmost position
    const leftEdge = this._buffer[range] ?? NaN
    if (isNaN(leftEdge)) {
      return NaN
    }

    // Store the possible pivot value
    const possiblePivot = this._buffer[rightBars]

    // Find min/max in the range without using Math.min/max(...arr) which creates garbage
    let minValue = this._buffer[0]
    let maxValue = this._buffer[0]
    let minIndex = 0
    let maxIndex = 0

    for (let i = range; i >= 0; i--) {
      const value = this._buffer[i]

      if (value <= minValue) {
        minValue = value
        minIndex = range - i
      }

      if (value >= maxValue) {
        maxValue = value
        maxIndex = range - i
      }
    }

    // Check if the extreme value is at the right position
    const searchIndex = isHighType ? maxIndex : minIndex
    const pivotRightBars = range - searchIndex

    if (pivotRightBars === rightBars) {
      return possiblePivot
    }

    return NaN
  }
}
