/**
 * Analysis prompts for Driver Performance Agent
 * Templates for driver-focused F1 performance analysis
 */

export const analysisPrompts = {
  queryAnalysis: `Analyze this F1 driver query and extract key information:

"{query}"

Extract:
1. Driver names mentioned
2. Seasons or time periods
3. Analysis type (performance, comparison, career, specific metrics)
4. Metrics of interest (wins, poles, points, lap times, etc.)
5. Comparison context (vs other drivers, vs teammates, vs previous seasons)

Format as JSON with confidence score.`,

  performanceInsights: `Generate comprehensive driver performance insights:

Driver Data: {driverData}
Performance Metrics: {performanceMetrics}
Analysis Context: {analysisContext}

Analyze and provide insights on:

1. **Career Performance Analysis**
   - Overall career trajectory and evolution
   - Peak performance periods and consistency
   - Adaptability across different car characteristics
   - Statistical achievements and records

2. **Performance Patterns & Trends**
   - Qualifying vs race pace performance
   - Circuit-specific strengths and weaknesses
   - Weather and pressure situation performance
   - Teammate comparison and learning curves

3. **Technical & Strategic Insights**
   - Driving style analysis and technical adaptation
   - Strategic decision-making and racecraft
   - Development feedback and team collaboration
   - Championship mentality and clutch performances

Include specific examples, statistics, and actionable insights that demonstrate deep F1 expertise.`
};

export default analysisPrompts;