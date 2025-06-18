/**
 * Analysis prompts for Season Analysis Agent
 * Contains templates for different types of F1 season analysis
 */

export const analysisPrompts = {
  queryAnalysis: `Analyze this F1 query and extract structured information:

"{query}"

Please extract:
1. Seasons mentioned (extract years like 2023, 2024, or keywords like "current", "last")
2. Analysis type (championship, performance, comparison, trends, etc.)
3. Specific entities (drivers, teams, races, circuits)
4. Key metrics of interest (points, wins, poles, fastest laps, etc.)

Format as JSON:
{
  "seasons": ["year1", "year2"],
  "analysisType": "type",
  "entities": {
    "drivers": ["name1", "name2"],
    "constructors": ["team1", "team2"],
    "races": ["race1", "race2"]
  },
  "metrics": ["metric1", "metric2"],
  "focus": "main focus area",
  "confidence": 0.95
}`,

  constructorAnalysis: `Analyze the constructor championship standings and performance data:

Season: {season}
Constructor Data: {constructorData}
Championship Standings: {standings}

Provide insights on:
1. Championship battle and competitiveness
2. Performance trends throughout the season
3. Notable achievements or disappointments
4. Technical or strategic advantages

Format as structured analysis with key insights.`,

  trendsAnalysis: `Analyze trends across these F1 seasons:

Seasons: {seasons}
Season Data: {seasonData}
Constructor Performance: {constructorData}
Race Results: {raceResults}

Identify:
1. Dominant periods and competitive eras
2. Performance evolution patterns
3. Impact of regulation changes
4. Emerging competitive trends
5. Historical context and comparisons

Provide insights on multi-season patterns and developments.`,

  insightsGeneration: `Generate comprehensive insights for this F1 season analysis:

Analysis Results: {analysisResults}
Constructor Analysis: {constructorAnalysis}
Trends Analysis: {trendsAnalysis}
Confidence Score: {confidence}

Provide:
1. Key takeaways and main findings
2. Performance highlights and surprises
3. Strategic or technical insights
4. Historical context and significance
5. Future implications and predictions

Focus on actionable insights and compelling narratives.`,

  finalSynthesis: `Create a comprehensive response to this F1 query:

Original Query: "{query}"
Analysis Insights: {insights}
Confidence Level: {confidence}

Requirements:
1. Directly address the user's question
2. Include specific data and statistics
3. Provide context and historical perspective
4. Offer expert insights and analysis
5. Use engaging and accessible language

Format as a well-structured response that satisfies the query completely.`
};

export default analysisPrompts;