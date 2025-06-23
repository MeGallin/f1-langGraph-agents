/**
 * Modern Season Analysis Agent
 * Uses LangGraph.js v0.2 patterns with streaming, checkpointing, and proper state management
 */

import ModernBaseAgent from './baseAgent.js';
import { SystemMessage } from '@langchain/core/messages';
import logger from '../utils/logger.js';
import { promptLoader } from '../prompts/index.js';

export class ModernSeasonAnalysisAgent extends ModernBaseAgent {
  constructor(options = {}) {
    super('seasonAnalysis', {
      enableStreaming: true,
      enableCheckpointing: true,
      temperature: 0.1,
      ...options
    });

    this.analysisCapabilities = [
      'multi_season_comparison',
      'constructor_performance_tracking',
      'driver_career_analysis',
      'regulation_impact_assessment',
      'statistical_trend_analysis'
    ];
  }

  /**
   * Initialize the Season Analysis Agent
   */
  async initialize(f1Adapter) {
    try {
      this.f1Adapter = f1Adapter;
      
      // Get F1 tools from the adapter
      const f1Tools = f1Adapter.getTools();
      
      // Load system prompt (use executiveAnalyst as main prompt)
      const systemPrompt = await promptLoader.getSystemPrompt('seasonAnalysis', 'executiveAnalyst');
      
      // Initialize base agent
      await super.initialize(f1Tools, systemPrompt);
      
      logger.info('ModernSeasonAnalysisAgent initialized successfully', {
        toolCount: f1Tools.length,
        capabilities: this.analysisCapabilities
      });

      return true;
    } catch (error) {
      logger.error('Failed to initialize ModernSeasonAnalysisAgent', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Analyze F1 season with enhanced capabilities
   */
  async analyzeSeason(query, threadId, userContext = {}) {
    const startTime = Date.now();
    
    try {
      logger.info('Starting season analysis', {
        threadId,
        queryPreview: query.substring(0, 100) + '...'
      });

      // Enhance query with season analysis context
      const enhancedQuery = this.enhanceQueryForSeasonAnalysis(query, userContext);
      
      // Process with modern base agent
      const result = await this.processQuery(enhancedQuery, threadId, userContext);
      
      // Post-process the result for season analysis
      const processedResult = await this.postProcessSeasonAnalysis(result, query);
      
      const duration = Date.now() - startTime;
      
      logger.info('Season analysis completed', {
        threadId,
        duration,
        streaming: result.streaming,
        success: result.success
      });

      return {
        ...processedResult,
        metadata: {
          ...processedResult.metadata,
          analysisType: 'season_analysis',
          capabilities: this.analysisCapabilities,
          duration
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Season analysis failed', {
        threadId,
        error: error.message,
        duration
      });

      throw error;
    }
  }

  /**
   * Enhance query with season analysis specific context
   */
  enhanceQueryForSeasonAnalysis(query, userContext) {
    const analysisContext = `
F1 Season Analysis Context:
- You are a specialized F1 season analysis expert
- You have access to comprehensive F1 data from 1950 to present
- Focus on providing detailed statistical analysis and insights
- Consider constructor performance, driver achievements, and regulatory impacts
- Use data-driven insights to support your analysis

Available Analysis Capabilities:
${this.analysisCapabilities.map(cap => `- ${cap.replace(/_/g, ' ')}`).join('\n')}

User Query: ${query}
`;

    return analysisContext;
  }

  /**
   * Post-process season analysis results
   */
  async postProcessSeasonAnalysis(result, originalQuery) {
    try {
      // Extract key insights from the analysis
      const insights = await this.extractKeyInsights(result.result);
      
      // Identify data sources used
      const dataSources = this.identifyDataSources(result);
      
      // Generate analysis summary
      const summary = await this.generateAnalysisSummary(result.result, insights);

      return {
        ...result,
        analysis: {
          originalQuery,
          keyInsights: insights,
          dataSources,
          summary,
          analysisType: 'season_analysis',
          confidence: this.calculateConfidence(result, insights)
        }
      };
    } catch (error) {
      logger.error('Failed to post-process season analysis', {
        error: error.message
      });
      
      // Return original result if post-processing fails
      return result;
    }
  }

  /**
   * Extract key insights from analysis result
   */
  async extractKeyInsights(analysisText) {
    try {
      const insights = [];
      
      // Look for statistical patterns
      const statisticalPatterns = this.extractStatisticalPatterns(analysisText);
      if (statisticalPatterns.length > 0) {
        insights.push({
          type: 'statistical',
          patterns: statisticalPatterns
        });
      }
      
      // Look for performance trends
      const performanceTrends = this.extractPerformanceTrends(analysisText);
      if (performanceTrends.length > 0) {
        insights.push({
          type: 'performance_trends',
          trends: performanceTrends
        });
      }
      
      // Look for comparative analysis
      const comparisons = this.extractComparativeAnalysis(analysisText);
      if (comparisons.length > 0) {
        insights.push({
          type: 'comparisons',
          comparisons
        });
      }

      return insights;
    } catch (error) {
      logger.error('Failed to extract key insights', { error: error.message });
      return [];
    }
  }

  /**
   * Extract statistical patterns from analysis text
   */
  extractStatisticalPatterns(text) {
    const patterns = [];
    
    // Look for numerical data patterns
    const numberPattern = /(\d+(?:\.\d+)?)\s*(points?|wins?|races?|seasons?|%)/gi;
    const matches = [...text.matchAll(numberPattern)];
    
    matches.forEach(match => {
      patterns.push({
        value: parseFloat(match[1]),
        unit: match[2].toLowerCase(),
        context: text.substring(Math.max(0, match.index - 50), match.index + 50)
      });
    });
    
    return patterns;
  }

  /**
   * Extract performance trends from analysis text
   */
  extractPerformanceTrends(text) {
    const trends = [];
    
    // Look for trend keywords
    const trendKeywords = [
      'improved', 'declined', 'increased', 'decreased', 
      'dominated', 'struggled', 'consistent', 'inconsistent'
    ];
    
    trendKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b.*?(?:\\.|!|\\?|$)`, 'gi');
      const matches = [...text.matchAll(regex)];
      
      matches.forEach(match => {
        trends.push({
          type: keyword,
          description: match[0].trim()
        });
      });
    });
    
    return trends;
  }

  /**
   * Extract comparative analysis from text
   */
  extractComparativeAnalysis(text) {
    const comparisons = [];
    
    // Look for comparison patterns
    const comparisonPatterns = [
      /compared to/gi,
      /versus/gi,
      /better than/gi,
      /worse than/gi,
      /similar to/gi
    ];
    
    comparisonPatterns.forEach(pattern => {
      const matches = [...text.matchAll(pattern)];
      
      matches.forEach(match => {
        const context = text.substring(
          Math.max(0, match.index - 100), 
          Math.min(text.length, match.index + 100)
        );
        
        comparisons.push({
          type: 'comparative',
          context: context.trim()
        });
      });
    });
    
    return comparisons;
  }

  /**
   * Identify data sources used in the analysis
   */
  identifyDataSources(result) {
    const dataSources = [];
    
    // Check if streaming chunks contain tool usage information
    if (result.chunks) {
      result.chunks.forEach(chunk => {
        if (chunk.data && chunk.data.messages) {
          chunk.data.messages.forEach(message => {
            if (message.tool_calls) {
              message.tool_calls.forEach(toolCall => {
                if (toolCall.name && !dataSources.includes(toolCall.name)) {
                  dataSources.push(toolCall.name);
                }
              });
            }
          });
        }
      });
    }
    
    return dataSources;
  }

  /**
   * Generate analysis summary
   */
  async generateAnalysisSummary(analysisText, insights) {
    try {
      const summary = {
        totalInsights: insights.length,
        statisticalInsights: insights.filter(i => i.type === 'statistical').length,
        performanceTrends: insights.filter(i => i.type === 'performance_trends').length,
        comparativeAnalysis: insights.filter(i => i.type === 'comparisons').length,
        textLength: analysisText.length,
        keyPoints: this.extractKeyPoints(analysisText)
      };
      
      return summary;
    } catch (error) {
      logger.error('Failed to generate analysis summary', { error: error.message });
      return { error: 'Failed to generate summary' };
    }
  }

  /**
   * Extract key points from analysis text
   */
  extractKeyPoints(text) {
    const sentences = text.split(/[.!?]+/);
    const keyPoints = [];
    
    // Look for sentences with high information density
    sentences.forEach(sentence => {
      const trimmed = sentence.trim();
      if (trimmed.length > 20 && trimmed.length < 150) {
        // Count F1-specific keywords
        const f1Keywords = [
          'championship', 'wins', 'points', 'pole', 'podium',
          'constructor', 'driver', 'season', 'race', 'qualifying'
        ];
        
        const keywordCount = f1Keywords.reduce((count, keyword) => {
          return count + (trimmed.toLowerCase().includes(keyword) ? 1 : 0);
        }, 0);
        
        if (keywordCount >= 2) {
          keyPoints.push(trimmed);
        }
      }
    });
    
    return keyPoints.slice(0, 5); // Return top 5 key points
  }

  /**
   * Calculate confidence score for the analysis
   */
  calculateConfidence(result, insights) {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence based on insights
    confidence += insights.length * 0.05;
    
    // Increase confidence if analysis is detailed
    if (result.result && result.result.length > 1000) {
      confidence += 0.1;
    }
    
    // Increase confidence if multiple data sources were used
    const dataSources = this.identifyDataSources(result);
    confidence += dataSources.length * 0.05;
    
    // Cap confidence at 0.95
    return Math.min(0.95, confidence);
  }

  /**
   * Get specialized capabilities
   */
  getCapabilities() {
    return {
      agentType: 'seasonAnalysis',
      capabilities: this.analysisCapabilities,
      supportedOperations: [
        'multi_season_comparison',
        'constructor_performance_analysis',
        'driver_career_tracking',
        'statistical_trend_analysis',
        'regulation_impact_assessment'
      ],
      dataSourcesSupported: [
        'seasons_data',
        'race_results',
        'driver_standings',
        'constructor_standings',
        'race_details'
      ]
    };
  }
}

export default ModernSeasonAnalysisAgent;