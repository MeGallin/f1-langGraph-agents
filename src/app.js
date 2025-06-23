/**
 * Modern F1 LangGraph Application Orchestrator
 * Uses LangGraph.js v0.2 patterns with streaming, checkpointing, and modern architecture
 */

import { StateGraph, START, END } from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph';
import ModernF1LangGraphAdapter from './adapters/langGraphAdapter.js';
import ModernF1StateManager from './state/graphState.js';
import ModernSeasonAnalysisAgent from './agents/seasonAnalysisAgent.js';
import { globalErrorHandler, F1Error } from './utils/errorHandler.js';
import logger from './utils/logger.js';
import rateLimit from 'express-rate-limit';

export class ModernF1LangGraphApp {
  constructor(options = {}) {
    this.options = {
      enableMemory: options.enableMemory !== false,
      enableStreaming: options.enableStreaming !== false,
      enableCheckpointing: options.enableCheckpointing !== false,
      enableHumanInLoop: options.enableHumanInLoop || false,
      defaultTimeout: options.defaultTimeout || 150000,
      maxRetries: options.maxRetries || 3,
      llmProvider: options.llmProvider || 'openai',
      rateLimitEnabled: options.rateLimitEnabled !== false,
      ...options
    };

    // Initialize core components
    this.f1Adapter = new ModernF1LangGraphAdapter(this.options);
    this.stateManager = new ModernF1StateManager(this.options);
    
    // Initialize agents
    this.agents = {};
    this.availableAgentTypes = [
      'seasonAnalysis',
      'driverPerformance', 
      'raceStrategy',
      'championshipPredictor',
      'historicalComparison'
    ];
    
    // State graph for workflow orchestration
    this.workflowGraph = null;
    this.memorySaver = new MemorySaver();
    
    // Application state
    this.isInitialized = false;
    this.healthStatus = 'initializing';
    
    // Rate limiting
    this.rateLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false
    });

    logger.info('ModernF1LangGraphApp initialized', {
      enableMemory: this.options.enableMemory,
      enableStreaming: this.options.enableStreaming,
      enableCheckpointing: this.options.enableCheckpointing
    });
  }

  /**
   * Initialize the complete F1 application
   */
  async initialize() {
    try {
      logger.info('Starting ModernF1LangGraphApp initialization...');
      
      this.healthStatus = 'initializing';

      // Initialize F1 adapter
      logger.info('Initializing F1 adapter...');
      await this.f1Adapter.initialize();

      // Initialize agents
      logger.info('Initializing agents...');
      await this.initializeAgents();

      // Initialize workflow graph
      logger.info('Initializing workflow graph...');
      await this.initializeWorkflowGraph();

      // Set up error handling
      this.setupErrorHandling();

      this.isInitialized = true;
      this.healthStatus = 'healthy';

      logger.info('ModernF1LangGraphApp initialization completed successfully', {
        agentCount: Object.keys(this.agents).length,
        healthStatus: this.healthStatus
      });

      return true;
    } catch (error) {
      this.healthStatus = 'unhealthy';
      logger.error('ModernF1LangGraphApp initialization failed', {
        error: error.message,
        stack: error.stack
      });
      throw new F1Error(
        `Application initialization failed: ${error.message}`,
        'APP_INIT_FAILED',
        { originalError: error }
      );
    }
  }

  /**
   * Initialize all agents
   */
  async initializeAgents() {
    try {
      // Initialize Season Analysis Agent
      this.agents.seasonAnalysis = new ModernSeasonAnalysisAgent(this.options);
      await this.agents.seasonAnalysis.initialize(this.f1Adapter);

      // TODO: Initialize other agents as they are created
      // this.agents.driverPerformance = new ModernDriverPerformanceAgent(this.options);
      // await this.agents.driverPerformance.initialize(this.f1Adapter);

      logger.info('All agents initialized successfully', {
        agentCount: Object.keys(this.agents).length,
        agentTypes: Object.keys(this.agents)
      });
    } catch (error) {
      logger.error('Failed to initialize agents', { error: error.message });
      throw error;
    }
  }

  /**
   * Initialize the workflow graph for orchestration
   */
  async initializeWorkflowGraph() {
    try {
      // Create the workflow graph
      const workflow = new StateGraph({
        channels: {
          query: String,
          threadId: String,
          userContext: Object,
          currentStep: String,
          agentType: String,
          result: Object,
          errors: Array
        }
      });

      // Add nodes
      workflow.addNode("query_analyzer", this.analyzeQuery.bind(this));
      workflow.addNode("agent_router", this.routeToAgent.bind(this));
      workflow.addNode("season_analysis", this.runSeasonAnalysis.bind(this));
      workflow.addNode("result_formatter", this.formatResult.bind(this));
      workflow.addNode("error_handler", this.handleError.bind(this));

      // Add edges
      workflow.addEdge(START, "query_analyzer");
      workflow.addEdge("query_analyzer", "agent_router");
      
      // Conditional routing based on agent type
      workflow.addConditionalEdges(
        "agent_router",
        this.routingCondition.bind(this),
        {
          "season_analysis": "season_analysis",
          "error": "error_handler"
        }
      );

      workflow.addEdge("season_analysis", "result_formatter");
      workflow.addEdge("result_formatter", END);
      workflow.addEdge("error_handler", END);

      // Compile the graph
      this.workflowGraph = workflow.compile({
        checkpointer: this.options.enableCheckpointing ? this.memorySaver : undefined
      });

      logger.info('Workflow graph initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize workflow graph', { error: error.message });
      throw error;
    }
  }

  /**
   * Process F1 query through the modern workflow
   */
  async processQuery(query, threadId, userContext = {}) {
    if (!this.isInitialized) {
      throw new F1Error(
        'Application not initialized. Call initialize() first.',
        'APP_NOT_INITIALIZED'
      );
    }

    const startTime = Date.now();
    threadId = threadId || `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      logger.info('Processing query through modern workflow', {
        threadId,
        queryPreview: query.substring(0, 100) + '...'
      });

      // Create initial state
      const initialState = this.stateManager.createInitialState(query, threadId, userContext);

      // Process through workflow graph
      const config = { 
        configurable: { thread_id: threadId },
        streamMode: this.options.enableStreaming ? "values" : undefined
      };

      const input = {
        query,
        threadId,
        userContext,
        currentStep: 'query_analysis',
        errors: []
      };

      let result;
      
      if (this.options.enableStreaming) {
        result = await this.processWithStreaming(input, config, threadId);
      } else {
        result = await this.workflowGraph.invoke(input, config);
      }

      // Update final state
      await this.stateManager.completeAnalysis(threadId, result);

      const duration = Date.now() - startTime;

      logger.info('Query processing completed successfully', {
        threadId,
        duration,
        streaming: this.options.enableStreaming
      });

      return {
        success: true,
        threadId,
        result: result.result || result,
        duration,
        streaming: this.options.enableStreaming,
        metadata: {
          workflowUsed: true,
          agentType: result.agentType,
          stepsCompleted: result.currentStep
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Update state with error
      await this.stateManager.addError(threadId, error.message);
      
      logger.error('Query processing failed', {
        threadId,
        error: error.message,
        duration
      });

      return {
        success: false,
        threadId,
        error: error.message,
        duration,
        metadata: {
          workflowUsed: true,
          failed: true
        }
      };
    }
  }

  /**
   * Process with streaming support
   */
  async processWithStreaming(input, config, threadId) {
    const chunks = [];
    const streamingResult = {
      streaming: true,
      chunks: [],
      threadId
    };

    try {
      for await (const chunk of await this.workflowGraph.stream(input, config)) {
        chunks.push(chunk);
        streamingResult.chunks.push({
          timestamp: Date.now(),
          data: chunk
        });
      }

      // Get final state
      const finalState = await this.workflowGraph.getState(config);
      streamingResult.result = finalState.values;
      
      return streamingResult;
    } catch (error) {
      streamingResult.error = error.message;
      throw error;
    }
  }

  /**
   * Workflow node: Analyze query to determine processing approach
   */
  async analyzeQuery(state) {
    try {
      logger.debug('Analyzing query', { threadId: state.threadId });
      
      const query = state.query.toLowerCase();
      let agentType = 'general';
      
      // Simple query analysis logic
      if (query.includes('season') || query.includes('championship') || query.includes('year')) {
        agentType = 'season_analysis';
      } else if (query.includes('driver') || query.includes('performance')) {
        agentType = 'driver_performance';
      } else if (query.includes('race') || query.includes('strategy')) {
        agentType = 'race_strategy';
      }

      return {
        ...state,
        currentStep: 'agent_routing',
        agentType,
        metadata: {
          ...state.metadata,
          queryAnalysisCompleted: true
        }
      };
    } catch (error) {
      logger.error('Query analysis failed', { error: error.message });
      return {
        ...state,
        currentStep: 'error',
        errors: [...state.errors, `Query analysis failed: ${error.message}`]
      };
    }
  }

  /**
   * Workflow node: Route to appropriate agent
   */
  async routeToAgent(state) {
    try {
      logger.debug('Routing to agent', { 
        threadId: state.threadId, 
        agentType: state.agentType 
      });

      return {
        ...state,
        currentStep: state.agentType,
        metadata: {
          ...state.metadata,
          routingCompleted: true
        }
      };
    } catch (error) {
      logger.error('Agent routing failed', { error: error.message });
      return {
        ...state,
        currentStep: 'error',
        errors: [...state.errors, `Agent routing failed: ${error.message}`]
      };
    }
  }

  /**
   * Workflow node: Run season analysis
   */
  async runSeasonAnalysis(state) {
    try {
      logger.debug('Running season analysis', { threadId: state.threadId });
      
      const agent = this.agents.seasonAnalysis;
      if (!agent) {
        throw new Error('Season analysis agent not available');
      }

      const result = await agent.analyzeSeason(
        state.query, 
        state.threadId, 
        state.userContext
      );

      return {
        ...state,
        currentStep: 'result_formatting',
        result,
        metadata: {
          ...state.metadata,
          agentExecuted: 'seasonAnalysis'
        }
      };
    } catch (error) {
      logger.error('Season analysis failed', { error: error.message });
      return {
        ...state,
        currentStep: 'error',
        errors: [...state.errors, `Season analysis failed: ${error.message}`]
      };
    }
  }

  /**
   * Workflow node: Format final result
   */
  async formatResult(state) {
    try {
      logger.debug('Formatting result', { threadId: state.threadId });
      
      const formattedResult = {
        ...state.result,
        workflow: {
          completed: true,
          stepsExecuted: [
            'query_analysis',
            'agent_routing', 
            state.agentType,
            'result_formatting'
          ],
          metadata: state.metadata
        }
      };

      return {
        ...state,
        currentStep: 'completed',
        result: formattedResult
      };
    } catch (error) {
      logger.error('Result formatting failed', { error: error.message });
      return {
        ...state,
        currentStep: 'error',
        errors: [...state.errors, `Result formatting failed: ${error.message}`]
      };
    }
  }

  /**
   * Workflow node: Handle errors
   */
  async handleError(state) {
    logger.error('Workflow error handler activated', {
      threadId: state.threadId,
      errors: state.errors
    });

    return {
      ...state,
      currentStep: 'error_handled',
      result: {
        success: false,
        errors: state.errors,
        message: 'An error occurred during processing'
      }
    };
  }

  /**
   * Routing condition for workflow
   */
  routingCondition(state) {
    if (state.errors && state.errors.length > 0) {
      return 'error';
    }
    
    switch (state.agentType) {
      case 'season_analysis':
        return 'season_analysis';
      default:
        return 'error';
    }
  }

  /**
   * Setup global error handling
   */
  setupErrorHandling() {
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });
  }

  /**
   * Get application health status
   */
  async getHealth() {
    try {
      const adapterHealth = await this.f1Adapter.healthCheck();
      const agentHealthChecks = await Promise.allSettled(
        Object.entries(this.agents).map(async ([type, agent]) => {
          const health = await agent.getHealth();
          return { type, health };
        })
      );

      const agentHealth = agentHealthChecks.map(result => 
        result.status === 'fulfilled' ? result.value : { error: result.reason.message }
      );

      return {
        status: this.healthStatus,
        initialized: this.isInitialized,
        f1Adapter: adapterHealth,
        agents: agentHealth,
        stateManager: {
          activeThreads: this.stateManager.getActiveThreads().length,
          statistics: this.stateManager.getStatistics()
        },
        options: this.options
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        initialized: this.isInitialized
      };
    }
  }

  /**
   * Get available agents
   */
  getAvailableAgents() {
    return Object.entries(this.agents).reduce((acc, [type, agent]) => {
      acc[type] = agent.getInfo();
      return acc;
    }, {});
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(threadId, options = {}) {
    if (!this.options.enableMemory) {
      throw new F1Error('Memory not enabled', 'MEMORY_DISABLED');
    }

    try {
      const state = this.stateManager.getState(threadId);
      
      // Get conversation history from workflow graph
      const config = { configurable: { thread_id: threadId } };
      const graphState = await this.workflowGraph.getState(config);

      return {
        threadId,
        state: state,
        workflow: graphState,
        options
      };
    } catch (error) {
      logger.error('Failed to get conversation history', {
        threadId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get analytics
   */
  async getAnalytics(options = {}) {
    const stateStats = this.stateManager.getStatistics();
    
    return {
      application: {
        initialized: this.isInitialized,
        healthStatus: this.healthStatus,
        agentCount: Object.keys(this.agents).length
      },
      state: stateStats,
      options
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      logger.info('Starting application cleanup...');
      
      // Cleanup agents
      await Promise.all(
        Object.values(this.agents).map(agent => agent.cleanup())
      );
      
      // Cleanup adapter
      await this.f1Adapter.cleanup();
      
      // Cleanup state manager
      this.stateManager.cleanup();
      
      this.isInitialized = false;
      this.healthStatus = 'shutdown';
      
      logger.info('Application cleanup completed successfully');
    } catch (error) {
      logger.error('Error during application cleanup', { error: error.message });
    }
  }

  /**
   * Get rate limiter middleware
   */
  getRateLimiter() {
    return this.options.rateLimitEnabled ? this.rateLimiter : (req, res, next) => next();
  }
}

export default ModernF1LangGraphApp;