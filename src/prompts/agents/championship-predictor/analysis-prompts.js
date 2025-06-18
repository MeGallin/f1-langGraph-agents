/**
 * Analysis prompts for Championship Predictor Agent
 * Templates for F1 championship prediction and statistical analysis
 */

export const analysisPrompts = {
  queryAnalysis: `Analyze this F1 championship prediction query:

"{query}"

Extract prediction elements:
1. Championship type (drivers, constructors)
2. Prediction timeframe (remainder of season, specific races)
3. Scenarios and conditions (what-if situations)
4. Key competitors and variables
5. Statistical requirements (probabilities, confidence levels)

Format as JSON with prediction scope and methodology requirements.`,

  championshipPredictions: `Generate comprehensive championship predictions:

Championship Data: {championshipData}
Performance Trends: {performanceTrends}
Remaining Schedule: {remainingRaces}
Statistical Context: {statisticalContext}

Analyze and provide predictions on:

1. **Championship Probability Analysis**
   - Current championship standings and points gaps
   - Mathematical scenarios and elimination thresholds
   - Probability distributions for final championship positions
   - Monte Carlo simulation results and confidence intervals

2. **Performance-Based Projections**
   - Current form and momentum analysis
   - Historical performance patterns and seasonality
   - Circuit-specific performance expectations
   - Reliability and consistency factor assessments

3. **Scenario Modeling and What-If Analysis**
   - Best-case and worst-case scenario outcomes
   - Impact of potential DNFs and reliability issues
   - Strategic decision influence on championship outcomes
   - External factor considerations (weather, regulations, incidents)

4. **Statistical Evidence and Reasoning**
   - Historical precedent analysis and pattern matching
   - Correlation between mid-season position and final outcome
   - Performance trend sustainability and regression analysis
   - Confidence levels and uncertainty quantification

Provide specific probability percentages with clear statistical reasoning and methodology transparency.`
};

export default analysisPrompts;