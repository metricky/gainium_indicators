import {
  LightIndicator,
  LightIndicatorState,
  PivotCalculator,
  crossover,
  crossunder,
  fixedArray,
  hlcValue,
} from '../util'
import { LinesResult, PriorPivotResult } from '../types/result'
import { HLC } from '../types/candles'

/**
 * Support Resistance
 */
export class PriorPivot extends LightIndicator<PriorPivotResult, HLC> {
  private highArray: number[] = []
  private export_highArray: number[] = []
  private lowArray: number[] = []
  private export_lowArray: number[] = []
  private pivotHighHistory: number[] = []
  private export_pivotHighHistory: number[] = []
  private pivotLowHistory: number[] = []
  private export_pivotLowHistory: number[] = []
  private valueWhenMap: Map<string, number[]> = new Map()
  private export_valueWhenMap: Map<string, number[]> = new Map()
  private maxLen = 1000
  private currentH?: 'hh' | 'lh'
  private export_currentH?: 'hh' | 'lh'
  private currentL?: 'hl' | 'll'
  private export_currentL?: 'hl' | 'll'
  private ScurrentH?: 'hh' | 'lh'
  private export_ScurrentH?: 'hh' | 'lh'
  private ScurrentL?: 'hl' | 'll'
  private export_ScurrentL?: 'hl' | 'll'
  private IcurrentH?: 'hh' | 'lh'
  private export_IcurrentH?: 'hh' | 'lh'
  private IcurrentL?: 'hl' | 'll'
  private export_IcurrentL?: 'hl' | 'll'
  private currentWSL?: 'sl' | 'wl'
  private export_currentWSL?: 'sl' | 'wl'
  private currentWSH?: 'sh' | 'wh'
  private export_currentWSH?: 'sh' | 'wh'
  private swingValueMap: Map<string, number[]> = new Map()
  private export_swingValueMap: Map<string, number[]> = new Map()
  private topCross = false
  private export_topCross = false
  private btmCross = false
  private export_btmCross = false
  private trend = 0
  private export_trend = 0
  private topY: number[] = fixedArray(2)
  private export_topY: number[] = fixedArray(2)
  private btmY: number[] = fixedArray(2)
  private export_btmY: number[] = fixedArray(2)
  private ItopCross = false
  private export_ItopCross = false
  private IbtmCross = false
  private export_IbtmCross = false
  private Itrend = 0
  private export_Itrend = 0
  private ItopY: number[] = fixedArray(2)
  private export_ItopY: number[] = fixedArray(2)
  private IbtmY: number[] = fixedArray(2)
  private export_IbtmY: number[] = fixedArray(2)
  private trailingUp = 0
  private export_trailingUp = 0
  private trailingDown = 0
  private export_trailingDown = 0
  private closeHist: number[] = fixedArray(2)
  private export_closeHist: number[] = fixedArray(2)
  private SphResHist: number[] = fixedArray(2)
  private export_SphResHist: number[] = fixedArray(2)
  private SplResHist: number[] = fixedArray(2)
  private export_SplResHist: number[] = fixedArray(2)
  private IphResHist: number[] = fixedArray(2)
  private export_IphResHist: number[] = fixedArray(2)
  private IplResHist: number[] = fixedArray(2)
  private export_IplResHist: number[] = fixedArray(2)
  private market: PriorPivotResult['market'] | null = null
  private export_market: PriorPivotResult['market'] | null = null
  private allResults: LinesResult = {
    hh: NaN,
    hl: NaN,
    ll: NaN,
    lh: NaN,
    sl: NaN,
    wl: NaN,
    sh: NaN,
    wh: NaN,
  }
  private export_allResults: LinesResult = {
    hh: NaN,
    hl: NaN,
    ll: NaN,
    lh: NaN,
    sl: NaN,
    wl: NaN,
    sh: NaN,
    wh: NaN,
  }
  private pivotLowCalculator: PivotCalculator
  private pivotHighCalculator: PivotCalculator
  constructor(
    public readonly highLeftBars: number,
    public readonly highRightBars: number,
    public readonly lowLeftBars: number,
    public readonly lowRightBars: number,
    public readonly mult = 1000,
  ) {
    super(1, hlcValue, 0)
    const rangeHigh = this.highLeftBars + this.highRightBars
    this.highArray = fixedArray(Math.max(52, rangeHigh + 1))
    this.export_highArray = fixedArray(Math.max(52, rangeHigh + 1))
    const lowRange = this.lowLeftBars + this.lowRightBars
    this.lowArray = fixedArray(Math.max(52, lowRange + 1))
    this.export_lowArray = fixedArray(Math.max(52, lowRange + 1))
    this.pivotHighHistory = fixedArray(this.maxLen)
    this.pivotLowHistory = fixedArray(this.maxLen)
    this.pivotHighCalculator = new PivotCalculator(
      this.highLeftBars,
      this.highRightBars,
      'high',
    )
    this.pivotLowCalculator = new PivotCalculator(
      this.lowLeftBars,
      this.lowRightBars,
      'low',
    )
  }

  private pivotHigh() {
    // Find the last non-NaN value in the array, starting from the end
    for (let i = this.pivotHighHistory.length - 1; i >= 0; i--) {
      if (!isNaN(this.pivotHighHistory[i])) {
        return this.pivotHighHistory[i]
      }
    }
    return NaN
  }
  private pivotLow() {
    // Find the last non-NaN value in the array, starting from the end
    for (let i = this.pivotLowHistory.length - 1; i >= 0; i--) {
      if (!isNaN(this.pivotLowHistory[i])) {
        return this.pivotLowHistory[i]
      }
    }
    return NaN
  }

  private valuewhen(bool: boolean, val: number, count: number, type: string) {
    if (bool) {
      let prev = this.valueWhenMap.get(type)
      if (!prev) {
        prev = fixedArray(2)
      }
      prev.push(val)
      this.valueWhenMap.set(type, prev)
    }
    const array = this.valueWhenMap.get(type)
    if (array) {
      return [...array].reverse()[count]
    }
    return NaN
  }

  private swings(_len: number, type: 'internal' | 'swing') {
    const len = _len + 1
    const high = [...this.highArray].reverse().slice(0, len + 1)
    const low = [...this.lowArray].reverse().slice(0, len + 1)
    const upper = Math.max(...[...high].slice(0, high.length - 1))
    const lower = Math.min(...[...low].slice(0, low.length - 1))
    const swingArr = this.swingValueMap.get(type) ?? []
    const swingVar = [...swingArr].reverse()
    const currentOs = high[len] > upper ? 0 : low[len] < lower ? 1 : swingVar[1]
    const top = currentOs === 0 && swingVar[0] !== 0 ? high[len] : NaN
    const btm = currentOs === 1 && swingVar[0] !== 1 ? low[len] : NaN
    swingArr.push(currentOs)
    swingArr.push(currentOs)
    do {
      swingArr.shift()
    } while (swingArr.length > 3)
    this.swingValueMap.set(type, swingArr)
    return [top, btm]
  }

  calculate(): PriorPivotResult | null {
    const candle = this._history.last
    this.highArray.push(candle.high)
    this.lowArray.push(candle.low)
    this.closeHist.push(candle.close)
    let pivotHigh = this.pivotHighCalculator.calculate(this.highArray)
    let pivotLow = this.pivotLowCalculator.calculate(this.lowArray)
    this.pivotHighHistory.push(pivotHigh)
    this.pivotLowHistory.push(pivotLow)
    const phRes = this.pivotHigh() * this.mult
    const plRes = this.pivotLow() * this.mult
    const hhValueWhen1 = this.valuewhen(
      !isNaN(pivotHigh),
      this.highArray[this.highArray.length - this.highLeftBars - 1],
      1,
      'hh1',
    )
    const hhValueWhen2 = this.valuewhen(
      !isNaN(pivotHigh),
      this.highArray[this.highArray.length - this.highLeftBars - 1],
      0,
      'hh2',
    )
    const hlValueWhen1 = this.valuewhen(
      !isNaN(pivotLow),
      this.lowArray[this.lowArray.length - this.lowLeftBars - 1],
      1,
      'hl1',
    )
    const hlValueWhen2 = this.valuewhen(
      !isNaN(pivotLow),
      this.lowArray[this.lowArray.length - this.lowLeftBars - 1],
      0,
      'hl2',
    )
    const lhValueWhen1 = this.valuewhen(
      !isNaN(pivotHigh),
      this.highArray[this.highArray.length - this.highLeftBars - 1],
      1,
      'lh1',
    )
    const lhValueWhen2 = this.valuewhen(
      !isNaN(pivotHigh),
      this.highArray[this.highArray.length - this.highLeftBars - 1],
      0,
      'lh2',
    )
    const llValueWhen1 = this.valuewhen(
      !isNaN(pivotLow),
      this.lowArray[this.lowArray.length - this.lowLeftBars - 1],
      1,
      'll1',
    )
    const llValueWhen2 = this.valuewhen(
      !isNaN(pivotLow),
      this.lowArray[this.lowArray.length - this.lowLeftBars - 1],
      0,
      'll2',
    )
    const hh = isNaN(pivotHigh)
      ? NaN
      : hhValueWhen1 < hhValueWhen2
        ? pivotHigh
        : NaN

    const hl = isNaN(pivotLow)
      ? NaN
      : hlValueWhen1 < hlValueWhen2
        ? pivotLow
        : NaN

    const lh = isNaN(pivotHigh)
      ? NaN
      : lhValueWhen1 > lhValueWhen2
        ? pivotHigh
        : NaN

    const ll = isNaN(pivotLow)
      ? NaN
      : llValueWhen1 > llValueWhen2
        ? pivotLow
        : NaN
    if (!isNaN(hh)) {
      this.currentH = 'hh'
    }
    if (!isNaN(hl)) {
      this.currentL = 'hl'
    }
    if (!isNaN(lh)) {
      this.currentH = 'lh'
    }
    if (!isNaN(ll)) {
      this.currentL = 'll'
    }
    const [top, btm] = this.swings(50, 'swing')
    const [Itop, Ibtm] = this.swings(5, 'internal')
    let Shh = NaN
    let Slh = NaN
    let Sll = NaN
    let Shl = NaN
    let Ihh = NaN
    let Ilh = NaN
    let Ill = NaN
    let Ihl = NaN
    let newTrend = 0
    let InewTrend = 0
    if (top && !isNaN(top)) {
      this.topCross = true
      if (top > this.topY[1]) {
        Shh = top
      } else {
        Slh = top
      }
      this.topY.push(top)
      this.topY.push(top)
      this.trailingUp = top
    }
    if (btm && !isNaN(btm)) {
      this.btmCross = true
      if (btm < this.btmY[1]) {
        Sll = btm
      } else {
        Shl = btm
      }
      this.btmY.push(btm)
      this.btmY.push(btm)
      this.trailingDown = btm
    }
    if (crossover(this.closeHist, this.topY)) {
      if (this.topCross) {
        newTrend = 1
      }
      this.topCross = false
    }
    if (crossunder(this.closeHist, this.btmY)) {
      if (this.btmCross) {
        newTrend = -1
      }
      this.btmCross = false
    }
    if (Itop && !isNaN(Itop)) {
      this.ItopCross = true
      if (Itop > this.ItopY[1]) {
        Ihh = Itop
      } else {
        Ilh = Itop
      }
      this.ItopY.push(Itop)
      this.ItopY.push(Itop)
    }
    if (Ibtm && !isNaN(Ibtm)) {
      this.IbtmCross = true
      if (Ibtm < this.IbtmY[1]) {
        Ill = Ibtm
      } else {
        Ihl = Ibtm
      }
      this.IbtmY.push(Ibtm)
      this.IbtmY.push(Ibtm)
    }
    if (crossover(this.closeHist, this.ItopY)) {
      if (this.ItopCross && Itop !== this.topY[0]) {
        InewTrend = 1
      }
      this.ItopCross = false
    }
    if (crossunder(this.closeHist, this.IbtmY)) {
      if (this.IbtmCross && Ibtm !== this.btmY[0]) {
        InewTrend = -1
      }
      this.IbtmCross = false
    }
    const SlLabel = btm && this.trend > 0
    const WLLabel = btm && this.trend <= 0
    const SHLabel = top && this.trend < 0
    const WHLabel = top && this.trend >= 0
    this.trailingUp = Math.max(
      this.trailingUp,
      this.highArray[this.highArray.length - 1],
    )
    this.trailingDown = Math.min(
      this.trailingDown,
      this.lowArray[this.lowArray.length - 1],
    )
    if (SlLabel) {
      this.currentWSL = 'sl'
    }
    if (WLLabel) {
      this.currentWSL = 'wl'
    }
    if (SHLabel) {
      this.currentWSH = 'sh'
    }
    if (WHLabel) {
      this.currentWSH = 'wh'
    }

    let SphRes = NaN
    let SplRes = NaN
    if (!isNaN(Shh)) {
      this.ScurrentH = 'hh'
      SphRes = Shh
    }
    if (!isNaN(Slh)) {
      this.ScurrentH = 'lh'
      SphRes = Slh
    }
    if (!isNaN(Sll)) {
      this.ScurrentL = 'll'
      SplRes = Sll
    }
    if (!isNaN(Shl)) {
      this.ScurrentL = 'hl'
      SplRes = Shl
    }

    if (!isNaN(SphRes)) {
      this.SphResHist.push(SphRes)
      this.SphResHist.push(SphRes)
    }
    if (!isNaN(SplRes)) {
      this.SplResHist.push(SplRes)
      this.SplResHist.push(SplRes)
    }

    const bullBoS =
      this.trend >= 0 &&
      crossover(this.closeHist, this.SphResHist) &&
      this.ScurrentH
    const bearBoS =
      this.trend <= 0 &&
      crossunder(this.closeHist, this.SplResHist) &&
      this.ScurrentL
    const bullCHoCH =
      this.trend < 0 &&
      crossover(this.closeHist, this.SphResHist) &&
      this.ScurrentH
    const bearCHoCH =
      this.trend > 0 &&
      crossunder(this.closeHist, this.SplResHist) &&
      this.ScurrentL
    if (bullBoS || bullCHoCH) {
      this.ScurrentH = undefined
    }
    if (bearBoS || bearCHoCH) {
      this.ScurrentL = undefined
    }
    if (bullCHoCH) {
      this.market = 'bull'
    }
    if (bearCHoCH) {
      this.market = 'bear'
    }
    let IphRes = NaN
    let IplRes = NaN
    if (!isNaN(Ihh)) {
      this.IcurrentH = 'hh'
      IphRes = Ihh
    }
    if (!isNaN(Ilh)) {
      this.IcurrentH = 'lh'
      IphRes = Ilh
    }
    if (!isNaN(Ill)) {
      this.IcurrentL = 'll'
      IplRes = Ill
    }
    if (!isNaN(Ihl)) {
      this.IcurrentL = 'hl'
      IplRes = Ihl
    }

    if (!isNaN(IphRes)) {
      this.IphResHist.push(IphRes)
      this.IphResHist.push(IphRes)
    }
    if (!isNaN(IplRes)) {
      this.IplResHist.push(IplRes)
      this.IplResHist.push(IplRes)
    }

    const IbullBoS =
      this.Itrend >= 0 &&
      crossover(this.closeHist, this.IphResHist) &&
      this.IcurrentH
    const IbearBoS =
      this.Itrend <= 0 &&
      crossunder(this.closeHist, this.IplResHist) &&
      this.IcurrentL
    const IbullCHoCH =
      this.Itrend < 0 &&
      crossover(this.closeHist, this.IphResHist) &&
      this.IcurrentH
    const IbearCHoCH =
      this.Itrend > 0 &&
      crossunder(this.closeHist, this.IplResHist) &&
      this.IcurrentL
    if (IbullBoS || IbullCHoCH) {
      this.IcurrentH = undefined
    }
    if (IbearBoS || IbearCHoCH) {
      this.IcurrentL = undefined
    }
    if (newTrend) {
      this.trend = newTrend
    }
    if (IbearCHoCH) {
      this.Itrend = -1
    } else if (IbullCHoCH) {
      this.Itrend = 1
    } else if (InewTrend) {
      this.Itrend = InewTrend
    }
    const hhRes = this.currentH === 'hh' ? phRes : NaN
    const hlRes = this.currentL === 'hl' ? plRes : NaN
    const llRes = this.currentL === 'll' ? plRes : NaN
    const lhRes = this.currentH === 'lh' ? phRes : NaN
    const slRes = this.currentWSL === 'sl' ? this.trailingDown * this.mult : NaN
    const wlRes = this.currentWSL === 'wl' ? this.trailingDown * this.mult : NaN
    const shRes = this.currentWSH === 'sh' ? this.trailingUp * this.mult : NaN
    const whRes = this.currentWSH === 'wh' ? this.trailingUp * this.mult : NaN
    if (!isNaN(hhRes)) {
      this.allResults.hh = hhRes
    }
    if (!isNaN(hlRes)) {
      this.allResults.hl = hlRes
    }
    if (!isNaN(llRes)) {
      this.allResults.ll = llRes
    }
    if (!isNaN(lhRes)) {
      this.allResults.lh = lhRes
    }
    if (!isNaN(slRes)) {
      this.allResults.sl = slRes
    }
    if (!isNaN(wlRes)) {
      this.allResults.wl = wlRes
    }
    if (!isNaN(whRes)) {
      this.allResults.wh = whRes
    }
    if (!isNaN(shRes)) {
      this.allResults.sh = shRes
    }
    return {
      hh: hhRes,
      hl: hlRes,
      ll: llRes,
      lh: lhRes,
      sl: slRes,
      wl: wlRes,
      sh: shRes,
      wh: whRes,
      sBearBoS: !!bearBoS,
      sBullBoS: !!bullBoS,
      sBearCHoCH: !!bearCHoCH,
      sBullCHoCH: !!bullCHoCH,
      iBearBoS: !!IbearBoS,
      iBullBoS: !!IbullBoS,
      iBearCHoCH: !!IbearCHoCH,
      iBullCHoCH: !!IbullCHoCH,
      market: this.market,
      price: candle.close,
      all: this.allResults,
    }
  }

  exportState(): LightIndicatorState {
    for (let i = 0; i < this.highArray.length; i++) {
      this.export_highArray[i] = this.highArray[i]
    }
    for (let i = 0; i < this.lowArray.length; i++) {
      this.export_lowArray[i] = this.lowArray[i]
    }
    for (let i = 0; i < this.pivotHighHistory.length; i++) {
      this.export_pivotHighHistory[i] = this.pivotHighHistory[i]
    }
    for (let i = 0; i < this.pivotLowHistory.length; i++) {
      this.export_pivotLowHistory[i] = this.pivotLowHistory[i]
    }
    for (const [key, value] of this.valueWhenMap.entries()) {
      this.export_valueWhenMap.set(key, [...value])
    }
    for (const [key, value] of this.swingValueMap.entries()) {
      this.export_swingValueMap.set(key, [...value])
    }
    this.export_currentH = this.currentH
    this.export_currentL = this.currentL
    this.export_ScurrentH = this.ScurrentH
    this.export_ScurrentL = this.ScurrentL
    this.export_IcurrentH = this.IcurrentH
    this.export_IcurrentL = this.IcurrentL
    this.export_currentWSH = this.currentWSH
    this.export_currentWSL = this.currentWSL
    this.export_topCross = this.topCross
    this.export_btmCross = this.btmCross
    this.export_trend = this.trend
    for (let i = 0; i < this.topY.length; i++) {
      this.export_topY[i] = this.topY[i]
    }
    for (let i = 0; i < this.btmY.length; i++) {
      this.export_btmY[i] = this.btmY[i]
    }
    this.export_ItopCross = this.ItopCross
    this.export_IbtmCross = this.IbtmCross
    this.export_Itrend = this.Itrend
    for (let i = 0; i < this.ItopY.length; i++) {
      this.export_ItopY[i] = this.ItopY[i]
    }
    for (let i = 0; i < this.IbtmY.length; i++) {
      this.export_IbtmY[i] = this.IbtmY[i]
    }
    this.export_trailingUp = this.trailingUp
    this.export_trailingDown = this.trailingDown
    for (let i = 0; i < this.closeHist.length; i++) {
      this.export_closeHist[i] = this.closeHist[i]
    }
    for (let i = 0; i < this.SphResHist.length; i++) {
      this.export_SphResHist[i] = this.SphResHist[i]
    }
    for (let i = 0; i < this.SplResHist.length; i++) {
      this.export_SplResHist[i] = this.SplResHist[i]
    }
    for (let i = 0; i < this.IphResHist.length; i++) {
      this.export_IphResHist[i] = this.IphResHist[i]
    }
    for (let i = 0; i < this.IplResHist.length; i++) {
      this.export_IplResHist[i] = this.IplResHist[i]
    }
    this.export_market = this.market
    this.export_allResults = { ...this.allResults }

    return {
      bin: [],
      circ: [],
      child: [],
      parent: super.exportState(),
    }
  }

  restoreState(state: LightIndicatorState): void {
    if (!state.parent) {
      throw new Error('Invalid state: parent state is missing')
    }
    for (let i = 0; i < this.export_highArray.length; i++) {
      this.highArray[i] = this.export_highArray[i]
    }
    for (let i = 0; i < this.export_lowArray.length; i++) {
      this.lowArray[i] = this.export_lowArray[i]
    }
    for (let i = 0; i < this.export_pivotHighHistory.length; i++) {
      this.pivotHighHistory[i] = this.export_pivotHighHistory[i]
    }
    for (let i = 0; i < this.export_pivotLowHistory.length; i++) {
      this.pivotLowHistory[i] = this.export_pivotLowHistory[i]
    }
    for (const [key, value] of this.export_valueWhenMap.entries()) {
      this.valueWhenMap.set(key, [...value])
    }
    for (const [key, value] of this.export_swingValueMap.entries()) {
      this.swingValueMap.set(key, [...value])
    }
    this.currentH = this.export_currentH
    this.currentL = this.export_currentL
    this.ScurrentH = this.export_ScurrentH
    this.ScurrentL = this.export_ScurrentL
    this.IcurrentH = this.export_IcurrentH
    this.IcurrentL = this.export_IcurrentL
    this.currentWSH = this.export_currentWSH
    this.currentWSL = this.export_currentWSL
    this.topCross = this.export_topCross
    this.btmCross = this.export_btmCross
    this.trend = this.export_trend
    for (let i = 0; i < this.export_topY.length; i++) {
      this.topY[i] = this.export_topY[i]
    }
    for (let i = 0; i < this.export_btmY.length; i++) {
      this.btmY[i] = this.export_btmY[i]
    }
    this.ItopCross = this.export_ItopCross
    this.IbtmCross = this.export_IbtmCross
    this.Itrend = this.export_Itrend
    for (let i = 0; i < this.export_ItopY.length; i++) {
      this.ItopY[i] = this.export_ItopY[i]
    }
    for (let i = 0; i < this.export_IbtmY.length; i++) {
      this.IbtmY[i] = this.export_IbtmY[i]
    }
    this.trailingUp = this.export_trailingUp
    this.trailingDown = this.export_trailingDown
    for (let i = 0; i < this.export_closeHist.length; i++) {
      this.closeHist[i] = this.export_closeHist[i]
    }
    for (let i = 0; i < this.export_SphResHist.length; i++) {
      this.SphResHist[i] = this.export_SphResHist[i]
    }
    for (let i = 0; i < this.export_SplResHist.length; i++) {
      this.SplResHist[i] = this.export_SplResHist[i]
    }
    for (let i = 0; i < this.export_IphResHist.length; i++) {
      this.IphResHist[i] = this.export_IphResHist[i]
    }
    for (let i = 0; i < this.export_IplResHist.length; i++) {
      this.IplResHist[i] = this.export_IplResHist[i]
    }
    this.market = this.export_market
    this.allResults = { ...this.export_allResults }
  }
}
