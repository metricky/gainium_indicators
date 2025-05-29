import { LightIndicator } from '../util/indicator'
import { IchimokuCloudResult } from '../types/result'
import { HLC, HL } from '../types/candles'
import { Extremum } from '../Extremum/Extremum'
import { average, hlcValue, lastIndexOfEnum } from '../util'
import { Float64CircularArray } from '../util'

enum IchimokuCloudState {
  CONVERSION_LINE = 0,
  BASE_LINE = 1,
  LEAD_LINE_1 = 2,
  LEAD_LINE_2 = 3,
}
/**
 * Ichimoku Cloud (Ichimoku Kinko Hyo)
 * Type: Comprehensive Trend/Momentum/Support-Resistance Indicator System
 *
 * The Ichimoku Cloud is a comprehensive technical analysis system developed by Goichi Hosoda
 * in Japan before World War II and published in the late 1960s. The name "Ichimoku Kinko Hyo"
 * translates to "one glance equilibrium chart," reflecting its ability to provide a complete
 * market analysis at a single glance.
 *
 * This sophisticated indicator system consists of five key components that work together to
 * provide information about trend direction, momentum, support and resistance levels, and
 * potential future price action. The "cloud" (Kumo) formed by the leading spans is particularly
 * important as it shows potential future support and resistance areas.
 *
 * Components:
 * - Tenkan-sen (Conversion Line): (Highest High + Lowest Low) / 2 over conversion periods
 * - Kijun-sen (Base Line): (Highest High + Lowest Low) / 2 over base periods
 * - Senkou Span A (Leading Span A): (Tenkan-sen + Kijun-sen) / 2, plotted ahead
 * - Senkou Span B (Leading Span B): (Highest High + Lowest Low) / 2 over lagging span periods, plotted ahead
 * - Chikou Span (Lagging Span): Current close price plotted behind
 *
 * Trading Interpretation:
 * - Trend Direction: Price above cloud indicates uptrend, below indicates downtrend
 * - Cloud Color: Green cloud (Senkou A > Senkou B) suggests bullish bias, red cloud suggests bearish
 * - Support/Resistance: Cloud acts as dynamic support in uptrends, resistance in downtrends
 * - Breakout Signals: Price breaking through cloud often signals significant trend changes
 * - Signal Line Cross: Tenkan-sen crossing above/below Kijun-sen provides trend signals
 * - Lagging Span: Chikou span above/below price from periods ago confirms trend strength
 * - Cloud Thickness: Thicker clouds provide stronger support/resistance
 *
 * The Ichimoku system is particularly powerful because it provides a complete trading
 * framework, including trend identification, entry/exit signals, and risk management
 * levels all within a single indicator system.
 *
 * Formula:
 * - Conversion Line = (Highest High + Lowest Low) / 2 over conversion periods
 * - Base Line = (Highest High + Lowest Low) / 2 over base periods
 * - Lead Line 1 = (Conversion Line + Base Line) / 2
 * - Lead Line 2 = (Highest High + Lowest Low) / 2 over lagging span periods
 *
 * Candle Input Type: HLC (High, Low, Close) - requires full range data for comprehensive analysis
 *
 * @see https://www.investopedia.com/terms/i/ichimoku-cloud.asp
 * @see https://www.babypips.com/learn/forex/ichimoku-kinko-hyo
 */
export class IchimokuCloud extends LightIndicator<IchimokuCloudResult, HLC> {
  // Use Extremum class for high/low calculations
  private readonly conversionPeriodsHigh: Extremum
  private readonly conversionPeriodsLow: Extremum
  private readonly basePeriodsHigh: Extremum
  private readonly basePeriodsLow: Extremum
  private readonly laggingSpan2PeriodsHigh: Extremum
  private readonly laggingSpan2PeriodsLow: Extremum

  // Use Float64CircularArray for price tracking
  private readonly closePrice: Float64CircularArray

  /**
   * Creates a new Ichimoku Cloud indicator instance
   *
   * @param conversionPeriods - Period for Tenkan-sen (Conversion Line) calculation (typically 9)
   * @param basePeriods - Period for Kijun-sen (Base Line) calculation (typically 26)
   * @param laggingSpan2Periods - Period for Senkou Span B (Leading Span B) calculation (typically 52)
   * @param laggingSpanPeriod - Displacement period for Chikou Span (Lagging Span) plotting (typically 26)
   */
  constructor(
    conversionPeriods: number,
    basePeriods: number,
    laggingSpan2Periods: number,
    private readonly laggingSpanPeriod: number,
  ) {
    /**
     * Initialize the LightIndicator parent class
     * @param historyLength - 1 (only need current candle as extremum components handle their own history)
     * @param defaultValue - hlcValue (default object with zero values, e.g., {high: 0, low: 0, close: 0})
     * @param stateSize - lastIndexOfEnum(IchimokuCloudState) (size of Float64Array to store: conversion line, base line, lead line 1, lead line 2)
     */
    // Initialize with state size 1 for price index and 4 for Ichimoku values
    super(1, hlcValue, lastIndexOfEnum(IchimokuCloudState))

    // Initialize Extremum indicators for each component
    this.conversionPeriodsHigh = new Extremum(conversionPeriods)
    this.conversionPeriodsLow = new Extremum(conversionPeriods)
    this.basePeriodsHigh = new Extremum(basePeriods)
    this.basePeriodsLow = new Extremum(basePeriods)
    this.laggingSpan2PeriodsHigh = new Extremum(laggingSpan2Periods)
    this.laggingSpan2PeriodsLow = new Extremum(laggingSpan2Periods)

    // Initialize circular buffer for close prices
    this.closePrice = new Float64CircularArray(this.laggingSpanPeriod, NaN)
  }

  protected calculate(): IchimokuCloudResult | null {
    const s = this._state
    const l = this._history.last
    const cp = this.closePrice

    // Create HL objects for Extremum indicators
    const highData: HL = { high: l.high, low: l.high }
    const lowData: HL = { high: l.low, low: l.low }

    // Update high/low Extremum indicators with proper HL objects
    this.conversionPeriodsHigh.next(highData)
    this.conversionPeriodsLow.next(lowData)
    this.basePeriodsHigh.next(highData)
    this.basePeriodsLow.next(lowData)
    this.laggingSpan2PeriodsHigh.next(highData)
    this.laggingSpan2PeriodsLow.next(lowData)
    cp.add(l.close)
    // Check if all indicators have results and buffer is filled
    if (
      this.conversionPeriodsHigh.result !== null &&
      this.conversionPeriodsLow.result !== null &&
      this.basePeriodsHigh.result !== null &&
      this.basePeriodsLow.result !== null &&
      this.laggingSpan2PeriodsHigh.result !== null &&
      this.laggingSpan2PeriodsLow.result !== null &&
      cp.isFilled
    ) {
      // Get current conversion line
      s[IchimokuCloudState.CONVERSION_LINE] = average([
        this.conversionPeriodsLow.result!.lowest,
        this.conversionPeriodsHigh.result!.highest,
      ])

      // Get current base line
      s[IchimokuCloudState.BASE_LINE] = average([
        this.basePeriodsLow.result!.lowest,
        this.basePeriodsHigh.result!.highest,
      ])

      // Calculate lead line 1
      s[IchimokuCloudState.LEAD_LINE_1] = average([
        s[IchimokuCloudState.CONVERSION_LINE],
        s[IchimokuCloudState.BASE_LINE],
      ])

      // Calculate lead line 2
      s[IchimokuCloudState.LEAD_LINE_2] = average([
        this.laggingSpan2PeriodsLow.result!.lowest,
        this.laggingSpan2PeriodsHigh.result!.highest,
      ])

      return {
        conversionLine: s[IchimokuCloudState.CONVERSION_LINE],
        baseLine: s[IchimokuCloudState.BASE_LINE],
        price: cp.prev,
        leadLine1: s[IchimokuCloudState.LEAD_LINE_1],
        leadLine2: s[IchimokuCloudState.LEAD_LINE_2],
      }
    }

    return null
  }

  /**
   * Exports the state of the indicator for restoration later
   */
  exportState(): any {
    const state = super.exportState()

    // Add child indicators state
    state.child = [
      this.conversionPeriodsHigh.exportState(),
      this.conversionPeriodsLow.exportState(),
      this.basePeriodsHigh.exportState(),
      this.basePeriodsLow.exportState(),
      this.laggingSpan2PeriodsHigh.exportState(),
      this.laggingSpan2PeriodsLow.exportState(),
    ]

    // Add circular buffer state
    state.circ.push(this.closePrice.exportState())

    return state
  }

  /**
   * Restores the state of the indicator
   * @param state Previously exported state
   */
  restoreState(state: any): void {
    super.restoreState(state)

    // Restore child indicators
    if (state.child && state.child.length >= 6) {
      this.conversionPeriodsHigh.restoreState(state.child[0])
      this.conversionPeriodsLow.restoreState(state.child[1])
      this.basePeriodsHigh.restoreState(state.child[2])
      this.basePeriodsLow.restoreState(state.child[3])
      this.laggingSpan2PeriodsHigh.restoreState(state.child[4])
      this.laggingSpan2PeriodsLow.restoreState(state.child[5])
    }

    // Restore circular buffer
    if (state.circ.length > 1) {
      this.closePrice.restoreState(state.circ[1])
    }
  }
}
