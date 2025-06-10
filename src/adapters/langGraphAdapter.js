import { F1MCPClient } from '../adapters/f1McpClient.js';
import logger from '../utils/logger.js';

/**
 * LangGraph Tools Adapter for F1 MCP Integration
 * Converts F1 MCP tools into LangGraph-compatible tool definitions
 */
export class F1LangGraphAdapter {
  constructor(options = {}) {
    this.f1Client = new F1MCPClient(options);
    this.tools = null;
    this.initialized = false;
  }

  /**
   * Initialize the adapter and load tools
   */
  async initialize() {
    try {
      // Test connection to F1 MCP server
      await this.f1Client.healthCheck();

      // Load available tools
      const mcpTools = await this.f1Client.getTools();

      // Convert MCP tools to LangGraph format
      this.tools = this.convertMCPToolsToLangGraph(mcpTools);

      this.initialized = true;
      logger.info('F1 LangGraph Adapter initialized', {
        toolCount: this.tools.length,
      });

      return this.tools;
    } catch (error) {
      logger.error('Failed to initialize F1 LangGraph Adapter', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Convert MCP tools to LangGraph tool format
   */
  convertMCPToolsToLangGraph(mcpTools) {
    const langGraphTools = []; // Map of MCP tool names to LangGraph tool definitions
    const toolMappings = {
      get_seasons: this.createSeasonsTool(),
      get_races: this.createRacesTool(),
      get_drivers: this.createDriversTool(),
      get_constructors: this.createConstructorsTool(),
      get_race_results: this.createRaceResultsTool(),
      get_qualifying_results: this.createQualifyingResultsTool(),
      get_driver_standings: this.createDriverStandingsTool(),
      get_constructor_standings: this.createConstructorStandingsTool(),
      get_circuit_info: this.createCircuitInfoTool(),
      get_all_circuits: this.createAllCircuitsTool(),
      get_driver_info: this.createDriverInfoTool(),
      get_constructor_info: this.createConstructorInfoTool(),
      get_season_summary: this.createSeasonSummaryTool(),
      get_current_season: this.createCurrentSeasonTool(),
    };

    // Convert available MCP tools
    if (Array.isArray(mcpTools)) {
      mcpTools.forEach((tool) => {
        const toolName = tool.name;
        if (toolMappings[toolName]) {
          langGraphTools.push(toolMappings[toolName]);
        }
      });
    }

    return langGraphTools;
  }

  /**
   * Get tools for LangGraph agents
   */
  getTools() {
    if (!this.initialized) {
      throw new Error('Adapter not initialized. Call initialize() first.');
    }
    return this.tools;
  }
  // Individual tool creators

  createSeasonsTool() {
    return {
      name: 'get_f1_seasons',
      description: 'Get all available F1 seasons from 1950 to present',
      schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      func: async () => {
        return await this.f1Client.getSeasons();
      },
    };
  }

  createRacesTool() {
    return {
      name: 'get_f1_races',
      description: 'Get races for a specific F1 season',
      schema: {
        type: 'object',
        properties: {
          year: {
            type: 'number',
            description: 'F1 season year (1950-2025)',
          },
        },
        required: ['year'],
      },
      func: async (params) => {
        return await this.f1Client.getRaces(params.year);
      },
    };
  }

  createDriversTool() {
    return {
      name: 'get_f1_drivers',
      description: 'Get drivers for a specific F1 season',
      schema: {
        type: 'object',
        properties: {
          year: {
            type: 'number',
            description: 'F1 season year (1950-2025)',
          },
        },
        required: ['year'],
      },
      func: async (params) => {
        return await this.f1Client.getDrivers(params.year);
      },
    };
  }

  createConstructorsTool() {
    return {
      name: 'get_f1_constructors',
      description: 'Get constructors/teams for a specific F1 season',
      schema: {
        type: 'object',
        properties: {
          year: {
            type: 'number',
            description: 'F1 season year (1950-2025)',
          },
        },
        required: ['year'],
      },
      func: async (params) => {
        return await this.f1Client.getConstructors(params.year);
      },
    };
  }

  createRaceResultsTool() {
    return {
      name: 'get_f1_race_results',
      description: 'Get race results for a specific race',
      schema: {
        type: 'object',
        properties: {
          year: {
            type: 'number',
            description: 'F1 season year',
          },
          round: {
            type: 'number',
            description: 'Race round number',
          },
        },
        required: ['year', 'round'],
      },
      func: async (params) => {
        return await this.f1Client.getRaceResults(params.year, params.round);
      },
    };
  }

  createQualifyingResultsTool() {
    return {
      name: 'get_f1_qualifying_results',
      description: 'Get qualifying results for a specific race',
      schema: {
        type: 'object',
        properties: {
          year: {
            type: 'number',
            description: 'F1 season year',
          },
          round: {
            type: 'number',
            description: 'Race round number',
          },
        },
        required: ['year', 'round'],
      },
      func: async (params) => {
        return await this.f1Client.getQualifyingResults(
          params.year,
          params.round,
        );
      },
    };
  }

  createDriverStandingsTool() {
    return {
      name: 'get_f1_driver_standings',
      description: 'Get driver championship standings',
      schema: {
        type: 'object',
        properties: {
          year: {
            type: 'number',
            description: 'F1 season year',
          },
          round: {
            type: 'number',
            description: 'Optional: specific round number',
            optional: true,
          },
        },
        required: ['year'],
      },
      func: async (params) => {
        return await this.f1Client.getDriverStandings(
          params.year,
          params.round,
        );
      },
    };
  }

  createConstructorStandingsTool() {
    return {
      name: 'get_f1_constructor_standings',
      description: 'Get constructor championship standings',
      schema: {
        type: 'object',
        properties: {
          year: {
            type: 'number',
            description: 'F1 season year',
          },
          round: {
            type: 'number',
            description: 'Optional: specific round number',
            optional: true,
          },
        },
        required: ['year'],
      },
      func: async (params) => {
        return await this.f1Client.getConstructorStandings(
          params.year,
          params.round,
        );
      },
    };
  }

  createCircuitInfoTool() {
    return {
      name: 'get_f1_circuit_info',
      description: 'Get circuit information for a specific race',
      schema: {
        type: 'object',
        properties: {
          year: {
            type: 'number',
            description: 'F1 season year',
          },
          round: {
            type: 'number',
            description: 'Race round number',
          },
        },
        required: ['year', 'round'],
      },
      func: async (params) => {
        return await this.f1Client.getCircuitInfo(params.year, params.round);
      },
    };
  }

  createAllCircuitsTool() {
    return {
      name: 'get_all_f1_circuits',
      description: 'Get information about all F1 circuits',
      schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      func: async () => {
        return await this.f1Client.getAllCircuits();
      },
    };
  }

  createDriverInfoTool() {
    return {
      name: 'get_f1_driver_info',
      description: 'Get detailed information about a specific driver',
      schema: {
        type: 'object',
        properties: {
          driver_id: {
            type: 'string',
            description: 'Driver ID (e.g., "hamilton", "verstappen")',
          },
          year: {
            type: 'number',
            description: 'Optional: specific year filter',
            optional: true,
          },
        },
        required: ['driver_id'],
      },
      func: async (params) => {
        return await this.f1Client.getDriverInfo(params.driver_id, params.year);
      },
    };
  }

  createConstructorInfoTool() {
    return {
      name: 'get_f1_constructor_info',
      description: 'Get detailed information about a specific constructor',
      schema: {
        type: 'object',
        properties: {
          constructor_id: {
            type: 'string',
            description:
              'Constructor ID (e.g., "mercedes", "ferrari", "red_bull")',
          },
          year: {
            type: 'number',
            description: 'Optional: specific year filter',
            optional: true,
          },
        },
        required: ['constructor_id'],
      },
      func: async (params) => {
        return await this.f1Client.getConstructorInfo(
          params.constructor_id,
          params.year,
        );
      },
    };
  }

  createSeasonSummaryTool() {
    return {
      name: 'get_f1_season_summary',
      description: 'Get comprehensive summary of an F1 season',
      schema: {
        type: 'object',
        properties: {
          year: {
            type: 'number',
            description: 'F1 season year',
          },
        },
        required: ['year'],
      },
      func: async (params) => {
        return await this.f1Client.getSeasonSummary(params.year);
      },
    };
  }

  createCurrentSeasonTool() {
    return {
      name: 'get_current_f1_season',
      description: 'Get information about the current F1 season',
      schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      func: async () => {
        const currentYear = new Date().getFullYear();
        return await this.f1Client.getSeasonSummary(currentYear);
      },
    };
  }
}

export default F1LangGraphAdapter;
