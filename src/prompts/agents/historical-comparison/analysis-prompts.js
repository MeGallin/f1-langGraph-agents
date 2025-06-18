/**
 * Analysis prompts for Historical Comparison Agent
 * Templates for cross-era F1 analysis and historical comparisons
 */

export const analysisPrompts = {
  historicalComparison: `Perform comprehensive historical F1 analysis and cross-era comparison:

Historical Data: {historicalData}
Comparison Context: {comparisonContext}
Era Information: {eraInfo}

Analyze and provide insights on:

1. **Cross-Era Comparison Analysis**
   - Statistical normalization across different competitive periods
   - Era-adjusted performance metrics and achievements
   - Technology and regulation impact on competitive balance
   - Historical significance and context of achievements

2. **Regulatory Impact Assessment**
   - Major regulation changes and their effects on competition
   - Technical evolution and its influence on driver/constructor success
   - Safety improvements and their impact on racing dynamics
   - Commercial and sporting regulation effects on the sport

3. **Historical Context and Significance**
   - Landmark moments and turning points in F1 history
   - Evolution of competitive dynamics and team strategies
   - Generational shifts in driver and constructor capabilities
   - Cultural and technological influences on the sport's development

4. **Comparative Analysis Framework**
   - Methodology for fair cross-era comparisons
   - Statistical adjustments for era differences
   - Qualitative factors and contextual considerations
   - Historical precedent analysis and pattern recognition

Provide historically accurate insights with proper context for era-specific factors and fair comparative analysis.`
};

export default analysisPrompts;