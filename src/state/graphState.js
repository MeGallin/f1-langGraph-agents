/**
 * Modern LangGraph State Management
 * Uses LangGraph.js v0.2 state patterns with proper type safety and checkpointing
 */

import { z } from 'zod';
import { StateGraph, START, END } from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

// Define the state schema for F1 analysis workflow
export const F1StateSchema = z.object({
  // Query information
  query: z.string().describe('The original user query about F1'),
  threadId: z.string().describe('Unique thread identifier for conversation'),
  userContext: z.object({}).passthrough().describe('Additional user context'),
  
  // Analysis flow control
  currentStep: z.string().describe('Current step in the analysis workflow'),
  agentType: z.string().optional().describe('Selected agent type for analysis'),
  
  // Data collection
  f1Data: z.object({}).passthrough().optional().describe('Collected F1 data'),
  analysisResults: z.array(z.object({}).passthrough()).default([]).describe('Analysis results from agents'),
  
  // Streaming and checkpointing
  streamingEnabled: z.boolean().default(true).describe('Whether streaming is enabled'),
  checkpointId: z.string().optional().describe('Checkpoint ID for state recovery'),
  
  // Error handling
  errors: z.array(z.string()).default([]).describe('Collection of errors during processing'),
  retryCount: z.number().default(0).describe('Number of retry attempts'),
  
  // Final output
  finalResponse: z.string().optional().describe('Final formatted response'),
  metadata: z.object({
    startTime: z.number(),
    endTime: z.number().optional(),
    totalDuration: z.number().optional(),
    agentsUsed: z.array(z.string()).default([]),
    toolsUsed: z.array(z.string()).default([]),
    dataSourcesAccessed: z.array(z.string()).default([])
  }).describe('Metadata about the analysis process')
});

// Type definition for F1State (TypeScript equivalent: z.infer<typeof F1StateSchema>)

/**
 * Modern F1 State Manager with LangGraph.js v0.2 patterns
 */
export class ModernF1StateManager {
  constructor(options = {}) {
    this.options = {
      enableCheckpointing: options.enableCheckpointing !== false,
      enableStreaming: options.enableStreaming !== false,
      checkpointInterval: options.checkpointInterval || 5000, // 5 seconds
      maxRetries: options.maxRetries || 3,
      ...options
    };

    // Initialize memory saver for checkpointing
    this.memorySaver = new MemorySaver();
    
    // State graph for workflow management
    this.stateGraph = null;
    this.activeThreads = new Map();
    
    logger.info('ModernF1StateManager initialized', {
      enableCheckpointing: this.options.enableCheckpointing,
      enableStreaming: this.options.enableStreaming
    });
  }

  /**
   * Create initial state for a new F1 analysis
   */
  createInitialState(query, threadId, userContext = {}) {
    const initialState = {
      query,
      threadId: threadId || uuidv4(),
      userContext,
      currentStep: 'query_analysis',
      f1Data: {},
      analysisResults: [],
      streamingEnabled: this.options.enableStreaming,
      errors: [],
      retryCount: 0,
      metadata: {
        startTime: Date.now(),
        agentsUsed: [],
        toolsUsed: [],
        dataSourcesAccessed: []
      }
    };

    // Validate state
    const validatedState = F1StateSchema.parse(initialState);
    
    // Store in active threads
    this.activeThreads.set(validatedState.threadId, validatedState);
    
    logger.info('Initial state created', {
      threadId: validatedState.threadId,
      query: query.substring(0, 100) + '...'
    });

    return validatedState;
  }

  /**
   * Update state with new data
   */
  async updateState(threadId, updates) {
    try {
      const currentState = this.activeThreads.get(threadId);
      
      if (!currentState) {
        throw new Error(`Thread ${threadId} not found`);
      }

      // Merge updates with current state
      const updatedState = {
        ...currentState,
        ...updates,
        metadata: {
          ...currentState.metadata,
          ...updates.metadata
        }
      };

      // Validate updated state
      const validatedState = F1StateSchema.parse(updatedState);
      
      // Update active threads
      this.activeThreads.set(threadId, validatedState);

      // Create checkpoint if enabled
      if (this.options.enableCheckpointing) {
        await this.createCheckpoint(threadId, validatedState);
      }

      logger.debug('State updated', {
        threadId,
        currentStep: validatedState.currentStep,
        agentsUsed: validatedState.metadata.agentsUsed.length
      });

      return validatedState;
    } catch (error) {
      logger.error('Failed to update state', {
        threadId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get current state for a thread
   */
  getState(threadId) {
    const state = this.activeThreads.get(threadId);
    
    if (!state) {
      throw new Error(`Thread ${threadId} not found`);
    }

    return state;
  }

  /**
   * Add analysis result to state
   */
  async addAnalysisResult(threadId, agentType, result) {
    const currentState = this.getState(threadId);
    
    const analysisResult = {
      agentType,
      result,
      timestamp: Date.now(),
      id: uuidv4()
    };

    return this.updateState(threadId, {
      analysisResults: [...currentState.analysisResults, analysisResult],
      metadata: {
        ...currentState.metadata,
        agentsUsed: [...new Set([...currentState.metadata.agentsUsed, agentType])]
      }
    });
  }

  /**
   * Add F1 data to state
   */
  async addF1Data(threadId, dataKey, data, dataSource) {
    const currentState = this.getState(threadId);
    
    return this.updateState(threadId, {
      f1Data: {
        ...currentState.f1Data,
        [dataKey]: data
      },
      metadata: {
        ...currentState.metadata,
        dataSourcesAccessed: [...new Set([...currentState.metadata.dataSourcesAccessed, dataSource])]
      }
    });
  }

  /**
   * Add error to state
   */
  async addError(threadId, error) {
    const currentState = this.getState(threadId);
    
    return this.updateState(threadId, {
      errors: [...currentState.errors, error],
      retryCount: currentState.retryCount + 1
    });
  }

  /**
   * Mark analysis as complete
   */
  async completeAnalysis(threadId, finalResponse) {
    const currentState = this.getState(threadId);
    const endTime = Date.now();
    
    return this.updateState(threadId, {
      currentStep: 'completed',
      finalResponse,
      metadata: {
        ...currentState.metadata,
        endTime,
        totalDuration: endTime - currentState.metadata.startTime
      }
    });
  }

  /**
   * Create checkpoint for state recovery
   */
  async createCheckpoint(threadId, state) {
    try {
      const checkpointId = `checkpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await this.memorySaver.put({
        configurable: { thread_id: threadId },
        checkpoint: {
          id: checkpointId,
          ts: Date.now(),
          channel_values: state,
          channel_versions: {},
          versions_seen: {}
        }
      });

      logger.debug('Checkpoint created', {
        threadId,
        checkpointId,
        currentStep: state.currentStep
      });

      return checkpointId;
    } catch (error) {
      logger.error('Failed to create checkpoint', {
        threadId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Restore state from checkpoint
   */
  async restoreFromCheckpoint(threadId, checkpointId) {
    try {
      const checkpoint = await this.memorySaver.get({
        configurable: { thread_id: threadId }
      });

      if (!checkpoint) {
        throw new Error(`Checkpoint not found for thread ${threadId}`);
      }

      const restoredState = F1StateSchema.parse(checkpoint.channel_values);
      this.activeThreads.set(threadId, restoredState);

      logger.info('State restored from checkpoint', {
        threadId,
        checkpointId,
        currentStep: restoredState.currentStep
      });

      return restoredState;
    } catch (error) {
      logger.error('Failed to restore from checkpoint', {
        threadId,
        checkpointId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * List all active threads
   */
  getActiveThreads() {
    return Array.from(this.activeThreads.entries()).map(([threadId, state]) => ({
      threadId,
      currentStep: state.currentStep,
      startTime: state.metadata.startTime,
      agentsUsed: state.metadata.agentsUsed,
      hasErrors: state.errors.length > 0
    }));
  }

  /**
   * Clean up completed or old threads
   */
  cleanup(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
    const now = Date.now();
    const threadsToRemove = [];

    for (const [threadId, state] of this.activeThreads.entries()) {
      const age = now - state.metadata.startTime;
      
      if (age > maxAge || state.currentStep === 'completed') {
        threadsToRemove.push(threadId);
      }
    }

    for (const threadId of threadsToRemove) {
      this.activeThreads.delete(threadId);
    }

    logger.info('State cleanup completed', {
      removedThreads: threadsToRemove.length,
      activeThreads: this.activeThreads.size
    });

    return threadsToRemove.length;
  }

  /**
   * Get state statistics
   */
  getStatistics() {
    const states = Array.from(this.activeThreads.values());
    
    return {
      totalThreads: states.length,
      completedThreads: states.filter(s => s.currentStep === 'completed').length,
      errorThreads: states.filter(s => s.errors.length > 0).length,
      averageDuration: states
        .filter(s => s.metadata.totalDuration)
        .reduce((sum, s) => sum + s.metadata.totalDuration, 0) / states.length || 0,
      mostUsedAgents: this.getMostUsedAgents(states),
      mostUsedTools: this.getMostUsedTools(states)
    };
  }

  /**
   * Get most used agents
   */
  getMostUsedAgents(states) {
    const agentCount = {};
    
    for (const state of states) {
      for (const agent of state.metadata.agentsUsed) {
        agentCount[agent] = (agentCount[agent] || 0) + 1;
      }
    }

    return Object.entries(agentCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([agent, count]) => ({ agent, count }));
  }

  /**
   * Get most used tools
   */
  getMostUsedTools(states) {
    const toolCount = {};
    
    for (const state of states) {
      for (const tool of state.metadata.toolsUsed) {
        toolCount[tool] = (toolCount[tool] || 0) + 1;
      }
    }

    return Object.entries(toolCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([tool, count]) => ({ tool, count }));
  }
}

export default ModernF1StateManager;