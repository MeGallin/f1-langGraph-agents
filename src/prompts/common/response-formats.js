/**
 * Common response format templates used across agents
 */

export const responseFormats = {
  jsonStructured: `Format as JSON:
{
  "analysis": "main analysis content",
  "confidence": 0.95,
  "key_insights": ["insight1", "insight2"],
  "supporting_data": {},
  "recommendations": ["rec1", "rec2"]
}`,

  confidenceScale: `Include confidence score on scale 0-100 where:
- 90-100: High confidence with strong supporting data
- 70-89: Good confidence with adequate supporting evidence  
- 50-69: Moderate confidence with some uncertainty
- 30-49: Low confidence with significant limitations
- 0-29: Very low confidence due to insufficient data`,

  executiveSummary: `Structure response with:
1. **Executive Summary** - Key findings in 2-3 sentences
2. **Detailed Analysis** - Comprehensive breakdown
3. **Supporting Evidence** - Specific data and statistics
4. **Key Insights** - Novel or surprising findings
5. **Implications** - What this means for stakeholders
6. **Confidence Assessment** - Reliability of analysis`,

  statisticalEvidence: `Include specific statistical evidence:
- Exact numbers, percentages, and measurements
- Historical comparisons and benchmarks
- Statistical significance and trends
- Data sources and methodology notes
- Uncertainty ranges where applicable`
};

export default responseFormats;