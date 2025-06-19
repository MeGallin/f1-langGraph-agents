/**
 * F1 Tools Base Class
 * Base abstraction for F1 data access tools
 */

import logger from '../utils/logger.js';

export class F1ToolsBase {
  constructor(adapter, options = {}) {
    this.adapter = adapter;
    this.timeout = options.timeout || 10000;
    this.retries = options.retries || 2;
    this.logger = logger;
    this.cache = new Map(); // Simple in-memory cache
    this.cacheTTL = options.cacheTTL || 300000; // 5 minutes
  }

  /**
   * Execute F1 MCP tool with error handling and caching
   */
  async executeWithCache(toolName, params = {}, useCache = true) {
    const cacheKey = `${toolName}_${JSON.stringify(params)}`;
    
    // Check cache first
    if (useCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTTL) {
        this.logger.debug(`F1Tools: Cache hit for ${toolName}`, { params });
        return cached.data;
      } else {
        this.cache.delete(cacheKey);
      }
    }

    try {
      const result = await this.executeWithRetry(toolName, params);
      
      // Cache successful results
      if (useCache && result && !result.error) {
        this.cache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });
      }

      return result;

    } catch (error) {
      this.logger.error(`F1Tools: Failed to execute ${toolName}`, {
        toolName,
        params,
        error: error.message
      });
      return this.createErrorResponse(error, toolName);
    }
  }

  /**
   * Execute tool with retry logic
   */
  async executeWithRetry(toolName, params) {
    let lastError;

    for (let attempt = 1; attempt <= this.retries + 1; attempt++) {
      try {
        this.logger.debug(`F1Tools: Executing ${toolName} (attempt ${attempt})`, { params });
        
        const result = await Promise.race([
          this.adapter.invoke(toolName, params),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Tool ${toolName} timeout`)), this.timeout)
          )
        ]);

        if (result && !result.error) {
          this.logger.debug(`F1Tools: Successfully executed ${toolName}`, { 
            attempt,
            resultSize: JSON.stringify(result).length
          });
          return result;
        } else if (result && result.error) {
          throw new Error(result.error);
        }

      } catch (error) {
        lastError = error;
        this.logger.warn(`F1Tools: Attempt ${attempt} failed for ${toolName}`, {
          error: error.message,
          willRetry: attempt <= this.retries
        });

        if (attempt <= this.retries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Create standardized error response
   */
  createErrorResponse(error, toolName) {
    return {
      error: true,
      message: error.message || 'Unknown error',
      toolName,
      timestamp: new Date().toISOString(),
      fallback: true
    };
  }

  /**
   * Optimize data for LLM consumption
   */
  optimizeForLLM(data, maxTokens = 2000) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    // Estimate token count (rough approximation)
    const jsonString = JSON.stringify(data);
    const estimatedTokens = jsonString.length / 4; // Rough token estimation

    if (estimatedTokens <= maxTokens) {
      return data;
    }

    // Truncate data to fit token limit
    return this.truncateData(data, maxTokens);
  }

  /**
   * Intelligently truncate data structure
   */
  truncateData(data, maxTokens) {
    if (Array.isArray(data)) {
      const maxItems = Math.max(1, Math.floor(maxTokens / 100)); // Rough items per token limit
      return data.slice(0, maxItems);
    }

    if (typeof data === 'object' && data !== null) {
      const truncated = {};
      let tokenCount = 0;
      const tokenPerField = maxTokens / Object.keys(data).length;

      for (const [key, value] of Object.entries(data)) {
        if (tokenCount >= maxTokens) break;

        if (typeof value === 'string') {
          const maxLength = Math.floor(tokenPerField * 4); // Rough string length per token estimate
          truncated[key] = value.length > maxLength ? 
            value.substring(0, maxLength) + '...' : value;
        } else if (Array.isArray(value)) {
          truncated[key] = value.slice(0, Math.max(1, Math.floor(tokenPerField / 10)));
        } else {
          truncated[key] = value;
        }

        tokenCount += JSON.stringify(truncated[key]).length / 4;
      }

      return truncated;
    }

    return data;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    this.logger.debug('F1Tools: Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      ttl: this.cacheTTL,
      entries: Array.from(this.cache.keys())
    };
  }
}

/**
 * Season Analysis Tools
 */
export class SeasonTools extends F1ToolsBase {
  constructor(adapter, options = {}) {
    super(adapter, options);
    this.specialization = 'season_analysis';
  }

  async getSeasonData(season = null) {
    const params = season ? { season } : {};
    return this.executeWithCache('get_f1_seasons', params);
  }

  async getCurrentSeason() {
    return this.executeWithCache('get_current_f1_season', {});
  }

  async getConstructors(season = null) {
    const params = season ? { season } : {};
    return this.executeWithCache('get_f1_constructors', params);
  }

  async getConstructorStandings(season = null) {
    const params = season ? { season } : {};
    return this.executeWithCache('get_f1_constructor_standings', params);
  }

  async getDriverStandings(season = null) {
    const params = season ? { season } : {};
    return this.executeWithCache('get_f1_driver_standings', params);
  }

  async getRaces(season = null) {
    const params = season ? { season } : {};
    return this.executeWithCache('get_f1_races', params);
  }

  async getComprehensiveSeasonData(season) {
    try {
      const [
        seasonInfo,
        constructors,
        driverStandings,
        constructorStandings,
        races
      ] = await Promise.allSettled([
        this.getSeasonData(season),
        this.getConstructors(season),
        this.getDriverStandings(season),
        this.getConstructorStandings(season),
        this.getRaces(season)
      ]);

      return this.combineResults({
        seasonInfo: seasonInfo.status === 'fulfilled' ? seasonInfo.value : null,
        constructors: constructors.status === 'fulfilled' ? constructors.value : null,
        driverStandings: driverStandings.status === 'fulfilled' ? driverStandings.value : null,
        constructorStandings: constructorStandings.status === 'fulfilled' ? constructorStandings.value : null,
        races: races.status === 'fulfilled' ? races.value : null
      });

    } catch (error) {
      return this.createErrorResponse(error, 'getComprehensiveSeasonData');
    }
  }

  combineResults(results) {
    const combined = {
      ...results,
      summary: {
        dataAvailable: Object.values(results).filter(Boolean).length,
        totalQueries: Object.keys(results).length,
        timestamp: new Date().toISOString()
      }
    };

    return this.optimizeForLLM(combined);
  }
}

/**
 * Driver Performance Tools
 */
export class DriverTools extends F1ToolsBase {
  constructor(adapter, options = {}) {
    super(adapter, options);
    this.specialization = 'driver_performance';
  }

  async getDrivers(season = null) {
    const params = season ? { season } : {};
    return this.executeWithCache('get_f1_drivers', params);
  }

  async getDriverDetails(driverId) {
    return this.executeWithCache('get_f1_driver_details', { driverId });
  }

  async getDriverStandings(season = null) {
    const params = season ? { season } : {};
    return this.executeWithCache('get_f1_driver_standings', params);
  }

  async getComprehensiveDriverData(driverId, season = null) {
    try {
      const [
        driverDetails,
        driverStandings,
        drivers
      ] = await Promise.allSettled([
        this.getDriverDetails(driverId),
        this.getDriverStandings(season),
        this.getDrivers(season)
      ]);

      return this.combineResults({
        driverDetails: driverDetails.status === 'fulfilled' ? driverDetails.value : null,
        standings: driverStandings.status === 'fulfilled' ? driverStandings.value : null,
        seasonDrivers: drivers.status === 'fulfilled' ? drivers.value : null
      });

    } catch (error) {
      return this.createErrorResponse(error, 'getComprehensiveDriverData');
    }
  }
}

/**
 * Race Strategy Tools
 */
export class RaceTools extends F1ToolsBase {
  constructor(adapter, options = {}) {
    super(adapter, options);
    this.specialization = 'race_strategy';
  }

  async getRaces(season = null) {
    const params = season ? { season } : {};
    return this.executeWithCache('get_f1_races', params);
  }

  async getRaceDetails(raceId) {
    return this.executeWithCache('get_f1_race_details', { raceId });
  }

  async getCurrentRace() {
    return this.executeWithCache('get_current_f1_race', {});
  }

  async getNextRace() {
    return this.executeWithCache('get_next_f1_race', {});
  }

  async getRaceResults(raceId) {
    return this.executeWithCache('get_f1_race_results', { raceId });
  }

  async getQualifyingResults(raceId) {
    return this.executeWithCache('get_f1_qualifying_results', { raceId });
  }

  async getComprehensiveRaceData(raceId) {
    try {
      const [
        raceDetails,
        raceResults,
        qualifyingResults
      ] = await Promise.allSettled([
        this.getRaceDetails(raceId),
        this.getRaceResults(raceId),
        this.getQualifyingResults(raceId)
      ]);

      return this.combineResults({
        raceDetails: raceDetails.status === 'fulfilled' ? raceDetails.value : null,
        raceResults: raceResults.status === 'fulfilled' ? raceResults.value : null,
        qualifyingResults: qualifyingResults.status === 'fulfilled' ? qualifyingResults.value : null
      });

    } catch (error) {
      return this.createErrorResponse(error, 'getComprehensiveRaceData');
    }
  }
}

/**
 * Championship Tools
 */
export class ChampionshipTools extends F1ToolsBase {
  constructor(adapter, options = {}) {
    super(adapter, options);
    this.specialization = 'championship_prediction';
  }

  async getDriverStandings(season = null) {
    const params = season ? { season } : {};
    return this.executeWithCache('get_f1_driver_standings', params);
  }

  async getConstructorStandings(season = null) {
    const params = season ? { season } : {};
    return this.executeWithCache('get_f1_constructor_standings', params);
  }

  async getCurrentSeason() {
    return this.executeWithCache('get_current_f1_season', {});
  }

  async getRemainingRaces(season = null) {
    const races = await this.executeWithCache('get_f1_races', season ? { season } : {});
    
    if (races && races.races) {
      const now = new Date();
      return {
        ...races,
        remainingRaces: races.races.filter(race => {
          const raceDate = new Date(race.date);
          return raceDate > now;
        })
      };
    }

    return races;
  }

  async getChampionshipData(season = null) {
    try {
      const [
        driverStandings,
        constructorStandings,
        currentSeason,
        remainingRaces
      ] = await Promise.allSettled([
        this.getDriverStandings(season),
        this.getConstructorStandings(season),
        this.getCurrentSeason(),
        this.getRemainingRaces(season)
      ]);

      return this.combineResults({
        driverStandings: driverStandings.status === 'fulfilled' ? driverStandings.value : null,
        constructorStandings: constructorStandings.status === 'fulfilled' ? constructorStandings.value : null,
        currentSeason: currentSeason.status === 'fulfilled' ? currentSeason.value : null,
        remainingRaces: remainingRaces.status === 'fulfilled' ? remainingRaces.value : null
      });

    } catch (error) {
      return this.createErrorResponse(error, 'getChampionshipData');
    }
  }
}

/**
 * Historical Comparison Tools
 */
export class HistoricalTools extends F1ToolsBase {
  constructor(adapter, options = {}) {
    super(adapter, options);
    this.specialization = 'historical_comparison';
  }

  async getAllSeasons() {
    return this.executeWithCache('get_f1_seasons', {});
  }

  async getHistoricalDriverData(seasons = []) {
    try {
      const driverDataPromises = seasons.map(season => 
        this.getDriverStandings(season)
      );

      const results = await Promise.allSettled(driverDataPromises);
      
      return {
        seasons: seasons,
        driverData: results.map((result, index) => ({
          season: seasons[index],
          data: result.status === 'fulfilled' ? result.value : null,
          success: result.status === 'fulfilled'
        }))
      };

    } catch (error) {
      return this.createErrorResponse(error, 'getHistoricalDriverData');
    }
  }

  async getHistoricalConstructorData(seasons = []) {
    try {
      const constructorDataPromises = seasons.map(season => 
        this.getConstructorStandings(season)
      );

      const results = await Promise.allSettled(constructorDataPromises);
      
      return {
        seasons: seasons,
        constructorData: results.map((result, index) => ({
          season: seasons[index],
          data: result.status === 'fulfilled' ? result.value : null,
          success: result.status === 'fulfilled'
        }))
      };

    } catch (error) {
      return this.createErrorResponse(error, 'getHistoricalConstructorData');
    }
  }
}

export default {
  F1ToolsBase,
  SeasonTools,
  DriverTools,
  RaceTools,
  ChampionshipTools,
  HistoricalTools
};