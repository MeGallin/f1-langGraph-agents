/**
 * Modern LangGraph Adapter for F1 MCP Integration
 * Uses LangGraph.js v0.2 patterns with proper state management and streaming
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { SimpleF1MCPClient } from './simpleMcpClient.js';
import logger from '../utils/logger.js';

export class ModernF1LangGraphAdapter {
  constructor(options = {}) {
    this.options = {
      enableStreaming: options.enableStreaming !== false,
      enableRetry: options.enableRetry !== false,
      maxRetries: options.maxRetries || 3,
      timeout: options.timeout || 150000,
      ...options
    };

    this.mcpClient = new SimpleF1MCPClient(options);
    this.tools = [];
    this.toolMap = new Map();
    this.initialized = false;

    logger.info('ModernF1LangGraphAdapter initialized', {
      enableStreaming: this.options.enableStreaming,
      enableRetry: this.options.enableRetry
    });
  }

  /**
   * Initialize the adapter with modern MCP client
   */
  async initialize() {
    try {
      logger.info('Initializing Modern F1 LangGraph Adapter...');

      // Initialize MCP client
      await this.mcpClient.initialize();

      // Create LangGraph tools from available MCP tools
      this.tools = await this.createLangGraphTools();

      this.initialized = true;

      logger.info('Modern F1 LangGraph Adapter initialized successfully', {
        toolCount: this.tools.length
      });

      return this.tools;
    } catch (error) {
      logger.error('Failed to initialize Modern F1 LangGraph Adapter', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create LangGraph tools using modern patterns
   */
  async createLangGraphTools() {
    const availableTools = this.mcpClient.getAvailableTools();
    const langGraphTools = [];

    // Define tool schemas and create tools
    const toolDefinitions = this.getToolDefinitions();

    for (const mcpTool of availableTools) {
      const toolDef = toolDefinitions[mcpTool.name];
      
      if (toolDef) {
        const langGraphTool = this.createTool(mcpTool.name, toolDef);
        langGraphTools.push(langGraphTool);
        this.toolMap.set(mcpTool.name, langGraphTool);
      }
    }

    return langGraphTools;
  }

  /**
   * Create a single LangGraph tool with modern patterns
   */
  createTool(toolName, definition) {
    return tool(
      async (params, config) => {
        try {
          // Add streaming support if enabled
          if (this.options.enableStreaming && config?.callbacks) {
            await config.callbacks.handleToolStart?.(
              { name: toolName },
              params,
              config.runId
            );
          }

          // Invoke MCP tool with retry logic
          const result = await this.invokeWithRetry(toolName, params);
          
          // Stream the result if enabled
          if (this.options.enableStreaming && config?.callbacks) {
            await config.callbacks.handleToolEnd?.(
              result,
              config.runId
            );
          }

          return result;
        } catch (error) {
          if (this.options.enableStreaming && config?.callbacks) {
            await config.callbacks.handleToolError?.(
              error,
              config.runId
            );
          }
          throw error;
        }
      },
      {
        name: toolName,
        description: definition.description,
        schema: definition.schema,
        returnDirect: definition.returnDirect || false
      }
    );
  }

  /**
   * Invoke MCP tool with retry logic
   */
  async invokeWithRetry(toolName, params, attempt = 1) {
    try {
      const result = await this.mcpClient.invokeTool(toolName, params);
      return this.mcpClient.extractContent(result);
    } catch (error) {
      if (this.options.enableRetry && attempt < this.options.maxRetries) {
        logger.warn(`Tool invocation failed, retrying (${attempt}/${this.options.maxRetries})`, {
          toolName,
          error: error.message
        });
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        
        return this.invokeWithRetry(toolName, params, attempt + 1);
      }
      
      throw error;
    }
  }

  /**
   * Get tool definitions with proper schemas
   */
  getToolDefinitions() {
    return {
      get_f1_seasons: {
        description: 'Get all available F1 seasons from 1950 to present',
        schema: z.object({}),
        returnDirect: false
      },
      
      get_current_f1_season: {
        description: 'Get information about the current F1 season',
        schema: z.object({}),
        returnDirect: false
      },
      
      get_f1_races: {
        description: 'Get race schedule for a specific F1 season',
        schema: z.object({
          year: z.number().min(1950).max(2025).describe('F1 season year (1950-2025)')
        }),
        returnDirect: false
      },
      
      get_f1_race_details: {
        description: 'Get detailed information about a specific race',
        schema: z.object({
          year: z.number().min(1950).max(2025).describe('F1 season year'),
          round: z.number().min(1).describe('Race round number')
        }),
        returnDirect: false
      },
      
      get_current_f1_race: {
        description: 'Get information about the current/ongoing F1 race',
        schema: z.object({}),
        returnDirect: false
      },
      
      get_next_f1_race: {
        description: 'Get information about the next scheduled F1 race',
        schema: z.object({}),
        returnDirect: false
      },
      
      get_f1_drivers: {
        description: 'Get drivers participating in a specific F1 season',
        schema: z.object({
          year: z.number().min(1950).max(2025).describe('F1 season year')
        }),
        returnDirect: false
      },
      
      get_f1_driver_details: {
        description: 'Get detailed information about a specific driver',
        schema: z.object({
          driverId: z.string().describe('Driver ID (e.g., "hamilton", "verstappen")'),
          year: z.number().min(1950).max(2025).optional().describe('Optional: specific year filter')
        }),
        returnDirect: false
      },
      
      get_f1_constructors: {
        description: 'Get constructors/teams participating in a specific F1 season',
        schema: z.object({
          year: z.number().min(1950).max(2025).describe('F1 season year')
        }),
        returnDirect: false
      },
      
      get_f1_constructor_details: {
        description: 'Get detailed information about a specific constructor/team',
        schema: z.object({
          constructorId: z.string().describe('Constructor ID (e.g., "mercedes", "ferrari", "red_bull")'),
          year: z.number().min(1950).max(2025).optional().describe('Optional: specific year filter')
        }),
        returnDirect: false
      },
      
      get_f1_race_results: {
        description: 'Get race results and finishing positions for a specific race',
        schema: z.object({
          year: z.number().min(1950).max(2025).describe('F1 season year'),
          round: z.number().min(1).describe('Race round number')
        }),
        returnDirect: false
      },
      
      get_f1_qualifying_results: {
        description: 'Get qualifying session results for a specific race',
        schema: z.object({
          year: z.number().min(1950).max(2025).describe('F1 season year'),
          round: z.number().min(1).describe('Race round number')
        }),
        returnDirect: false
      },
      
      get_f1_driver_standings: {
        description: 'Get driver championship standings for a season',
        schema: z.object({
          year: z.number().min(1950).max(2025).describe('F1 season year'),
          round: z.number().min(1).optional().describe('Optional: specific round number')
        }),
        returnDirect: false
      },
      
      get_f1_constructor_standings: {
        description: 'Get constructor championship standings for a season',
        schema: z.object({
          year: z.number().min(1950).max(2025).describe('F1 season year'),
          round: z.number().min(1).optional().describe('Optional: specific round number')
        }),
        returnDirect: false
      }
    };
  }

  /**
   * Get all available LangGraph tools
   */
  getTools() {
    if (!this.initialized) {
      throw new Error('Adapter not initialized. Call initialize() first.');
    }
    return this.tools;
  }

  /**
   * Get specific tool by name
   */
  getTool(toolName) {
    return this.toolMap.get(toolName);
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const mcpHealth = await this.mcpClient.healthCheck();
      
      return {
        status: this.initialized && mcpHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
        initialized: this.initialized,
        toolCount: this.tools.length,
        mcpClient: mcpHealth
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        initialized: this.initialized
      };
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      await this.mcpClient.disconnect();
      this.initialized = false;
      this.tools = [];
      this.toolMap.clear();
      
      logger.info('ModernF1LangGraphAdapter cleaned up successfully');
    } catch (error) {
      logger.error('Error during adapter cleanup', { error: error.message });
    }
  }

  /**
   * Get adapter information
   */
  getInfo() {
    return {
      initialized: this.initialized,
      toolCount: this.tools.length,
      availableTools: Array.from(this.toolMap.keys()),
      options: this.options
    };
  }
}

export default ModernF1LangGraphAdapter;