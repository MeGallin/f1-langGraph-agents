/**
 * F1 Router Agent
 * Intelligent query routing for F1 specialized agents
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import logger from '../utils/logger.js';
import { promptLoader } from '../prompts/prompt-loader.js';

export class F1RouterAgent {
  constructor(llm, options = {}) {
    this.llm = llm || new ChatOpenAI({
      modelName: 'gpt-4o',
      temperature: 0, // Deterministic routing decisions
    });
    
    this.timeout = options.timeout || 10000; // 10 second timeout
    this.logger = logger;
    
    // Agent routing preferences
    this.agentPreferences = {
      'season': {
        keywords: ['season', 'championship', 'standings', 'constructor', 'team', 'points'],
        confidence: 0.9
      },
      'driver': {
        keywords: ['driver', 'hamilton', 'verstappen', 'leclerc', 'russell', 'performance', 'career'],
        confidence: 0.9
      },
      'race': {
        keywords: ['race', 'circuit', 'strategy', 'qualifying', 'lap', 'monaco', 'silverstone'],
        confidence: 0.85
      },
      'championship': {
        keywords: ['predict', 'forecast', 'winner', 'champion', 'probability', 'outcome'],
        confidence: 0.8
      },
      'historical': {
        keywords: ['compare', 'historical', 'era', 'legacy', 'evolution', 'schumacher', 'senna'],
        confidence: 0.8
      }
    };
  }

  /**
   * Route query to appropriate specialized agent
   */
  async route(state) {
    const startTime = Date.now();
    
    try {
      this.logger.info('RouterAgent: Analyzing query for routing', {
        query: state.state.query,
        threadId: state.state.threadId
      });

      // Multi-tier routing decision
      const routingDecision = await this.analyzeQuery(state.state.query, state.state.userContext);
      
      // Update state with routing decision and processing metadata
      const updatedState = state
        .addNodeToSequence('router')
        .updateState({
          selectedAgent: routingDecision.agent,
          confidence: routingDecision.confidence,
          metadata: {
            ...state.state.metadata,
            routingReason: routingDecision.reason,
            alternativeAgents: routingDecision.alternatives || []
          }
        })
        .updateProcessingTime(startTime);

      this.logger.info('RouterAgent: Routing completed', {
        selectedAgent: routingDecision.agent,
        confidence: routingDecision.confidence,
        reason: routingDecision.reason
      });

      return updatedState;

    } catch (error) {
      this.logger.error('RouterAgent: Routing failed', {
        error: error.message,
        query: state.state.query
      });

      // Fallback routing
      return this.handleRoutingError(state, error, startTime);
    }
  }

  /**
   * Multi-tier query analysis for agent routing
   */
  async analyzeQuery(query, userContext = {}) {
    // 1. Explicit agent mentions (95% confidence)
    const explicitRouting = this.detectExplicitAgent(query);
    if (explicitRouting.confidence > 0.9) {
      return explicitRouting;
    }

    // 2. Keyword-based routing with preferences (70-90% confidence)
    const keywordRouting = this.routeByKeywords(query);
    if (keywordRouting.confidence > 0.7) {
      return keywordRouting;
    }

    // 3. User context and history routing (50-80% confidence)
    const contextRouting = this.routeByContext(query, userContext);
    if (contextRouting.confidence > 0.5) {
      return contextRouting;
    }

    // 4. LLM-powered contextual analysis (30-70% confidence)
    const llmRouting = await this.llmAnalysis(query, userContext);
    if (llmRouting.confidence > 0.3) {
      return llmRouting;
    }

    // 5. Fallback to season analysis (10% confidence)
    return {
      agent: 'season',
      confidence: 0.1,
      reason: 'Fallback routing - no clear agent match',
      alternatives: ['driver', 'race']
    };
  }

  /**
   * Detect explicit agent mentions in query
   */
  detectExplicitAgent(query) {
    const lowerQuery = query.toLowerCase();
    
    const explicitMentions = {
      'season': ['season analysis', 'championship analysis', 'constructor analysis'],
      'driver': ['driver analysis', 'driver performance', 'driver comparison'],
      'race': ['race analysis', 'race strategy', 'circuit analysis'],
      'championship': ['championship prediction', 'title prediction', 'championship forecast'],
      'historical': ['historical analysis', 'historical comparison', 'era comparison']
    };

    for (const [agent, mentions] of Object.entries(explicitMentions)) {
      if (mentions.some(mention => lowerQuery.includes(mention))) {
        return {
          agent,
          confidence: 0.95,
          reason: `Explicit mention of ${agent} analysis`,
          alternatives: []
        };
      }
    }

    return { agent: null, confidence: 0 };
  }

  /**
   * Keyword-based routing with scoring
   */
  routeByKeywords(query) {
    const lowerQuery = query.toLowerCase();
    const scores = {};

    // Score each agent based on keyword matches
    for (const [agent, config] of Object.entries(this.agentPreferences)) {
      let score = 0;
      let matchedKeywords = [];

      for (const keyword of config.keywords) {
        if (lowerQuery.includes(keyword)) {
          score += 1;
          matchedKeywords.push(keyword);
        }
      }

      if (score > 0) {
        // Calculate confidence based on keyword density and agent base confidence
        const keywordDensity = score / config.keywords.length;
        const confidence = Math.min(config.confidence, keywordDensity * 0.8 + 0.2);
        
        scores[agent] = {
          score,
          confidence,
          matchedKeywords,
          reason: `Keyword match: ${matchedKeywords.join(', ')}`
        };
      }
    }

    // Return best scoring agent
    if (Object.keys(scores).length > 0) {
      const bestAgent = Object.entries(scores)
        .sort(([,a], [,b]) => b.confidence - a.confidence)[0];
      
      const [agent, data] = bestAgent;
      const alternatives = Object.keys(scores)
        .filter(a => a !== agent)
        .slice(0, 2);

      return {
        agent,
        confidence: data.confidence,
        reason: data.reason,
        alternatives
      };
    }

    return { agent: null, confidence: 0 };
  }

  /**
   * Route based on user context and preferences
   */
  routeByContext(query, userContext) {
    if (!userContext || Object.keys(userContext).length === 0) {
      return { agent: null, confidence: 0 };
    }

    let bestAgent = null;
    let confidence = 0;
    let reason = '';

    // Check for analysis preferences
    if (userContext.analysisPreferences) {
      const prefs = userContext.analysisPreferences;
      if (prefs.favoriteAnalysisType && this.agentPreferences[prefs.favoriteAnalysisType]) {
        bestAgent = prefs.favoriteAnalysisType;
        confidence = 0.6;
        reason = 'User analysis preference';
      }
    }

    // Check for favorite drivers (suggests driver analysis)
    if (userContext.favoriteDrivers && userContext.favoriteDrivers.length > 0) {
      const driverMentioned = userContext.favoriteDrivers.some(driver =>
        query.toLowerCase().includes(driver.toLowerCase())
      );
      
      if (driverMentioned && confidence < 0.7) {
        bestAgent = 'driver';
        confidence = 0.7;
        reason = 'Query mentions user\'s favorite driver';
      }
    }

    // Check for favorite teams (suggests season/constructor analysis)
    if (userContext.favoriteTeams && userContext.favoriteTeams.length > 0) {
      const teamMentioned = userContext.favoriteTeams.some(team =>
        query.toLowerCase().includes(team.toLowerCase())
      );
      
      if (teamMentioned && confidence < 0.6) {
        bestAgent = 'season';
        confidence = 0.6;
        reason = 'Query mentions user\'s favorite team';
      }
    }

    return bestAgent ? {
      agent: bestAgent,
      confidence,
      reason,
      alternatives: []
    } : { agent: null, confidence: 0 };
  }

  /**
   * LLM-powered contextual analysis for complex queries
   */
  async llmAnalysis(query, userContext) {
    try {
      const systemPrompt = `You are an F1 query router. Analyze the query and determine which specialized agent should handle it.

Available agents:
- season: Season/championship analysis, constructor performance, standings
- driver: Individual driver performance, career analysis, comparisons  
- race: Race strategy, circuit analysis, qualifying, race-specific insights
- championship: Championship predictions, probability calculations, forecasts
- historical: Cross-era comparisons, historical data, legacy analysis

Respond with JSON: {"agent": "agent_name", "confidence": 0.0-1.0, "reason": "explanation"}`;

      const analysisPrompt = `Query: "${query}"
      
User Context: ${JSON.stringify(userContext, null, 2)}

Which agent should handle this query?`;

      const response = await Promise.race([
        this.llm.invoke([
          new SystemMessage(systemPrompt),
          new HumanMessage(analysisPrompt)
        ]),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('LLM analysis timeout')), this.timeout)
        )
      ]);

      const result = this.parseJsonResponse(response.content);
      
      // Validate and return result
      if (result.agent && this.agentPreferences[result.agent]) {
        return {
          agent: result.agent,
          confidence: Math.min(Math.max(result.confidence || 0.5, 0), 1),
          reason: result.reason || 'LLM contextual analysis',
          alternatives: []
        };
      }

    } catch (error) {
      this.logger.warn('RouterAgent: LLM analysis failed', {
        error: error.message,
        query
      });
    }

    return { agent: null, confidence: 0 };
  }

  /**
   * Handle routing errors with fallback logic
   */
  handleRoutingError(state, error, startTime) {
    this.logger.warn('RouterAgent: Using fallback routing due to error', {
      error: error.message,
      query: state.state.query
    });

    // Simple fallback based on query content
    const query = state.state.query.toLowerCase();
    let fallbackAgent = 'season'; // Default fallback

    if (query.includes('driver') || query.includes('hamilton') || query.includes('verstappen')) {
      fallbackAgent = 'driver';
    } else if (query.includes('race') || query.includes('strategy')) {
      fallbackAgent = 'race';
    } else if (query.includes('predict') || query.includes('championship')) {
      fallbackAgent = 'championship';
    } else if (query.includes('historical') || query.includes('compare')) {
      fallbackAgent = 'historical';
    }

    return state
      .addNodeToSequence('router')
      .updateState({
        selectedAgent: fallbackAgent,
        confidence: 0.3,
        error: {
          message: `Routing error: ${error.message}`,
          fallbackUsed: true
        }
      })
      .updateProcessingTime(startTime);
  }

  /**
   * Parse JSON response from LLM
   */
  parseJsonResponse(content) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {};
    } catch (error) {
      this.logger.warn('RouterAgent: Failed to parse LLM JSON response', {
        content,
        error: error.message
      });
      return {};
    }
  }

  /**
   * Get routing statistics and health information
   */
  getRoutingStats() {
    return {
      availableAgents: Object.keys(this.agentPreferences),
      defaultAgent: 'season',
      routingMethods: [
        'explicit_mentions',
        'keyword_matching', 
        'user_context',
        'llm_analysis',
        'fallback'
      ],
      timeout: this.timeout
    };
  }

  /**
   * Validate routing decision
   */
  validateRoutingDecision(decision) {
    if (!decision.agent || !this.agentPreferences[decision.agent]) {
      return false;
    }
    
    if (decision.confidence < 0 || decision.confidence > 1) {
      return false;
    }
    
    return true;
  }
}

export default F1RouterAgent;