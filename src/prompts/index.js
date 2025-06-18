/**
 * F1 LangGraph Agents - Prompts Module
 * 
 * This module provides a centralized prompt management system for F1 LangGraph agents.
 * All agent prompts have been extracted from hardcoded strings into organized, 
 * maintainable files with a unified loading system.
 */

export { promptLoader, PromptLoader } from './prompt-loader.js';

// Re-export individual agent prompts for direct access if needed
export { systemPrompts as seasonAnalysisSystemPrompts } from './agents/season-analysis/system-prompts.js';
export { analysisPrompts as seasonAnalysisPrompts } from './agents/season-analysis/analysis-prompts.js';

export { systemPrompts as driverPerformanceSystemPrompts } from './agents/driver-performance/system-prompts.js';
export { analysisPrompts as driverPerformancePrompts } from './agents/driver-performance/analysis-prompts.js';

export { systemPrompts as raceStrategySystemPrompts } from './agents/race-strategy/system-prompts.js';
export { analysisPrompts as raceStrategyPrompts } from './agents/race-strategy/analysis-prompts.js';

export { systemPrompts as championshipPredictorSystemPrompts } from './agents/championship-predictor/system-prompts.js';
export { analysisPrompts as championshipPredictorPrompts } from './agents/championship-predictor/analysis-prompts.js';

export { systemPrompts as historicalComparisonSystemPrompts } from './agents/historical-comparison/system-prompts.js';
export { analysisPrompts as historicalComparisonPrompts } from './agents/historical-comparison/analysis-prompts.js';

export { systemPrompts as multiAgentOrchestratorSystemPrompts } from './agents/multi-agent-orchestrator/system-prompts.js';
export { analysisPrompts as multiAgentOrchestratorPrompts } from './agents/multi-agent-orchestrator/analysis-prompts.js';

export { responseFormats } from './common/response-formats.js';

/**
 * Quick access to the default prompt loader instance
 */
import { promptLoader } from './prompt-loader.js';
export default promptLoader;