/**
 * Analysis prompts for Race Strategy Agent
 * Templates for F1 race strategy and tactical analysis
 */

export const analysisPrompts = {
  queryAnalysis: `Analyze this F1 race strategy query:

"{query}"

Extract strategic elements:
1. Strategic aspects (pit stops, tire strategy, race tactics)
2. Teams and drivers mentioned
3. Specific races, circuits, or conditions
4. Weather and environmental factors
5. Time-sensitive strategic decisions

Format as JSON with strategic focus areas identified.`,

  strategicInsights: `Generate comprehensive race strategy insights:

Race Data: {raceData}
Strategic Context: {strategicContext}
Circuit Information: {circuitInfo}

Analyze and provide strategic insights on:

1. **Optimal Race Strategies**
   - Tire strategy optimization and compound selection
   - Pit stop timing and strategic windows
   - Fuel management and energy deployment tactics
   - Grid position-based strategic approaches

2. **Tactical Decision Analysis**
   - Real-time strategic adjustments and adaptations
   - Risk assessment and contingency planning
   - Weather-dependent strategy modifications
   - Safety car and virtual safety car tactical responses

3. **Competitive Strategic Elements**
   - Undercut and overcut opportunities
   - Track position vs pace strategic trade-offs
   - DRS and slipstream tactical utilization
   - Strategic battles and team coordination

4. **Circuit-Specific Strategic Considerations**
   - Track characteristics impact on strategy
   - Historical strategic patterns and precedents
   - Unique strategic challenges and opportunities

Provide specific strategic recommendations with clear reasoning and risk-benefit analysis.`
};

export default analysisPrompts;