/**
 * Analysis prompts for Multi-Agent Orchestrator
 * Templates for query routing and multi-agent result synthesis
 */

export const analysisPrompts = {
  queryAnalysis: `Analyze this F1 query and determine which specialized agents should handle it:

Query: "{query}"

Available agents:
- season: Season analysis, championship standings, constructor performance
- driver: Individual driver performance, career analysis, comparisons
- race: Race strategy, circuit analysis, race-specific insights
- championship: Championship predictions, probability calculations
- historical: Cross-era comparisons, historical analysis

Respond with JSON containing:
{
  "primaryAgent": "agent_name",
  "secondaryAgents": ["agent1", "agent2"],
  "queryType": "description",
  "complexity": "simple|moderate|complex",
  "requiresMultipleAgents": boolean,
  "extractedEntities": {
    "drivers": ["driver1", "driver2"],
    "teams": ["team1", "team2"],
    "seasons": ["2023", "2024"],
    "races": ["Monaco", "Silverstone"]
  }
}`,

  queryRouting: `Analyze this F1 query and determine which specialized agents should handle it:

Query: "{query}"

Available agents:
1. Season Analysis Agent - Multi-season analysis, constructor tracking, trend analysis
2. Driver Performance Agent - Career analysis, head-to-head comparisons, circuit performance  
3. Race Strategy Agent - Circuit analysis, strategy recommendations, weather impact
4. Championship Predictor Agent - Probability calculations, scenario modeling, predictive analysis
5. Historical Comparison Agent - Cross-era comparisons, regulation impact analysis

For each agent, determine:
- Should this agent be used? (yes/no)
- What specific analysis should they perform?
- What priority level? (high/medium/low)
- What data do they need?

Respond with JSON:
{
  "agents": [
    {
      "name": "agent_name",
      "should_use": true/false,
      "priority": "high/medium/low",
      "analysis_focus": "specific focus for this agent",
      "data_requirements": ["data1", "data2"]
    }
  ],
  "reasoning": "Why these agents were selected",
  "coordination_strategy": "How agents should work together"
}`,

  resultSynthesis: `Synthesize insights from multiple F1 analysis agents into a comprehensive response:

Original Query: "{query}"

Agent Results:
{agentResults}

Your task:
1. **Integration**: Combine insights from different agents coherently
2. **Prioritization**: Highlight the most important findings first  
3. **Cross-validation**: Identify where agents agree or provide complementary insights
4. **Gap identification**: Note any missing information or conflicting viewpoints
5. **Executive summary**: Provide clear conclusions and actionable insights

Requirements:
- Directly answer the original query
- Maintain technical accuracy while being accessible
- Use specific data and statistics when available
- Provide balanced perspective incorporating all relevant agent insights
- Structure response logically with clear sections
- Include confidence level based on agent consensus

Format as a comprehensive, well-structured response that leverages the collective expertise of all contributing agents.`
};

export default analysisPrompts;