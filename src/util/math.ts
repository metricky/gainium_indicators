/**
 * Epsilon value for floating-point comparisons
 * This defines the threshold for considering two numbers equal
 */
const eps = 1e-10

/**
 * Check if a number is effectively zero (within epsilon range)
 * Ultra-optimized implementation that avoids the Math.abs call
 * @param a Number to check
 * @returns True if the number is considered zero
 */
export const isZero = (a: number): boolean => {
  return a <= eps && a >= -eps
}

/**
 * Check if a is greater than b with epsilon consideration
 * Optimized implementation that avoids unnecessary function calls
 * @param a First number
 * @param b Second number
 * @returns True if a is definitely greater than b
 */
export const gt = (a: number, b: number): boolean => {
  const diff = a - b
  return diff > eps && a > b
}

/**
 * Check if a is less than b with epsilon consideration
 * Optimized implementation that avoids unnecessary function calls
 * @param a First number
 * @param b Second number
 * @returns True if a is definitely less than b
 */
export const lt = (a: number, b: number): boolean => {
  const diff = a - b
  return diff < -eps && a < b
}

/**
 * Check if a is greater than or equal to b with epsilon consideration
 * Optimized implementation that avoids unnecessary function calls
 * @param a First number
 * @param b Second number
 * @returns True if a is greater than or equal to b
 */
export const gte = (a: number, b: number): boolean => {
  const diff = a - b
  return diff > -eps
}

/**
 * Check if a is less than or equal to b with epsilon consideration
 * Optimized implementation that avoids unnecessary function calls
 * @param a First number
 * @param b Second number
 * @returns True if a is less than or equal to b
 */
export const lte = (a: number, b: number): boolean => {
  const diff = a - b
  return diff < eps
}

/**
 * Check if two numbers are equal within epsilon
 * Optimized implementation that avoids function call overhead
 * @param a First number
 * @param b Second number
 * @returns True if the numbers are considered equal
 */
export const eq = (a: number, b: number): boolean => {
  const diff = a - b
  return diff <= eps && diff >= -eps
}

/**
 * Check if two numbers are not equal beyond epsilon
 * Optimized implementation that avoids function call overhead
 * @param a First number
 * @param b Second number
 * @returns True if the numbers are definitely not equal
 */
export const neq = (a: number, b: number): boolean => {
  const diff = a - b
  return diff > eps || diff < -eps
}

/**
 * Optimized round function that avoids string conversions for better performance
 * @param num Number to round
 * @param precision Decimal places (default: 2)
 * @param down Whether to round down (floor)
 * @param up Whether to round up (ceil)
 * @returns Rounded number
 */
export const round = (
  num: number,
  precision = 2,
  down = false,
  up = false,
): number => {
  // Handle NaN or infinite values
  if (!isFinite(num)) return num

  // Calculate the multiplier based on precision
  const multiplier = Math.pow(10, precision)

  // Scale the number
  const scaledNum = num * multiplier

  // Apply appropriate rounding function
  let result
  if (down) {
    result = Math.floor(scaledNum)
  } else if (up) {
    result = Math.ceil(scaledNum)
  } else {
    result = Math.round(scaledNum)
  }

  // Scale back to original decimal places
  return result / multiplier
}

/**
 * Calculate standard deviation of an array of numbers
 * Optimized to avoid creating intermediate arrays
 * @param array Input array of numbers
 * @returns Standard deviation
 */
export const stDev = (array: number[] | Float64Array): number => {
  const n = array.length
  if (n === 0) return 0

  // Calculate mean in a single pass
  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += array[i]
  }
  const mean = sum / n

  // Calculate sum of squared differences in a single pass (no new arrays)
  let sumSquaredDiff = 0
  for (let i = 0; i < n; i++) {
    const diff = array[i] - mean
    sumSquaredDiff += diff * diff
  }

  // Calculate standard deviation
  return Math.sqrt(sumSquaredDiff / n)
}

/**
 * Calculate arithmetic mean of an array of numbers
 * Optimized version that avoids Array.reduce for better performance
 * @param values Input array of numbers
 * @returns Arithmetic mean (average) of the array
 */
export const average = (values: number[] | Float64Array): number => {
  const len = values.length
  if (len === 0) return 0

  let sum = 0
  for (let i = 0; i < len; i++) {
    sum += values[i]
  }
  return sum / len
}

/**
 * Determines if value1 has crossed above value2 (crossover)
 * Optimized implementation supporting both arrays and Float64Array
 * @param value1 First array of values
 * @param value2 Second array of values
 * @returns True if value1 crossed above value2
 */
export const crossover = (
  value1: number[] | Float64Array,
  value2: number[] | Float64Array,
): boolean => {
  if (value1.length > 1 && value2.length > 1) {
    const last1 = value1[value1.length - 1]
    const last2 = value2[value2.length - 1]
    const prev1 = value1[value1.length - 2]
    const prev2 = value2[value2.length - 2]
    return lt(prev1, prev2) && gt(last1, last2)
  }
  return false
}

/**
 * Determines if value1 has crossed below value2 (crossunder)
 * Optimized implementation supporting both arrays and Float64Array
 * @param value1 First array of values
 * @param value2 Second array of values
 * @returns True if value1 crossed below value2
 */
export const crossunder = (
  value1: number[] | Float64Array,
  value2: number[] | Float64Array,
): boolean => {
  if (value1.length > 1 && value2.length > 1) {
    const last1 = value1[value1.length - 1]
    const last2 = value2[value2.length - 1]
    const prev1 = value1[value1.length - 2]
    const prev2 = value2[value2.length - 2]
    return gt(prev1, prev2) && lt(last1, last2)
  }
  return false
}
