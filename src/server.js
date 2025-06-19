import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import timeout from 'connect-timeout';
import cron from 'node-cron';
import 'dotenv/config';
import logger, { requestLogger } from './utils/logger.js';
import { f1ErrorMiddleware } from './utils/errorHandler.js';

// Import main application orchestrator
import F1LangGraphApp from './app.js';

const app = express();
const PORT = process.env.PORT || 3000;
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT) || 125000; // 125 seconds

// Request timeout middleware (must be first)
app.use(timeout(REQUEST_TIMEOUT));

// Timeout handler middleware
app.use((req, res, next) => {
  if (req.timedout) {
    logger.warn('Request timeout detected', {
      method: req.method,
      url: req.url,
      timeout: REQUEST_TIMEOUT
    });
    
    if (!res.headersSent) {
      res.status(408).json({
        error: 'Request timeout',
        message: `Request exceeded timeout of ${REQUEST_TIMEOUT}ms`,
        code: 'REQUEST_TIMEOUT'
      });
    }
    return;
  }
  next();
});

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

// Initialize F1 LangGraph Application
const f1App = new F1LangGraphApp({
  enableMemory: process.env.ENABLE_MEMORY !== 'false',
  enableCircuitBreaker: process.env.ENABLE_CIRCUIT_BREAKER !== 'false',
  defaultTimeout: parseInt(process.env.DEFAULT_TIMEOUT) || 90000
});

// Initialize application on startup
async function initializeServices() {
  try {
    logger.info('Initializing F1 LangGraph Application...');
    await f1App.initialize();
    logger.info('F1 LangGraph Application initialized successfully');
  } catch (error) {
    logger.error('F1 LangGraph Application initialization failed:', error.message);
    throw error;
  }
}

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = await f1App.getHealth();
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 206 : 500;
    
    res.status(statusCode).json({
      ...health,
      service: 'f1-langgraph-agents',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Agent information endpoint
app.get('/agents', (req, res) => {
  try {
    const agents = f1App.getAvailableAgents();
    res.json({
      available: Object.keys(agents),
      details: agents,
      total: Object.keys(agents).length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get agent information',
      message: error.message
    });
  }
});

// Main F1 query processing endpoint
app.post('/query', async (req, res) => {
  try {
    const { query, threadId, userContext = {} } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required',
        message: 'Please provide a query string in the request body',
      });
    }

    // Process the query through the complete LangGraph workflow
    const result = await f1App.processQuery(query, threadId, userContext);

    res.json(result);

  } catch (error) {
    logger.error('F1 query processing failed', {
      error: error.message,
      query: req.body.query?.substring(0, 100),
      threadId: req.body.threadId
    });

    res.status(500).json({
      success: false,
      error: 'Query processing failed',
      message: error.message,
      query: req.body.query,
    });
  }
});

// Legacy multi-agent endpoint (for backward compatibility)
app.post('/agents/analyze', async (req, res) => {
  try {
    const { query, options = {} } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required',
        message: 'Please provide a query string in the request body',
      });
    }

    // Process query directly with F1 app
    const result = await f1App.processQuery(
      query,
      options.threadId || `legacy_${Date.now()}`,
      options.userContext || {}
    );

    res.json(result);

  } catch (error) {
    logger.error('Legacy agent analysis failed', {
      error: error.message,
      query: req.body.query?.substring(0, 100)
    });

    res.status(500).json({
      success: false,
      error: 'Agent analysis failed',
      message: error.message,
      query: req.body.query,
    });
  }
});

// Conversation history endpoint
app.get('/conversations/:threadId', async (req, res) => {
  try {
    const { threadId } = req.params;
    const { limit, offset, includeMetadata } = req.query;
    
    const history = await f1App.getConversationHistory(threadId, {
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
      includeMetadata: includeMetadata === 'true'
    });

    res.json({
      threadId,
      history,
      total: history.length
    });

  } catch (error) {
    if (error.code === 'MEMORY_DISABLED') {
      return res.status(501).json({
        error: 'Memory not enabled',
        message: 'Conversation history requires memory to be enabled'
      });
    }

    res.status(500).json({
      error: 'Failed to get conversation history',
      message: error.message
    });
  }
});

// Conversation summary endpoint
app.get('/conversations/:threadId/summary', async (req, res) => {
  try {
    const { threadId } = req.params;
    const summary = await f1App.getConversationSummary(threadId);

    if (!summary) {
      return res.status(404).json({
        error: 'Conversation not found',
        threadId
      });
    }

    res.json(summary);

  } catch (error) {
    if (error.code === 'MEMORY_DISABLED') {
      return res.status(501).json({
        error: 'Memory not enabled',
        message: 'Conversation summary requires memory to be enabled'
      });
    }

    res.status(500).json({
      error: 'Failed to get conversation summary',
      message: error.message
    });
  }
});

// Analytics endpoint
app.get('/analytics', async (req, res) => {
  try {
    const { days, agentType } = req.query;
    const analytics = await f1App.getAnalytics({
      days: parseInt(days) || 7,
      agentType
    });

    res.json(analytics);

  } catch (error) {
    res.status(500).json({
      error: 'Failed to get analytics',
      message: error.message
    });
  }
});

// Use F1 error handling middleware
app.use(f1ErrorMiddleware);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.url} not found`,
    available: [
      'GET /health',
      'GET /agents', 
      'POST /query',
      'GET /conversations/:threadId',
      'GET /conversations/:threadId/summary',
      'GET /analytics'
    ],
  });
});

// Setup cron jobs for maintenance tasks
function setupCronJobs(f1App) {
  // Run every 30 seconds - health check and agent status monitoring
  cron.schedule('*/30 * * * * *', async () => {
    try {
      // Health check
      const health = await f1App.getHealth();
      logger.debug('Scheduled health check completed', { 
        status: health.status,
        agents: health.agents?.length || 0 
      });
      
      // Optional: Add agent performance monitoring or cache cleanup here
      
    } catch (error) {
      logger.error('Scheduled health check failed:', error);
    }
  });

  logger.info('Cron jobs scheduled: health check every 30 seconds');
}

// Initialize server
async function startServer() {
  try {
    logger.info('Starting F1 LangGraph Agents server', {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
    });

    // Initialize services first
    await initializeServices();

    // Setup cron jobs after initialization
    setupCronJobs(f1App);

    app.listen(PORT, () => {
      logger.info('F1 LangGraph Agents server running', {
        port: PORT,
        health: `http://localhost:${PORT}/health`,
        agents: `http://localhost:${PORT}/agents`,
        query: `http://localhost:${PORT}/query`
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  await f1App.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  await f1App.cleanup();
  process.exit(0);
});

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

export default app;
