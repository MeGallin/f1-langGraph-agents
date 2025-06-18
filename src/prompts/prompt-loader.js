/**
 * Prompt Loader Utility
 * Centralized loading and management of agent prompts
 */

import { systemPrompts as seasonSystemPrompts } from './agents/season-analysis/system-prompts.js';
import { analysisPrompts as seasonAnalysisPrompts } from './agents/season-analysis/analysis-prompts.js';

import { systemPrompts as driverSystemPrompts } from './agents/driver-performance/system-prompts.js';
import { analysisPrompts as driverAnalysisPrompts } from './agents/driver-performance/analysis-prompts.js';

import { systemPrompts as strategySystemPrompts } from './agents/race-strategy/system-prompts.js';
import { analysisPrompts as strategyAnalysisPrompts } from './agents/race-strategy/analysis-prompts.js';

import { systemPrompts as championshipSystemPrompts } from './agents/championship-predictor/system-prompts.js';
import { analysisPrompts as championshipAnalysisPrompts } from './agents/championship-predictor/analysis-prompts.js';

import { systemPrompts as historicalSystemPrompts } from './agents/historical-comparison/system-prompts.js';
import { analysisPrompts as historicalAnalysisPrompts } from './agents/historical-comparison/analysis-prompts.js';

import { systemPrompts as orchestratorSystemPrompts } from './agents/multi-agent-orchestrator/system-prompts.js';
import { analysisPrompts as orchestratorAnalysisPrompts } from './agents/multi-agent-orchestrator/analysis-prompts.js';

import { responseFormats } from './common/response-formats.js';

export class PromptLoader {
  constructor() {
    this.prompts = {
      seasonAnalysis: {
        system: seasonSystemPrompts,
        analysis: seasonAnalysisPrompts
      },
      driverPerformance: {
        system: driverSystemPrompts,
        analysis: driverAnalysisPrompts
      },
      raceStrategy: {
        system: strategySystemPrompts,
        analysis: strategyAnalysisPrompts
      },
      championshipPredictor: {
        system: championshipSystemPrompts,
        analysis: championshipAnalysisPrompts
      },
      historicalComparison: {
        system: historicalSystemPrompts,
        analysis: historicalAnalysisPrompts
      },
      multiAgentOrchestrator: {
        system: orchestratorSystemPrompts,
        analysis: orchestratorAnalysisPrompts
      }
    };
    
    this.common = {
      responseFormats
    };
  }

  /**
   * Get system prompt for an agent
   */
  getSystemPrompt(agentType, promptKey) {
    const agentPrompts = this.prompts[agentType];
    if (!agentPrompts || !agentPrompts.system) {
      throw new Error(`No system prompts found for agent: ${agentType}`);
    }
    
    const prompt = agentPrompts.system[promptKey];
    if (!prompt) {
      throw new Error(`No system prompt found for key: ${promptKey} in agent: ${agentType}`);
    }
    
    return prompt;
  }

  /**
   * Get analysis prompt for an agent
   */
  getAnalysisPrompt(agentType, promptKey) {
    const agentPrompts = this.prompts[agentType];
    if (!agentPrompts || !agentPrompts.analysis) {
      throw new Error(`No analysis prompts found for agent: ${agentType}`);
    }
    
    const prompt = agentPrompts.analysis[promptKey];
    if (!prompt) {
      throw new Error(`No analysis prompt found for key: ${promptKey} in agent: ${agentType}`);
    }
    
    return prompt;
  }

  /**
   * Get formatted analysis prompt with variables replaced
   */
  getFormattedAnalysisPrompt(agentType, promptKey, variables = {}) {
    let prompt = this.getAnalysisPrompt(agentType, promptKey);
    
    // Replace template variables
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      const replacement = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
      prompt = prompt.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), replacement);
    });
    
    return prompt;
  }

  /**
   * Get common response format
   */
  getResponseFormat(formatKey) {
    const format = this.common.responseFormats[formatKey];
    if (!format) {
      throw new Error(`No response format found for key: ${formatKey}`);
    }
    return format;
  }

  /**
   * List available prompts for an agent
   */
  listPrompts(agentType) {
    const agentPrompts = this.prompts[agentType];
    if (!agentPrompts) {
      throw new Error(`No prompts found for agent: ${agentType}`);
    }
    
    return {
      system: Object.keys(agentPrompts.system || {}),
      analysis: Object.keys(agentPrompts.analysis || {})
    };
  }

  /**
   * List all available agents
   */
  listAgents() {
    return Object.keys(this.prompts);
  }
}

// Export singleton instance
export const promptLoader = new PromptLoader();

export default promptLoader;