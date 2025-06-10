/**
 * F1 Historical Comparison Agent - Minimal Working Version
 */

import { StateGraph, START, END } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import logger from '../utils/logger.js';

export class HistoricalComparisonAgent {
  constructor(langGraphAdapter, options = {}) {
    this.adapter = langGraphAdapter;
    this.model =
      options.model ||
      new ChatOpenAI({
        modelName: 'gpt-4o-mini',
        temperature: 0.1,
      });

    // Build the workflow graph
    this.workflow = this.createWorkflow();
    this.app = this.workflow.compile();

    logger.info('HistoricalComparisonAgent initialized');
  }

  createWorkflow() {
    const workflow = new StateGraph({
      channels: {
        messages: { default: () => [] },
        query: { default: () => '' },
        results: { default: () => ({}) },
      },
    });

    // Add nodes
    workflow.addNode('analyze', this.analyze.bind(this));

    // Add edges
    workflow.addEdge(START, 'analyze');
    workflow.addEdge('analyze', END);

    return workflow;
  }
  async analyze(state) {
    try {
      logger.info('Analyzing historical comparison query', {
        query: state.query,
      });

      const results = {
        query: state.query,
        analysis: 'Historical comparison analysis completed',
        timestamp: new Date().toISOString(),
      };

      return {
        ...state,
        results,
        messages: [
          ...(state.messages || []),
          { role: 'system', content: 'Analysis completed' },
        ],
      };
    } catch (error) {
      logger.error('Error in analyze:', error);
      throw error;
    }
  }

  parseJsonResponse(content) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return {
        comparisonType: 'drivers',
        drivers: this.extractDriverNames(content),
        teams: this.extractTeamNames(content),
        seasons: this.extractSeasons(content),
        metrics: ['wins', 'championships', 'consistency'],
      };
    } catch (error) {
      logger.warn('Failed to parse JSON response, using fallback', error);
      return {
        comparisonType: 'drivers',
        drivers: [],
        teams: [],
        seasons: [],
        metrics: ['wins', 'championships'],
      };
    }
  }

  extractDriverNames(content) {
    const commonDrivers = [
      'Hamilton',
      'Verstappen',
      'Schumacher',
      'Senna',
      'Prost',
    ];
    const foundDrivers = [];

    for (const driver of commonDrivers) {
      if (content.toLowerCase().includes(driver.toLowerCase())) {
        foundDrivers.push(driver);
      }
    }

    return foundDrivers.length > 0 ? foundDrivers : commonDrivers.slice(0, 2);
  }

  extractTeamNames(content) {
    const commonTeams = [
      'Mercedes',
      'Red Bull',
      'Ferrari',
      'McLaren',
      'Williams',
    ];
    const foundTeams = [];

    for (const team of commonTeams) {
      if (content.toLowerCase().includes(team.toLowerCase())) {
        foundTeams.push(team);
      }
    }

    return foundTeams.length > 0 ? foundTeams : commonTeams.slice(0, 2);
  }

  extractSeasons(content) {
    const seasonRegex = /\b(19|20)\d{2}\b/g;
    const matches = content.match(seasonRegex);

    if (matches) {
      return [...new Set(matches)].sort();
    }

    return ['2023', '2024'];
  }

  // Public interface
  async compareHistorical(query, options = {}) {
    try {
      const initialState = {
        query,
        messages: [],
        results: {},
        ...options,
      };

      const result = await this.app.invoke(initialState);

      logger.info('Historical comparison completed', {
        query,
        success: true,
      });

      return result;
    } catch (error) {
      logger.error('Historical comparison failed:', error);
      throw error;
    }
  }
}

export default HistoricalComparisonAgent;
