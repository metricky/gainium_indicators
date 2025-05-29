# Contributing to Gainium Technical Indicators

Thank you for your interest in contributing to the Gainium Technical Indicators library! We welcome contributions from the community and are grateful for your help in making this library better.

## 🚀 Getting Started

### Prerequisites

- Node.js 16.0.0 or higher
- npm or yarn
- TypeScript knowledge
- Understanding of technical analysis concepts

### Development Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/indicators.git
   cd indicators
   ```
3. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```
4. Build the project:
   ```bash
   npm run build
   ```

## 📐 Architecture Guidelines

### LightIndicator Base Class

All indicators **must** extend the `LightIndicator` base class:

```typescript
import { LightIndicator } from '../util/indicator';

export class MyIndicator extends LightIndicator<ResultType, InputType> {
  constructor(period: number) {
    // Initialize with proper parameters
    super(historyLength, defaultValue, stateSize, fillValue);
  }

  protected calculate(): ResultType | null {
    // Your implementation here
  }
}
```

### Constructor Parameters

The `super()` call requires specific parameters:

- **historyLength**: Number of historical values needed (usually the period)
- **defaultValue**: Default value for input processing (numeric value or function)
- **stateSize**: Size of Float64Array for internal state (0 if not needed)
- **fillValue**: Value to return during warmup period (typically `NaN`)

### State Management

Implement proper state export/restore for persistence:

```typescript
exportState(): LightIndicatorState {
  return {
    bin: [], // Float64Array states
    circ: [], // Circular buffer states  
    child: [], // Child indicator states
    parent: super.exportState(),
  };
}

restoreState(state: LightIndicatorState): void {
  // Restore all internal state
  super.restoreState(state.parent);
}
```

## 📊 Adding New Indicators

### 1. Indicator Structure

Create a new directory under `src/` with the indicator name:

```
src/
  YourIndicator/
    YourIndicator.ts
    index.ts (optional)
```

### 2. Implementation Template

```typescript
import { LightIndicator, LightIndicatorState } from '../util/indicator';
import { PercentileResult } from '../types/result';

/**
 * Your Indicator Name (ABBREVIATION)
 * Type: [Trend-Following|Momentum|Volatility|Volume|Composite|Helper/Utility]
 *
 * [Comprehensive description with historical context]
 *
 * Key Characteristics:
 * - [List key features]
 *
 * Trading Interpretation:
 * - [Detailed trading guidance]
 *
 * Advanced Analysis Techniques:
 * - [Advanced usage patterns]
 *
 * Strategy Applications:
 * - [How to use in trading strategies]
 *
 * Market Condition Adaptations:
 * - [How it performs in different markets]
 *
 * Parameter Guidelines:
 * - [Recommended parameter ranges]
 *
 * Advantages:
 * - [Strengths of the indicator]
 *
 * Limitations:
 * - [Weaknesses and considerations]
 *
 * Formula: [Mathematical formula]
 * Input Type: [Numeric|HLC|OHLC|OHLCV]
 *
 * @see [Reliable reference links]
 */
export class YourIndicator extends LightIndicator<ResultType, InputType> {
  /**
   * Creates a new YourIndicator instance
   *
   * @param period The calculation period (typically 14)
   *               - Short-term: X-Y (description)
   *               - Medium-term: Y-Z (description)
   *               - Long-term: Z+ (description)
   */
  constructor(public readonly period: number) {
    super(period, defaultValue, stateSize, NaN);
  }

  protected calculate(): ResultType | null {
    // Implementation
  }
}
```

### 3. Documentation Requirements

**Must include:**

- **Type Classification**: Trend-Following, Momentum, Volatility, Volume, Composite, Helper/Utility
- **Comprehensive Description**: Historical context, mathematical background
- **Trading Interpretation**: Practical usage guidance with signal meanings
- **Advanced Analysis Techniques**: Divergences, multiple timeframes, etc.
- **Strategy Applications**: How to use in different trading approaches
- **Market Condition Adaptations**: Performance in various market environments
- **Parameter Guidelines**: Recommended ranges with explanations
- **Advantages/Limitations**: Balanced assessment
- **Formula**: Clear mathematical notation
- **Input Type**: Specify required candle data
- **Reference Links**: Reliable sources (Investopedia, StockCharts, etc.)

### 4. Constructor Documentation

```typescript
/**
 * Creates a new [Indicator] instance
 *
 * @param period The [description] period (typically X)
 *               - Short-term: X-Y ([characteristics])
 *               - Medium-term: Y-Z ([characteristics])
 *               - Long-term: Z+ ([characteristics])
 * @param param2 [Description with typical ranges]
 */
constructor(period: number, param2?: number) {
  // Initialize with historyLength=[explanation],
  // defaultValue=[explanation of value/function],
  // stateSize=[calculation explanation],
  // fillValue=[explanation of NaN or other value]
  super(historyLength, defaultValue, stateSize, fillValue);
}
```

## 🔧 Code Quality Standards

### TypeScript

- Use strict TypeScript configuration
- Define proper types for all inputs and outputs
- Avoid `any` types
- Use generic types appropriately

### Performance

- Use efficient algorithms (prefer O(1) operations)
- Minimize memory allocations in calculation loops
- Leverage Float64Array for state storage
- Use circular buffers for history management

### Testing

While we don't currently have a test suite, future contributions should include:

- Unit tests for mathematical accuracy
- Edge case testing (empty data, invalid inputs)
- State serialization/deserialization tests
- Performance benchmarks

## 📝 Pull Request Process

1. **Fork & Branch**: Create a feature branch from `master`
2. **Implement**: Follow the architecture guidelines above
3. **Document**: Add comprehensive JSDoc documentation
4. **Export**: Add your indicator to `src/index.ts`
5. **Test**: Verify your implementation works correctly
6. **Submit**: Create a pull request with detailed description

### PR Requirements

- [ ] Follows LightIndicator architecture
- [ ] Comprehensive JSDoc documentation
- [ ] Proper TypeScript types
- [ ] State management implementation
- [ ] Added to main exports in `index.ts`
- [ ] No breaking changes to existing APIs
- [ ] Performance considerations addressed

### PR Description Template

```markdown
## Description
Brief description of the indicator and its purpose.

## Type of Change
- [ ] New indicator
- [ ] Bug fix
- [ ] Performance improvement
- [ ] Documentation update

## Indicator Details
- **Type**: [Trend-Following|Momentum|Volatility|Volume|Composite|Helper/Utility]
- **Input Type**: [Numeric|HLC|OHLC|OHLCV]
- **Parameters**: List of parameters with defaults
- **Mathematical Reference**: Link to authoritative source

## Testing
- [ ] Mathematical accuracy verified against reference
- [ ] State serialization/deserialization tested
- [ ] Performance characteristics acceptable
- [ ] Works with streaming data

## Documentation
- [ ] Comprehensive JSDoc comments
- [ ] Trading interpretation included
- [ ] Parameter guidelines provided
- [ ] Reference links added
```

## 🎯 Indicator Categories

When adding indicators, classify them correctly:

- **Trend-Following**: SMA, EMA, SuperTrend, etc.
- **Momentum**: RSI, Stochastic, MACD, etc.
- **Volatility**: ATR, Bollinger Bands, etc.
- **Volume**: Volume Oscillator, VWMA, etc.
- **Composite**: TVTA (multiple indicators combined)
- **Helper/Utility**: Sum, mathematical utilities

## 🚫 What We Don't Accept

- Indicators without proper documentation
- Code that doesn't follow the LightIndicator pattern
- Implementations without state management
- Indicators that can't handle streaming data
- Code with poor performance characteristics
- Plagiarized or copyrighted implementations

## 📞 Getting Help

- Check existing indicators for examples
- Review the LightIndicator base class
- Open an issue for architectural questions
- Contact the maintainers for guidance

## 🙏 Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes for their contributions
- Special mentions for significant improvements

Thank you for contributing to the Gainium Technical Indicators library!
