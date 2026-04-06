import { ATR } from '../ATR/ATR'
import { LightIndicator, LightIndicatorState } from '../util'
import { lastIndexOfEnum } from '../util/state'
import { OHLC } from '../types/candles'
import { ohlcValue } from '../util/candles'
import { LongWickResult } from '../types/result'

enum LWState {
  BULL_LEVEL = 0,
  BEAR_LEVEL = 1,
  BULL_COUNT = 2,
  BEAR_COUNT = 3,
  NEW_BULL = 4,
  NEW_BEAR = 5,
}

export class LongWick extends LightIndicator<LongWickResult, OHLC> {
  private readonly atr: ATR
  private readonly threshold: number
  private readonly maxDuration: number

  constructor(threshold: number = 2, maxDuration: number = 1000) {
    super(1, ohlcValue, lastIndexOfEnum(LWState))
    this.atr = new ATR(200)
    this.threshold = threshold
    this.maxDuration = maxDuration
    // Initialize state to NaN
    this._state[LWState.BULL_LEVEL] = NaN
    this._state[LWState.BEAR_LEVEL] = NaN
    this._state[LWState.BULL_COUNT] = NaN
    this._state[LWState.BEAR_COUNT] = NaN
    this._state[LWState.NEW_BULL] = 0
    this._state[LWState.NEW_BEAR] = 0
  }

  protected calculate(): LongWickResult | null {
    const candle = this._history.last
    const atrResult = this.atr.next({
      high: candle.high,
      low: candle.low,
      close: candle.close,
    })

    if (atrResult === null) {
      return null
    }

    const s = this._state
    const volatility = atrResult * this.threshold
    const bodyTop = Math.max(candle.open, candle.close)
    const bodyBottom = Math.min(candle.open, candle.close)
    const topWick = candle.high - bodyTop
    const bottomWick = bodyBottom - candle.low
    s[LWState.NEW_BULL] = 0
    s[LWState.NEW_BEAR] = 0

    // Detect new long top wick → bullish level (price wants to reach up)
    if (topWick >= volatility) {
      s[LWState.BULL_LEVEL] = candle.high
      s[LWState.BULL_COUNT] = 0
      s[LWState.NEW_BULL] = 1
    }

    // Detect new long bottom wick → bearish level (price wants to reach down)
    if (bottomWick >= volatility) {
      s[LWState.BEAR_LEVEL] = candle.low
      s[LWState.BEAR_COUNT] = 0
      s[LWState.NEW_BEAR] = 1
    }

    // Check mitigation and expiry for existing bull level
    if (!isNaN(s[LWState.BULL_LEVEL]) && !s[LWState.NEW_BULL]) {
      s[LWState.BULL_COUNT]++
      if (
        bodyTop >= s[LWState.BULL_LEVEL] ||
        s[LWState.BULL_COUNT] > this.maxDuration
      ) {
        s[LWState.BULL_LEVEL] = NaN
        s[LWState.BULL_COUNT] = NaN
      }
    }

    // Check mitigation and expiry for existing bear level
    if (!isNaN(s[LWState.BEAR_LEVEL]) && !s[LWState.NEW_BEAR]) {
      s[LWState.BEAR_COUNT]++
      if (
        bodyBottom <= s[LWState.BEAR_LEVEL] ||
        s[LWState.BEAR_COUNT] > this.maxDuration
      ) {
        s[LWState.BEAR_LEVEL] = NaN
        s[LWState.BEAR_COUNT] = NaN
      }
    }

    return {
      bull: s[LWState.BULL_LEVEL],
      bear: s[LWState.BEAR_LEVEL],
      price: candle.close,
    }
  }

  override exportState(): LightIndicatorState {
    return {
      bin: [],
      circ: [],
      parent: super.exportState(),
      child: [this.atr.exportState()],
    }
  }

  override restoreState(state: LightIndicatorState): void {
    if (!state.parent) {
      throw new Error('Invalid state: parent state is missing')
    }
    if (!state.child?.length) {
      throw new Error('Invalid state: child state is missing')
    }
    this.atr.restoreState(state.child[0])
    super.restoreState(state.parent)
  }
}
