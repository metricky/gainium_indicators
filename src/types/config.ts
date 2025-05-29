import { DEMA } from '../DEMA/DEMA'
import { EMA } from '../EMA/EMA'

export type MACDConfig = {
  indicator: typeof EMA | typeof DEMA
  longInterval: number
  shortInterval: number
  signalInterval: number
}
