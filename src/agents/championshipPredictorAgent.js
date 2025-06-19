/**
 * F1 Championship Predictor Agent
 *
 * Specialized LangGraph agent for championship prediction analysis,
 * probability calculations, and season outcome forecasting.
 *
 * Features:
 * - Championship standings analysis
 * - Points projection and probability calculations
 * - Remaining races impact analysis
 * - Historical pattern recognition
 * - Scenario-based predictions
 */

import { StateGraph, START, END } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import logger from '../utils/logger.js';

export class ChampionshipPredictorAgent {
  constructor(langGraphAdapter, options = {}) {
    this.adapter = langGraphAdapter;
    this.model =
      options.model ||
      new ChatOpenAI({
        modelName: 'gpt-4o',
        temperature: 0.1,
      });

    // Build the workflow graph
    this.workflow = this.createWorkflow();
    this.app = this.workflow.compile();

    logger.info('ChampionshipPredictorAgent initialized');
  }

  createWorkflow() {
    const workflow = new StateGraph({
      channels: {
        messages: { default: () => [] },
        query: { default: () => '' },
        queryAnalysis: { default: () => ({}) },
        currentStandings: { default: () => [] },
        remainingRaces: { default: () => [] },
        historicalPatterns: { default: () => [] },
        probabilityCalculations: { default: () => ({}) },
        scenarios: { default: () => [] },
        predictions: { default: () => ({}) },
        insights: { default: () => ({}) },
        synthesis: { default: () => ({}) },
        results: { default: () => ({}) },
      },
    });

    // Add nodes
    workflow.addNode('analyzeQuery', this.analyzeQuery.bind(this));
    workflow.addNode(
      'fetchCurrentStandings',
      this.fetchCurrentStandings.bind(this),
    );
    workflow.addNode(
      'analyzeRemainingRaces',
      this.analyzeRemainingRaces.bind(this),
    );
    workflow.addNode(
      'calculateProbabilities',
      this.calculateProbabilities.bind(this),
    );
    workflow.addNode('runScenarios', this.runScenarios.bind(this));
    workflow.addNode(
      'generatePredictions',
      this.generatePredictions.bind(this),
    );
    workflow.addNode('synthesizeResults', this.synthesizeResults.bind(this));

    // Add edges
    workflow.addEdge(START, 'analyzeQuery');
    workflow.addEdge('analyzeQuery', 'fetchCurrentStandings');
    workflow.addEdge('fetchCurrentStandings', 'analyzeRemainingRaces');
    workflow.addEdge('analyzeRemainingRaces', 'calculateProbabilities');
    workflow.addEdge('calculateProbabilities', 'runScenarios');
    workflow.addEdge('runScenarios', 'generatePredictions');
    workflow.addEdge('generatePredictions', 'synthesizeResults');
    workflow.addEdge('synthesizeResults', END);

    return workflow;
  }

  async analyzeQuery(state) {
    try {
      logger.info('Analyzing championship prediction query', {
        query: state.query,
      });

      const messages = [
        new SystemMessage(`You are an expert F1 championship analyst specializing in statistical prediction and outcome modeling.
                
                Analyze the following query and extract:
                1. Championship type (drivers or constructors)
                2. Specific season or current season
                3. Prediction timeframe (end of season, specific races)
                4. Specific drivers/teams of interest
                5. Scenario types requested (optimistic, realistic, pessimistic)
                6. Statistical confidence level desired
                
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
            content: 'Query analyzed for championship prediction',
          },
        ],
      };
    } catch (error) {
      logger.error('Error in analyzeQuery:', error);
      throw error;
    }
  }

  async fetchCurrentStandings(state) {
    try {
      const { queryAnalysis } = state;
      const season = queryAnalysis.season || new Date().getFullYear();
      const standingsData = {};

      logger.info('Fetching current championship standings', { season });

      // Fetch driver standings
      if (queryAnalysis.championshipType !== 'constructors') {
        try {
          const driverStandings = await this.adapter.invoke(
            'get_driver_standings',
            {
              season: season,
            },
          );
          standingsData.drivers = driverStandings;
        } catch (error) {
          logger.warn(`No driver standings for ${season}:`, error.message);
        }
      }

      // Fetch constructor standings
      if (queryAnalysis.championshipType !== 'drivers') {
        try {
          const constructorStandings = await this.adapter.invoke(
            'get_constructor_standings',
            {
              season: season,
            },
          );
          standingsData.constructors = constructorStandings;
        } catch (error) {
          logger.warn(`No constructor standings for ${season}:`, error.message);
        }
      }

      // Fetch season races to determine remaining races
      try {
        const races = await this.adapter.invoke('get_races', {
          season: season,
        });
        standingsData.seasonRaces = races;
      } catch (error) {
        logger.warn(`No race schedule for ${season}:`, error.message);
      }

      return {
        ...state,
        currentStandings: standingsData,
        messages: [
          ...(state.messages || []),
          { role: 'system', content: `Fetched standings data for ${season}` },
        ],
      };
    } catch (error) {
      logger.error('Error in fetchCurrentStandings:', error);
      throw error;
    }
  }

  async analyzeRemainingRaces(state) {
    try {
      const { currentStandings, queryAnalysis } = state;
      const season = queryAnalysis.season || new Date().getFullYear();

      logger.info('Analyzing remaining races');

      // Determine completed and remaining races
      const races = currentStandings.seasonRaces || [];
      const currentDate = new Date();
      const completedRaces = [];
      const remainingRaces = [];

      for (const race of races) {
        const raceDate = new Date(race.date);
        if (raceDate <= currentDate) {
          completedRaces.push(race);
        } else {
          remainingRaces.push(race);
        }
      }

      // Calculate points available
      const pointsPerRace = 25; // Maximum points for win
      const totalRemainingPoints = remainingRaces.length * pointsPerRace;

      const raceAnalysis = {
        totalRaces: races.length,
        completedRaces: completedRaces.length,
        remainingRaces: remainingRaces.length,
        totalRemainingPoints,
        remainingRaceList: remainingRaces,
        seasonProgress:
          races.length > 0 ? (completedRaces.length / races.length) * 100 : 0,
      };

      return {
        ...state,
        remainingRaces: raceAnalysis,
        messages: [
          ...(state.messages || []),
          {
            role: 'system',
            content: `${remainingRaces.length} races remaining in ${season}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error in analyzeRemainingRaces:', error);
      throw error;
    }
  }

  async calculateProbabilities(state) {
    try {
      const { currentStandings, remainingRaces } = state;

      logger.info('Calculating championship probabilities');

      const calculations = {};

      // Driver championship probabilities
      if (currentStandings.drivers) {
        calculations.drivers = this.calculateDriverProbabilities(
          currentStandings.drivers,
          remainingRaces,
        );
      }

      // Constructor championship probabilities
      if (currentStandings.constructors) {
        calculations.constructors = this.calculateConstructorProbabilities(
          currentStandings.constructors,
          remainingRaces,
        );
      }

      return {
        ...state,
        probabilityCalculations: calculations,
        messages: [
          ...(state.messages || []),
          { role: 'system', content: 'Championship probabilities calculated' },
        ],
      };
    } catch (error) {
      logger.error('Error in calculateProbabilities:', error);
      throw error;
    }
  }

  async runScenarios(state) {
    try {
      const { probabilityCalculations, queryAnalysis } = state;

      logger.info('Running championship scenarios');

      const scenarios = [];

      // Optimistic scenario
      scenarios.push({
        type: 'optimistic',
        description: 'Best case scenario for championship contenders',
        assumptions: [
          'Consistent top-3 finishes',
          'Minimal DNFs',
          'Optimal strategy execution',
        ],
        results: this.calculateOptimisticScenario(probabilityCalculations),
      });

      // Realistic scenario
      scenarios.push({
        type: 'realistic',
        description: 'Expected performance based on current form',
        assumptions: [
          'Average performance maintained',
          'Normal reliability',
          'Standard strategic decisions',
        ],
        results: this.calculateRealisticScenario(probabilityCalculations),
      });

      // Pessimistic scenario
      scenarios.push({
        type: 'pessimistic',
        description: 'Conservative scenario with setbacks',
        assumptions: [
          'Below-average performance',
          'Reliability issues',
          'Strategic mistakes',
        ],
        results: this.calculatePessimisticScenario(probabilityCalculations),
      });

      return {
        ...state,
        scenarios: scenarios,
        messages: [
          ...(state.messages || []),
          { role: 'system', content: 'Championship scenarios generated' },
        ],
      };
    } catch (error) {
      logger.error('Error in runScenarios:', error);
      throw error;
    }
  }

  async generatePredictions(state) {
    try {
      const {
        currentStandings,
        probabilityCalculations,
        scenarios,
        queryAnalysis,
      } = state;

      logger.info('Generating AI-powered championship predictions');

      const messages = [
        new SystemMessage(`You are a world-class F1 championship analyst with deep knowledge of statistical modeling and racing dynamics.
                
                Based on the comprehensive championship data provided, generate expert predictions about:
                1. Most likely championship winner and probability
                2. Key factors that will determine the outcome
                3. Critical races and turning points
                4. Impact of remaining circuits on different teams/drivers
                5. Historical context and comparison to similar seasons
                6. Confidence levels for different predictions
                
                Focus on data-driven analysis, statistical reasoning, and racing context.
                Provide confidence scores (0-100) for major predictions.
                Include specific examples and statistical evidence.`),
        new HumanMessage(`Analyze this championship prediction data:
                
                Query: ${state.query}
                
                Championship Analysis: ${JSON.stringify(
                  {
                    currentStandings,
                    probabilityCalculations,
                    scenarios,
                  },
                  null,
                  2,
                )}
                
                Generate comprehensive championship predictions with confidence scores.`),
      ];

      const response = await this.model.invoke(messages);
      const predictions = this.parsePredictionsResponse(response.content);

      return {
        ...state,
        predictions,
        insights: predictions,
        messages: [
          ...(state.messages || []),
          {
            role: 'assistant',
            content: 'Generated expert championship predictions',
          },
        ],
      };
    } catch (error) {
      logger.error('Error in generatePredictions:', error);
      throw error;
    }
  }

  async synthesizeResults(state) {
    try {
      logger.info('Synthesizing final championship prediction analysis');

      const synthesis = {
        summary: this.createPredictionSummary(state),
        keyPredictions: this.extractKeyPredictions(state),
        criticalFactors: this.identifyCriticalFactors(state),
        scenarioAnalysis: this.summarizeScenarios(state),
        recommendations: this.generateRecommendations(state),
        dataQuality: this.assessDataQuality(state),
        metadata: {
          analysisType: 'championship_prediction',
          championshipTypes: this.getAnalyzedChampionships(state),
          timestamp: new Date().toISOString(),
          confidence: this.calculateOverallConfidence(state),
        },
      };

      return {
        ...state,
        synthesis,
        results: synthesis,
        finalResponse: synthesis.summary,
        messages: [
          ...(state.messages || []),
          {
            role: 'assistant',
            content: 'Championship prediction analysis completed successfully',
          },
        ],
      };
    } catch (error) {
      logger.error('Error in synthesizeResults:', error);
      throw error;
    }
  }

  // Helper methods for probability calculations
  calculateDriverProbabilities(driverStandings, remainingRaces) {
    const probabilities = [];

    for (let i = 0; i < Math.min(driverStandings.length, 5); i++) {
      const driver = driverStandings[i];
      const pointsGap =
        i === 0
          ? 0
          : parseInt(driverStandings[0].points) - parseInt(driver.points);
      const maxPossiblePoints = remainingRaces.totalRemainingPoints || 0;

      // Simple probability calculation based on points gap and remaining points
      let probability = 0;
      if (pointsGap <= maxPossiblePoints) {
        const gapRatio = pointsGap / (maxPossiblePoints || 1);
        probability = Math.max(0, Math.min(100, (1 - gapRatio) * 100));

        // Adjust for position (leader gets bonus, others get penalty)
        if (i === 0) {
          probability = Math.min(100, probability + 20);
        } else {
          probability = Math.max(0, probability - i * 10);
        }
      }

      probabilities.push({
        driver: `${driver.Driver?.givenName} ${driver.Driver?.familyName}`,
        currentPoints: parseInt(driver.points),
        position: parseInt(driver.position),
        pointsGap,
        probability: Math.round(probability),
        mathematicallyPossible: pointsGap <= maxPossiblePoints,
      });
    }

    return probabilities;
  }

  calculateConstructorProbabilities(constructorStandings, remainingRaces) {
    const probabilities = [];

    for (let i = 0; i < Math.min(constructorStandings.length, 5); i++) {
      const constructor = constructorStandings[i];
      const pointsGap =
        i === 0
          ? 0
          : parseInt(constructorStandings[0].points) -
            parseInt(constructor.points);
      const maxPossiblePoints = (remainingRaces.totalRemainingPoints || 0) * 2; // Two cars per team

      let probability = 0;
      if (pointsGap <= maxPossiblePoints) {
        const gapRatio = pointsGap / (maxPossiblePoints || 1);
        probability = Math.max(0, Math.min(100, (1 - gapRatio) * 100));

        if (i === 0) {
          probability = Math.min(100, probability + 15);
        } else {
          probability = Math.max(0, probability - i * 8);
        }
      }

      probabilities.push({
        constructor: constructor.Constructor?.name,
        currentPoints: parseInt(constructor.points),
        position: parseInt(constructor.position),
        pointsGap,
        probability: Math.round(probability),
        mathematicallyPossible: pointsGap <= maxPossiblePoints,
      });
    }

    return probabilities;
  }

  calculateOptimisticScenario(calculations) {
    // Boost probabilities for top contenders
    const optimistic = JSON.parse(JSON.stringify(calculations));

    if (optimistic.drivers) {
      optimistic.drivers.forEach((driver, index) => {
        if (index < 3) {
          driver.probability = Math.min(100, driver.probability * 1.3);
        }
      });
    }

    if (optimistic.constructors) {
      optimistic.constructors.forEach((constructor, index) => {
        if (index < 3) {
          constructor.probability = Math.min(
            100,
            constructor.probability * 1.3,
          );
        }
      });
    }

    return optimistic;
  }

  calculateRealisticScenario(calculations) {
    // Use current calculations as realistic baseline
    return JSON.parse(JSON.stringify(calculations));
  }

  calculatePessimisticScenario(calculations) {
    // Reduce probabilities, spread them more evenly
    const pessimistic = JSON.parse(JSON.stringify(calculations));

    if (pessimistic.drivers) {
      pessimistic.drivers.forEach((driver, index) => {
        driver.probability = Math.max(0, driver.probability * 0.7);
      });
    }

    if (pessimistic.constructors) {
      pessimistic.constructors.forEach((constructor, index) => {
        constructor.probability = Math.max(0, constructor.probability * 0.7);
      });
    }

    return pessimistic;
  }

  parseJsonResponse(content) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return {
        championshipType: this.extractChampionshipType(content),
        season: this.extractSeason(content),
        scenarios: ['realistic'],
      };
    } catch (error) {
      logger.warn('Failed to parse JSON response, using fallback', error);
      return {
        championshipType: 'drivers',
        season: new Date().getFullYear(),
        scenarios: ['realistic'],
      };
    }
  }

  extractChampionshipType(content) {
    if (content.toLowerCase().includes('constructor')) {
      return 'constructors';
    }
    return 'drivers'; // Default to drivers
  }

  extractSeason(content) {
    const yearMatches = content.match(/\b(19|20)\d{2}\b/g);
    return yearMatches ? parseInt(yearMatches[0]) : new Date().getFullYear();
  }

  parsePredictionsResponse(content) {
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
      : ['Comprehensive championship prediction completed'];
  }

  createPredictionSummary(state) {
    const { probabilityCalculations, scenarios } = state;
    let summary = 'Championship prediction analysis completed. ';

    if (probabilityCalculations.drivers) {
      const leader = probabilityCalculations.drivers[0];
      summary += `Driver championship leader: ${leader.driver} (${leader.probability}% probability). `;
    }

    if (probabilityCalculations.constructors) {
      const leader = probabilityCalculations.constructors[0];
      summary += `Constructor championship leader: ${leader.constructor} (${leader.probability}% probability).`;
    }

    return summary;
  }

  extractKeyPredictions(state) {
    const predictions = [];
    const { probabilityCalculations } = state;

    if (probabilityCalculations.drivers) {
      const top3 = probabilityCalculations.drivers.slice(0, 3);
      top3.forEach((driver) => {
        predictions.push(
          `${driver.driver}: ${driver.probability}% chance of winning drivers' championship`,
        );
      });
    }

    if (probabilityCalculations.constructors) {
      const top3 = probabilityCalculations.constructors.slice(0, 3);
      top3.forEach((constructor) => {
        predictions.push(
          `${constructor.constructor}: ${constructor.probability}% chance of winning constructors' championship`,
        );
      });
    }

    return predictions;
  }

  identifyCriticalFactors(state) {
    return [
      'Remaining race count and points distribution',
      'Current championship gaps and mathematical possibilities',
      'Historical performance patterns at remaining circuits',
      'Reliability and consistency factors',
      'Strategic decision-making under pressure',
    ];
  }
  summarizeScenarios(state) {
    const { scenarios } = state;
    if (!scenarios || !Array.isArray(scenarios)) {
      return [];
    }
    return scenarios.map((scenario) => ({
      type: scenario.type,
      description: scenario.description,
      likelihood:
        scenario.type === 'realistic'
          ? 'Most likely'
          : scenario.type === 'optimistic'
          ? 'Best case'
          : 'Worst case',
    }));
  }

  generateRecommendations(state) {
    return [
      'Monitor race-by-race performance trends for probability updates',
      'Consider circuit-specific strengths for more accurate predictions',
      'Account for potential regulatory changes or penalties',
      'Track weather patterns and their impact on different teams',
    ];
  }

  assessDataQuality(state) {
    const { currentStandings, remainingRaces } = state;
    const hasDriverData = currentStandings.drivers?.length > 0;
    const hasConstructorData = currentStandings.constructors?.length > 0;
    const hasRaceData = remainingRaces.remainingRaces > 0;

    const completeness =
      ([hasDriverData, hasConstructorData, hasRaceData].filter(Boolean).length /
        3) *
      100;

    return {
      completeness,
      coverage: `${hasDriverData ? 'Driver' : ''}${
        hasConstructorData ? ' Constructor' : ''
      } data available`,
      reliability: 'high',
    };
  }

  getAnalyzedChampionships(state) {
    const types = [];
    if (state.currentStandings?.drivers) types.push('drivers');
    if (state.currentStandings?.constructors) types.push('constructors');
    return types;
  }

  calculateOverallConfidence(state) {
    const { insights } = state;
    if (insights?.confidence?.length > 0) {
      return (
        insights.confidence.reduce((a, b) => a + b, 0) /
        insights.confidence.length
      );
    }
    return 78; // Default confidence for championship predictions
  }

  // Public interface
  async predictChampionship(query, options = {}) {
    try {
      const initialState = {
        query,
        messages: [],
        queryAnalysis: {},
        currentStandings: [],
        remainingRaces: [],
        historicalPatterns: [],
        probabilityCalculations: {},
        scenarios: [],
        predictions: {},
        insights: {},
        synthesis: {},
        results: {},
        ...options,
      };

      const result = await this.app.invoke(initialState);

      logger.info('Championship prediction completed', {
        query,
        success: true,
        championshipTypes: this.getAnalyzedChampionships(result),
      });

      return result;
    } catch (error) {
      logger.error('Championship prediction failed:', error);
      throw error;
    }
  }
}

export default ChampionshipPredictorAgent;
