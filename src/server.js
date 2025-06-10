import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';
import logger, { requestLogger } from './utils/logger.js';

// Import agents
import SeasonAnalysisAgent from './agents/seasonAnalysisAgent.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  }),
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    requestLogger.info('Request completed', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });
  });

  next();
});

// Initialize agents
const agents = {
  seasonAnalysis: null,
};

// Health check endpoint
app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'f1-langgraph-agents',
    version: process.env.npm_package_version || '1.0.0',
    agents: {
      seasonAnalysis: agents.seasonAnalysis?.initialized || false,
    },
    environment: process.env.NODE_ENV || 'development',
  };

  res.json(health);
});

// Agent information endpoint
app.get('/agents', (req, res) => {
  const agentInfo = {
    available: Object.keys(agents),
    details: {},
  };

  // Get info from initialized agents
  Object.entries(agents).forEach(([name, agent]) => {
    if (agent && agent.initialized) {
      agentInfo.details[name] = agent.getInfo();
    } else {
      agentInfo.details[name] = { status: 'not_initialized' };
    }
  });

  res.json(agentInfo);
});

// Season analysis endpoint
app.post('/agents/season/analyze', async (req, res) => {
  try {
    const { query, options = {} } = req.body;

    if (!query) {
      return res.status(400).json({
        error: 'Query is required',
        message: 'Please provide a query string in the request body',
      });
    }

    // Initialize agent if not already done
    if (!agents.seasonAnalysis) {
      logger.info('Initializing Season Analysis Agent');
      agents.seasonAnalysis = new SeasonAnalysisAgent();
      await agents.seasonAnalysis.initialize();
    }

    // Analyze the query
    const result = await agents.seasonAnalysis.analyze(query, options);

    res.json({
      success: true,
      query,
      result: {
        finalResponse: result.finalResponse,
        confidence: result.confidence,
        analysisType: result.analysisType,
        seasons: result.seasons,
        insights: result.insights,
        completedAt: result.completedAt,
      },
    });
  } catch (error) {
    logger.error('Season analysis failed', {
      error: error.message,
      query: req.body.query,
    });

    res.status(500).json({
      error: 'Analysis failed',
      message: error.message,
      query: req.body.query,
    });
  }
});

// Generic agent endpoint for future expansion
app.post('/agents/:agentType/analyze', async (req, res) => {
  const { agentType } = req.params;

  // For now, only season analysis is implemented
  if (agentType === 'season') {
    return (req.originalUrl = '/agents/season/analyze');
  }

  res.status(404).json({
    error: 'Agent not found',
    message: `Agent type '${agentType}' is not available`,
    available: ['season'],
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
  });

  res.status(500).json({
    error: 'Internal server error',
    message:
      process.env.NODE_ENV === 'development'
        ? error.message
        : 'Something went wrong',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.url} not found`,
    available: ['GET /health', 'GET /agents', 'POST /agents/season/analyze'],
  });
});

// Initialize server
async function startServer() {
  try {
    logger.info('Starting F1 LangGraph Agents server', {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
    });

    // Pre-initialize the season analysis agent
    logger.info('Pre-initializing Season Analysis Agent...');
    agents.seasonAnalysis = new SeasonAnalysisAgent();
    await agents.seasonAnalysis.initialize();
    logger.info('Season Analysis Agent ready');

    app.listen(PORT, () => {
      logger.info('F1 LangGraph Agents server running', {
        port: PORT,
        health: `http://localhost:${PORT}/health`,
        agents: `http://localhost:${PORT}/agents`,
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

export default app;
