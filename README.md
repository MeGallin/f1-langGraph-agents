# F1 LangGraph Agents

Intelligent F1 Racing Analysis powered by LangGraph and Model Context Protocol (MCP).

## 🏁 Overview

This service provides specialized AI agents for comprehensive Formula 1 racing analysis. Built on LangGraph's powerful workflow orchestration and integrated with our F1 MCP ecosystem, it delivers expert-level insights and analysis.

## 🚀 Features

### 🤖 Specialized Agents

- **Season Analysis Agent**: Comprehensive season statistics and insights
- **Driver Performance Agent**: Individual driver career and performance analysis _(coming soon)_
- **Race Strategy Agent**: Race-specific analysis and strategic insights _(coming soon)_
- **Championship Predictor Agent**: Predictive analysis for championship outcomes _(coming soon)_
- **Historical Comparison Agent**: Deep historical analysis and era comparisons _(coming soon)_

### 🔧 Technical Features

- **LangGraph Workflows**: Advanced multi-step reasoning and analysis
- **MCP Integration**: Direct connection to F1 data via Model Context Protocol
- **Real-time Analysis**: Live data processing and insights generation
- **RESTful API**: Easy integration with other applications
- **Docker Support**: Containerized deployment ready
- **Comprehensive Logging**: Full observability and monitoring

## 📋 Prerequisites

- Node.js 18+
- Access to F1 MCP Server (https://f1-mcp-server-5dh3.onrender.com)
- OpenAI API key
- Environment variables configured

## 🛠️ Installation

### Local Development

```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit .env with your API keys
nano .env

# Start development server
npm run dev
```

### Docker

```bash
# Build the image
npm run docker:build

# Run the container
npm run docker:run
```

## 🔧 Configuration

### Environment Variables

```bash
# Service Configuration
NODE_ENV=development
PORT=3000
SERVICE_NAME=f1-langgraph-agents

# F1 MCP System Integration
F1_MCP_SERVER_URL=https://f1-mcp-server-5dh3.onrender.com
F1_API_PROXY_URL=https://f1-api-proxy.onrender.com

# AI Model Configuration
OPENAI_API_KEY=your_openai_api_key_here

# LangGraph Configuration
LANGGRAPH_API_KEY=your_langgraph_api_key_here
LANGSMITH_API_KEY=your_langsmith_api_key_here
LANGSMITH_TRACING=true
LANGSMITH_PROJECT=F1-MCP-LangGraph-Agents

# Agent Configuration
DEFAULT_MODEL=gpt-4o
DEFAULT_TEMPERATURE=0.1
MAX_ITERATIONS=10
AGENT_TIMEOUT=30000
```

## 🔌 API Usage

### Health Check

```bash
GET /health
```

```json
{
  "status": "ok",
  "timestamp": "2025-06-10T10:30:00.000Z",
  "service": "f1-langgraph-agents",
  "version": "1.0.0",
  "agents": {
    "seasonAnalysis": true
  }
}
```

### Available Agents

```bash
GET /agents
```

```json
{
  "available": ["seasonAnalysis"],
  "details": {
    "seasonAnalysis": {
      "name": "Season Analysis Agent",
      "description": "Specialized F1 agent for comprehensive season analysis",
      "capabilities": [
        "Single season analysis",
        "Multi-season comparisons",
        "Constructor performance analysis"
      ],
      "initialized": true
    }
  }
}
```

### Season Analysis

```bash
POST /agents/season/analyze
Content-Type: application/json

{
  "query": "Analyze the 2023 F1 season performance",
  "options": {
    "threadId": "optional_thread_id"
  }
}
```

**Response:**

```json
{
  "success": true,
  "query": "Analyze the 2023 F1 season performance",
  "result": {
    "finalResponse": "The 2023 F1 season was dominated by Red Bull Racing...",
    "confidence": 0.95,
    "analysisType": "single_season",
    "seasons": [2023],
    "insights": ["Red Bull achieved unprecedented dominance..."],
    "completedAt": "2025-06-10T10:35:00.000Z"
  }
}
```

## 📚 Examples

### Programmatic Usage

```javascript
import SeasonAnalysisAgent from './src/agents/seasonAnalysisAgent.js';

// Initialize agent
const agent = new SeasonAnalysisAgent();
await agent.initialize();

// Analyze a season
const result = await agent.analyze(
  'How competitive was the 2023 championship?',
);

console.log(result.finalResponse);
console.log(`Confidence: ${result.confidence}`);
```

### API Usage with fetch

```javascript
const response = await fetch('http://localhost:3000/agents/season/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "Compare Red Bull's 2023 dominance to Mercedes' 2014-2016 era",
    options: { threadId: 'comparison_analysis' },
  }),
});

const analysis = await response.json();
console.log(analysis.result.finalResponse);
```

### cURL Examples

```bash
# Health check
curl http://localhost:3000/health

# Season analysis
curl -X POST http://localhost:3000/agents/season/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What made the 2023 F1 season exciting?",
    "options": {"threadId": "example"}
  }'
```

## 🧪 Running Examples

```bash
# Run interactive examples
node examples/seasonAnalysis.js

# Test API endpoints (server must be running)
node examples/seasonAnalysis.js --api
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run linting
npm run lint
```

## 📊 System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│  User Query     │───▶│  LangGraph      │───▶│  F1 MCP Server  │
│                 │    │  Agents         │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                         │
                              │                         │
                              ▼                         ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │                 │    │                 │
                       │  AI Analysis    │    │  F1 API Proxy   │
                       │  & Insights     │    │                 │
                       │                 │    │                 │
                       └─────────────────┘    └─────────────────┘
                              │                         │
                              │                         │
                              ▼                         ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │                 │    │                 │
                       │  Comprehensive  │    │  Jolpica F1 API │
                       │  F1 Response    │    │                 │
                       │                 │    │                 │
                       └─────────────────┘    └─────────────────┘
```

## 🤖 Agent Workflows

### Season Analysis Workflow

1. **Query Analysis**: Parse and understand the user's F1 query
2. **Data Fetching**: Retrieve relevant F1 data via MCP tools
3. **Analysis Routing**: Route to appropriate analysis type (single/multi-season)
4. **Expert Analysis**: Apply AI analysis for insights and patterns
5. **Synthesis**: Generate comprehensive, expert-level response

## 🔗 Integration with F1 MCP Ecosystem

- **F1 API Proxy**: `https://f1-api-proxy.onrender.com`
- **F1 MCP Server**: `https://f1-mcp-server-5dh3.onrender.com`
- **Data Coverage**: 76 F1 seasons (1950-2025) with complete racing data

## 🚀 Deployment

### Local Development

```bash
npm run dev
```

### Production Deployment

```bash
# Build and run with Docker
npm run docker:build
npm run docker:run

# Or deploy to cloud platform
# Configure environment variables for production
```

### Environment-Specific Configs

- **Development**: Hot reloading, verbose logging
- **Production**: Optimized performance, structured logging

## 📝 Logging

Comprehensive logging with Winston:

- **Request/Response logging**: All API interactions
- **Agent execution logging**: Workflow steps and performance
- **Error tracking**: Detailed error context and stack traces
- **Performance monitoring**: Execution times and resource usage

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Issues**: Create GitHub issues for bugs or feature requests
- **Documentation**: See `/docs` for detailed documentation
- **Examples**: Check `/examples` for usage patterns

## 🔮 Roadmap

- [ ] **Driver Performance Agent**: Individual driver analysis
- [ ] **Race Strategy Agent**: Race-specific insights
- [ ] **Championship Predictor**: Predictive modeling
- [ ] **Historical Comparison Agent**: Cross-era analysis
- [ ] **Multi-Agent Orchestrator**: Complex query coordination
- [ ] **Real-time Data Integration**: Live race analysis
- [ ] **Advanced Visualizations**: Charts and graphs
- [ ] **Natural Language Interface**: Conversational AI

---

**Built with ❤️ for F1 fans and data enthusiasts**
