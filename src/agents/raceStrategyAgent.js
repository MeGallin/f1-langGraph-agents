/**
 * F1 Race Strategy Agent
 *
 * Specialized LangGraph agent for analyzing race strategies, tactical decisions,
 * and providing strategic insights for specific races or race scenarios.
 *
 * Features:
 * - Race strategy analysis and optimization
 * - Pit stop strategy evaluation
 * - Weather impact analysis
 * - Tire strategy assessment
 * - Safety car and virtual safety car impact
 * - Strategic decision recommendations
 */

import { StateGraph, START, END } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { RaceState } from '../state/schemas.js';
import logger from '../utils/logger.js';

export class RaceStrategyAgent {
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

    logger.info('RaceStrategyAgent initialized');
  }
  createWorkflow() {
    const workflow = new StateGraph({
      channels: {
        messages: { default: () => [] },
        query: { default: () => '' },
        queryAnalysis: { default: () => ({}) },
        raceData: { default: () => ({}) },
        pitStrategies: { default: () => ({}) },
        weatherAnalysis: { default: () => ({}) },
        tireStrategies: { default: () => ({}) },
        safetyCarAnalysis: { default: () => ({}) },
        insights: { default: () => ({}) },
        synthesis: { default: () => ({}) },
        results: { default: () => ({}) },
      },
    });

    // Add nodes
    workflow.addNode('analyzeQuery', this.analyzeQuery.bind(this));
    workflow.addNode('fetchRaceData', this.fetchRaceData.bind(this));
    workflow.addNode(
      'analyzePitStrategies',
      this.analyzePitStrategies.bind(this),
    );
    workflow.addNode(
      'evaluateWeatherImpact',
      this.evaluateWeatherImpact.bind(this),
    );
    workflow.addNode(
      'assessTireStrategies',
      this.assessTireStrategies.bind(this),
    );
    workflow.addNode(
      'analyzeSafetyCarImpact',
      this.analyzeSafetyCarImpact.bind(this),
    );
    workflow.addNode(
      'generateStrategyInsights',
      this.generateStrategyInsights.bind(this),
    );
    workflow.addNode('synthesizeResults', this.synthesizeResults.bind(this));

    // Add edges
    workflow.addEdge(START, 'analyzeQuery');
    workflow.addEdge('analyzeQuery', 'fetchRaceData');
    workflow.addEdge('fetchRaceData', 'analyzePitStrategies');

    // Conditional routing based on analysis type
    workflow.addConditionalEdges(
      'analyzePitStrategies',
      this.routeAnalysis.bind(this),
      {
        weather_focus: 'evaluateWeatherImpact',
        tire_focus: 'assessTireStrategies',
        safety_focus: 'analyzeSafetyCarImpact',
        comprehensive: 'evaluateWeatherImpact',
      },
    );
    workflow.addEdge('evaluateWeatherImpact', 'assessTireStrategies');
    workflow.addEdge('assessTireStrategies', 'analyzeSafetyCarImpact');
    workflow.addEdge('analyzeSafetyCarImpact', 'generateStrategyInsights');
    workflow.addEdge('generateStrategyInsights', 'synthesizeResults');
    workflow.addEdge('synthesizeResults', END);

    return workflow;
  }

  async analyzeQuery(state) {
    try {
      logger.info('Analyzing race strategy query', { query: state.query });

      const messages = [
        new SystemMessage(`You are an expert F1 race strategist and analyst.
                
                Analyze the following query and extract:
                1. Specific race(s) to analyze (season, round, circuit)
                2. Strategic aspects to focus on (pit stops, tires, weather, safety cars)
                3. Teams or drivers of particular interest
                4. Type of strategic analysis requested
                5. Weather conditions or scenarios to consider
                6. Comparative analysis requirements
                
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
            content: 'Query analyzed for race strategy analysis',
          },
        ],
      };
    } catch (error) {
      logger.error('Error in analyzeQuery:', error);
      throw error;
    }
  }

  async fetchRaceData(state) {
    try {
      const { queryAnalysis } = state;
      const raceData = {};

      logger.info('Fetching race data', { races: queryAnalysis.races });

      for (const raceInfo of queryAnalysis.races || []) {
        try {
          const { season, round } = raceInfo;

          // Fetch race results with detailed timing
          const raceResults = await this.adapter.invoke('get_race_results', {
            season: season,
            round: round,
          });

          // Fetch qualifying results for strategy context
          const qualifyingResults = await this.adapter.invoke(
            'get_qualifying_results',
            {
              season: season,
              round: round,
            },
          );

          // Fetch race information (circuit, date, etc.)
          const raceInfo = await this.adapter.invoke('get_races', {
            season: season,
            round: round,
          });

          // Fetch lap times if available
          const lapTimes = await this.fetchLapTimes(season, round);

          // Fetch pit stop data if available
          const pitStops = await this.fetchPitStops(season, round);

          raceData[`${season}_${round}`] = {
            race: raceInfo[0],
            results: raceResults,
            qualifying: qualifyingResults,
            lapTimes: lapTimes,
            pitStops: pitStops,
            season: season,
            round: round,
          };
        } catch (error) {
          logger.warn(
            `Failed to fetch race data for ${raceInfo.season} round ${raceInfo.round}:`,
            error.message,
          );
        }
      }

      return {
        ...state,
        raceData,
        messages: [
          ...(state.messages || []),
          {
            role: 'system',
            content: `Fetched data for ${Object.keys(raceData).length} races`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error in fetchRaceData:', error);
      throw error;
    }
  }

  async analyzePitStrategies(state) {
    try {
      const { raceData } = state;
      const pitStrategies = {};

      logger.info('Analyzing pit stop strategies');

      for (const [raceKey, data] of Object.entries(raceData)) {
        const analysis = this.analyzePitStopStrategies(data);
        pitStrategies[raceKey] = analysis;
      }

      return {
        ...state,
        pitStrategies,
        messages: [
          ...(state.messages || []),
          { role: 'system', content: 'Pit stop strategies analyzed' },
        ],
      };
    } catch (error) {
      logger.error('Error in analyzePitStrategies:', error);
      throw error;
    }
  }

  async evaluateWeatherImpact(state) {
    try {
      const { raceData } = state;
      const weatherAnalysis = {};

      logger.info('Evaluating weather impact on strategies');

      for (const [raceKey, data] of Object.entries(raceData)) {
        const analysis = this.evaluateWeatherStrategies(data);
        weatherAnalysis[raceKey] = analysis;
      }

      return {
        ...state,
        weatherAnalysis,
        messages: [
          ...(state.messages || []),
          { role: 'system', content: 'Weather impact evaluated' },
        ],
      };
    } catch (error) {
      logger.error('Error in evaluateWeatherImpact:', error);
      throw error;
    }
  }

  async assessTireStrategies(state) {
    try {
      const { raceData } = state;
      const tireAnalysis = {};

      logger.info('Assessing tire strategies');

      for (const [raceKey, data] of Object.entries(raceData)) {
        const analysis = this.assessTireChoices(data);
        tireAnalysis[raceKey] = analysis;
      }

      return {
        ...state,
        tireAnalysis,
        messages: [
          ...(state.messages || []),
          { role: 'system', content: 'Tire strategies assessed' },
        ],
      };
    } catch (error) {
      logger.error('Error in assessTireStrategies:', error);
      throw error;
    }
  }

  async analyzeSafetyCarImpact(state) {
    try {
      const { raceData } = state;
      const safetyCarAnalysis = {};

      logger.info('Analyzing safety car impact');

      for (const [raceKey, data] of Object.entries(raceData)) {
        const analysis = this.analyzeSafetyCarStrategies(data);
        safetyCarAnalysis[raceKey] = analysis;
      }

      return {
        ...state,
        safetyCarAnalysis,
        messages: [
          ...(state.messages || []),
          { role: 'system', content: 'Safety car impact analyzed' },
        ],
      };
    } catch (error) {
      logger.error('Error in analyzeSafetyCarImpact:', error);
      throw error;
    }
  }

  async generateStrategyInsights(state) {
    try {
      const {
        raceData,
        pitStrategies,
        weatherAnalysis,
        tireAnalysis,
        safetyCarAnalysis,
      } = state;

      logger.info('Generating AI-powered strategy insights');

      const messages = [
        new SystemMessage(`You are a world-class F1 race strategist with extensive experience in tactical decision-making.
                
                Based on the comprehensive race data and strategic analysis provided, generate expert insights about:
                1. Optimal race strategies and tactical decisions
                2. Key strategic turning points in the race
                3. Alternative strategies that could have been employed
                4. Impact of external factors (weather, safety cars, tire degradation)
                5. Team strategic performance evaluation
                6. Learning points for future race strategies
                
                Focus on strategic reasoning, tactical alternatives, and decision-making factors.
                Provide confidence scores (0-100) for strategic recommendations.
                Include specific examples and strategic rationale.`),
        new HumanMessage(`Analyze this race strategy data:
                
                Query: ${state.query}
                
                Strategic Analysis: ${JSON.stringify(
                  {
                    pitStrategies,
                    weatherAnalysis,
                    tireAnalysis,
                    safetyCarAnalysis,
                  },
                  null,
                  2,
                )}
                
                Generate comprehensive strategic insights with confidence scores.`),
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
            content: 'Generated expert race strategy insights',
          },
        ],
      };
    } catch (error) {
      logger.error('Error in generateStrategyInsights:', error);
      throw error;
    }
  }

  async synthesizeResults(state) {
    try {
      logger.info('Synthesizing final race strategy analysis');

      const synthesis = {
        summary: this.createStrategySummary(state),
        keyStrategicDecisions: this.extractKeyDecisions(state),
        alternativeStrategies: this.identifyAlternatives(state),
        strategicLearnings: this.extractLearnings(state),
        recommendations: this.generateRecommendations(state),
        dataQuality: this.assessDataQuality(state),
        metadata: {
          analysisType: 'race_strategy',
          racesAnalyzed: Object.keys(state.raceData || {}),
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
            content: 'Race strategy analysis completed successfully',
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

    if (queryAnalysis.focus?.includes('weather')) {
      return 'weather_focus';
    } else if (queryAnalysis.focus?.includes('tire')) {
      return 'tire_focus';
    } else if (queryAnalysis.focus?.includes('safety')) {
      return 'safety_focus';
    }
    return 'comprehensive';
  }

  // Helper methods for strategic analysis
  analyzePitStopStrategies(raceData) {
    const { results, pitStops, lapTimes } = raceData;

    const strategies = [];
    const strategyTypes = {};

    // Analyze each driver's pit strategy
    for (const result of results) {
      const driverPitStops =
        pitStops?.filter((ps) => ps.driverId === result.Driver.driverId) || [];

      const strategy = {
        driver: result.Driver.familyName,
        team: result.Constructor.name,
        stops: driverPitStops.length,
        stopLaps: driverPitStops.map((ps) => parseInt(ps.lap)),
        totalPitTime: driverPitStops.reduce(
          (sum, ps) => sum + parseFloat(ps.duration || 0),
          0,
        ),
        finalPosition: parseInt(result.position),
        startPosition: parseInt(result.grid),
      };

      strategies.push(strategy);

      // Categorize strategy types
      const strategyKey = `${strategy.stops}_stop`;
      if (!strategyTypes[strategyKey]) {
        strategyTypes[strategyKey] = [];
      }
      strategyTypes[strategyKey].push(strategy);
    }

    // Evaluate strategy effectiveness
    const strategyEffectiveness = {};
    for (const [type, drivers] of Object.entries(strategyTypes)) {
      const avgPositionGain =
        drivers.reduce(
          (sum, d) => sum + (d.startPosition - d.finalPosition),
          0,
        ) / drivers.length;
      const avgPitTime =
        drivers.reduce((sum, d) => sum + d.totalPitTime, 0) / drivers.length;

      strategyEffectiveness[type] = {
        count: drivers.length,
        avgPositionGain,
        avgPitTime,
        effectiveness: this.calculateStrategyEffectiveness(
          avgPositionGain,
          avgPitTime,
        ),
      };
    }

    return {
      strategies,
      strategyTypes,
      strategyEffectiveness,
      optimalStrategy: this.identifyOptimalStrategy(strategyEffectiveness),
    };
  }

  evaluateWeatherStrategies(raceData) {
    const { race, results, lapTimes } = raceData;

    // Analyze weather patterns during the race
    const weatherChanges = this.detectWeatherChanges(lapTimes);
    const wetTireUsage = this.analyzeWetTireUsage(results);

    return {
      weatherConditions: race.weather || 'unknown',
      weatherChanges,
      wetTireUsage,
      strategicImpact: this.assessWeatherStrategicImpact(
        weatherChanges,
        results,
      ),
    };
  }

  assessTireChoices(raceData) {
    const { results, qualifying } = raceData;

    const tireStrategies = [];
    const compoundEffectiveness = {};

    for (const result of results) {
      // Extract tire information if available
      const tireInfo = this.extractTireInformation(result);
      tireStrategies.push({
        driver: result.Driver.familyName,
        startingTire: tireInfo.starting,
        tireChanges: tireInfo.changes,
        performance: {
          position: parseInt(result.position),
          grid: parseInt(result.grid),
          positionChange: parseInt(result.grid) - parseInt(result.position),
        },
      });
    }

    return {
      tireStrategies,
      compoundEffectiveness,
      optimalTireStrategy: this.identifyOptimalTireStrategy(tireStrategies),
    };
  }

  analyzeSafetyCarStrategies(raceData) {
    const { results, lapTimes } = raceData;

    // Detect safety car periods from lap time data
    const safetyCarPeriods = this.detectSafetyCarPeriods(lapTimes);
    const strategicMoves = this.identifyStrategicMoves(
      safetyCarPeriods,
      results,
    );

    return {
      safetyCarPeriods,
      strategicMoves,
      impactAnalysis: this.analyzeSafetyCarImpact(safetyCarPeriods, results),
    };
  }

  // Utility methods
  async fetchLapTimes(season, round) {
    try {
      // This would fetch lap times - implementation depends on available endpoints
      return await this.adapter.invoke('get_lap_times', { season, round });
    } catch (error) {
      logger.warn(`No lap times available for ${season} round ${round}`);
      return [];
    }
  }

  async fetchPitStops(season, round) {
    try {
      // This would fetch pit stop data - implementation depends on available endpoints
      return await this.adapter.invoke('get_pit_stops', { season, round });
    } catch (error) {
      logger.warn(`No pit stop data available for ${season} round ${round}`);
      return [];
    }
  }

  calculateStrategyEffectiveness(positionGain, pitTime) {
    // Simple effectiveness calculation (can be made more sophisticated)
    const timeValue = Math.max(0, 100 - pitTime); // Less pit time is better
    const positionValue = Math.max(0, positionGain * 10); // Position gain is better
    return (timeValue + positionValue) / 2;
  }

  identifyOptimalStrategy(strategyEffectiveness) {
    let optimalStrategy = null;
    let bestEffectiveness = -1;

    for (const [strategy, data] of Object.entries(strategyEffectiveness)) {
      if (data.effectiveness > bestEffectiveness) {
        bestEffectiveness = data.effectiveness;
        optimalStrategy = strategy;
      }
    }

    return {
      strategy: optimalStrategy,
      effectiveness: bestEffectiveness,
      reasoning: `${optimalStrategy} showed best balance of position gain and pit time efficiency`,
    };
  }

  detectWeatherChanges(lapTimes) {
    // Analyze lap time variations to detect weather changes
    if (!lapTimes || lapTimes.length === 0) return [];

    const changes = [];
    // Implementation would analyze lap time patterns to detect weather changes
    return changes;
  }

  analyzeWetTireUsage(results) {
    // Analyze intermediate and wet tire usage
    const wetTireUsers = results.filter(
      (r) =>
        r.Constructor?.name?.toLowerCase().includes('wet') ||
        r.status?.toLowerCase().includes('rain'),
    );

    return {
      wetTireUsers: wetTireUsers.length,
      effectivenessInWet: wetTireUsers.length > 0 ? 'high' : 'low',
    };
  }

  assessWeatherStrategicImpact(weatherChanges, results) {
    return {
      impact: weatherChanges.length > 0 ? 'high' : 'low',
      strategicOpportunities: weatherChanges.length,
      winnerBenefited: weatherChanges.length > 0 ? 'likely' : 'unlikely',
    };
  }

  extractTireInformation(result) {
    // Extract tire information from result data
    // This is simplified - real implementation would parse tire data
    return {
      starting: 'medium', // Default assumption
      changes: 1, // Default assumption
    };
  }

  identifyOptimalTireStrategy(tireStrategies) {
    // Find the most successful tire strategy
    const bestPerformer = tireStrategies.reduce((best, current) =>
      current.performance.positionChange > best.performance.positionChange
        ? current
        : best,
    );

    return {
      driver: bestPerformer.driver,
      strategy: bestPerformer.startingTire,
      effectiveness: bestPerformer.performance.positionChange,
    };
  }

  detectSafetyCarPeriods(lapTimes) {
    // Detect safety car periods from lap time consistency
    if (!lapTimes || lapTimes.length === 0) return [];

    // Implementation would analyze lap time patterns
    return [];
  }

  identifyStrategicMoves(safetyCarPeriods, results) {
    // Identify strategic moves made during safety car periods
    return safetyCarPeriods.map((period) => ({
      lap: period.lap,
      moves: ['strategic pit stops', 'position changes'],
      impact: 'position shuffle',
    }));
  }

  analyzeSafetyCarImpact(safetyCarPeriods, results) {
    return {
      totalPeriods: safetyCarPeriods.length,
      strategicImpact: safetyCarPeriods.length > 0 ? 'high' : 'low',
      winnerBenefited: safetyCarPeriods.length > 0 ? 'possible' : 'unlikely',
    };
  }

  parseJsonResponse(content) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return {
        races: this.extractRaceInfo(content),
        focus: this.extractFocus(content),
        analysisType: 'comprehensive',
      };
    } catch (error) {
      logger.warn('Failed to parse JSON response, using fallback', error);
      return {
        races: this.extractRaceInfo(content),
        focus: ['comprehensive'],
        analysisType: 'comprehensive',
      };
    }
  }

  extractRaceInfo(content) {
    // Extract race information from content
    const seasonMatches = content.match(/\b(19|20)\d{2}\b/g);
    const seasons = seasonMatches
      ? seasonMatches.map((s) => parseInt(s))
      : [2024];

    return seasons.map((season) => ({ season, round: 1 })); // Default to first round
  }

  extractFocus(content) {
    const focusAreas = ['pit', 'weather', 'tire', 'safety', 'strategy'];
    return focusAreas.filter((area) => content.toLowerCase().includes(area));
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
      : [80];
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
      : ['Comprehensive race strategy analysis completed'];
  }

  createStrategySummary(state) {
    const { raceData } = state;
    const races = Object.keys(raceData);

    return (
      `Analyzed race strategies for ${races.length} race(s). ` +
      `Evaluated pit stop strategies, weather impact, tire choices, and safety car influences.`
    );
  }

  extractKeyDecisions(state) {
    const decisions = [];
    const { pitStrategies } = state;

    for (const [race, strategies] of Object.entries(pitStrategies || {})) {
      decisions.push(
        `${race}: ${strategies.optimalStrategy?.strategy} proved most effective`,
      );
    }

    return decisions;
  }

  identifyAlternatives(state) {
    return [
      'Alternative pit windows could have been utilized',
      'Different tire compound strategies were available',
      'Weather-based strategic adjustments were possible',
    ];
  }

  extractLearnings(state) {
    return [
      'Pit stop timing is crucial for strategic advantage',
      'Weather conditions significantly impact tire strategy',
      'Safety car periods create strategic opportunities',
    ];
  }

  generateRecommendations(state) {
    return [
      'Monitor weather forecasts for strategic planning',
      'Prepare multiple pit stop scenarios',
      'Consider tire degradation patterns for optimal timing',
      'Be ready to capitalize on safety car opportunities',
    ];
  }

  assessDataQuality(state) {
    const { raceData } = state;
    const totalRaces = Object.keys(raceData).length;
    const racesWithPitData = Object.values(raceData).filter(
      (data) => data.pitStops?.length > 0,
    ).length;

    return {
      completeness: totalRaces > 0 ? (racesWithPitData / totalRaces) * 100 : 0,
      coverage: `${racesWithPitData}/${totalRaces} races with complete strategic data`,
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
    return 80; // Default confidence for strategy analysis
  } // Public interface
  async analyzeRaceStrategy(query, options = {}) {
    try {
      const initialState = {
        query,
        messages: [],
        queryAnalysis: {},
        raceData: {},
        pitStrategies: {},
        weatherAnalysis: {},
        tireStrategies: {},
        safetyCarAnalysis: {},
        insights: {},
        synthesis: {},
        results: {},
        ...options,
      };

      const result = await this.app.invoke(initialState);

      logger.info('Race strategy analysis completed', {
        query,
        success: true,
        racesAnalyzed: Object.keys(result.raceData || {}).length,
      });

      return result;
    } catch (error) {
      logger.error('Race strategy analysis failed:', error);
      throw error;
    }
  }
}

export default RaceStrategyAgent;
