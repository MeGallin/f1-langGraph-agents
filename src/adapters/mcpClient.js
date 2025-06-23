/**
 * Modern F1 MCP Client using Official SDK
 * Uses @modelcontextprotocol/sdk for proper MCP protocol implementation
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import logger from '../utils/logger.js';

export class ModernF1MCPClient {
  constructor(options = {}) {
    this.options = {
      serverUrl: options.serverUrl || process.env.F1_MCP_SERVER_URL || 'http://localhost:3001',
      mode: options.mode || 'http', // 'stdio' or 'http'
      timeout: options.timeout || 150000,
      maxRetries: options.maxRetries || 3,
      ...options
    };

    this.client = null;
    this.transport = null;
    this.isConnected = false;
    this.availableTools = new Map();
    
    logger.info('ModernF1MCPClient initialized', { 
      serverUrl: this.options.serverUrl,
      mode: this.options.mode 
    });
  }

  /**
   * Initialize the MCP client connection
   */
  async initialize() {
    try {
      logger.info('Initializing MCP client connection...');

      // Create transport based on mode
      if (this.options.mode === 'stdio') {
        this.transport = new StdioClientTransport({
          command: 'node',
          args: [process.env.F1_MCP_SERVER_PATH || '../f1-mcp-server/src/server.js']
        });
      } else {
        // HTTP/SSE transport for remote servers
        this.transport = new SSEClientTransport(
          new URL('/sse', this.options.serverUrl)
        );
      }

      // Create client
      this.client = new Client({
        name: 'f1-langgraph-agents',
        version: '1.0.0'
      }, {
        capabilities: {
          tools: {},
          resources: {}
        }
      });

      // Connect to server
      await this.client.connect(this.transport);
      this.isConnected = true;

      // Load available tools
      await this.loadAvailableTools();

      logger.info('MCP client connection established successfully', {
        toolCount: this.availableTools.size
      });

      return true;
    } catch (error) {
      logger.error('Failed to initialize MCP client', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Load available tools from the MCP server
   */
  async loadAvailableTools() {
    try {
      const response = await this.client.listTools();
      
      this.availableTools.clear();
      if (response.tools) {
        response.tools.forEach(tool => {
          this.availableTools.set(tool.name, tool);
        });
      }

      logger.info('Tools loaded from MCP server', {
        toolCount: this.availableTools.size,
        tools: Array.from(this.availableTools.keys())
      });
    } catch (error) {
      logger.error('Failed to load available tools', { error: error.message });
      throw error;
    }
  }

  /**
   * Health check - verify connection and server status
   */
  async healthCheck() {
    try {
      if (!this.isConnected) {
        await this.initialize();
      }

      // Test with a simple tool call
      const tools = await this.client.listTools();
      
      return {
        status: 'healthy',
        connected: this.isConnected,
        toolCount: tools.tools?.length || 0,
        serverUrl: this.options.serverUrl
      };
    } catch (error) {
      logger.error('Health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Invoke a tool with proper MCP protocol
   */
  async invokeTool(toolName, parameters = {}) {
    if (!this.isConnected) {
      await this.initialize();
    }

    try {
      logger.info(`Invoking MCP tool: ${toolName}`, { parameters });

      // Verify tool exists
      if (!this.availableTools.has(toolName)) {
        throw new Error(`Tool '${toolName}' not available. Available tools: ${Array.from(this.availableTools.keys()).join(', ')}`);
      }

      const result = await this.client.callTool({
        name: toolName,
        arguments: parameters
      });

      logger.info(`MCP tool invocation successful: ${toolName}`, {
        hasContent: !!result.content,
        contentCount: result.content?.length || 0
      });

      return result;
    } catch (error) {
      logger.error(`MCP tool invocation failed: ${toolName}`, {
        error: error.message,
        parameters
      });
      throw error;
    }
  }

  /**
   * Get available tools information
   */
  getAvailableTools() {
    return Array.from(this.availableTools.values());
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect() {
    try {
      if (this.client && this.isConnected) {
        await this.client.close();
        this.isConnected = false;
        logger.info('MCP client disconnected successfully');
      }
    } catch (error) {
      logger.error('Error during MCP client disconnect', { error: error.message });
    }
  }

  /**
   * F1-specific convenience methods using proper MCP protocol
   */
  async getF1Seasons() {
    const result = await this.invokeTool('get_f1_seasons', {});
    return this.extractContent(result);
  }

  async getF1Drivers(year) {
    const result = await this.invokeTool('get_f1_drivers', { year });
    return this.extractContent(result);
  }

  async getF1Races(year) {
    const result = await this.invokeTool('get_f1_races', { year });
    return this.extractContent(result);
  }

  async getF1Constructors(year) {
    const result = await this.invokeTool('get_f1_constructors', { year });
    return this.extractContent(result);
  }

  async getF1RaceResults(year, round) {
    const result = await this.invokeTool('get_f1_race_results', { year, round });
    return this.extractContent(result);
  }

  async getF1QualifyingResults(year, round) {
    const result = await this.invokeTool('get_f1_qualifying_results', { year, round });
    return this.extractContent(result);
  }

  async getF1DriverStandings(year, round = null) {
    const params = round ? { year, round } : { year };
    const result = await this.invokeTool('get_f1_driver_standings', params);
    return this.extractContent(result);
  }

  async getF1ConstructorStandings(year, round = null) {
    const params = round ? { year, round } : { year };
    const result = await this.invokeTool('get_f1_constructor_standings', params);
    return this.extractContent(result);
  }

  async getCurrentF1Season() {
    const result = await this.invokeTool('get_current_f1_season', {});
    return this.extractContent(result);
  }

  async getCurrentF1Race() {
    const result = await this.invokeTool('get_current_f1_race', {});
    return this.extractContent(result);
  }

  async getNextF1Race() {
    const result = await this.invokeTool('get_next_f1_race', {});
    return this.extractContent(result);
  }

  /**
   * Extract content from MCP tool result
   */
  extractContent(mcpResult) {
    if (!mcpResult || !mcpResult.content) {
      return null;
    }

    // Handle different content types
    const content = mcpResult.content[0];
    
    if (content.type === 'text') {
      try {
        return JSON.parse(content.text);
      } catch {
        return content.text;
      }
    }

    return content;
  }

  /**
   * Batch tool invocation for efficiency
   */
  async invokeMultipleTools(toolRequests) {
    const results = await Promise.allSettled(
      toolRequests.map(({ toolName, parameters }) => 
        this.invokeTool(toolName, parameters)
      )
    );

    return results.map((result, index) => ({
      toolName: toolRequests[index].toolName,
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? this.extractContent(result.value) : null,
      error: result.status === 'rejected' ? result.reason.message : null
    }));
  }
}

export default ModernF1MCPClient;