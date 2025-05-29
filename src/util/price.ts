export const hl2 = (high: number, low: number): number => {
  return (high + low) / 2
}

export const hlc3 = (high: number, low: number, close: number): number => {
  return (high + low + close) / 3
}

export const ohlc4 = (
  open: number,
  high: number,
  low: number,
  close: number,
): number => {
  return (open + high + low + close) / 4
}
