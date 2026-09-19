import { describe, it } from 'mocha'
import { expect } from 'chai'
import { EMA } from '../src/EMA/EMA'
import { RMA } from '../src/RMA/RMA'
import { SMA } from '../src/SMA/SMA'
import { ATR } from '../src/ATR/ATR'
import { HLC } from '../src/types/candles'

/**
 * Spec: specs/003.ema-rma-first-value-seed.md
 *
 * EMA and RMA are seeded with the simple average of their first
 * `interval` inputs and then smoothed with `prev + alpha * (input - prev)`
 * — the definition TA-Lib and TradingView compute (§1.1). The seed used
 * to be built from `interval - 1` inputs divided by `interval` (§1.2).
 */

/**
 * The textbook definition (§1.1.1 + §1.1.2), written out independently of
 * the implementation under test.
 */
function reference(values: number[], n: number, alpha: number): number[] {
  const out: number[] = []
  let prev = 0
  for (let i = n - 1; i < values.length; i++) {
    prev =
      i === n - 1
        ? values.slice(0, n).reduce((a, b) => a + b, 0) / n
        : prev + alpha * (values[i] - prev)
    out.push(prev)
  }
  return out
}

/** A deterministic random walk — no network, no candle fixtures. */
function walk(count: number): number[] {
  let seed = 246813579
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  const values: number[] = []
  let price = 100
  for (let i = 0; i < count; i++) {
    price = Math.max(1, price * (1 + (rand() - 0.48) * 0.03))
    values.push(price)
  }
  return values
}

const averages = [
  {
    name: 'EMA',
    make: (n: number) => new EMA(n),
    alpha: (n: number) => 2 / (n + 1),
  },
  { name: 'RMA', make: (n: number) => new RMA(n), alpha: (n: number) => 1 / n },
]

describe('EMA / RMA first-value seed (spec 003)', () => {
  for (const { name, make, alpha } of averages) {
    // §1.1.1, §1.1.3, §1.1.4
    it(`${name} of a constant series is that constant from its first value`, () => {
      for (const n of [1, 2, 3, 14, 50]) {
        const indicator = make(n)
        const out: Array<number | null> = []
        for (let i = 0; i < n + 5; i++) {
          out.push(indicator.next(10))
        }
        const values = out.filter((v): v is number => v !== null)
        expect(values.length, `${name}(${n}) count`).to.equal(6)
        for (const v of values) {
          expect(v, `${name}(${n})`).to.be.closeTo(10, 1e-12)
        }
      }
    })

    // §1.1.1 + §1.1.2
    it(`${name} matches the textbook definition on a random walk`, () => {
      const values = walk(600)
      for (const n of [3, 14, 50, 200]) {
        const indicator = make(n)
        const got: number[] = []
        for (const v of values) {
          const r = indicator.next(v)
          if (r !== null) got.push(r)
        }
        const expected = reference(values, n, alpha(n))
        expect(got.length, `${name}(${n}) length`).to.equal(expected.length)
        got.forEach((g, i) => {
          expect(g, `${name}(${n}) #${i}`).to.be.closeTo(expected[i], 1e-9)
        })
      }
    })

    // §1.1.5, §1.2.4 — a gap inside the first window
    it(`${name} waits for a clean window when there is a gap`, () => {
      const run = (inputs: number[]) => {
        const indicator = make(3)
        return inputs.map((v) => indicator.next(v))
      }
      expect(run([10, Number.NaN, 10, 10, 10, 10])).to.deep.equal([
        null,
        null,
        null,
        null,
        10,
        10,
      ])
      expect(run([10, 10, Number.NaN, 10, 10, 10])).to.deep.equal([
        null,
        null,
        null,
        null,
        null,
        10,
      ])
    })

    // §1.1.5, §1.2.4 — a gap after the first value
    it(`${name} shows a gap after its first value as NaN, then starts over`, () => {
      const indicator = make(3)
      const out = [10, 10, 10, Number.NaN, 10, 10, 10, 10].map((v) =>
        indicator.next(v),
      )
      expect(out.slice(0, 3)).to.deep.equal([null, null, 10])
      expect(out[3]).to.be.NaN
      expect(out.slice(4, 6)).to.deep.equal([null, null])
      expect(out.slice(6)).to.deep.equal([10, 10])
    })

    // §4.2 — the exported state layout still round-trips
    it(`${name} carries on the same after an export and restore mid-window`, () => {
      const values = walk(60)
      for (const cut of [1, 4, 5, 6, 20]) {
        const whole = make(6)
        const expected = values.map((v) => whole.next(v))
        const first = make(6)
        const got: Array<number | null> = []
        values.slice(0, cut).forEach((v) => got.push(first.next(v)))
        const second = make(6)
        second.restoreState(first.exportState())
        values.slice(cut).forEach((v) => got.push(second.next(v)))
        expect(got, `${name} cut at ${cut}`).to.deep.equal(expected)
      }
    })
  }

  // §2.4 — SMA is the control: it was always right and must stay right
  it('SMA of a constant series is that constant from its first value', () => {
    const sma = new SMA(3)
    const out = [10, 10, 10, 10, 10].map((v) => sma.next(v))
    expect(out.slice(0, 2)).to.deep.equal([null, null])
    out.slice(2).forEach((v) => expect(v).to.be.closeTo(10, 1e-12))
  })

  // §2.5 — a consumer: ATR is an RMA of true range, so it inherited the seed
  it('ATR(14) over a constant true range is that range from its first value', () => {
    const atr = new ATR(14)
    const candle: HLC = { high: 1100, low: 1000, close: 1050 }
    const out: Array<number | null> = []
    for (let i = 0; i < 20; i++) out.push(atr.next(candle))
    const values = out.filter((v): v is number => v !== null)
    expect(values.length, 'ATR(14) count').to.be.greaterThan(0)
    for (const v of values) {
      expect(v, 'ATR(14)').to.be.closeTo(100, 1e-9)
    }
  })
})
