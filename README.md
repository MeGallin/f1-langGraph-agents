# F1 LangGraph Agents - Modern Architecture 🏎️

## Overview

The **Modern F1 LangGraph Agents** is a completely redesigned and modernized version of the F1 racing intelligence system, built using the latest LangGraph.js v0.2 patterns, official MCP SDK, and cutting-edge Node.js/Express architecture. This system transforms static F1 data access into intelligent, autonomous agentic workflows with real-time streaming, comprehensive state management, and production-ready deployment capabilities.

## 🚀 Key Improvements in Modern Architecture

### LangGraph.js v0.2 Integration
- **Streaming Support**: Real-time response streaming with multiple modes
- **Built-in Checkpointing**: State persistence and recovery capabilities  
- **Human-in-the-Loop**: Interactive approval workflows for sensitive operations
- **Parallel Node Processing**: Concurrent agent execution for improved performance
- **Enhanced Error Handling**: Retry policies and graceful degradation

### Official MCP SDK Integration
- **Standards Compliance**: Uses `@modelcontextprotocol/sdk` for proper protocol implementation
- **Multiple Transports**: Support for both stdio and HTTP/SSE connections
- **Tool Validation**: Automatic schema validation and type safety
- **Connection Management**: Robust error handling and automatic reconnection

### Modern Express Architecture
- **Comprehensive Middleware**: Rate limiting, compression, security headers, timeout handling
- **Streaming Endpoints**: Server-Sent Events (SSE) for real-time updates
- **Health Monitoring**: Detailed health checks and system metrics
- **Error Boundaries**: Graceful error handling with proper HTTP status codes

### Advanced State Management
- **Persistent State**: SQLite-based checkpointing with automatic cleanup
- **Thread Management**: Multi-conversation support with isolation
- **Analytics**: Comprehensive usage tracking and performance metrics
- **Memory Management**: Configurable retention policies and cleanup

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Modern F1 LangGraph Application              │
├─────────────────────────────────────────────────────────────────┤
│  Express Server (modernServer.js)                              │
│  ├── Streaming Handler (SSE/WebSocket)                         │
│  ├── Rate Limiting & Security                                  │
│  ├── Compression & Caching                                     │
│  └── Health Monitoring                                         │
├─────────────────────────────────────────────────────────────────┤
│  Application Orchestrator (modernApp.js)                      │
│  ├── Workflow Graph (LangGraph v0.2)                          │
│  ├── State Manager                                             │
│  └── Agent Router                                              │
├─────────────────────────────────────────────────────────────────┤
│  Modern Agents (modernBaseAgent.js)                           │
│  ├── Season Analysis Agent                                     │
│  ├── Driver Performance Agent                                  │
│  ├── Race Strategy Agent                                       │
│  ├── Championship Predictor                                    │
│  └── Historical Comparison Agent                               │
├─────────────────────────────────────────────────────────────────┤
│  Modern MCP Integration                                        │
│  ├── Official MCP SDK Client                                   │
│  ├── LangGraph Tools Adapter                                   │
│  └── Connection Management                                      │
├─────────────────────────────────────────────────────────────────┤
│  Infrastructure Layer                                          │
│  ├── Checkpoint Manager (SQLite)                               │
│  ├── Monitoring System                                         │
│  └── Streaming Handler                                         │
└─────────────────────────────────────────────────────────────────┘
```

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+ (LTS recommended)
- npm 9+
- OpenAI API key
- Access to F1 MCP Server

### Quick Start
```bash
# Clone repository
git clone https://github.com/your-username/F1-MCP-LANGGRAPH.git
cd F1-MCP-LANGGRAPH/f1-langGraph-agents

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev

# Or start production server
npm start
```

### Environment Configuration
```bash
# Core Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# AI Providers
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# F1 MCP Server
F1_MCP_SERVER_URL=https://f1-mcp-server-5dh3.onrender.com

# Feature Flags
ENABLE_STREAMING=true
ENABLE_CHECKPOINTING=true
ENABLE_RATE_LIMITING=true
ENABLE_COMPRESSION=true
ENABLE_MONITORING=true

# Security
CORS_ORIGIN=*
REQUEST_TIMEOUT=180000
MAX_RETRIES=3
```

## 🎯 Core Features

### 1. Intelligent F1 Analysis Agents
- **Season Analysis**: Multi-season comparisons, trend analysis, championship insights
- **Driver Performance**: Career tracking, head-to-head comparisons, circuit analysis
- **Race Strategy**: Circuit-specific strategies, weather impact, pit stop optimization
- **Championship Predictor**: Probability calculations, scenario modeling, trend forecasting
- **Historical Comparison**: Cross-era analysis, regulation impact assessment

### 2. Real-time Streaming
```javascript
// Connect to streaming endpoint
const eventSource = new EventSource('/stream/query/thread-123');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Streaming update:', data);
};
```

### 3. Advanced State Management
```javascript
// Query with persistent state
const response = await fetch('/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'Analyze the 2023 F1 season performance trends',
    threadId: 'user-session-123',
    userContext: { preferences: { units: 'metric' } }
  })
});
```

### 4. Comprehensive Monitoring
```javascript
// Get system health
const health = await fetch('/health/detailed');
const metrics = await fetch('/analytics');
const checkpoints = await fetch('/checkpoints/stats');
```

## 🔧 API Endpoints

### Core Endpoints
- `GET /health` - Basic health check
- `GET /health/detailed` - Comprehensive system status
- `POST /query` - Process F1 query
- `POST /query/stream` - Streaming query processing
- `GET /agents` - Available agents information
- `GET /conversations/:threadId` - Conversation history
- `GET /analytics` - Usage analytics and metrics

### Streaming Endpoints
- `GET /stream/query/:threadId` - Query processing events
- `GET /stream/health` - Health monitoring events
- `GET /stream/agents/:agentType` - Agent-specific events

### Management Endpoints
- `GET /checkpoints/stats` - Checkpoint statistics
- `POST /checkpoints/cleanup` - Manual cleanup
- `DELETE /conversations/:threadId` - Clear conversation

## 🧪 Testing

### Run Tests
```bash
# Run all tests
npm test

# Run with watch mode
npm run test:watch

# Run specific test
npm test test/modernIntegrationTest.js

# Run with coverage
npm run test:coverage
```

### Test Categories
- **Integration Tests**: End-to-end application testing
- **Unit Tests**: Individual component testing
- **Performance Tests**: Load and stress testing
- **Security Tests**: Authentication and authorization

## 📊 Monitoring & Analytics

### Built-in Monitoring
- **System Metrics**: CPU, memory, disk usage
- **Application Metrics**: Request rates, response times, error rates
- **Agent Metrics**: Invocation counts, success rates, performance
- **Business Metrics**: Query patterns, user engagement, feature usage

### Health Checks
```bash
# Check application health
curl http://localhost:3000/health

# Get detailed metrics
curl http://localhost:3000/health/detailed

# View analytics
curl http://localhost:3000/analytics
```

### Alerting
- Memory usage > 80%
- Error rate > 5%
- Response time > 5 seconds
- CPU usage > 80%

## 🚀 Deployment

### Cloud Platforms
- **Render.com** (Recommended)
- **Vercel** (Serverless)
- **Railway** (Container-based)
- **Netlify Functions** (Serverless)

### Traditional Deployment
- **VPS/Dedicated Server** with PM2
- **Load Balanced** multi-instance setup
- **Reverse Proxy** with Nginx

See [Deployment Guide](./deploy/modern-deployment.md) for detailed instructions.

## 🔐 Security

### Security Features
- **Rate Limiting**: Configurable request limits
- **CORS Protection**: Configurable origin restrictions
- **Security Headers**: Helmet.js integration
- **Input Validation**: Zod schema validation
- **Error Handling**: No sensitive data exposure

### Security Checklist
- [ ] Environment variables secured
- [ ] SSL/TLS enabled in production
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Security headers enabled
- [ ] Input validation implemented

## 📈 Performance

### Expected Performance
- **Response Time**: < 2 seconds (cached)
- **Throughput**: 100+ requests/minute
- **Memory Usage**: < 1GB
- **CPU Usage**: < 50%
- **Uptime**: > 99.9%

### Optimization Features
- **Response Compression**: Gzip/Brotli
- **Request Caching**: Intelligent caching strategies
- **Connection Pooling**: Efficient resource utilization
- **Streaming**: Real-time data delivery
- **Parallel Processing**: Concurrent operations

## 🛠️ Development

### Development Workflow
```bash
# Start development server
npm run dev

# Run tests in watch mode
npm run test:watch

# Check code quality
npm run lint
npm run lint:fix

# MCP inspector for debugging
npm run mcp:inspect
```

### Code Structure
```
src/
├── modernServer.js          # Main server entry point
├── modernApp.js             # Application orchestrator
├── adapters/               # MCP and LangGraph adapters
│   ├── modernMcpClient.js
│   └── modernLangGraphAdapter.js
├── agents/                 # Modern agent implementations
│   ├── modernBaseAgent.js
│   └── modernSeasonAnalysisAgent.js
├── state/                  # State management
│   └── modernGraphState.js
├── streaming/              # Real-time streaming
│   └── modernStreamingHandler.js
├── checkpointing/          # Persistence layer
│   └── modernCheckpointManager.js
├── monitoring/             # System monitoring
│   └── modernMonitoring.js
└── utils/                  # Shared utilities
    ├── logger.js
    └── errorHandler.js
```

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Install dependencies: `npm install`
4. Make changes and add tests
5. Run tests: `npm test`
6. Commit changes: `git commit -m 'Add amazing feature'`
7. Push to branch: `git push origin feature/amazing-feature`
8. Open Pull Request

### Code Standards
- **ES6+ Modules**: Use import/export syntax
- **Async/Await**: Prefer over promises chains
- **Error Handling**: Comprehensive error boundaries
- **Logging**: Structured logging with context
- **Testing**: 80%+ test coverage required

## 📚 Documentation

- [Deployment Guide](./deploy/modern-deployment.md)
- [API Documentation](./docs/api.md)
- [Architecture Guide](./docs/architecture.md)
- [Contributing Guide](./CONTRIBUTING.md)

## 🐛 Troubleshooting

### Common Issues
1. **Memory Leaks**: Monitor with health endpoints
2. **Connection Issues**: Check MCP server status
3. **Performance Issues**: Review analytics endpoint
4. **Deployment Issues**: Check deployment logs

### Debug Mode
```bash
# Enable debug logging
LOG_LEVEL=debug npm start

# Use MCP inspector
npm run mcp:inspect

# Monitor in real-time
curl -N http://localhost:3000/stream/health
```

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🏆 Acknowledgments

- **LangGraph.js Team** for the excellent framework
- **Anthropic** for MCP specification and tools
- **F1 Community** for data and insights
- **Open Source Contributors** for various dependencies

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-username/F1-MCP-LANGGRAPH/issues)
- **Documentation**: [Wiki](https://github.com/your-username/F1-MCP-LANGGRAPH/wiki)
- **Community**: [Discussions](https://github.com/your-username/F1-MCP-LANGGRAPH/discussions)

---

**Built with ❤️ for F1 enthusiasts and AI developers**