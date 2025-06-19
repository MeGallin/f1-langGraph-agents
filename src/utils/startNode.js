/**
 * F1 StartNode Implementation
 * Initializes and validates F1 query processing workflow
 */

import F1GraphState from './graphState.js';
import logger from './logger.js';

export class F1StartNode {
  constructor() {
    this.logger = logger;
  }

  /**
   * Process incoming query and initialize workflow state
   */
  async process(query, threadId, userContext = {}) {
    try {
      // Input validation and sanitization
      const sanitizedQuery = this.sanitizeInput(query);
      const validatedThreadId = threadId || this.generateThreadId();
      
      // Initialize F1GraphState
      const state = new F1GraphState({
        query: sanitizedQuery,
        threadId: validatedThreadId,
        userContext: this.sanitizeUserContext(userContext),
        metadata: {
          timestamp: new Date(),
          processingTime: 0,
          apiCalls: 0,
          nodeSequence: ['start']
        }
      });

      // Validate the initialized state
      const validation = state.validate();
      if (!validation.isValid) {
        throw new Error(`State validation failed: ${validation.issues.join(', ')}`);
      }

      this.logger.info('StartNode: F1 query initialized', {
        threadId: validatedThreadId,
        queryLength: sanitizedQuery.length,
        hasUserContext: Object.keys(userContext).length > 0
      });

      return state;

    } catch (error) {
      this.logger.error('StartNode: Failed to initialize query', {
        query,
        threadId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Sanitize and validate input query
   */
  sanitizeInput(query) {
    if (!query || typeof query !== 'string') {
      throw new Error('Query must be a non-empty string');
    }

    // Basic sanitization
    const sanitized = query.trim();
    
    if (sanitized.length === 0) {
      throw new Error('Query cannot be empty');
    }

    if (sanitized.length > 2000) {
      throw new Error('Query too long (max 2000 characters)');
    }

    // Remove potentially harmful characters
    const cleaned = sanitized.replace(/[<>]/g, '');
    
    return cleaned;
  }

  /**
   * Generate unique thread ID for conversation tracking
   */
  generateThreadId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `f1_${timestamp}_${random}`;
  }

  /**
   * Sanitize user context object
   */
  sanitizeUserContext(userContext) {
    if (!userContext || typeof userContext !== 'object') {
      return {};
    }

    const sanitized = {};
    const allowedKeys = [
      'previousQueries',
      'favoriteDrivers', 
      'favoriteTeams',
      'preferredSeason',
      'analysisPreferences',
      'sessionId'
    ];

    // Only include allowed keys and sanitize values
    for (const key of allowedKeys) {
      if (userContext[key] !== undefined) {
        if (typeof userContext[key] === 'string') {
          sanitized[key] = userContext[key].substring(0, 500); // Limit string length
        } else if (Array.isArray(userContext[key])) {
          sanitized[key] = userContext[key].slice(0, 10); // Limit array length
        } else if (typeof userContext[key] === 'object' && userContext[key] !== null) {
          sanitized[key] = this.sanitizeObject(userContext[key]);
        } else {
          sanitized[key] = userContext[key];
        }
      }
    }

    return sanitized;
  }

  /**
   * Recursively sanitize nested objects
   */
  sanitizeObject(obj, depth = 0) {
    if (depth > 3) return {}; // Prevent deep nesting

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = value.substring(0, 200);
      } else if (typeof value === 'number' && isFinite(value)) {
        sanitized[key] = value;
      } else if (typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (Array.isArray(value)) {
        sanitized[key] = value.slice(0, 5);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value, depth + 1);
      }
    }
    return sanitized;
  }

  /**
   * Detect query type for initial routing hints
   */
  detectQueryType(query) {
    const lowerQuery = query.toLowerCase();
    
    // F1-specific query type detection
    if (lowerQuery.includes('season') || lowerQuery.includes('championship')) {
      return 'season_analysis';
    }
    
    if (lowerQuery.includes('driver') || this.containsDriverName(lowerQuery)) {
      return 'driver_performance';
    }
    
    if (lowerQuery.includes('race') || lowerQuery.includes('circuit') || lowerQuery.includes('strategy')) {
      return 'race_strategy';
    }
    
    if (lowerQuery.includes('predict') || lowerQuery.includes('forecast') || lowerQuery.includes('winner')) {
      return 'championship_prediction';
    }
    
    if (lowerQuery.includes('compare') || lowerQuery.includes('historical') || lowerQuery.includes('era')) {
      return 'historical_comparison';
    }
    
    return 'general_f1';
  }

  /**
   * Check if query contains known F1 driver names
   */
  containsDriverName(query) {
    const commonDrivers = [
      'hamilton', 'verstappen', 'leclerc', 'russell', 'sainz',
      'norris', 'piastri', 'alonso', 'schumacher', 'senna',
      'prost', 'vettel', 'ricciardo', 'gasly', 'ocon'
    ];
    
    return commonDrivers.some(driver => query.includes(driver));
  }

  /**
   * Extract initial entities from query for routing optimization
   */
  extractInitialEntities(query) {
    const entities = {
      drivers: [],
      teams: [],
      seasons: [],
      races: []
    };

    // Extract years (potential seasons)
    const yearMatches = query.match(/\b(19|20)\d{2}\b/g);
    if (yearMatches) {
      entities.seasons = [...new Set(yearMatches)];
    }

    // Extract known driver names
    const driverNames = [
      'Hamilton', 'Verstappen', 'Leclerc', 'Russell', 'Sainz',
      'Norris', 'Piastri', 'Alonso', 'Schumacher', 'Senna', 'Prost'
    ];
    
    entities.drivers = driverNames.filter(driver => 
      query.toLowerCase().includes(driver.toLowerCase())
    );

    // Extract team names
    const teamNames = [
      'Mercedes', 'Red Bull', 'Ferrari', 'McLaren', 'Alpine',
      'Aston Martin', 'Williams', 'AlphaTauri', 'Alfa Romeo', 'Haas'
    ];
    
    entities.teams = teamNames.filter(team => 
      query.toLowerCase().includes(team.toLowerCase())
    );

    // Extract race/circuit names
    const raceNames = [
      'Monaco', 'Silverstone', 'Monza', 'Spa', 'Suzuka',
      'Interlagos', 'Abu Dhabi', 'Bahrain', 'Australia', 'Imola'
    ];
    
    entities.races = raceNames.filter(race => 
      query.toLowerCase().includes(race.toLowerCase())
    );

    return entities;
  }

  /**
   * Enhanced process method with entity extraction and type detection
   */
  async processWithAnalysis(query, threadId, userContext = {}) {
    const baseState = await this.process(query, threadId, userContext);
    
    // Add initial analysis
    const queryType = this.detectQueryType(query);
    const entities = this.extractInitialEntities(query);
    
    return baseState.updateState({
      metadata: {
        ...baseState.state.metadata,
        initialQueryType: queryType,
        extractedEntities: entities,
        nodeSequence: ['start', 'analyzed']
      }
    });
  }
}

export default F1StartNode;