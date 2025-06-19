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
    this.timeout = options.timeout || 150000; // 2.5 minutes for Render.com cold starts and complex queries

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
      throw error;
    }
  }

  /**
   * Invoke an F1 MCP tool
   */
  async invoke(toolName, parameters = {}) {
    try {
      logger.info(`Invoking F1 MCP tool: ${toolName}`, { parameters });

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
      
      throw error;
    }
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
      
      throw error;
    }
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

  async getConstructorStandings(season) {
    return this.invoke('get_f1_constructor_standings', { season });
  }

  async getDriverStandings(season) {
    return this.invoke('get_f1_driver_standings', { season });
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

  async getSeasonSummary(season) {
    // This method combines multiple data sources to create a season summary
    const [races, drivers, constructors, driverStandings, constructorStandings] = await Promise.all([
      this.getRaces(season),
      this.getDrivers(season),
      this.getConstructors(season),
      this.getStandings(season, 'drivers'),
      this.getStandings(season, 'constructors')
    ]);

    return {
      season,
      totalRaces: races.races?.length || 0,
      totalDrivers: drivers.drivers?.length || 0,
      totalConstructors: constructors.constructors?.length || 0,
      champion: driverStandings.standings?.[0]?.driver || 'Unknown',
      constructorChampion: constructorStandings.standings?.[0]?.name || 'Unknown',
      races: races.races || [],
      drivers: drivers.drivers || [],
      constructors: constructors.constructors || [],
      driverStandings: driverStandings.standings || [],
      constructorStandings: constructorStandings.standings || []
    };
  }
}

export default F1MCPClient;
