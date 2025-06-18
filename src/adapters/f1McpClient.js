/**
 * F1 MCP Client
 * Client for communicating with F1 MCP Server
 */

import logger from '../utils/logger.js';
import axios from 'axios';

export class F1MCPClient {
  constructor(options = {}) {
    this.baseUrl =
      options.baseUrl ||
      process.env.F1_MCP_SERVER_URL ||
      'http://localhost:3001';
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    this.timeout = options.timeout || 30000; // Increased for Render.com cold starts

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'F1-LangGraph-Agents/1.0.0'
      }
    });

    logger.info('F1MCPClient initialized', { baseUrl: this.baseUrl });
  }

  /**
   * Health check to verify MCP server is accessible
   */
  async healthCheck() {
    try {
      logger.info('Performing F1 MCP health check...');
      const response = await this.httpClient.get('/health');
      logger.info('F1 MCP health check successful', response.data);
      return response.data;
    } catch (error) {
      logger.error('F1 MCP health check failed:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      
      // Return a fallback response for offline development
      if (error.code === 'ECONNREFUSED' || error.response?.status >= 500) {
        logger.warn('MCP server unavailable, using fallback mode');
        return { 
          status: 'fallback', 
          timestamp: new Date().toISOString(),
          message: 'MCP server unavailable, using mock data'
        };
      }
      throw error;
    }
  }

  /**
   * Invoke an F1 MCP tool
   */
  async invoke(toolName, parameters = {}) {
    try {
      logger.info(`Invoking F1 MCP tool: ${toolName}`, { parameters });

      // Try to make real HTTP request to MCP server
      const response = await this.httpClient.post('/tools/invoke', {
        tool: toolName,
        parameters: parameters
      });

      logger.info(`F1 MCP tool response received`, {
        toolName,
        responseSize: JSON.stringify(response.data).length,
      });
      
      return response.data;
    } catch (error) {
      logger.error(`F1 MCP tool invocation failed: ${toolName}`, {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText
      });

      // Fallback to mock data if MCP server is unavailable
      if (error.code === 'ECONNREFUSED' || error.response?.status >= 500) {
        logger.warn(`Using mock data for tool: ${toolName}`);
        return this._getMockResponse(toolName, parameters);
      }
      
      throw error;
    }
  }

  /**
   * Get mock response for development/fallback
   */
  _getMockResponse(toolName, parameters) {
    const mockResponses = {
      get_drivers: {
        drivers: [
          { name: 'Lewis Hamilton', team: 'Mercedes', number: 44 },
          { name: 'Max Verstappen', team: 'Red Bull Racing', number: 1 },
          { name: 'Charles Leclerc', team: 'Ferrari', number: 16 }
        ],
        source: 'mock_data'
      },
      get_races: {
        races: [
          { name: 'Monaco Grand Prix', date: '2024-05-26', round: 8 },
          { name: 'Canadian Grand Prix', date: '2024-06-09', round: 9 }
        ],
        source: 'mock_data'
      },
      get_standings: {
        standings: [
          { position: 1, driver: 'Max Verstappen', points: 393 },
          { position: 2, driver: 'Lando Norris', points: 331 },
          { position: 3, driver: 'Charles Leclerc', points: 307 }
        ],
        source: 'mock_data'
      },
      get_constructors: {
        constructors: [
          { name: 'Red Bull Racing', points: 589 },
          { name: 'McLaren', points: 521 },
          { name: 'Ferrari', points: 407 }
        ],
        source: 'mock_data'
      },
    };

    return mockResponses[toolName] || {
      result: 'Mock response - MCP server unavailable',
      toolName,
      parameters,
      source: 'mock_data'
    };
  }

  /**
   * Get available tools from the MCP server
   */
  async getTools() {
    try {
      logger.info('Fetching F1 MCP tools...');
      const response = await this.httpClient.get('/tools');
      
      logger.info('F1 MCP tools retrieved', { toolCount: response.data.tools?.length || 0 });
      return response.data.tools || response.data;
    } catch (error) {
      logger.error('Failed to get F1 MCP tools:', {
        message: error.message,
        status: error.response?.status
      });

      // Fallback to mock tool definitions
      if (error.code === 'ECONNREFUSED' || error.response?.status >= 500) {
        logger.warn('Using mock tool definitions');
        return this._getMockTools();
      }
      
      throw error;
    }
  }

  /**
   * Get mock tool definitions for development/fallback
   */
  _getMockTools() {
    return [
      {
        name: 'get_drivers',
        description: 'Get F1 drivers information',
        parameters: {
          type: 'object',
          properties: {
            season: { type: 'string', description: 'Season year' },
          },
        },
      },
      {
        name: 'get_races',
        description: 'Get F1 races information',
        parameters: {
          type: 'object',
          properties: {
            season: { type: 'string', description: 'Season year' },
          },
        },
      },
      {
        name: 'get_standings',
        description: 'Get F1 championship standings',
        parameters: {
          type: 'object',
          properties: {
            season: { type: 'string', description: 'Season year' },
            type: { type: 'string', enum: ['drivers', 'constructors'] },
          },
        },
      },
      {
        name: 'get_constructors',
        description: 'Get F1 constructors information',
        parameters: {
          type: 'object',
          properties: {
            season: { type: 'string', description: 'Season year' },
          },
        },
      },
    ];
  }

  /**
   * Convenience methods for common F1 data operations
   */
  async getSeasons() {
    return this.invoke('get_f1_seasons', {});
  }

  async getDrivers(season) {
    return this.invoke('get_f1_drivers', { season });
  }

  async getRaces(season) {
    return this.invoke('get_f1_races', { season });
  }

  async getStandings(season, type = 'drivers') {
    const toolName = type === 'constructors' ? 'get_f1_constructor_standings' : 'get_f1_driver_standings';
    return this.invoke(toolName, { season });
  }

  async getConstructors(season) {
    return this.invoke('get_f1_constructors', { season });
  }

  async getRaceResults(season, round) {
    return this.invoke('get_f1_race_results', { season, round });
  }

  async getCurrentSeason() {
    return this.invoke('get_current_f1_season', {});
  }

  async getCurrentRace() {
    return this.invoke('get_current_f1_race', {});
  }

  async getNextRace() {
    return this.invoke('get_next_f1_race', {});
  }
}

export default F1MCPClient;
