/**
 * F1 Agent State Schemas
 * Defines the state management structures for different F1 analysis agents
 */

/**
 * Base F1 Agent State
 * Common state structure for all F1 agents
 */
export class F1AgentState {
  constructor() {
    this.messages = [];
    this.currentQuery = '';
    this.selectedSeason = null;
    this.selectedDriver = null;
    this.selectedRace = null;
    this.selectedConstructor = null;
    this.analysisType = null; // 'season' | 'driver' | 'race' | 'championship' | 'historical'
    this.results = [];
    this.insights = [];
    this.confidence = 0;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Season Analysis State
 * Extended state for season-focused analysis
 */
export class SeasonState extends F1AgentState {
  constructor() {
    super();
    this.seasons = [];
    this.constructorData = [];
    this.raceResults = [];
    this.championshipStandings = [];
    this.trends = [];
    this.analysisType = 'season';
  }
}

/**
 * Driver Performance State
 * Extended state for driver-focused analysis
 */
export class DriverState extends F1AgentState {
  constructor() {
    super();
    this.driverName = '';
    this.driverId = '';
    this.careerStats = {};
    this.circuitPerformance = [];
    this.teammates = [];
    this.comparisons = [];
    this.analysisType = 'driver';
  }
}

/**
 * Race Strategy State
 * Extended state for race-focused analysis
 */
export class RaceState extends F1AgentState {
  constructor() {
    super();
    this.raceInfo = {};
    this.circuitInfo = {};
    this.weatherData = {};
    this.strategicInsights = [];
    this.performancePredictions = [];
    this.analysisType = 'race';
  }
}

/**
 * Championship Prediction State
 * Extended state for championship analysis
 */
export class ChampionshipState extends F1AgentState {
  constructor() {
    super();
    this.currentStandings = [];
    this.remainingRaces = [];
    this.historicalPatterns = [];
    this.probabilityCalculations = {};
    this.projections = [];
    this.analysisType = 'championship';
  }
}

/**
 * Historical Comparison State
 * Extended state for historical analysis
 */
export class HistoricalState extends F1AgentState {
  constructor() {
    super();
    this.eras = [];
    this.regulationChanges = [];
    this.dominancePeriods = [];
    this.crossEraComparisons = [];
    this.evolutionTrends = [];
    this.analysisType = 'historical';
  }
}

/**
 * Multi-Agent Orchestrator State
 * State for coordinating multiple specialized agents
 */
export class OrchestratorState extends F1AgentState {
  constructor() {
    super();
    this.activeAgents = [];
    this.agentResults = {};
    this.synthesizedResults = [];
    this.queryDecomposition = [];
    this.executionPlan = [];
  }
}

/**
 * State Factory
 * Creates appropriate state objects based on analysis type
 */
export class StateFactory {
  static createState(analysisType, initialData = {}) {
    let state;

    switch (analysisType) {
      case 'season':
        state = new SeasonState();
        break;
      case 'driver':
        state = new DriverState();
        break;
      case 'race':
        state = new RaceState();
        break;
      case 'championship':
        state = new ChampionshipState();
        break;
      case 'historical':
        state = new HistoricalState();
        break;
      case 'orchestrator':
        state = new OrchestratorState();
        break;
      default:
        state = new F1AgentState();
    }

    // Apply initial data
    Object.assign(state, initialData);

    return state;
  }
}

/**
 * State Utilities
 * Helper functions for state management
 */
export class StateUtils {
  /**
   * Add message to state
   */
  static addMessage(state, message) {
    if (!state.messages) state.messages = [];
    state.messages.push({
      ...message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Add result to state
   */
  static addResult(state, result) {
    if (!state.results) state.results = [];
    state.results.push({
      ...result,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Add insight to state
   */
  static addInsight(state, insight) {
    if (!state.insights) state.insights = [];
    state.insights.push({
      text: insight,
      timestamp: new Date().toISOString(),
      confidence: state.confidence || 0,
    });
  }

  /**
   * Update confidence score
   */
  static updateConfidence(state, score) {
    state.confidence = Math.max(0, Math.min(1, score));
  }

  /**
   * Get state summary
   */
  static getSummary(state) {
    return {
      analysisType: state.analysisType,
      messageCount: state.messages?.length || 0,
      resultCount: state.results?.length || 0,
      insightCount: state.insights?.length || 0,
      confidence: state.confidence,
      lastUpdated: state.timestamp,
    };
  }
}

export default {
  F1AgentState,
  SeasonState,
  DriverState,
  RaceState,
  ChampionshipState,
  HistoricalState,
  OrchestratorState,
  StateFactory,
  StateUtils,
};
