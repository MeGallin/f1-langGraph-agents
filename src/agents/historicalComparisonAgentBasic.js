/**
 * F1 Historical Comparison Agent - No LangGraph Version
 */

export class HistoricalComparisonAgent {
  constructor(langGraphAdapter, options = {}) {
    this.adapter = langGraphAdapter;
    console.log('HistoricalComparisonAgent initialized');
  }

  parseJsonResponse(content) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {
        comparisonType: 'drivers',
        drivers: [],
        teams: [],
        seasons: [],
        metrics: [],
      };
    } catch (error) {
      return {
        comparisonType: 'drivers',
        drivers: [],
        teams: [],
        seasons: [],
        metrics: [],
      };
    }
  }

  extractDriverNames(content) {
    const commonDrivers = [
      'Hamilton',
      'Verstappen',
      'Schumacher',
      'Senna',
      'Prost',
    ];
    return commonDrivers.slice(0, 2);
  }

  extractTeamNames(content) {
    const commonTeams = [
      'Mercedes',
      'Red Bull',
      'Ferrari',
      'McLaren',
      'Williams',
    ];
    return commonTeams.slice(0, 2);
  }

  extractSeasons(content) {
    return ['2023', '2024'];
  }

  async compareHistorical(query, options = {}) {
    console.log('Historical comparison:', query);
    return { query, result: 'Basic comparison completed' };
  }
}

export default HistoricalComparisonAgent;
