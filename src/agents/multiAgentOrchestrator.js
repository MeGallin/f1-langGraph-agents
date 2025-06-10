import { StateGraph } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import logger from '../utils/logger.js';

// Import specialized agents
import SeasonAnalysisAgent from './seasonAnalysisAgent.js';
import DriverPerformanceAgent from './driverPerformanceAgent.js';
import RaceStrategyAgent from './raceStrategyAgent.js';
import ChampionshipPredictorAgent from './championshipPredictorAgent.js';
import HistoricalComparisonAgent from './historicalComparisonAgent.js';

/**
 * Multi-Agent Orchestrator for F1 LangGraph System
 * Routes queries to appropriate specialized agents and synthesizes results
 */
export default class MultiAgentOrchestrator {
  constructor(langGraphAdapter, options = {}) {
    this.adapter = langGraphAdapter;
    this.model =
      options.model ||
      new ChatOpenAI({
        modelName: process.env.DEFAULT_MODEL || 'gpt-4o',
        temperature: parseFloat(process.env.DEFAULT_TEMPERATURE) || 0.1,
      });

    // Initialize specialized agents
    this.agents = {
      season: new SeasonAnalysisAgent(langGraphAdapter, options),
      driver: new DriverPerformanceAgent(langGraphAdapter, options),
      race: new RaceStrategyAgent(langGraphAdapter, options),
      championship: new ChampionshipPredictorAgent(langGraphAdapter, options),
      historical: new HistoricalComparisonAgent(langGraphAdapter, options),
    };

    // Create the orchestration workflow
    this.workflow = this.createWorkflow();
    this.app = this.workflow.compile();

    logger.info('MultiAgentOrchestrator initialized');
  }

  /**
   * Create the multi-agent orchestration workflow
   */
  createWorkflow() {
    const workflow = new StateGraph({
      channels: {
        messages: { default: () => [] },
        query: { default: () => '' },
        queryAnalysis: { default: () => ({}) },
        selectedAgent: { default: () => '' },
        agentResults: { default: () => [] },
        finalResponse: { default: () => '' },
        confidence: { default: () => 0 },
        metadata: { default: () => ({}) },
      },
    });

    // Add workflow nodes
    workflow.addNode('analyzeQuery', this.analyzeQuery.bind(this));
    workflow.addNode('routeToAgent', this.routeToAgent.bind(this));
    workflow.addNode('executeAgent', this.executeAgent.bind(this));
    workflow.addNode('synthesizeResults', this.synthesizeResults.bind(this));

    // Define workflow edges
    workflow.setEntryPoint('analyzeQuery');
    workflow.addEdge('analyzeQuery', 'routeToAgent');
    workflow.addEdge('routeToAgent', 'executeAgent');
    workflow.addEdge('executeAgent', 'synthesizeResults');
    workflow.setFinishPoint('synthesizeResults');

    return workflow;
  }

  /**
   * Analyze the incoming query to determine intent and routing
   */
  async analyzeQuery(state) {
    const { query } = state;

    logger.info('Analyzing query for agent routing', { query });

    try {
      const analysisPrompt = `
Analyze this F1 query and determine which specialized agent should handle it:

Query: "${query}"

Available agents:
- season: Season analysis, championship standings, constructor performance
- driver: Individual driver performance, career analysis, comparisons
- race: Race strategy, circuit analysis, race-specific insights
- championship: Championship predictions, probability calculations
- historical: Historical comparisons, era analysis, cross-generational insights

Respond with JSON:
{
  "primaryAgent": "agent_name",
  "confidence": 0.0-1.0,
  "reasoning": "explanation",
  "keywords": ["key", "terms"],
  "requiresMultipleAgents": false
}`;

      const response = await this.model.invoke([
        new SystemMessage(
          'You are an expert F1 query analyzer. Analyze queries and route them to the most appropriate specialized agent.',
        ),
        new HumanMessage(analysisPrompt),
      ]);

      const analysis = this.parseJsonResponse(response.content);

      return {
        ...state,
        queryAnalysis: analysis,
        selectedAgent: analysis.primaryAgent,
        metadata: {
          ...state.metadata,
          analysisConfidence: analysis.confidence,
          reasoning: analysis.reasoning,
        },
      };
    } catch (error) {
      logger.error('Error analyzing query', { error: error.message, query });

      // Fallback to season agent for general queries
      return {
        ...state,
        queryAnalysis: {
          primaryAgent: 'season',
          confidence: 0.5,
          reasoning: 'Fallback routing due to analysis error',
        },
        selectedAgent: 'season',
      };
    }
  }

  /**
   * Route the query to the appropriate specialized agent
   */
  async routeToAgent(state) {
    const { selectedAgent, queryAnalysis } = state;

    logger.info('Routing to specialized agent', {
      selectedAgent,
      confidence: queryAnalysis.confidence,
    });

    // Validate agent selection
    if (!this.agents[selectedAgent]) {
      logger.warn('Invalid agent selected, defaulting to season', {
        selectedAgent,
      });
      return {
        ...state,
        selectedAgent: 'season',
      };
    }

    return state;
  }

  /**
   * Execute the selected specialized agent
   */
  async executeAgent(state) {
    const { selectedAgent, query } = state;

    logger.info('Executing specialized agent', { selectedAgent, query });

    try {
      const agent = this.agents[selectedAgent];
      let result;

      // Call the appropriate agent method based on agent type
      switch (selectedAgent) {
        case 'season':
          result = await agent.analyze(query);
          break;
        case 'driver':
          result = await agent.analyzeDriver(query);
          break;
        case 'race':
          result = await agent.analyzeRace(query);
          break;
        case 'championship':
          result = await agent.predictChampionship(query);
          break;
        case 'historical':
          result = await agent.compareHistorical(query);
          break;
        default:
          throw new Error(`Unknown agent type: ${selectedAgent}`);
      }

      return {
        ...state,
        agentResults: [result],
        confidence: result.confidence || 0.8,
        metadata: {
          ...state.metadata,
          agentExecuted: selectedAgent,
          executionTime: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error('Error executing specialized agent', {
        error: error.message,
        selectedAgent,
        query,
      });

      return {
        ...state,
        agentResults: [
          {
            finalResponse: `I encountered an error while analyzing your F1 query. Please try rephrasing your question or contact support if the issue persists.`,
            confidence: 0.1,
            error: error.message,
          },
        ],
        confidence: 0.1,
      };
    }
  }

  /**
   * Synthesize results from specialized agents into final response
   */
  async synthesizeResults(state) {
    const { agentResults, query, selectedAgent, queryAnalysis } = state;

    logger.info('Synthesizing final response', {
      selectedAgent,
      resultsCount: agentResults.length,
    });

    try {
      if (agentResults.length === 0) {
        return {
          ...state,
          finalResponse: 'No results were generated for your F1 query.',
          confidence: 0.1,
        };
      }

      const primaryResult = agentResults[0];

      // If we have a good result, use it directly
      if (primaryResult.finalResponse && primaryResult.confidence > 0.7) {
        return {
          ...state,
          finalResponse: primaryResult.finalResponse,
          confidence: primaryResult.confidence,
          metadata: {
            ...state.metadata,
            synthesisMethod: 'direct',
            agentUsed: selectedAgent,
          },
        };
      }

      // Otherwise, enhance the response with orchestrator context
      const enhancementPrompt = `
Enhance this F1 analysis response with additional context and insights:

Original Query: "${query}"
Agent Used: ${selectedAgent}
Agent Response: "${primaryResult.finalResponse}"

Provide an enhanced response that:
1. Maintains the core analysis from the specialized agent
2. Adds relevant F1 context and background
3. Suggests related areas of interest
4. Ensures the response is comprehensive and engaging

Keep the response focused on F1 racing and maintain technical accuracy.`;

      const enhancedResponse = await this.model.invoke([
        new SystemMessage(
          'You are an expert F1 analyst enhancing specialized agent responses with additional context and insights.',
        ),
        new HumanMessage(enhancementPrompt),
      ]);

      return {
        ...state,
        finalResponse: enhancedResponse.content,
        confidence: Math.min(primaryResult.confidence + 0.1, 0.95),
        metadata: {
          ...state.metadata,
          synthesisMethod: 'enhanced',
          agentUsed: selectedAgent,
          enhancementApplied: true,
        },
      };
    } catch (error) {
      logger.error('Error synthesizing results', { error: error.message });

      // Fallback to primary result if synthesis fails
      const primaryResult = agentResults[0] || {};
      return {
        ...state,
        finalResponse:
          primaryResult.finalResponse ||
          'Unable to generate a complete response for your F1 query.',
        confidence: primaryResult.confidence || 0.3,
      };
    }
  }

  /**
   * Main orchestration method - processes F1 queries through specialized agents
   */
  async processQuery(query, options = {}) {
    logger.info('Processing F1 query through multi-agent orchestrator', {
      query,
    });

    try {
      const initialState = {
        query,
        messages: [new HumanMessage(query)],
        ...options,
      };

      const result = await this.app.invoke(initialState);

      logger.info('Multi-agent orchestration completed', {
        query,
        selectedAgent: result.selectedAgent,
        confidence: result.confidence,
      });

      return {
        success: true,
        query,
        result: {
          finalResponse: result.finalResponse,
          confidence: result.confidence,
          agentUsed: result.selectedAgent,
          queryAnalysis: result.queryAnalysis,
          metadata: result.metadata,
          completedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error('Multi-agent orchestration failed', {
        error: error.message,
        query,
      });

      return {
        success: false,
        query,
        error: error.message,
        result: {
          finalResponse:
            'I encountered an error while processing your F1 query. Please try again or contact support.',
          confidence: 0.1,
          completedAt: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Get available agents and their capabilities
   */
  getAvailableAgents() {
    return {
      season: {
        name: 'Season Analysis Agent',
        description: 'Comprehensive F1 season analysis and insights',
        capabilities: [
          'Single season analysis',
          'Multi-season comparisons',
          'Constructor performance analysis',
          'Championship standings analysis',
        ],
      },
      driver: {
        name: 'Driver Performance Agent',
        description: 'Individual driver career and performance analysis',
        capabilities: [
          'Driver career statistics',
          'Head-to-head comparisons',
          'Circuit-specific performance',
          'Team adaptation analysis',
        ],
      },
      race: {
        name: 'Race Strategy Agent',
        description: 'Race-specific analysis and strategic insights',
        capabilities: [
          'Circuit characteristics analysis',
          'Race strategy evaluation',
          'Weather impact analysis',
          'Pit stop strategy insights',
        ],
      },
      championship: {
        name: 'Championship Predictor Agent',
        description: 'Predictive analysis for championship outcomes',
        capabilities: [
          'Championship probability calculations',
          'Scenario modeling',
          'Points projection analysis',
          'Remaining race impact assessment',
        ],
      },
      historical: {
        name: 'Historical Comparison Agent',
        description: 'Deep historical analysis and era comparisons',
        capabilities: [
          'Cross-era driver comparisons',
          'Regulation change impact analysis',
          'Team dominance periods',
          'Technical evolution insights',
        ],
      },
    };
  }

  /**
   * Parse JSON response with error handling
   */
  parseJsonResponse(content) {
    try {
      // Clean the content to extract JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback parsing
      return JSON.parse(content);
    } catch (error) {
      logger.warn('Failed to parse JSON response', {
        content,
        error: error.message,
      });
      return {
        primaryAgent: 'season',
        confidence: 0.5,
        reasoning: 'JSON parsing failed, using default routing',
      };
    }
  }
}
