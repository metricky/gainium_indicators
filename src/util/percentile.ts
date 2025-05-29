import { CircularArrayState, Float64CircularArray } from './array'

/**
 * Optimized percentile calculator that matches the original percentileRank logic
 * O(n) time complexity for insert and percentile calculation using quickselect
 */
export class PercentileCalculator {
  private readonly values: Float64CircularArray
  private readonly workingArray: number[] // Pre-allocated working array for sorting

  constructor(
    private readonly lookback: number,
    private readonly percentage: number = 50,
  ) {
    // Pre-allocate array with proper size
    this.values = new Float64CircularArray(lookback, NaN)
    // Pre-allocate working array to avoid memory allocations
    this.workingArray = new Array(lookback)
  }

  /**
   * Quickselect algorithm for finding the k-th smallest element in O(n) average time
   * @param arr Array to search in
   * @param left Start index
   * @param right End index
   * @param k Index of element to find (0-based)
   * @returns The k-th smallest element
   */
  private quickselect(
    arr: number[],
    left: number,
    right: number,
    k: number,
  ): number {
    if (left === right) {
      return arr[left]
    }

    // Use median-of-three for better pivot selection
    const finalPivotIndex = this.partition(
      arr,
      left,
      right,
      this.medianOfThree(arr, left, right),
    )

    if (k === finalPivotIndex) {
      return arr[k]
    } else if (k < finalPivotIndex) {
      return this.quickselect(arr, left, finalPivotIndex - 1, k)
    } else {
      return this.quickselect(arr, finalPivotIndex + 1, right, k)
    }
  }

  /**
   * Median-of-three pivot selection for better quickselect performance
   */
  private medianOfThree(arr: number[], left: number, right: number): number {
    const mid = Math.floor((left + right) / 2)

    if (arr[left] > arr[mid]) {
      ;[arr[left], arr[mid]] = [arr[mid], arr[left]]
    }
    if (arr[mid] > arr[right]) {
      ;[arr[mid], arr[right]] = [arr[right], arr[mid]]
    }
    if (arr[left] > arr[mid]) {
      ;[arr[left], arr[mid]] = [arr[mid], arr[left]]
    }

    return mid
  }

  /**
   * Partition function for quickselect
   */
  private partition(
    arr: number[],
    left: number,
    right: number,
    pivotIndex: number,
  ): number {
    const pivotValue = arr[pivotIndex]

    // Move pivot to end
    ;[arr[pivotIndex], arr[right]] = [arr[right], arr[pivotIndex]]

    let storeIndex = left
    for (let i = left; i < right; i++) {
      if (arr[i] < pivotValue) {
        ;[arr[i], arr[storeIndex]] = [arr[storeIndex], arr[i]]
        storeIndex++
      }
    }

    // Move pivot to its final place
    ;[arr[storeIndex], arr[right]] = [arr[right], arr[storeIndex]]

    return storeIndex
  }

  /**
   * Insert a new value (matches old function logic)
   * @param value New value to insert
   * @returns True if the array has enough data for percentile calculation
   */
  insert(value: number): boolean {
    const v = this.values
    // Skip invalid values (matches old function's if (v) check)
    if (!value && value !== 0) {
      return v.isFilled
    }

    v.add(value)

    return v.isFilled
  }

  /**
   * Get the value at the specified percentile using optimized quickselect (matches old function exactly)
   * @returns The value at the specified percentile, or NaN if not enough data
   */
  getPercentile(): number {
    const v = this.values
    // Check if we have enough data (matches old function's data.get(lookback) check)
    if (!v.isFilled) {
      return NaN
    }

    // Filter out invalid values using pre-allocated working array
    let validCount = 0
    for (let i = 0; i < this.lookback; i++) {
      const _v = v.array[i]
      if (_v || _v === 0) {
        // Include 0 but exclude NaN, null, undefined
        this.workingArray[validCount++] = _v
      }
    }

    if (validCount === 0) {
      return NaN
    }

    // Calculate target index using actual data length (matches old function)

    // Use quickselect for O(n) average time complexity instead of O(n log n) sorting
    return this.quickselect(
      this.workingArray,
      0,
      validCount - 1,
      Math.max(
        0,
        Math.min(
          Math.round((this.percentage / 100) * validCount) - 1,
          validCount - 1,
        ),
      ),
    )
  }

  exportState(): CircularArrayState<number, Float64Array> {
    return this.values.exportState()
  }

  restoreState(state: CircularArrayState<number, Float64Array>) {
    this.values.restoreState(state)
  }
}
