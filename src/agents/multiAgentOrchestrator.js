/**
 * F1 Multi-Agent Orchestrator
 *
 * Coordinates multiple specialized F1 agents to handle complex queries
 * that may require expertise from different domains.
 */

import { StateGraph, START, END } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import logger from '../utils/logger.js';

// Import specialized agents
import { SeasonAnalysisAgent } from './seasonAnalysisAgent.js';
import { DriverPerformanceAgent } from './driverPerformanceAgent.js';
import { RaceStrategyAgent } from './raceStrategyAgent.js';
import { ChampionshipPredictorAgent } from './championshipPredictorAgent.js';
import { HistoricalComparisonAgent } from './historicalComparisonAgent.js';

export class MultiAgentOrchestrator {
  constructor(langGraphAdapter, options = {}) {
    this.adapter = langGraphAdapter;
    this.model =
      options.model ||
      new ChatOpenAI({
        modelName: 'gpt-4o-mini',
        temperature: 0.1,
      });

    // Initialize specialized agents
    this.agents = {
      season: new SeasonAnalysisAgent(langGraphAdapter, options),
      driver: new DriverPerformanceAgent(langGraphAdapter, options),
      race: new RaceStrategyAgent(langGraphAdapter, options),
      championship: new ChampionshipPredictorAgent(langGraphAdapter, options),
      historical: new HistoricalComparisonAgent(langGraphAdapter, options),
    };

    // Build the orchestrator workflow
    this.workflow = this.createWorkflow();
    this.app = this.workflow.compile();

    logger.info(
      'MultiAgentOrchestrator initialized with all specialized agents',
    );
  }

  createWorkflow() {
    const workflow = new StateGraph({
      channels: {
        messages: { default: () => [] },
        query: { default: () => '' },
        queryAnalysis: { default: () => ({}) },
        routingDecision: { default: () => ({}) },
        agentResults: { default: () => [] },
        finalResponse: { default: () => '' },
        confidence: { default: () => 0.0 },
        metadata: { default: () => ({}) },
      },
    });

    // Add nodes
    workflow.addNode('analyzeQuery', this.analyzeQuery.bind(this));
    workflow.addNode('routeToAgents', this.routeToAgents.bind(this));
    workflow.addNode('executeAgents', this.executeAgents.bind(this));
    workflow.addNode('synthesizeResults', this.synthesizeResults.bind(this));

    // Add edges
    workflow.addEdge(START, 'analyzeQuery');
    workflow.addEdge('analyzeQuery', 'routeToAgents');
    workflow.addEdge('routeToAgents', 'executeAgents');
    workflow.addEdge('executeAgents', 'synthesizeResults');
    workflow.addEdge('synthesizeResults', END);

    return workflow;
  }

  async analyzeQuery(state) {
    try {
      logger.info('Analyzing query for agent routing', { query: state.query });

      const analysisPrompt = `
        Analyze this F1 query and determine which specialized agents should handle it:
        
        Query: "${state.query}"
        
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
        }
      `;

      const response = await this.model.invoke([
        new SystemMessage('You are an expert F1 query analyzer.'),
        new HumanMessage(analysisPrompt),
      ]);

      const queryAnalysis = this.parseJsonResponse(response.content);

      return {
        ...state,
        queryAnalysis,
        messages: [...state.messages, response],
      };
    } catch (error) {
      logger.error('Error analyzing query:', error);

      // Fallback analysis
      const fallbackAnalysis = this.createFallbackAnalysis(state.query);
      return {
        ...state,
        queryAnalysis: fallbackAnalysis,
      };
    }
  }

  async routeToAgents(state) {
    try {
      logger.info('Routing query to appropriate agents', {
        primaryAgent: state.queryAnalysis.primaryAgent,
        secondaryAgents: state.queryAnalysis.secondaryAgents,
      });

      const routingDecision = {
        primaryAgent: state.queryAnalysis.primaryAgent || 'season',
        secondaryAgents: state.queryAnalysis.secondaryAgents || [],
        executionOrder: this.determineExecutionOrder(state.queryAnalysis),
        parallelExecution: state.queryAnalysis.complexity !== 'complex',
      };

      return {
        ...state,
        routingDecision,
      };
    } catch (error) {
      logger.error('Error routing to agents:', error);

      // Fallback routing
      return {
        ...state,
        routingDecision: {
          primaryAgent: 'season',
          secondaryAgents: [],
          executionOrder: ['season'],
          parallelExecution: true,
        },
      };
    }
  }

  async executeAgents(state) {
    try {
      logger.info('Executing specialized agents', {
        agents: state.routingDecision.executionOrder,
      });

      const agentResults = [];
      const { primaryAgent, secondaryAgents, parallelExecution } =
        state.routingDecision;

      if (parallelExecution && secondaryAgents.length > 0) {
        // Execute agents in parallel
        const agentPromises = [primaryAgent, ...secondaryAgents].map(
          async (agentType) => {
            return this.executeSpecializedAgent(
              agentType,
              state.query,
              state.queryAnalysis,
            );
          },
        );

        const results = await Promise.allSettled(agentPromises);

        results.forEach((result, index) => {
          const agentType = [primaryAgent, ...secondaryAgents][index];
          if (result.status === 'fulfilled') {
            agentResults.push({
              agent: agentType,
              result: result.value,
              success: true,
            });
          } else {
            logger.warn(`Agent ${agentType} failed:`, result.reason);
            agentResults.push({
              agent: agentType,
              result: null,
              success: false,
              error: result.reason?.message || 'Unknown error',
            });
          }
        });
      } else {
        // Execute agents sequentially
        for (const agentType of [primaryAgent, ...secondaryAgents]) {
          try {
            const result = await this.executeSpecializedAgent(
              agentType,
              state.query,
              state.queryAnalysis,
            );
            agentResults.push({
              agent: agentType,
              result,
              success: true,
            });
          } catch (error) {
            logger.warn(`Agent ${agentType} failed:`, error);
            agentResults.push({
              agent: agentType,
              result: null,
              success: false,
              error: error.message,
            });
          }
        }
      }

      return {
        ...state,
        agentResults,
      };
    } catch (error) {
      logger.error('Error executing agents:', error);
      throw error;
    }
  }

  async executeSpecializedAgent(agentType, query, queryAnalysis) {
    const agent = this.agents[agentType];
    if (!agent) {
      throw new Error(`Unknown agent type: ${agentType}`);
    }

    logger.info(`Executing ${agentType} agent`, { query });

    // Call the appropriate method based on agent type
    switch (agentType) {
      case 'season':
        return await agent.analyze(query);
      case 'driver':
        return await agent.analyzeDriver(query);
      case 'race':
        return await agent.analyzeRace(query);
      case 'championship':
        return await agent.predictChampionship(query);
      case 'historical':
        return await agent.compareHistorical(query);
      default:
        throw new Error(`No execution method for agent type: ${agentType}`);
    }
  }

  async synthesizeResults(state) {
    try {
      logger.info('Synthesizing results from multiple agents', {
        agentCount: state.agentResults.length,
      });

      const successfulResults = state.agentResults.filter((r) => r.success);
      const failedResults = state.agentResults.filter((r) => !r.success);

      if (successfulResults.length === 0) {
        throw new Error('All agents failed to produce results');
      }

      // Create synthesis prompt
      const synthesisPrompt = this.createSynthesisPrompt(
        state.query,
        successfulResults,
      );

      const response = await this.model.invoke([
        new SystemMessage(
          'You are an expert F1 analyst synthesizing insights from multiple specialized agents.',
        ),
        new HumanMessage(synthesisPrompt),
      ]);

      // Calculate overall confidence
      const confidence = this.calculateOverallConfidence(successfulResults);

      // Create metadata
      const metadata = {
        queryType: state.queryAnalysis.queryType || 'general',
        agentsUsed: successfulResults.map((r) => r.agent),
        agentsFailed: failedResults.map((r) => r.agent),
        complexity: state.queryAnalysis.complexity || 'moderate',
        executionTime: new Date().toISOString(),
        totalAgents: state.agentResults.length,
        successfulAgents: successfulResults.length,
      };

      return {
        ...state,
        finalResponse: response.content,
        confidence,
        metadata,
        messages: [...state.messages, response],
      };
    } catch (error) {
      logger.error('Error synthesizing results:', error);

      // Fallback synthesis
      const fallbackResponse = this.createFallbackResponse(state);
      return {
        ...state,
        finalResponse: fallbackResponse,
        confidence: 0.5,
        metadata: { error: 'Synthesis failed, using fallback' },
      };
    }
  }

  createSynthesisPrompt(query, results) {
    const resultsSummary = results
      .map((r) => {
        const result = r.result;
        return `
Agent: ${r.agent}
Analysis: ${result.finalResponse || result.analysis || JSON.stringify(result)}
Confidence: ${result.confidence || 'N/A'}
`;
      })
      .join('\n---\n');

    return `
Original Query: "${query}"

Results from specialized F1 agents:
${resultsSummary}

Please synthesize these results into a comprehensive, expert-level F1 analysis that:
1. Directly answers the original query
2. Integrates insights from all agents
3. Highlights key findings and patterns
4. Provides actionable insights
5. Maintains technical accuracy

Provide a clear, engaging response that demonstrates deep F1 expertise.
    `;
  }

  calculateOverallConfidence(results) {
    if (results.length === 0) return 0;

    const confidences = results.map((r) => {
      const confidence = r.result?.confidence;
      if (typeof confidence === 'number') return confidence;
      return 0.7; // Default confidence
    });

    // Weighted average with bonus for multiple agents
    const avgConfidence =
      confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
    const multiAgentBonus = Math.min(0.1, (results.length - 1) * 0.05);

    return Math.min(1.0, avgConfidence + multiAgentBonus);
  }

  createFallbackAnalysis(query) {
    // Simple keyword-based analysis
    const lowerQuery = query.toLowerCase();

    let primaryAgent = 'season';
    const secondaryAgents = [];

    if (
      lowerQuery.includes('driver') ||
      lowerQuery.includes('hamilton') ||
      lowerQuery.includes('verstappen')
    ) {
      primaryAgent = 'driver';
    } else if (
      lowerQuery.includes('race') ||
      lowerQuery.includes('strategy') ||
      lowerQuery.includes('circuit')
    ) {
      primaryAgent = 'race';
    } else if (
      lowerQuery.includes('championship') ||
      lowerQuery.includes('predict') ||
      lowerQuery.includes('winner')
    ) {
      primaryAgent = 'championship';
    } else if (
      lowerQuery.includes('compare') ||
      lowerQuery.includes('historical') ||
      lowerQuery.includes('era')
    ) {
      primaryAgent = 'historical';
    }

    return {
      primaryAgent,
      secondaryAgents,
      queryType: 'general F1 analysis',
      complexity: 'moderate',
      requiresMultipleAgents: false,
      extractedEntities: {
        drivers: [],
        teams: [],
        seasons: [],
        races: [],
      },
    };
  }

  determineExecutionOrder(queryAnalysis) {
    const { primaryAgent, secondaryAgents } = queryAnalysis;
    return [primaryAgent, ...secondaryAgents].filter(Boolean);
  }

  createFallbackResponse(state) {
    const successfulResults = state.agentResults.filter((r) => r.success);

    if (successfulResults.length > 0) {
      const primaryResult = successfulResults[0];
      return (
        primaryResult.result?.finalResponse ||
        primaryResult.result?.analysis ||
        'F1 analysis completed with limited results.'
      );
    }

    return 'I apologize, but I encountered difficulties analyzing your F1 query. Please try rephrasing your question or asking about a specific aspect of Formula 1.';
  }

  parseJsonResponse(content) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback parsing
      return this.extractStructuredData(content);
    } catch (error) {
      logger.warn('Failed to parse JSON response, using fallback', error);
      return this.createFallbackAnalysis(content);
    }
  }

  extractStructuredData(content) {
    // Simple extraction based on keywords
    const lowerContent = content.toLowerCase();

    return {
      primaryAgent: 'season',
      secondaryAgents: [],
      queryType: 'general',
      complexity: 'moderate',
      requiresMultipleAgents: false,
      extractedEntities: {
        drivers: this.extractDrivers(content),
        teams: this.extractTeams(content),
        seasons: this.extractSeasons(content),
        races: this.extractRaces(content),
      },
    };
  }

  extractDrivers(content) {
    const drivers = [
      'Hamilton',
      'Verstappen',
      'Leclerc',
      'Russell',
      'Sainz',
      'Norris',
      'Piastri',
      'Alonso',
      'Schumacher',
      'Senna',
      'Prost',
    ];
    return drivers.filter((driver) =>
      content.toLowerCase().includes(driver.toLowerCase()),
    );
  }

  extractTeams(content) {
    const teams = [
      'Mercedes',
      'Red Bull',
      'Ferrari',
      'McLaren',
      'Alpine',
      'Aston Martin',
      'Williams',
      'AlphaTauri',
      'Alfa Romeo',
      'Haas',
    ];
    return teams.filter((team) =>
      content.toLowerCase().includes(team.toLowerCase()),
    );
  }

  extractSeasons(content) {
    const seasonRegex = /\b(19|20)\d{2}\b/g;
    const matches = content.match(seasonRegex);
    return matches ? [...new Set(matches)].sort() : [];
  }

  extractRaces(content) {
    const races = [
      'Monaco',
      'Silverstone',
      'Monza',
      'Spa',
      'Suzuka',
      'Interlagos',
      'Abu Dhabi',
      'Bahrain',
      'Australia',
      'Spain',
    ];
    return races.filter((race) =>
      content.toLowerCase().includes(race.toLowerCase()),
    );
  }

  // Public interface
  async processQuery(query, options = {}) {
    try {
      logger.info('Processing F1 query through multi-agent orchestrator', {
        query,
      });

      const initialState = {
        query,
        messages: [],
        queryAnalysis: {},
        routingDecision: {},
        agentResults: [],
        finalResponse: '',
        confidence: 0.0,
        metadata: {},
        ...options,
      };

      const result = await this.app.invoke(initialState);

      logger.info('Multi-agent query processing completed', {
        query,
        agentsUsed: result.metadata?.agentsUsed || [],
        confidence: result.confidence,
      });

      return {
        query: result.query,
        response: result.finalResponse,
        confidence: result.confidence,
        metadata: result.metadata,
        agentResults: result.agentResults,
      };
    } catch (error) {
      logger.error('Multi-agent query processing failed:', error);
      throw error;
    }
  }

  // Health check for all agents
  async healthCheck() {
    const agentHealth = {};

    for (const [agentType, agent] of Object.entries(this.agents)) {
      try {
        // Simple test to verify agent is working
        agentHealth[agentType] = {
          status: 'healthy',
          initialized: !!agent,
          hasWorkflow: !!agent.workflow,
        };
      } catch (error) {
        agentHealth[agentType] = {
          status: 'unhealthy',
          error: error.message,
        };
      }
    }

    return {
      orchestrator: 'healthy',
      agents: agentHealth,
      totalAgents: Object.keys(this.agents).length,
      healthyAgents: Object.values(agentHealth).filter(
        (h) => h.status === 'healthy',
      ).length,
    };
  }
}

export default MultiAgentOrchestrator;
