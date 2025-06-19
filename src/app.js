/**
 * F1 LangGraph Application Orchestrator
 * Main application class that coordinates the entire F1 analysis workflow
 */

import { ChatOpenAI } from '@langchain/openai';
import F1GraphState from './utils/graphState.js';
import F1StartNode from './utils/startNode.js';
import F1RouterAgent from './agents/routerAgent.js';
import F1ChatMemory from './memory/chatMemory.js';
import LangGraphAdapter from './adapters/langGraphAdapter.js';
import { globalErrorHandler, F1Error } from './utils/errorHandler.js';
import logger from './utils/logger.js';

// Import specialized agents
import SeasonAnalysisAgent from './agents/seasonAnalysisAgent.js';
import DriverPerformanceAgent from './agents/driverPerformanceAgent.js';
import RaceStrategyAgent from './agents/raceStrategyAgent.js';
import ChampionshipPredictorAgent from './agents/championshipPredictorAgent.js';
import HistoricalComparisonAgent from './agents/historicalComparisonAgent.js';

export class F1LangGraphApp {
  constructor(options = {}) {
    this.options = {
      enableMemory: options.enableMemory !== false,
      enableCircuitBreaker: options.enableCircuitBreaker !== false,
      defaultTimeout: options.defaultTimeout || 30000,
      ...options
    };

    // Initialize core components
    this.llm = this.initializeLLM();
    this.langGraphAdapter = new LangGraphAdapter();
    this.startNode = new F1StartNode();
    this.memory = null;
    this.agents = {};
    this.router = null;
    
    this.logger = logger;
    this.isInitialized = false;
  }

  /**
   * Initialize the F1 LangGraph application
   */
  async initialize() {
    try {
      this.logger.info('F1LangGraphApp: Starting initialization');

      // Initialize LangGraph adapter
      await this.langGraphAdapter.initialize();
      
      // Initialize memory if enabled
      if (this.options.enableMemory) {
        this.memory = new F1ChatMemory();
        await this.memory.initialize();
      }

      // Initialize agents
      this.agents = await this.initializeAgents();
      
      // Initialize router
      this.router = new F1RouterAgent(this.llm, {
        timeout: this.options.defaultTimeout,
        enableCircuitBreaker: this.options.enableCircuitBreaker
      });

      this.isInitialized = true;
      
      this.logger.info('F1LangGraphApp: Initialization completed successfully', {
        agentCount: Object.keys(this.agents).length,
        memoryEnabled: !!this.memory,
        circuitBreakerEnabled: this.options.enableCircuitBreaker
      });

    } catch (error) {
      this.logger.error('F1LangGraphApp: Initialization failed', {
        error: error.message
      });
      throw new F1Error(
        `Failed to initialize F1 LangGraph application: ${error.message}`,
        'INITIALIZATION_FAILED',
        { originalError: error }
      );
    }
  }

  /**
   * Process F1 query through the complete LangGraph workflow
   */
  async processQuery(query, threadId, userContext = {}) {
    if (!this.isInitialized) {
      throw new F1Error(
        'Application not initialized. Call initialize() first.',
        'NOT_INITIALIZED'
      );
    }

    const startTime = Date.now();

    return globalErrorHandler.executeWithResilience(
      async () => {
        // 1. StartNode - Initialize workflow
        this.logger.info('F1LangGraphApp: Starting query processing', {
          query: query.substring(0, 100) + '...',
          threadId,
          hasUserContext: Object.keys(userContext).length > 0
        });

        let state = await this.startNode.processWithAnalysis(query, threadId, userContext);

        // 2. RouterAgent - Determine target agent
        this.logger.debug('F1LangGraphApp: Routing query to specialized agent');
        state = await this.router.route(state);

        // 3. SpecializedAgent - Process with domain expertise
        this.logger.debug('F1LangGraphApp: Processing with specialized agent', {
          selectedAgent: state.state.selectedAgent,
          confidence: state.state.confidence
        });
        
        const selectedAgent = this.agents[state.state.selectedAgent];
        if (!selectedAgent) {
          throw new F1Error(
            `Selected agent '${state.state.selectedAgent}' not available`,
            'AGENT_NOT_FOUND'
          );
        }

        state = await this.processWithSpecializedAgent(selectedAgent, state);

        // 4. Memory - Persist conversation
        if (this.memory) {
          await this.persistConversation(state);
        }

        // 5. Response - Assemble final response
        const response = this.assembleResponse(state, startTime);

        this.logger.info('F1LangGraphApp: Query processing completed', {
          threadId,
          selectedAgent: state.state.selectedAgent,
          confidence: state.state.confidence,
          processingTime: Date.now() - startTime,
          success: true
        });

        return response;

      },
      {
        operation: 'processQuery',
        useCircuitBreaker: this.options.enableCircuitBreaker,
        timeout: this.options.defaultTimeout,
        fallbackFn: (error) => this.createFallbackResponse(query, threadId, error)
      }
    );
  }

  /**
   * Process query with specialized agent
   */
  async processWithSpecializedAgent(agent, state) {
    const agentType = state.state.selectedAgent;
    
    try {
      // Call the appropriate agent method
      let agentResult;
      
      switch (agentType) {
        case 'season':
          agentResult = await agent.analyze(state.state.query);
          break;
        case 'driver':
          agentResult = await agent.analyzeDriver(state.state.query);
          break;
        case 'race':
          agentResult = await agent.analyzeRaceStrategy(state.state.query);
          break;
        case 'championship':
          agentResult = await agent.predictChampionship(state.state.query);
          break;
        case 'historical':
          agentResult = await agent.compareHistorical(state.state.query);
          break;
        default:
          throw new F1Error(`Unknown agent type: ${agentType}`, 'UNKNOWN_AGENT_TYPE');
      }

      // Update state with agent response
      return state.updateState({
        agentResponse: agentResult,
        f1Data: agentResult.f1Data || null,
        metadata: {
          ...state.state.metadata,
          agentProcessingTime: agentResult.processingTime || 0,
          agentApiCalls: agentResult.apiCalls || 0
        }
      }).addNodeToSequence(agentType);

    } catch (error) {
      this.logger.error('F1LangGraphApp: Specialized agent processing failed', {
        agentType,
        error: error.message
      });

      // Set error state but don't throw - let error handler manage fallbacks
      return state.setError(error).addNodeToSequence(`${agentType}_error`);
    }
  }

  /**
   * Persist conversation to memory
   */
  async persistConversation(state) {
    try {
      const { query, threadId, selectedAgent, agentResponse, confidence } = state.state;

      // Save user message
      await this.memory.saveMessage(threadId, 'user', query, {
        userContext: state.state.userContext,
        queryType: state.state.metadata.initialQueryType
      });

      // Save assistant response
      if (agentResponse) {
        await this.memory.saveMessage(threadId, 'assistant', 
          agentResponse.finalResponse || agentResponse.analysis || 'Analysis completed',
          {
            agentType: selectedAgent,
            confidence,
            f1Data: state.state.f1Data,
            queryType: state.state.metadata.initialQueryType,
            processingTime: state.state.metadata.processingTime,
            apiCalls: state.state.metadata.apiCalls,
            nodeSequence: state.state.metadata.nodeSequence
          }
        );
      }

      this.logger.debug('F1LangGraphApp: Conversation persisted to memory', {
        threadId,
        agentType: selectedAgent
      });

    } catch (error) {
      this.logger.warn('F1LangGraphApp: Failed to persist conversation', {
        threadId: state.state.threadId,
        error: error.message
      });
      // Don't throw - memory persistence failure shouldn't break the response
    }
  }

  /**
   * Assemble final response
   */
  assembleResponse(state, startTime) {
    const {
      query,
      threadId,
      selectedAgent,
      agentResponse,
      confidence,
      f1Data,
      metadata,
      error
    } = state.state;

    const response = {
      success: !error,
      query,
      threadId,
      agent: selectedAgent,
      confidence,
      response: agentResponse?.finalResponse || agentResponse?.analysis || 'Analysis completed',
      metadata: {
        ...metadata,
        totalProcessingTime: Date.now() - startTime,
        nodeSequence: metadata.nodeSequence,
        completedAt: new Date().toISOString()
      }
    };

    // Include additional data if available
    if (agentResponse?.insights) {
      response.insights = agentResponse.insights;
    }

    if (agentResponse?.analysisType) {
      response.analysisType = agentResponse.analysisType;
    }

    if (f1Data) {
      response.f1Data = f1Data;
    }

    if (error) {
      response.error = {
        message: error.message,
        code: error.code || 'PROCESSING_ERROR',
        timestamp: error.timestamp
      };
    }

    return response;
  }

  /**
   * Create fallback response when main processing fails
   */
  createFallbackResponse(query, threadId, error) {
    this.logger.warn('F1LangGraphApp: Creating fallback response', {
      query: query.substring(0, 100),
      threadId,
      error: error.message
    });

    return {
      success: false,
      query,
      threadId,
      agent: 'fallback',
      confidence: 0.1,
      response: 'I apologize, but I encountered difficulties processing your F1 query. Please try rephrasing your question or asking about a specific aspect of Formula 1.',
      isFallback: true,
      error: {
        message: error.message,
        code: error.code || 'FALLBACK_RESPONSE',
        timestamp: new Date().toISOString()
      },
      metadata: {
        nodeSequence: ['start', 'error', 'fallback'],
        completedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Initialize LLM
   */
  initializeLLM() {
    return new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-4o',
      temperature: 0.1,
      timeout: this.options.defaultTimeout
    });
  }

  /**
   * Initialize all specialized agents
   */
  async initializeAgents() {
    const agents = {};

    try {
      // Initialize each agent with the shared LangGraph adapter
      agents.season = new SeasonAnalysisAgent(this.langGraphAdapter);
      agents.driver = new DriverPerformanceAgent(this.langGraphAdapter);
      agents.race = new RaceStrategyAgent(this.langGraphAdapter);
      agents.championship = new ChampionshipPredictorAgent(this.langGraphAdapter);
      agents.historical = new HistoricalComparisonAgent(this.langGraphAdapter);

      // Initialize agents that require it
      for (const [name, agent] of Object.entries(agents)) {
        if (typeof agent.initialize === 'function') {
          await agent.initialize();
          this.logger.debug(`F1LangGraphApp: Initialized ${name} agent`);
        }
      }

      this.logger.info('F1LangGraphApp: All agents initialized successfully', {
        agentTypes: Object.keys(agents)
      });

      return agents;

    } catch (error) {
      this.logger.error('F1LangGraphApp: Failed to initialize agents', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(threadId, options = {}) {
    if (!this.memory) {
      throw new F1Error('Memory not enabled', 'MEMORY_DISABLED');
    }

    return this.memory.getConversationHistory(threadId, options);
  }

  /**
   * Get conversation summary
   */
  async getConversationSummary(threadId) {
    if (!this.memory) {
      throw new F1Error('Memory not enabled', 'MEMORY_DISABLED');
    }

    return this.memory.getConversationSummary(threadId);
  }

  /**
   * Get application health status
   */
  async getHealth() {
    const health = {
      status: 'healthy',
      initialized: this.isInitialized,
      timestamp: new Date().toISOString(),
      components: {}
    };

    try {
      // Check adapter health
      health.components.adapter = {
        status: this.langGraphAdapter?.isInitialized ? 'healthy' : 'unhealthy',
        initialized: this.langGraphAdapter?.isInitialized || false
      };

      // Check memory health
      if (this.memory) {
        health.components.memory = await this.memory.getHealth();
      } else {
        health.components.memory = { status: 'disabled' };
      }

      // Check agents health
      health.components.agents = {};
      for (const [name, agent] of Object.entries(this.agents)) {
        health.components.agents[name] = {
          status: agent ? 'healthy' : 'unhealthy',
          initialized: !!agent
        };
      }

      // Check router health
      health.components.router = {
        status: this.router ? 'healthy' : 'unhealthy',
        stats: this.router?.getRoutingStats() || null
      };

      // Check error handler health
      health.components.errorHandler = globalErrorHandler.getStats();

      // Overall status
      const unhealthyComponents = Object.values(health.components)
        .filter(component => component.status === 'unhealthy').length;

      if (unhealthyComponents > 0) {
        health.status = 'degraded';
      }

    } catch (error) {
      health.status = 'unhealthy';
      health.error = error.message;
    }

    return health;
  }

  /**
   * Get available agents information
   */
  getAvailableAgents() {
    return {
      season: {
        name: 'Season Analysis Agent',
        description: 'Analyzes F1 season data, championship standings, and constructor performance',
        capabilities: ['Season statistics', 'Team performance', 'Championship standings']
      },
      driver: {
        name: 'Driver Performance Agent',
        description: 'Examines individual driver performance, career statistics, and comparisons',
        capabilities: ['Driver statistics', 'Career analysis', 'Performance comparisons']
      },
      race: {
        name: 'Race Strategy Agent',
        description: 'Provides insights on race strategy, circuit analysis, and race-specific information',
        capabilities: ['Race strategy', 'Circuit analysis', 'Lap time analysis']
      },
      championship: {
        name: 'Championship Predictor Agent',
        description: 'Makes predictions about championship outcomes with probability calculations',
        capabilities: ['Title predictions', 'Points projections', 'Scenario modeling']
      },
      historical: {
        name: 'Historical Comparison Agent',
        description: 'Offers cross-era comparisons and historical data analysis',
        capabilities: ['Era comparisons', 'Historical statistics', 'Legacy assessment']
      }
    };
  }

  /**
   * Get system analytics
   */
  async getAnalytics(options = {}) {
    if (!this.memory) {
      return { error: 'Analytics require memory to be enabled' };
    }

    return this.memory.getAnalytics(options);
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.memory) {
      await this.memory.close();
    }

    this.logger.info('F1LangGraphApp: Cleanup completed');
  }
}

export default F1LangGraphApp;