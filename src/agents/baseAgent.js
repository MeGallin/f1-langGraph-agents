/**
 * Modern Base Agent using LangGraph.js v0.2 patterns
 * Foundation for all F1 specialized agents with streaming, checkpointing, and proper state management
 */

import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { MemorySaver } from '@langchain/langgraph';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import logger from '../utils/logger.js';
import { F1Error } from '../utils/errorHandler.js';

export class ModernBaseAgent {
  constructor(agentType, options = {}) {
    this.agentType = agentType;
    this.options = {
      enableStreaming: options.enableStreaming !== false,
      enableCheckpointing: options.enableCheckpointing !== false,
      enableHumanInLoop: options.enableHumanInLoop || false,
      maxRetries: options.maxRetries || 3,
      timeout: options.timeout || 150000,
      llmProvider: options.llmProvider || 'openai',
      modelName: options.modelName || 'gpt-4o',
      temperature: options.temperature || 0.1,
      ...options
    };

    // Initialize LLM
    this.llm = this.initializeLLM();
    
    // Initialize memory saver for checkpointing
    this.memorySaver = new MemorySaver();
    
    // Agent instance will be created during initialization
    this.agent = null;
    this.tools = [];
    this.systemPrompt = '';
    
    // State management
    this.activeThreads = new Map();
    
    logger.info(`ModernBaseAgent (${agentType}) initialized`, {
      llmProvider: this.options.llmProvider,
      modelName: this.options.modelName,
      enableStreaming: this.options.enableStreaming
    });
  }

  /**
   * Initialize the appropriate LLM based on configuration
   */
  initializeLLM() {
    if (this.options.llmProvider === 'anthropic') {
      return new ChatAnthropic({
        modelName: this.options.modelName === 'gpt-4o' ? 'claude-3-sonnet-20240229' : this.options.modelName,
        temperature: this.options.temperature,
        streaming: this.options.enableStreaming
      });
    } else {
      return new ChatOpenAI({
        modelName: this.options.modelName,
        temperature: this.options.temperature,
        streaming: this.options.enableStreaming
      });
    }
  }

  /**
   * Initialize the agent with tools and configuration
   */
  async initialize(tools = [], systemPrompt = '') {
    try {
      this.tools = tools;
      this.systemPrompt = systemPrompt;

      // Create React agent using LangGraph.js v0.2 pattern
      this.agent = createReactAgent({
        llm: this.llm,
        tools: this.tools,
        checkpointSaver: this.options.enableCheckpointing ? this.memorySaver : undefined,
        messageModifier: this.systemPrompt ? new SystemMessage(this.systemPrompt) : undefined
      });

      logger.info(`Agent ${this.agentType} initialized successfully`, {
        toolCount: this.tools.length,
        hasSystemPrompt: !!this.systemPrompt,
        checkpointingEnabled: this.options.enableCheckpointing
      });

      return true;
    } catch (error) {
      logger.error(`Failed to initialize agent ${this.agentType}`, {
        error: error.message
      });
      throw new F1Error(
        `Agent initialization failed: ${error.message}`,
        'AGENT_INIT_FAILED',
        { agentType: this.agentType }
      );
    }
  }

  /**
   * Process a query with modern streaming and checkpointing support
   */
  async processQuery(query, threadId, userContext = {}) {
    if (!this.agent) {
      throw new F1Error(
        'Agent not initialized. Call initialize() first.',
        'AGENT_NOT_INITIALIZED',
        { agentType: this.agentType }
      );
    }

    const startTime = Date.now();
    
    try {
      logger.info(`Processing query with ${this.agentType}`, {
        threadId,
        queryPreview: query.substring(0, 100) + '...'
      });

      // Prepare configuration for LangGraph
      const config = {
        configurable: { thread_id: threadId },
        streamMode: this.options.enableStreaming ? "values" : undefined,
        callbacks: this.createCallbacks(threadId)
      };

      // Add user context to the query if provided
      const contextualQuery = this.addUserContext(query, userContext);

      // Create input message
      const input = {
        messages: [new HumanMessage(contextualQuery)]
      };

      // Process with streaming support
      if (this.options.enableStreaming) {
        return await this.processWithStreaming(input, config, threadId);
      } else {
        return await this.processWithoutStreaming(input, config, threadId);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error(`Query processing failed for ${this.agentType}`, {
        threadId,
        error: error.message,
        duration
      });

      throw new F1Error(
        `Agent processing failed: ${error.message}`,
        'AGENT_PROCESSING_FAILED',
        { agentType: this.agentType, threadId, duration }
      );
    }
  }

  /**
   * Process query with streaming support
   */
  async processWithStreaming(input, config, threadId) {
    const chunks = [];
    const streamingResult = {
      success: true,
      agentType: this.agentType,
      threadId,
      streaming: true,
      chunks: []
    };

    try {
      // Stream the response
      for await (const chunk of await this.agent.stream(input, config)) {
        chunks.push(chunk);
        streamingResult.chunks.push({
          timestamp: Date.now(),
          data: chunk
        });

        // Emit streaming event if callback is available
        if (config.callbacks?.handleLLMNewToken) {
          await config.callbacks.handleLLMNewToken(chunk);
        }
      }

      // Get final state
      const finalState = await this.agent.getState(config);
      const finalMessages = finalState.values.messages || [];
      const lastMessage = finalMessages[finalMessages.length - 1];

      streamingResult.result = lastMessage?.content || 'No response generated';
      streamingResult.fullState = finalState;
      streamingResult.duration = Date.now() - (streamingResult.startTime || Date.now());

      return streamingResult;

    } catch (error) {
      streamingResult.success = false;
      streamingResult.error = error.message;
      throw error;
    }
  }

  /**
   * Process query without streaming
   */
  async processWithoutStreaming(input, config, threadId) {
    const result = await this.agent.invoke(input, config);
    
    const messages = result.messages || [];
    const lastMessage = messages[messages.length - 1];

    return {
      success: true,
      agentType: this.agentType,
      threadId,
      streaming: false,
      result: lastMessage?.content || 'No response generated',
      fullState: result,
      messages: messages
    };
  }

  /**
   * Add user context to query
   */
  addUserContext(query, userContext) {
    if (!userContext || Object.keys(userContext).length === 0) {
      return query;
    }

    const contextString = Object.entries(userContext)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    return `${query}\n\nUser Context: ${contextString}`;
  }

  /**
   * Create callbacks for streaming and monitoring
   */
  createCallbacks(threadId) {
    return {
      handleLLMStart: async (llm, prompts) => {
        logger.debug(`LLM started for ${this.agentType}`, {
          threadId,
          promptCount: prompts.length
        });
      },

      handleLLMEnd: async (output) => {
        logger.debug(`LLM completed for ${this.agentType}`, {
          threadId,
          outputLength: output.generations?.[0]?.[0]?.text?.length || 0
        });
      },

      handleLLMError: async (error) => {
        logger.error(`LLM error for ${this.agentType}`, {
          threadId,
          error: error.message
        });
      },

      handleToolStart: async (tool, input) => {
        logger.debug(`Tool started: ${tool.name}`, {
          threadId,
          agentType: this.agentType,
          input: JSON.stringify(input).substring(0, 200)
        });
      },

      handleToolEnd: async (output) => {
        logger.debug(`Tool completed`, {
          threadId,
          agentType: this.agentType,
          outputLength: JSON.stringify(output).length
        });
      },

      handleToolError: async (error) => {
        logger.error(`Tool error`, {
          threadId,
          agentType: this.agentType,
          error: error.message
        });
      }
    };
  }

  /**
   * Get conversation history for a thread
   */
  async getConversationHistory(threadId, limit = 10) {
    try {
      const config = { configurable: { thread_id: threadId } };
      const state = await this.agent.getState(config);
      
      const messages = state.values.messages || [];
      
      return {
        threadId,
        messages: messages.slice(-limit).map(msg => ({
          type: msg.constructor.name,
          content: msg.content,
          timestamp: msg.timestamp || Date.now()
        })),
        totalMessages: messages.length
      };
    } catch (error) {
      logger.error(`Failed to get conversation history`, {
        threadId,
        agentType: this.agentType,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Clear conversation history for a thread
   */
  async clearConversationHistory(threadId) {
    try {
      const config = { configurable: { thread_id: threadId } };
      
      // Clear the thread's state
      await this.memorySaver.delete(config);
      
      logger.info(`Conversation history cleared`, {
        threadId,
        agentType: this.agentType
      });

      return true;
    } catch (error) {
      logger.error(`Failed to clear conversation history`, {
        threadId,
        agentType: this.agentType,  
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get agent health status
   */
  async getHealth() {
    try {
      // Test LLM connection
      const testResponse = await this.llm.invoke([
        new HumanMessage("Test connection - respond with 'OK'")
      ]);

      return {
        status: 'healthy',
        agentType: this.agentType,
        llmProvider: this.options.llmProvider,
        modelName: this.options.modelName,
        toolCount: this.tools.length,
        initialized: !!this.agent,
        testResponse: testResponse.content
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        agentType: this.agentType,
        error: error.message,
        initialized: !!this.agent
      };
    }
  }

  /**
   * Get agent information
   */
  getInfo() {
    return {
      agentType: this.agentType,
      options: this.options,
      toolCount: this.tools.length,
      initialized: !!this.agent,
      hasSystemPrompt: !!this.systemPrompt,
      activeThreads: this.activeThreads.size
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      this.activeThreads.clear();
      
      logger.info(`Agent ${this.agentType} cleaned up successfully`);
    } catch (error) {
      logger.error(`Error during agent cleanup`, {
        agentType: this.agentType,
        error: error.message
      });
    }
  }
}

export default ModernBaseAgent;