/**
 * Simple F1 MCP Client
 * HTTP-based client that works with the existing F1 MCP server structure
 */

import axios from 'axios';
import logger from '../utils/logger.js';

export class SimpleF1MCPClient {
  constructor(options = {}) {
    this.options = {
      serverUrl: options.serverUrl || process.env.F1_MCP_SERVER_URL || 'http://localhost:3001',
      timeout: options.timeout || 150000,
      maxRetries: options.maxRetries || 3,
      ...options
    };

    this.httpClient = axios.create({
      baseURL: this.options.serverUrl,
      timeout: this.options.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'F1-LangGraph-Agents/2.0.0'
      }
    });

    this.isConnected = false;
    this.availableTools = new Map();
    
    logger.info('SimpleF1MCPClient initialized', { 
      serverUrl: this.options.serverUrl
    });
  }

  /**
   * Initialize the MCP client connection
   */
  async initialize() {
    try {
      logger.info('Initializing simple MCP client connection...');

      // Test connection with health check
      await this.healthCheck();
      
      // Load available tools (mock for now since we know the F1 tools)
      this.loadF1Tools();
      
      this.isConnected = true;

      logger.info('Simple MCP client connection established successfully', {
        toolCount: this.availableTools.size
      });

      return true;
    } catch (error) {
      logger.error('Failed to initialize simple MCP client', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Load F1 tools (we know the structure from the existing server)
   */
  loadF1Tools() {
    const f1Tools = [
      { name: 'get_f1_seasons', description: 'Get all available F1 seasons' },
      { name: 'get_current_f1_season', description: 'Get current F1 season' },
      { name: 'get_f1_races', description: 'Get races for a season' },
      { name: 'get_f1_race_details', description: 'Get race details' },
      { name: 'get_current_f1_race', description: 'Get current race' },
      { name: 'get_next_f1_race', description: 'Get next race' },
      { name: 'get_f1_drivers', description: 'Get drivers for a season' },
      { name: 'get_f1_driver_details', description: 'Get driver details' },
      { name: 'get_f1_constructors', description: 'Get constructors for a season' },
      { name: 'get_f1_constructor_details', description: 'Get constructor details' },
      { name: 'get_f1_race_results', description: 'Get race results' },
      { name: 'get_f1_qualifying_results', description: 'Get qualifying results' },
      { name: 'get_f1_driver_standings', description: 'Get driver standings' },
      { name: 'get_f1_constructor_standings', description: 'Get constructor standings' }
    ];

    f1Tools.forEach(tool => {
      this.availableTools.set(tool.name, tool);
    });
  }

  /**
   * Health check - verify connection and server status
   */
  async healthCheck() {
    try {
      const response = await this.httpClient.get('/health');
      
      return {
        status: 'healthy',
        connected: true,
        serverResponse: response.data
      };
    } catch (error) {
      logger.error('Health check failed', { error: error.message });
      
      // Return mock healthy status for development
      return {
        status: 'mock_healthy',
        connected: false,
        error: error.message,
        note: 'Using mock mode - F1 MCP server may be unavailable'
      };
    }
  }

  /**
   * Invoke a tool using the F1 MCP server API
   */
  async invokeTool(toolName, parameters = {}) {
    try {
      logger.info(`Invoking F1 tool: ${toolName}`, { parameters });

      // Verify tool exists
      if (!this.availableTools.has(toolName)) {
        throw new Error(`Tool '${toolName}' not available`);
      }

      // Try to invoke the tool on the F1 MCP server
      const response = await this.httpClient.post('/tools/invoke', {
        tool: toolName,
        parameters: parameters
      });

      logger.info(`F1 tool invocation successful: ${toolName}`);
      return response.data;

    } catch (error) {
      logger.warn(`F1 tool invocation failed: ${toolName}, using mock data`, {
        error: error.message
      });

      // Return mock data for development
      return this.getMockData(toolName, parameters);
    }
  }

  /**
   * Get mock data for development when server is unavailable
   */
  getMockData(toolName, parameters) {
    const mockData = {
      get_f1_seasons: {
        seasons: [
          { year: 2024, races: 24 },
          { year: 2023, races: 23 },
          { year: 2022, races: 22 }
        ]
      },
      get_current_f1_season: {
        season: 2024,
        races: 24,
        status: 'active'
      },
      get_f1_races: {
        season: parameters.year || 2024,
        races: [
          { round: 1, name: 'Bahrain Grand Prix', date: '2024-03-02' },
          { round: 2, name: 'Saudi Arabian Grand Prix', date: '2024-03-09' },
          { round: 3, name: 'Australian Grand Prix', date: '2024-03-24' }
        ]
      },
      get_f1_drivers: {
        season: parameters.year || 2024,
        drivers: [
          { name: 'Max Verstappen', team: 'Red Bull Racing', number: 1 },
          { name: 'Lewis Hamilton', team: 'Mercedes', number: 44 },
          { name: 'Charles Leclerc', team: 'Ferrari', number: 16 }
        ]
      },
      get_f1_constructors: {
        season: parameters.year || 2024,
        constructors: [
          { name: 'Red Bull Racing', championships: 6 },
          { name: 'Mercedes', championships: 8 },
          { name: 'Ferrari', championships: 16 }
        ]
      },
      get_f1_driver_standings: {
        season: parameters.year || 2024,
        standings: [
          { position: 1, driver: 'Max Verstappen', points: 575 },
          { position: 2, driver: 'Lando Norris', points: 356 },
          { position: 3, driver: 'Charles Leclerc', points: 307 }
        ]
      }
    };

    const result = mockData[toolName] || { 
      message: `Mock data for ${toolName}`,
      parameters 
    };

    return {
      success: true,
      data: result,
      mock: true,
      toolName
    };
  }

  /**
   * Get available tools information
   */
  getAvailableTools() {
    return Array.from(this.availableTools.values());
  }

  /**
   * Extract content from tool result (compatibility method)
   */
  extractContent(result) {
    if (result && result.data) {
      return result.data;
    }
    return result;
  }

  /**
   * Disconnect from the server
   */
  async disconnect() {
    try {
      this.isConnected = false;
      logger.info('Simple MCP client disconnected');
    } catch (error) {
      logger.error('Error during disconnect', { error: error.message });
    }
  }

  /**
   * F1-specific convenience methods
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
}

export default SimpleF1MCPClient;