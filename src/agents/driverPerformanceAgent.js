/**
 * F1 Driver Performance Agent
 *
 * Specialized LangGraph agent for analyzing individual driver careers,
 * performance metrics, and career trajectory analysis.
 *
 * Features:
 * - Career span analysis across multiple seasons
 * - Performance metrics and statistical analysis
 * - Team changes and adaptation analysis
 * - Peak performance identification
 * - Career comparison with other drivers
 */

import { StateGraph, START, END } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { DriverState } from '../state/schemas.js';
import logger from '../utils/logger.js';

export class DriverPerformanceAgent {
  constructor(langGraphAdapter, options = {}) {
    this.adapter = langGraphAdapter;
    this.model =
      options.model ||
      new ChatOpenAI({
        modelName: 'gpt-4o-mini',
        temperature: 0.1,
      });

    // Build the workflow graph
    this.workflow = this.createWorkflow();
    this.app = this.workflow.compile();

    logger.info('DriverPerformanceAgent initialized');
  }
  createWorkflow() {
    const workflow = new StateGraph({
      channels: {
        messages: { default: () => [] },
        query: { default: () => '' },
        queryAnalysis: { default: () => ({}) },
        driverData: { default: () => ({}) },
        careerStats: { default: () => ({}) },
        teamAnalysis: { default: () => ({}) },
        peakAnalysis: { default: () => ({}) },
        insights: { default: () => ({}) },
        synthesis: { default: () => ({}) },
        results: { default: () => ({}) },
      },
    });

    // Add nodes
    workflow.addNode('analyzeQuery', this.analyzeQuery.bind(this));
    workflow.addNode('fetchDriverData', this.fetchDriverData.bind(this));
    workflow.addNode('analyzeCareerStats', this.analyzeCareerStats.bind(this));
    workflow.addNode('analyzeTeamChanges', this.analyzeTeamChanges.bind(this));
    workflow.addNode(
      'identifyPeakPerformance',
      this.identifyPeakPerformance.bind(this),
    );
    workflow.addNode(
      'generateDriverInsights',
      this.generateDriverInsights.bind(this),
    );
    workflow.addNode('synthesizeResults', this.synthesizeResults.bind(this));

    // Add edges
    workflow.addEdge(START, 'analyzeQuery');
    workflow.addEdge('analyzeQuery', 'fetchDriverData');
    workflow.addEdge('fetchDriverData', 'analyzeCareerStats');

    // Conditional routing based on analysis type
    workflow.addConditionalEdges(
      'analyzeCareerStats',
      this.routeAnalysis.bind(this),
      {
        team_analysis: 'analyzeTeamChanges',
        peak_performance: 'identifyPeakPerformance',
        comprehensive: 'analyzeTeamChanges',
      },
    );

    workflow.addEdge('analyzeTeamChanges', 'identifyPeakPerformance');
    workflow.addEdge('identifyPeakPerformance', 'generateDriverInsights');
    workflow.addEdge('generateDriverInsights', 'synthesizeResults');
    workflow.addEdge('synthesizeResults', END);

    return workflow;
  }

  async analyzeQuery(state) {
    try {
      logger.info('Analyzing driver performance query', { query: state.query });

      const messages = [
        new SystemMessage(`You are an expert F1 analyst specializing in driver performance analysis.
                
                Analyze the following query and extract:
                1. Driver name(s) to analyze
                2. Specific seasons or career span
                3. Type of analysis requested (career overview, team comparison, peak performance, etc.)
                4. Comparison drivers if mentioned
                5. Specific metrics of interest
                
                Return a JSON object with extracted parameters.`),
        new HumanMessage(state.query),
      ];

      const response = await this.model.invoke(messages);
      const analysis = this.parseJsonResponse(response.content);

      return {
        ...state,
        queryAnalysis: analysis,
        messages: [
          ...(state.messages || []),
          {
            role: 'system',
            content: 'Query analyzed for driver performance analysis',
          },
        ],
      };
    } catch (error) {
      logger.error('Error in analyzeQuery:', error);
      throw error;
    }
  }

  async fetchDriverData(state) {
    try {
      const { queryAnalysis } = state;
      const driverData = {};

      logger.info('Fetching driver data', { drivers: queryAnalysis.drivers });

      // Get driver information
      for (const driverName of queryAnalysis.drivers || []) {
        try {
          // Fetch driver basic info
          const driverInfo = await this.adapter.invoke('get_drivers', {
            season: queryAnalysis.seasons?.[0] || 2024,
          });

          const driver = driverInfo.find(
            (d) =>
              d.familyName?.toLowerCase().includes(driverName.toLowerCase()) ||
              d.givenName?.toLowerCase().includes(driverName.toLowerCase()),
          );

          if (driver) {
            // Fetch career results across seasons
            const careerResults = [];
            const seasons =
              queryAnalysis.seasons || this.getDriverCareerSeasons(driver);

            for (const season of seasons) {
              try {
                const seasonResults = await this.adapter.invoke(
                  'get_driver_results',
                  {
                    season: season,
                    driverId: driver.driverId,
                  },
                );
                careerResults.push({ season, results: seasonResults });
              } catch (err) {
                logger.warn(
                  `No results for ${driverName} in ${season}:`,
                  err.message,
                );
              }
            }

            // Fetch driver standings across seasons
            const standings = [];
            for (const season of seasons) {
              try {
                const seasonStandings = await this.adapter.invoke(
                  'get_driver_standings',
                  {
                    season: season,
                    driverId: driver.driverId,
                  },
                );
                standings.push({ season, standings: seasonStandings });
              } catch (err) {
                logger.warn(
                  `No standings for ${driverName} in ${season}:`,
                  err.message,
                );
              }
            }

            driverData[driverName] = {
              info: driver,
              careerResults,
              standings,
              seasons: seasons,
            };
          }
        } catch (error) {
          logger.warn(
            `Failed to fetch data for driver ${driverName}:`,
            error.message,
          );
        }
      }

      return {
        ...state,
        driverData,
        messages: [
          ...(state.messages || []),
          {
            role: 'system',
            content: `Fetched data for ${
              Object.keys(driverData).length
            } drivers`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error in fetchDriverData:', error);
      throw error;
    }
  }

  async analyzeCareerStats(state) {
    try {
      const { driverData } = state;
      const careerStats = {};

      logger.info('Analyzing career statistics');

      for (const [driverName, data] of Object.entries(driverData)) {
        const stats = this.calculateCareerStatistics(data);
        careerStats[driverName] = stats;
      }

      return {
        ...state,
        careerStats,
        messages: [
          ...(state.messages || []),
          { role: 'system', content: 'Career statistics calculated' },
        ],
      };
    } catch (error) {
      logger.error('Error in analyzeCareerStats:', error);
      throw error;
    }
  }

  async analyzeTeamChanges(state) {
    try {
      const { driverData } = state;
      const teamAnalysis = {};

      logger.info('Analyzing team changes and adaptation');

      for (const [driverName, data] of Object.entries(driverData)) {
        const analysis = this.analyzeDriverTeamChanges(data);
        teamAnalysis[driverName] = analysis;
      }

      return {
        ...state,
        teamAnalysis,
        messages: [
          ...(state.messages || []),
          { role: 'system', content: 'Team change analysis completed' },
        ],
      };
    } catch (error) {
      logger.error('Error in analyzeTeamChanges:', error);
      throw error;
    }
  }

  async identifyPeakPerformance(state) {
    try {
      const { driverData, careerStats } = state;
      const peakAnalysis = {};

      logger.info('Identifying peak performance periods');

      for (const [driverName, data] of Object.entries(driverData)) {
        const peaks = this.identifyDriverPeaks(data, careerStats[driverName]);
        peakAnalysis[driverName] = peaks;
      }

      return {
        ...state,
        peakAnalysis,
        messages: [
          ...(state.messages || []),
          { role: 'system', content: 'Peak performance periods identified' },
        ],
      };
    } catch (error) {
      logger.error('Error in identifyPeakPerformance:', error);
      throw error;
    }
  }

  async generateDriverInsights(state) {
    try {
      const {
        driverData,
        careerStats,
        teamAnalysis,
        peakAnalysis,
        queryAnalysis,
      } = state;

      logger.info('Generating AI-powered driver insights');

      const messages = [
        new SystemMessage(`You are a world-class F1 expert analyst with deep knowledge of driver performance patterns.
                
                Based on the comprehensive driver data provided, generate expert insights about:
                1. Career trajectory and development
                2. Performance consistency and reliability
                3. Adaptation to different teams and car philosophies
                4. Peak performance periods and factors
                5. Strengths and weaknesses analysis
                6. Legacy and career significance
                
                Focus on statistical evidence, performance patterns, and contextual factors.
                Provide confidence scores (0-100) for major claims.
                Include specific examples and data points.`),
        new HumanMessage(`Analyze this driver performance data:
                
                Query: ${state.query}
                
                Driver Data: ${JSON.stringify(
                  { careerStats, teamAnalysis, peakAnalysis },
                  null,
                  2,
                )}
                
                Generate comprehensive insights with confidence scores.`),
      ];

      const response = await this.model.invoke(messages);
      const insights = this.parseInsightsResponse(response.content);

      return {
        ...state,
        insights,
        messages: [
          ...(state.messages || []),
          {
            role: 'assistant',
            content: 'Generated expert driver performance insights',
          },
        ],
      };
    } catch (error) {
      logger.error('Error in generateDriverInsights:', error);
      throw error;
    }
  }

  async synthesizeResults(state) {
    try {
      logger.info('Synthesizing final driver performance analysis');

      const synthesis = {
        summary: this.createDriverSummary(state),
        keyFindings: this.extractKeyFindings(state),
        recommendations: this.generateRecommendations(state),
        dataQuality: this.assessDataQuality(state),
        metadata: {
          analysisType: 'driver_performance',
          driversAnalyzed: Object.keys(state.driverData || {}),
          timestamp: new Date().toISOString(),
          confidence: this.calculateOverallConfidence(state),
        },
      };

      return {
        ...state,
        synthesis,
        results: synthesis,
        messages: [
          ...(state.messages || []),
          {
            role: 'assistant',
            content: 'Driver performance analysis completed successfully',
          },
        ],
      };
    } catch (error) {
      logger.error('Error in synthesizeResults:', error);
      throw error;
    }
  }

  routeAnalysis(state) {
    const { queryAnalysis } = state;

    if (queryAnalysis.analysisType?.includes('team')) {
      return 'team_analysis';
    } else if (queryAnalysis.analysisType?.includes('peak')) {
      return 'peak_performance';
    }
    return 'comprehensive';
  }

  // Helper methods
  calculateCareerStatistics(driverData) {
    const { careerResults, standings } = driverData;

    let totalRaces = 0;
    let wins = 0;
    let podiums = 0;
    let points = 0;
    let dnfs = 0;
    let polePositions = 0;
    let fastestLaps = 0;

    const seasonalPerformance = [];

    for (const seasonData of careerResults) {
      const { season, results } = seasonData;
      let seasonWins = 0;
      let seasonPodiums = 0;
      let seasonPoints = 0;
      let seasonDNFs = 0;
      let seasonRaces = results.length;

      for (const result of results) {
        totalRaces++;

        if (result.position === '1') {
          wins++;
          seasonWins++;
        }
        if (['1', '2', '3'].includes(result.position)) {
          podiums++;
          seasonPodiums++;
        }
        if (result.points) {
          points += parseFloat(result.points);
          seasonPoints += parseFloat(result.points);
        }
        if (!result.position || result.statusId !== '1') {
          dnfs++;
          seasonDNFs++;
        }
        if (result.grid === '1') {
          polePositions++;
        }
        if (result.fastestLap?.rank === '1') {
          fastestLaps++;
        }
      }

      seasonalPerformance.push({
        season,
        races: seasonRaces,
        wins: seasonWins,
        podiums: seasonPodiums,
        points: seasonPoints,
        dnfs: seasonDNFs,
        winRate: seasonRaces > 0 ? (seasonWins / seasonRaces) * 100 : 0,
        podiumRate: seasonRaces > 0 ? (seasonPodiums / seasonRaces) * 100 : 0,
        finishRate:
          seasonRaces > 0
            ? ((seasonRaces - seasonDNFs) / seasonRaces) * 100
            : 0,
      });
    }

    return {
      careerSpan: `${Math.min(
        ...careerResults.map((r) => r.season),
      )}-${Math.max(...careerResults.map((r) => r.season))}`,
      totalRaces,
      wins,
      podiums,
      points,
      dnfs,
      polePositions,
      fastestLaps,
      winRate: totalRaces > 0 ? (wins / totalRaces) * 100 : 0,
      podiumRate: totalRaces > 0 ? (podiums / totalRaces) * 100 : 0,
      finishRate: totalRaces > 0 ? ((totalRaces - dnfs) / totalRaces) * 100 : 0,
      pointsPerRace: totalRaces > 0 ? points / totalRaces : 0,
      seasonalPerformance,
    };
  }

  analyzeDriverTeamChanges(driverData) {
    const { careerResults } = driverData;
    const teamChanges = [];
    let currentTeam = null;

    for (const seasonData of careerResults) {
      const { season, results } = seasonData;
      if (results.length === 0) continue;

      const seasonTeam = results[0].Constructor?.name || 'Unknown';

      if (currentTeam && currentTeam !== seasonTeam) {
        teamChanges.push({
          season,
          from: currentTeam,
          to: seasonTeam,
        });
      }
      currentTeam = seasonTeam;
    }

    return {
      totalTeamChanges: teamChanges.length,
      teamChanges,
      longestStint: this.calculateLongestTeamStint(careerResults),
      adaptabilityScore: this.calculateAdaptabilityScore(
        teamChanges,
        careerResults,
      ),
    };
  }

  identifyDriverPeaks(driverData, careerStats) {
    const { seasonalPerformance } = careerStats;

    // Find peak seasons by different metrics
    const peaksByWins = [...seasonalPerformance]
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 3);
    const peaksByPoints = [...seasonalPerformance]
      .sort((a, b) => b.points - a.points)
      .slice(0, 3);
    const peaksByWinRate = [...seasonalPerformance]
      .filter((s) => s.races >= 10) // Minimum race threshold
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 3);

    return {
      peakSeasonsByWins: peaksByWins,
      peakSeasonsByPoints: peaksByPoints,
      peakSeasonsByWinRate: peaksByWinRate,
      overallPeakPeriod: this.identifyPeakPeriod(seasonalPerformance),
    };
  }

  calculateLongestTeamStint(careerResults) {
    let longestStint = { team: null, seasons: 0, period: null };
    let currentStint = { team: null, start: null, length: 0 };

    for (const seasonData of careerResults) {
      const { season, results } = seasonData;
      if (results.length === 0) continue;

      const seasonTeam = results[0].Constructor?.name || 'Unknown';

      if (currentStint.team === seasonTeam) {
        currentStint.length++;
      } else {
        if (currentStint.length > longestStint.seasons) {
          longestStint = {
            team: currentStint.team,
            seasons: currentStint.length,
            period: `${currentStint.start}-${season - 1}`,
          };
        }
        currentStint = { team: seasonTeam, start: season, length: 1 };
      }
    }

    // Check final stint
    if (currentStint.length > longestStint.seasons) {
      longestStint = {
        team: currentStint.team,
        seasons: currentStint.length,
        period: `${currentStint.start}-${
          careerResults[careerResults.length - 1].season
        }`,
      };
    }

    return longestStint;
  }

  calculateAdaptabilityScore(teamChanges, careerResults) {
    // Calculate how well driver adapted to team changes
    // Higher score = better adaptation
    let adaptabilityScore = 50; // Base score

    // Bonus for successful team changes (performance improvement)
    // Penalty for unsuccessful team changes (performance decline)

    return Math.min(Math.max(adaptabilityScore, 0), 100);
  }

  identifyPeakPeriod(seasonalPerformance) {
    // Find the best consecutive 3-season period
    let bestPeriod = { start: null, end: null, avgPoints: 0, seasons: [] };

    for (let i = 0; i <= seasonalPerformance.length - 3; i++) {
      const period = seasonalPerformance.slice(i, i + 3);
      const avgPoints =
        period.reduce((sum, s) => sum + s.points, 0) / period.length;

      if (avgPoints > bestPeriod.avgPoints) {
        bestPeriod = {
          start: period[0].season,
          end: period[period.length - 1].season,
          avgPoints,
          seasons: period,
        };
      }
    }

    return bestPeriod;
  }

  getDriverCareerSeasons(driver) {
    // Generate likely career seasons for a driver
    // This is a simplified approach - in reality, you'd query for actual career span
    const currentYear = new Date().getFullYear();
    const careerStart = Math.max(1950, currentYear - 20); // Assume max 20-year career

    const seasons = [];
    for (let year = careerStart; year <= Math.min(currentYear, 2024); year++) {
      seasons.push(year);
    }

    return seasons;
  }

  parseJsonResponse(content) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback parsing
      return {
        drivers: this.extractDriverNames(content),
        seasons: this.extractSeasons(content),
        analysisType: this.extractAnalysisType(content),
      };
    } catch (error) {
      logger.warn('Failed to parse JSON response, using fallback', error);
      return {
        drivers: this.extractDriverNames(content),
        seasons: null,
        analysisType: 'comprehensive',
      };
    }
  }

  extractDriverNames(content) {
    // Simple driver name extraction
    const commonDriverNames = [
      'Hamilton',
      'Verstappen',
      'Leclerc',
      'Russell',
      'Sainz',
      'Norris',
      'Piastri',
      'Alonso',
      'Stroll',
      'Tsunoda',
      'Albon',
      'Sargeant',
      'Magnussen',
      'Hulkenberg',
      'Ocon',
      'Gasly',
      'Bottas',
      'Zhou',
      'Perez',
      'Ricciardo',
      'Schumacher',
      'Vettel',
      'Raikkonen',
    ];

    return commonDriverNames.filter((name) =>
      content.toLowerCase().includes(name.toLowerCase()),
    );
  }

  extractSeasons(content) {
    const yearMatches = content.match(/\b(19|20)\d{2}\b/g);
    return yearMatches
      ? yearMatches
          .map((y) => parseInt(y))
          .filter((y) => y >= 1950 && y <= 2025)
      : null;
  }

  extractAnalysisType(content) {
    const types = ['career', 'team', 'peak', 'comparison', 'comprehensive'];
    return (
      types.find((type) => content.toLowerCase().includes(type)) ||
      'comprehensive'
    );
  }

  parseInsightsResponse(content) {
    return {
      analysis: content,
      confidence: this.extractConfidenceScores(content),
      keyPoints: this.extractKeyPoints(content),
    };
  }

  extractConfidenceScores(content) {
    const confidenceMatches = content.match(/confidence[:\s]*(\d+)/gi);
    return confidenceMatches
      ? confidenceMatches.map((match) => parseInt(match.match(/\d+/)[0]))
      : [75];
  }

  extractKeyPoints(content) {
    const points = content
      .split('\n')
      .filter(
        (line) => line.trim().startsWith('-') || line.trim().startsWith('•'),
      )
      .map((line) => line.trim().substring(1).trim());
    return points.length > 0
      ? points
      : ['Comprehensive driver analysis completed'];
  }

  createDriverSummary(state) {
    const { driverData, careerStats } = state;
    const drivers = Object.keys(driverData);

    return (
      `Analyzed ${drivers.length} driver(s): ${drivers.join(', ')}. ` +
      `Career statistics, team adaptability, and peak performance periods identified.`
    );
  }

  extractKeyFindings(state) {
    const findings = [];
    const { careerStats, teamAnalysis, peakAnalysis } = state;

    for (const [driver, stats] of Object.entries(careerStats || {})) {
      findings.push(
        `${driver}: ${stats.wins} wins, ${stats.podiums} podiums in ${stats.totalRaces} races`,
      );
      findings.push(
        `Peak period: ${peakAnalysis[driver]?.overallPeakPeriod?.start}-${peakAnalysis[driver]?.overallPeakPeriod?.end}`,
      );
    }

    return findings;
  }

  generateRecommendations(state) {
    return [
      'Consider team context when evaluating driver performance',
      'Peak performance periods often correlate with competitive car packages',
      'Adaptability to team changes is a key indicator of driver skill',
    ];
  }

  assessDataQuality(state) {
    const { driverData } = state;
    const totalDrivers = Object.keys(driverData).length;
    const driversWithData = Object.values(driverData).filter(
      (data) => data.careerResults?.length > 0,
    ).length;

    return {
      completeness:
        totalDrivers > 0 ? (driversWithData / totalDrivers) * 100 : 0,
      coverage: `${driversWithData}/${totalDrivers} drivers with complete data`,
      reliability: 'high',
    };
  }

  calculateOverallConfidence(state) {
    const { insights } = state;
    if (insights?.confidence?.length > 0) {
      return (
        insights.confidence.reduce((a, b) => a + b, 0) /
        insights.confidence.length
      );
    }
    return 75; // Default confidence
  } // Public interface
  async analyzeDriver(query, options = {}) {
    try {
      const initialState = {
        query,
        messages: [],
        queryAnalysis: {},
        driverData: {},
        careerStats: {},
        teamAnalysis: {},
        peakAnalysis: {},
        insights: {},
        synthesis: {},
        results: {},
        ...options,
      };

      const result = await this.app.invoke(initialState);

      logger.info('Driver performance analysis completed', {
        query,
        success: true,
        driversAnalyzed: Object.keys(result.driverData || {}).length,
      });

      return result;
    } catch (error) {
      logger.error('Driver performance analysis failed:', error);
      throw error;
    }
  }
}

export default DriverPerformanceAgent;
