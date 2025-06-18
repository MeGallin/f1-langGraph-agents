# F1 LangGraph Agents - Prompts

This directory contains all prompts used by the F1 LangGraph agents, extracted from hardcoded strings into organized, maintainable files.

## Directory Structure

```
prompts/
├── agents/                           # Agent-specific prompts
│   ├── season-analysis/             # Season Analysis Agent prompts
│   │   ├── system-prompts.js        # Role definitions and expertise
│   │   └── analysis-prompts.js      # Analysis templates
│   ├── driver-performance/          # Driver Performance Agent prompts
│   ├── race-strategy/              # Race Strategy Agent prompts
│   ├── championship-predictor/     # Championship Predictor Agent prompts
│   ├── historical-comparison/      # Historical Comparison Agent prompts
│   └── multi-agent-orchestrator/  # Multi-Agent Orchestrator prompts
├── common/                         # Shared prompt utilities
│   └── response-formats.js        # Common response format templates
├── prompt-loader.js               # Centralized prompt loading utility
├── index.js                      # Main exports
└── README.md                     # This file
```

## Usage

### Basic Usage with Prompt Loader

```javascript
import { promptLoader } from './prompts/prompt-loader.js';

// Get a system prompt
const systemPrompt = promptLoader.getSystemPrompt('seasonAnalysis', 'queryAnalyzer');

// Get a formatted analysis prompt with variables
const analysisPrompt = promptLoader.getFormattedAnalysisPrompt('seasonAnalysis', 'queryAnalysis', {
  query: 'What happened in the 2024 F1 season?'
});

// Use in agent
const response = await this.model.invoke([
  new SystemMessage(systemPrompt),
  new HumanMessage(analysisPrompt)
]);
```

### Direct Import

```javascript
import { seasonAnalysisSystemPrompts } from './prompts/index.js';

const prompt = seasonAnalysisSystemPrompts.queryAnalyzer;
```

## Prompt Categories

### System Prompts
Define agent roles, expertise, and behavioral characteristics:
- **Query Analyzer**: Extract structured information from F1 queries
- **Technical Analyst**: Constructor performance and F1 history knowledge
- **Historian**: Long-term trends and pattern identification
- **Executive Analyst**: Stakeholder insights and analysis
- **Response Creator**: Comprehensive and accessible query responses

### Analysis Prompts
Template-driven prompts for specific analytical tasks:
- **Query Analysis**: Entity extraction and analysis type determination
- **Performance Analysis**: Driver/constructor performance evaluation
- **Strategic Analysis**: Race strategy and tactical decisions
- **Predictive Analysis**: Championship probability and scenario modeling
- **Historical Analysis**: Cross-era comparisons and trend analysis
- **Synthesis**: Multi-agent result integration

## Template Variables

Analysis prompts support variable substitution using `{variableName}` syntax:

```javascript
const prompt = promptLoader.getFormattedAnalysisPrompt('seasonAnalysis', 'constructorAnalysis', {
  season: '2024',
  constructorData: {...},
  standings: [...]
});
```

## Available Agents

1. **seasonAnalysis** - Multi-season analysis, constructor tracking, trend analysis
2. **driverPerformance** - Career analysis, head-to-head comparisons, circuit performance
3. **raceStrategy** - Circuit analysis, strategy recommendations, weather impact
4. **championshipPredictor** - Probability calculations, scenario modeling, predictive analysis
5. **historicalComparison** - Cross-era comparisons, regulation impact analysis
6. **multiAgentOrchestrator** - Query routing and result synthesis

## Benefits

✅ **Maintainability**: Prompts separated from code logic
✅ **Consistency**: Standardized prompt formats across agents
✅ **Reusability**: Common patterns and templates
✅ **Version Control**: Track prompt changes independently
✅ **Testing**: Easier prompt testing and iteration
✅ **Flexibility**: Support for template variables and dynamic content

## Adding New Prompts

1. Create prompt file in appropriate agent directory
2. Add to prompt-loader.js imports and prompts object
3. Update index.js exports if needed
4. Use promptLoader in agent code

## Migration Status

✅ Season Analysis Agent - Fully migrated
🔄 Driver Performance Agent - Partially migrated
🔄 Race Strategy Agent - Pending
🔄 Championship Predictor Agent - Pending
🔄 Historical Comparison Agent - Pending
🔄 Multi-Agent Orchestrator - Pending