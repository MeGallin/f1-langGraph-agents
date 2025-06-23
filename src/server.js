/**
 * Modern F1 LangGraph Express Server
 * Implements latest Express patterns with streaming, rate limiting, and comprehensive middleware
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import timeout from 'connect-timeout';
import compression from 'compression';
import { v4 as uuidv4 } from 'uuid';
import 'dotenv/config';

// Import modern components
import ModernF1LangGraphApp from './app.js';
import ModernStreamingHandler from './streaming/streamingHandler.js';
import ModernCheckpointManager from './checkpointing/checkpointManager.js';
import logger, { requestLogger } from './utils/logger.js';
import { f1ErrorMiddleware, F1Error } from './utils/errorHandler.js';

class ModernF1Server {
  constructor(options = {}) {
    this.options = {
      port: options.port || process.env.PORT || 3000,
      enableStreaming: options.enableStreaming !== false,
      enableRateLimit: options.enableRateLimit !== false,
      enableCompression: options.enableCompression !== false,
      requestTimeout: options.requestTimeout || 180000, // 3 minutes
      corsOrigin: options.corsOrigin || process.env.CORS_ORIGIN || '*',
      trustProxy: options.trustProxy || false,
      ...options
    };

    // Initialize Express app
    this.app = express();
    
    // Initialize components
    this.f1App = new ModernF1LangGraphApp(this.options);
    this.streamingHandler = new ModernStreamingHandler(this.options);
    this.checkpointManager = new ModernCheckpointManager(this.options);
    
    // Server state
    this.server = null;
    this.isInitialized = false;
    this.startTime = Date.now();

    logger.info('ModernF1Server created', {
      port: this.options.port,
      enableStreaming: this.options.enableStreaming,
      enableRateLimit: this.options.enableRateLimit
    });
  }

  /**
   * Initialize the server with all middleware and routes
   */
  async initialize() {
    try {
      logger.info('Initializing ModernF1Server...');

      // Setup middleware
      this.setupMiddleware();
      
      // Initialize core components
      await this.initializeComponents();
      
      // Setup routes
      this.setupRoutes();
      
      // Setup error handling
      this.setupErrorHandling();

      this.isInitialized = true;
      logger.info('ModernF1Server initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize ModernF1Server', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // Trust proxy if enabled (for load balancers, reverse proxies)
    if (this.options.trustProxy) {
      this.app.set('trust proxy', this.options.trustProxy);
    }

    // Compression middleware
    if (this.options.enableCompression) {
      this.app.use(compression({
        filter: (req, res) => {
          if (req.headers['x-no-compression']) {
            return false;
          }
          return compression.filter(req, res);
        }
      }));
    }

    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          connectSrc: ["'self'", 'ws:', 'wss:']
        }
      },
      crossOriginEmbedderPolicy: false
    }));

    // CORS middleware
    this.app.use(cors({
      origin: this.options.corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Thread-ID']
    }));

    // Rate limiting
    if (this.options.enableRateLimit) {
      const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // limit each IP to 100 requests per windowMs
        message: {
          error: 'Too many requests',
          message: 'Please try again later',
          retryAfter: 15 * 60
        },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
          logger.warn('Rate limit exceeded', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            endpoint: req.path
          });
          res.status(429).json({
            error: 'Too many requests',
            message: 'Please try again later',
            retryAfter: 15 * 60
          });
        }
      });
      this.app.use(limiter);
    }

    // Request timeout
    this.app.use(timeout(this.options.requestTimeout));

    // Body parsing
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req, res, buf) => {
        req.rawBody = buf;
      }
    }));
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: '10mb' 
    }));

    // Request ID middleware
    this.app.use((req, res, next) => {
      req.id = req.headers['x-request-id'] || uuidv4();
      res.setHeader('X-Request-ID', req.id);
      next();
    });

    // Request logging middleware
    this.app.use(this.createRequestLoggingMiddleware());

    // Timeout handler
    this.app.use((req, res, next) => {
      if (req.timedout) {
        logger.warn('Request timeout detected', {
          requestId: req.id,
          method: req.method,
          url: req.url,
          timeout: this.options.requestTimeout
        });
        
        if (!res.headersSent) {
          res.status(408).json({
            error: 'Request timeout',
            message: `Request exceeded timeout of ${this.options.requestTimeout}ms`,
            requestId: req.id
          });
        }
        return;
      }
      next();
    });

    // Streaming middleware
    if (this.options.enableStreaming) {
      this.app.use(this.streamingHandler.createStreamingMiddleware());
    }

    logger.info('Express middleware configured', {
      enableCompression: this.options.enableCompression,
      enableRateLimit: this.options.enableRateLimit,
      enableStreaming: this.options.enableStreaming
    });
  }

  /**
   * Initialize core components
   */
  async initializeComponents() {
    try {
      // Initialize checkpoint manager
      await this.checkpointManager.initialize();
      
      // Initialize F1 application
      await this.f1App.initialize();
      
      // Initialize streaming handler
      if (this.options.enableStreaming) {
        this.streamingHandler.initialize(this.app);
      }

      logger.info('All components initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize components', { error: error.message });
      throw error;
    }
  }

  /**
   * Setup Express routes
   */
  setupRoutes() {
    // Health check routes
    this.setupHealthRoutes();
    
    // Main F1 query routes
    this.setupQueryRoutes();
    
    // Agent information routes
    this.setupAgentRoutes();
    
    // Conversation and memory routes
    this.setupConversationRoutes();
    
    // Analytics and monitoring routes
    this.setupAnalyticsRoutes();
    
    // Checkpoint management routes
    this.setupCheckpointRoutes();

    logger.info('All routes configured');
  }

  /**
   * Setup health check routes
   */
  setupHealthRoutes() {
    // Basic health check
    this.app.get('/health', async (req, res) => {
      try {
        const health = await this.f1App.getHealth();
        const statusCode = health.status === 'healthy' ? 200 : 
                          health.status === 'degraded' ? 206 : 503;
        
        res.status(statusCode).json({
          ...health,
          service: 'f1-langgraph-agents-modern',
          version: process.env.npm_package_version || '2.0.0',
          environment: process.env.NODE_ENV || 'development',
          uptime: Date.now() - this.startTime,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          error: error.message,
          service: 'f1-langgraph-agents-modern',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Detailed health check
    this.app.get('/health/detailed', async (req, res) => {
      try {
        const [appHealth, checkpointHealth] = await Promise.all([
          this.f1App.getHealth(),
          this.checkpointManager.getHealth()
        ]);

        const streamingStats = this.options.enableStreaming ? 
          this.streamingHandler.getConnectionStats() : null;

        res.json({
          application: appHealth,
          checkpointing: checkpointHealth,
          streaming: streamingStats,
          server: {
            uptime: Date.now() - this.startTime,
            memory: process.memoryUsage(),
            cpu: process.cpuUsage()
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          error: 'Health check failed',
          message: error.message
        });
      }
    });
  }

  /**
   * Setup F1 query routes
   */
  setupQueryRoutes() {
    // Main query processing endpoint
    this.app.post('/query', async (req, res) => {
      try {
        const { query, threadId, userContext = {} } = req.body;

        if (!query) {
          return res.status(400).json({
            success: false,
            error: 'Query is required',
            message: 'Please provide a query string in the request body',
            requestId: req.id
          });
        }

        // Add request context
        const enhancedContext = {
          ...userContext,
          requestId: req.id,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        };

        // Process query
        const result = await this.f1App.processQuery(query, threadId, enhancedContext);

        res.json({
          ...result,
          requestId: req.id,
          processingTime: Date.now() - req.startTime
        });

      } catch (error) {
        logger.error('Query processing failed', {
          requestId: req.id,
          error: error.message,
          query: req.body.query?.substring(0, 100)
        });

        res.status(500).json({
          success: false,
          error: 'Query processing failed',
          message: error.message,
          requestId: req.id
        });
      }
    });

    // Streaming query endpoint
    if (this.options.enableStreaming) {
      this.app.post('/query/stream', async (req, res) => {
        try {
          const { query, threadId, userContext = {} } = req.body;

          if (!query) {
            return res.status(400).json({
              error: 'Query is required',
              requestId: req.id
            });
          }

          // Set SSE headers
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Request-ID': req.id
          });

          // Process with streaming
          const result = await this.f1App.processQuery(query, threadId, {
            ...userContext,
            streaming: true,
            requestId: req.id
          });

          // Send final result
          res.write(`event: result\ndata: ${JSON.stringify(result)}\n\n`);
          res.end();

        } catch (error) {
          logger.error('Streaming query failed', {
            requestId: req.id,
            error: error.message
          });

          res.write(`event: error\ndata: ${JSON.stringify({
            error: error.message,
            requestId: req.id
          })}\n\n`);
          res.end();
        }
      });
    }
  }

  /**
   * Setup agent information routes
   */
  setupAgentRoutes() {
    // Get available agents
    this.app.get('/agents', (req, res) => {
      try {
        const agents = this.f1App.getAvailableAgents();
        res.json({
          agents,
          count: Object.keys(agents).length,
          requestId: req.id
        });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to get agent information',
          message: error.message,
          requestId: req.id
        });
      }
    });

    // Get specific agent info
    this.app.get('/agents/:agentType', (req, res) => {
      try {
        const { agentType } = req.params;
        const agents = this.f1App.getAvailableAgents();
        
        if (!agents[agentType]) {
          return res.status(404).json({
            error: 'Agent not found',
            agentType,
            available: Object.keys(agents),
            requestId: req.id
          });
        }

        res.json({
          agent: agents[agentType],
          agentType,
          requestId: req.id
        });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to get agent information',
          message: error.message,
          requestId: req.id
        });
      }
    });
  }

  /**
   * Setup conversation and memory routes
   */
  setupConversationRoutes() {
    // Get conversation history
    this.app.get('/conversations/:threadId', async (req, res) => {
      try {
        const { threadId } = req.params;
        const { limit, offset, includeMetadata } = req.query;
        
        const history = await this.f1App.getConversationHistory(threadId, {
          limit: parseInt(limit) || 50,
          offset: parseInt(offset) || 0,
          includeMetadata: includeMetadata === 'true'
        });

        res.json({
          ...history,
          requestId: req.id
        });

      } catch (error) {
        if (error.code === 'MEMORY_DISABLED') {
          return res.status(501).json({
            error: 'Memory not enabled',
            message: 'Conversation history requires memory to be enabled',
            requestId: req.id
          });
        }

        res.status(500).json({
          error: 'Failed to get conversation history',
          message: error.message,
          requestId: req.id
        });
      }
    });

    // Clear conversation history
    this.app.delete('/conversations/:threadId', async (req, res) => {
      try {
        const { threadId } = req.params;
        
        // Clear from checkpoint manager
        await this.checkpointManager.deleteCheckpoints({
          configurable: { thread_id: threadId }
        });

        res.json({
          success: true,
          threadId,
          message: 'Conversation history cleared',
          requestId: req.id
        });

      } catch (error) {
        res.status(500).json({
          error: 'Failed to clear conversation history',
          message: error.message,
          requestId: req.id
        });
      }
    });
  }

  /**
   * Setup analytics routes
   */
  setupAnalyticsRoutes() {
    // Get analytics
    this.app.get('/analytics', async (req, res) => {
      try {
        const { days, agentType } = req.query;
        const analytics = await this.f1App.getAnalytics({
          days: parseInt(days) || 7,
          agentType
        });

        res.json({
          ...analytics,
          requestId: req.id
        });

      } catch (error) {
        res.status(500).json({
          error: 'Failed to get analytics',
          message: error.message,
          requestId: req.id
        });
      }
    });
  }

  /**
   * Setup checkpoint management routes
   */
  setupCheckpointRoutes() {
    // Get checkpoint statistics
    this.app.get('/checkpoints/stats', async (req, res) => {
      try {
        const stats = await this.checkpointManager.getStatistics();
        res.json({
          stats,
          requestId: req.id
        });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to get checkpoint statistics',
          message: error.message,
          requestId: req.id
        });
      }
    });

    // Manual cleanup
    this.app.post('/checkpoints/cleanup', async (req, res) => {
      try {
        const deletedCount = await this.checkpointManager.runCleanup();
        res.json({
          success: true,
          deletedCount,
          requestId: req.id
        });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to run checkpoint cleanup',
          message: error.message,
          requestId: req.id
        });
      }
    });
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.url} not found`,
        requestId: req.id,
        available: [
          'GET /health',
          'GET /health/detailed',
          'GET /agents',
          'POST /query',
          'POST /query/stream',
          'GET /conversations/:threadId',
          'GET /analytics',
          'GET /checkpoints/stats'
        ]
      });
    });

    // Global error handler
    this.app.use(f1ErrorMiddleware);

    logger.info('Error handling configured');
  }

  /**
   * Create request logging middleware
   */
  createRequestLoggingMiddleware() {
    return (req, res, next) => {
      req.startTime = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - req.startTime;
        requestLogger.info('Request completed', {
          requestId: req.id,
          method: req.method,
          url: req.url,
          status: res.statusCode,
          duration: `${duration}ms`,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          contentLength: res.get('Content-Length') || 0
        });
      });

      next();
    };
  }

  /**
   * Start the server
   */
  async start() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      this.server = this.app.listen(this.options.port, () => {
        logger.info('ModernF1Server started successfully', {
          port: this.options.port,
          environment: process.env.NODE_ENV || 'development',
          endpoints: {
            health: `http://localhost:${this.options.port}/health`,
            agents: `http://localhost:${this.options.port}/agents`,
            query: `http://localhost:${this.options.port}/query`,
            streaming: this.options.enableStreaming ? `http://localhost:${this.options.port}/query/stream` : null
          }
        });
      });

      // Handle server errors
      this.server.on('error', (error) => {
        logger.error('Server error', { error: error.message });
      });

      return this.server;
    } catch (error) {
      logger.error('Failed to start server', { error: error.message });
      throw error;
    }
  }

  /**
   * Stop the server gracefully
   */
  async stop() {
    try {
      logger.info('Stopping ModernF1Server...');

      if (this.server) {
        await new Promise((resolve) => {
          this.server.close(resolve);
        });
      }

      // Cleanup components
      await this.f1App.cleanup();
      await this.checkpointManager.cleanup();
      this.streamingHandler.cleanup();

      logger.info('ModernF1Server stopped successfully');
    } catch (error) {
      logger.error('Error stopping server', { error: error.message });
      throw error;
    }
  }
}

// Handle graceful shutdown
const gracefulShutdown = async (server) => {
  logger.info('Received shutdown signal, shutting down gracefully...');
  try {
    await server.stop();
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', { error: error.message });
    process.exit(1);
  }
};

// Create and start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new ModernF1Server();
  
  // Setup signal handlers
  process.on('SIGINT', () => gracefulShutdown(server));
  process.on('SIGTERM', () => gracefulShutdown(server));
  
  // Start server
  server.start().catch((error) => {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  });
}

export default ModernF1Server;