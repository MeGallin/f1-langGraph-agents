/**
 * Modern Streaming Handler for F1 LangGraph Application
 * Implements LangGraph.js v0.2 streaming patterns with SSE and WebSocket support
 */

import { EventEmitter } from 'events';
import logger from '../utils/logger.js';

export class ModernStreamingHandler extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      enableSSE: options.enableSSE !== false,
      enableWebSocket: options.enableWebSocket || false,
      heartbeatInterval: options.heartbeatInterval || 30000, // 30 seconds
      maxConnections: options.maxConnections || 100,
      bufferSize: options.bufferSize || 1000,
      ...options
    };

    this.activeConnections = new Map();
    this.connectionCount = 0;
    this.heartbeatTimer = null;

    logger.info('ModernStreamingHandler initialized', {
      enableSSE: this.options.enableSSE,
      enableWebSocket: this.options.enableWebSocket,
      maxConnections: this.options.maxConnections
    });
  }

  /**
   * Initialize streaming with Express app
   */
  initialize(app) {
    if (this.options.enableSSE) {
      this.setupSSEEndpoints(app);
    }

    if (this.options.enableWebSocket) {
      this.setupWebSocketServer(app);
    }

    this.startHeartbeat();
    
    logger.info('Streaming handler initialized with Express app');
  }

  /**
   * Setup Server-Sent Events endpoints
   */
  setupSSEEndpoints(app) {
    // SSE endpoint for query processing
    app.get('/stream/query/:threadId', (req, res) => {
      this.handleSSEConnection(req, res, 'query');
    });

    // SSE endpoint for health monitoring
    app.get('/stream/health', (req, res) => {
      this.handleSSEConnection(req, res, 'health');
    });

    // SSE endpoint for agent events
    app.get('/stream/agents/:agentType', (req, res) => {
      this.handleSSEConnection(req, res, 'agent');
    });

    logger.info('SSE endpoints configured');
  }

  /**
   * Handle SSE connection
   */
  handleSSEConnection(req, res, streamType) {
    if (this.connectionCount >= this.options.maxConnections) {
      res.status(503).json({ error: 'Maximum connections reached' });
      return;
    }

    const connectionId = `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const threadId = req.params.threadId;
    const agentType = req.params.agentType;

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Create connection object
    const connection = {
      id: connectionId,
      type: 'sse',
      streamType,
      threadId,
      agentType,
      response: res,
      lastActivity: Date.now(),
      buffer: []
    };

    this.activeConnections.set(connectionId, connection);
    this.connectionCount++;

    logger.info('SSE connection established', {
      connectionId,
      streamType,
      threadId,
      agentType,
      totalConnections: this.connectionCount
    });

    // Send initial connection event
    this.sendSSEEvent(res, 'connection', {
      connectionId,
      streamType,
      threadId,
      timestamp: Date.now()
    });

    // Handle client disconnect
    req.on('close', () => {
      this.closeConnection(connectionId);
    });

    req.on('aborted', () => {
      this.closeConnection(connectionId);
    });
  }

  /**
   * Send SSE event
   */
  sendSSEEvent(res, event, data) {
    try {
      const eventData = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      res.write(eventData);
    } catch (error) {
      logger.error('Failed to send SSE event', { error: error.message });
    }
  }

  /**
   * Broadcast event to connections
   */
  broadcastEvent(event, data, filter = {}) {
    const connections = Array.from(this.activeConnections.values());
    
    const filteredConnections = connections.filter(conn => {
      if (filter.streamType && conn.streamType !== filter.streamType) return false;
      if (filter.threadId && conn.threadId !== filter.threadId) return false;
      if (filter.agentType && conn.agentType !== filter.agentType) return false;
      return true;
    });

    filteredConnections.forEach(connection => {
      try {
        if (connection.type === 'sse') {
          this.sendSSEEvent(connection.response, event, data);
        }
        
        connection.lastActivity = Date.now();
      } catch (error) {
        logger.error('Failed to broadcast to connection', {
          connectionId: connection.id,
          error: error.message
        });
        this.closeConnection(connection.id);
      }
    });

    logger.debug('Event broadcasted', {
      event,
      connectionsReached: filteredConnections.length,
      filter
    });
  }

  /**
   * Stream query processing events
   */
  streamQueryProcessing(threadId, eventType, data) {
    this.broadcastEvent('query_event', {
      threadId,
      eventType,
      data,
      timestamp: Date.now()
    }, { streamType: 'query', threadId });
  }

  /**
   * Stream agent execution events
   */
  streamAgentEvent(agentType, eventType, data) {
    this.broadcastEvent('agent_event', {
      agentType,
      eventType,
      data,
      timestamp: Date.now()
    }, { streamType: 'agent', agentType });
  }

  /**
   * Stream health events
   */
  streamHealthEvent(healthData) {
    this.broadcastEvent('health_event', {
      ...healthData,
      timestamp: Date.now()
    }, { streamType: 'health' });
  }

  /**
   * Stream LLM token events
   */
  streamLLMToken(threadId, token, metadata = {}) {
    this.broadcastEvent('llm_token', {
      threadId,
      token,
      metadata,
      timestamp: Date.now()
    }, { streamType: 'query', threadId });
  }

  /**
   * Stream tool execution events
   */
  streamToolEvent(threadId, toolName, eventType, data) {
    this.broadcastEvent('tool_event', {
      threadId,
      toolName,
      eventType,
      data,
      timestamp: Date.now()
    }, { streamType: 'query', threadId });
  }

  /**
   * Stream workflow state changes
   */
  streamWorkflowState(threadId, currentStep, state) {
    this.broadcastEvent('workflow_state', {
      threadId,
      currentStep,
      state,
      timestamp: Date.now()
    }, { streamType: 'query', threadId });
  }

  /**
   * Close connection
   */
  closeConnection(connectionId) {
    const connection = this.activeConnections.get(connectionId);
    
    if (connection) {
      try {
        if (connection.type === 'sse') {
          connection.response.end();
        }
      } catch (error) {
        logger.error('Error closing connection', { error: error.message });
      }

      this.activeConnections.delete(connectionId);
      this.connectionCount--;

      logger.info('Connection closed', {
        connectionId,
        streamType: connection.streamType,
        totalConnections: this.connectionCount
      });
    }
  }

  /**
   * Start heartbeat to maintain connections
   */
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
      this.cleanupStaleConnections();
    }, this.options.heartbeatInterval);

    logger.info('Heartbeat started', {
      interval: this.options.heartbeatInterval
    });
  }

  /**
   * Send heartbeat to all connections
   */
  sendHeartbeat() {
    this.broadcastEvent('heartbeat', {
      timestamp: Date.now(),
      activeConnections: this.connectionCount
    });
  }

  /**
   * Cleanup stale connections
   */
  cleanupStaleConnections() {
    const now = Date.now();
    const maxInactivity = 5 * 60 * 1000; // 5 minutes
    const staleConnections = [];

    for (const [connectionId, connection] of this.activeConnections.entries()) {
      if (now - connection.lastActivity > maxInactivity) {
        staleConnections.push(connectionId);
      }
    }

    staleConnections.forEach(connectionId => {
      this.closeConnection(connectionId);
    });

    if (staleConnections.length > 0) {
      logger.info('Cleaned up stale connections', {
        count: staleConnections.length,
        remaining: this.connectionCount
      });
    }
  }

  /**
   * Get connection statistics
   */
  getConnectionStats() {
    const connections = Array.from(this.activeConnections.values());
    
    const stats = {
      total: this.connectionCount,
      byType: {},
      byStreamType: {},
      averageAge: 0
    };

    const now = Date.now();
    let totalAge = 0;

    connections.forEach(conn => {
      // Count by connection type
      stats.byType[conn.type] = (stats.byType[conn.type] || 0) + 1;
      
      // Count by stream type
      stats.byStreamType[conn.streamType] = (stats.byStreamType[conn.streamType] || 0) + 1;
      
      // Calculate age
      totalAge += now - conn.lastActivity;
    });

    stats.averageAge = connections.length > 0 ? totalAge / connections.length : 0;

    return stats;
  }

  /**
   * Cleanup all resources
   */
  cleanup() {
    try {
      // Close all connections
      for (const connectionId of this.activeConnections.keys()) {
        this.closeConnection(connectionId);
      }

      // Stop heartbeat
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }

      // Remove all listeners
      this.removeAllListeners();

      logger.info('Streaming handler cleanup completed');
    } catch (error) {
      logger.error('Error during streaming handler cleanup', {
        error: error.message
      });
    }
  }

  /**
   * Create streaming middleware for Express routes
   */
  createStreamingMiddleware() {
    return (req, res, next) => {
      // Add streaming methods to response object
      res.streamEvent = (event, data) => {
        if (req.headers.accept === 'text/event-stream') {
          this.sendSSEEvent(res, event, data);
        }
      };

      res.streamQueryEvent = (threadId, eventType, data) => {
        this.streamQueryProcessing(threadId, eventType, data);
      };

      res.streamAgentEvent = (agentType, eventType, data) => {
        this.streamAgentEvent(agentType, eventType, data);
      };

      next();
    };
  }
}

export default ModernStreamingHandler;