/**
 * Modern Monitoring System for F1 LangGraph Application
 * Comprehensive monitoring with metrics, health checks, and alerting
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import os from 'os';
import process from 'process';
import logger from '../utils/logger.js';

export class ModernMonitoringSystem extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      enableMetrics: options.enableMetrics !== false,
      enableHealthChecks: options.enableHealthChecks !== false,
      enableAlerting: options.enableAlerting || false,
      metricsInterval: options.metricsInterval || 30000, // 30 seconds
      healthCheckInterval: options.healthCheckInterval || 60000, // 1 minute
      alertThresholds: {
        errorRate: options.alertThresholds?.errorRate || 0.05, // 5%
        responseTime: options.alertThresholds?.responseTime || 5000, // 5 seconds
        memoryUsage: options.alertThresholds?.memoryUsage || 0.8, // 80%
        cpuUsage: options.alertThresholds?.cpuUsage || 0.8, // 80%
        ...options.alertThresholds
      },
      retentionPeriod: options.retentionPeriod || 24 * 60 * 60 * 1000, // 24 hours
      ...options
    };

    // Metrics storage
    this.metrics = {
      requests: new Map(),
      errors: new Map(), 
      performance: new Map(),
      system: new Map(),
      agents: new Map(),
      tools: new Map()
    };

    // Monitoring state
    this.isMonitoring = false;
    this.metricsTimer = null;
    this.healthCheckTimer = null;
    this.alerts = [];
    this.startTime = Date.now();

    logger.info('ModernMonitoringSystem initialized', {
      enableMetrics: this.options.enableMetrics,
      enableHealthChecks: this.options.enableHealthChecks,
      enableAlerting: this.options.enableAlerting
    });
  }

  /**
   * Start monitoring
   */
  start(app) {
    if (this.isMonitoring) {
      return;
    }

    this.app = app;
    this.isMonitoring = true;

    if (this.options.enableMetrics) {
      this.startMetricsCollection();
    }

    if (this.options.enableHealthChecks) {
      this.startHealthChecks();
    }

    this.setupEventListeners();

    logger.info('Monitoring started', {
      metricsInterval: this.options.metricsInterval,
      healthCheckInterval: this.options.healthCheckInterval
    });
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (!this.isMonitoring) {
      return;
    }

    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    this.removeAllListeners();
    this.isMonitoring = false;

    logger.info('Monitoring stopped');
  }

  /**
   * Start metrics collection
   */
  startMetricsCollection() {
    this.metricsTimer = setInterval(() => {
      this.collectSystemMetrics();
      this.cleanOldMetrics();
    }, this.options.metricsInterval);

    logger.info('Metrics collection started');
  }

  /**
   * Start health checks
   */
  startHealthChecks() {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.options.healthCheckInterval);

    logger.info('Health checks started');
  }

  /**
   * Setup event listeners for application events
   */
  setupEventListeners() {
    // Listen for application events
    this.on('request_started', this.handleRequestStarted.bind(this));
    this.on('request_completed', this.handleRequestCompleted.bind(this));
    this.on('request_failed', this.handleRequestFailed.bind(this));
    this.on('agent_invoked', this.handleAgentInvoked.bind(this));
    this.on('tool_used', this.handleToolUsed.bind(this));
    this.on('error_occurred', this.handleErrorOccurred.bind(this));
  }

  /**
   * Collect system metrics
   */
  collectSystemMetrics() {
    const timestamp = Date.now();
    
    // System metrics
    const systemMetrics = {
      timestamp,
      memory: {
        ...process.memoryUsage(),
        free: os.freemem(),
        total: os.totalmem(),
        usage: (os.totalmem() - os.freemem()) / os.totalmem()
      },
      cpu: {
        usage: process.cpuUsage(),
        loadAvg: os.loadavg(),
        uptime: os.uptime()
      },
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        version: process.version
      }
    };

    this.addMetric('system', 'system_stats', systemMetrics);

    // Check for alerts
    if (this.options.enableAlerting) {
      this.checkSystemAlerts(systemMetrics);
    }

    logger.debug('System metrics collected', {
      memoryUsage: systemMetrics.memory.usage,
      cpuLoad: systemMetrics.cpu.loadAvg[0]
    });
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck() {
    const timestamp = Date.now();
    const healthData = {
      timestamp,
      overall: 'healthy',
      components: {}
    };

    try {
      // Check application health
      if (this.app && this.app.getHealth) {
        healthData.components.application = await this.app.getHealth();
      }

      // Check system health
      const systemHealth = this.checkSystemHealth();
      healthData.components.system = systemHealth;

      // Check memory health
      const memoryHealth = this.checkMemoryHealth();
      healthData.components.memory = memoryHealth;

      // Determine overall health
      const componentStatuses = Object.values(healthData.components)
        .map(comp => comp.status);
      
      if (componentStatuses.includes('unhealthy')) {
        healthData.overall = 'unhealthy';
      } else if (componentStatuses.includes('degraded')) {
        healthData.overall = 'degraded';
      }

      this.addMetric('health', 'health_check', healthData);

      // Emit health check event
      this.emit('health_check_completed', healthData);

      logger.debug('Health check completed', {
        overall: healthData.overall,
        components: Object.keys(healthData.components).length
      });

    } catch (error) {
      healthData.overall = 'unhealthy';
      healthData.error = error.message;

      this.addMetric('health', 'health_check', healthData);
      
      logger.error('Health check failed', { error: error.message });
    }
  }

  /**
   * Check system health
   */
  checkSystemHealth() {
    const cpuLoad = os.loadavg()[0];
    const memoryUsage = (os.totalmem() - os.freemem()) / os.totalmem();
    
    let status = 'healthy';
    const issues = [];

    if (cpuLoad > this.options.alertThresholds.cpuUsage) {
      status = 'degraded';
      issues.push(`High CPU load: ${cpuLoad.toFixed(2)}`);
    }

    if (memoryUsage > this.options.alertThresholds.memoryUsage) {
      status = 'degraded';
      issues.push(`High memory usage: ${(memoryUsage * 100).toFixed(1)}%`);
    }

    return {
      status,
      cpuLoad,
      memoryUsage,
      issues
    };
  }

  /**
   * Check memory health
   */
  checkMemoryHealth() {
    const memory = process.memoryUsage();
    const heapUsedMB = memory.heapUsed / 1024 / 1024;
    const heapTotalMB = memory.heapTotal / 1024 / 1024;
    const heapUsage = memory.heapUsed / memory.heapTotal;

    let status = 'healthy';
    const issues = [];

    if (heapUsage > 0.9) {
      status = 'unhealthy';
      issues.push('Critical heap usage');
    } else if (heapUsage > 0.8) {
      status = 'degraded';
      issues.push('High heap usage');
    }

    return {
      status,
      heapUsedMB: Math.round(heapUsedMB),
      heapTotalMB: Math.round(heapTotalMB),
      heapUsage,
      issues
    };
  }

  /**
   * Handle request started event
   */
  handleRequestStarted(data) {
    const { requestId, method, path } = data;
    
    this.addMetric('requests', 'request_started', {
      requestId,
      method,
      path,
      timestamp: Date.now()
    });
  }

  /**
   * Handle request completed event
   */
  handleRequestCompleted(data) {
    const { requestId, statusCode, duration } = data;
    
    this.addMetric('requests', 'request_completed', {
      requestId,
      statusCode,
      duration,
      timestamp: Date.now()
    });

    // Check performance alerts
    if (this.options.enableAlerting && duration > this.options.alertThresholds.responseTime) {
      this.triggerAlert('performance', `Slow request: ${duration}ms`, data);
    }
  }

  /**
   * Handle request failed event
   */
  handleRequestFailed(data) {
    const { requestId, error, statusCode } = data;
    
    this.addMetric('errors', 'request_failed', {
      requestId,
      error,
      statusCode,
      timestamp: Date.now()
    });

    // Check error rate alerts
    if (this.options.enableAlerting) {
      this.checkErrorRateAlert();
    }
  }

  /**
   * Handle agent invoked event
   */
  handleAgentInvoked(data) {
    const { agentType, threadId, duration } = data;
    
    this.addMetric('agents', agentType, {
      threadId,
      duration,
      timestamp: Date.now()
    });
  }

  /**
   * Handle tool used event
   */
  handleToolUsed(data) {
    const { toolName, duration, success } = data;
    
    this.addMetric('tools', toolName, {
      duration,
      success,
      timestamp: Date.now()
    });
  }

  /**
   * Handle error occurred event
   */
  handleErrorOccurred(data) {
    const { error, context } = data;
    
    this.addMetric('errors', 'application_error', {
      error,
      context,
      timestamp: Date.now()
    });
  }

  /**
   * Add metric data
   */
  addMetric(category, key, data) {
    if (!this.metrics[category]) {
      this.metrics[category] = new Map();
    }

    if (!this.metrics[category].has(key)) {
      this.metrics[category].set(key, []);
    }

    this.metrics[category].get(key).push(data);
  }

  /**
   * Check system alerts
   */
  checkSystemAlerts(systemMetrics) {
    const { memory, cpu } = systemMetrics;
    
    if (memory.usage > this.options.alertThresholds.memoryUsage) {
      this.triggerAlert('memory', `High memory usage: ${(memory.usage * 100).toFixed(1)}%`, systemMetrics);
    }

    if (cpu.loadAvg[0] > this.options.alertThresholds.cpuUsage) {
      this.triggerAlert('cpu', `High CPU load: ${cpu.loadAvg[0].toFixed(2)}`, systemMetrics);
    }
  }

  /**
   * Check error rate alert
   */
  checkErrorRateAlert() {
    const now = Date.now();
    const timeWindow = 5 * 60 * 1000; // 5 minutes
    
    const recentRequests = this.getMetricsInTimeWindow('requests', 'request_completed', now - timeWindow, now);
    const recentErrors = this.getMetricsInTimeWindow('errors', 'request_failed', now - timeWindow, now);
    
    if (recentRequests.length > 0) {
      const errorRate = recentErrors.length / recentRequests.length;
      
      if (errorRate > this.options.alertThresholds.errorRate) {
        this.triggerAlert('error_rate', `High error rate: ${(errorRate * 100).toFixed(1)}%`, {
          requests: recentRequests.length,
          errors: recentErrors.length,
          errorRate
        });
      }
    }
  }

  /**
   * Trigger alert
   */
  triggerAlert(type, message, data) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      data,
      timestamp: Date.now(),
      resolved: false
    };

    this.alerts.push(alert);
    this.emit('alert_triggered', alert);

    logger.warn('Alert triggered', {
      type,
      message,
      alertId: alert.id
    });
  }

  /**
   * Get metrics in time window
   */
  getMetricsInTimeWindow(category, key, startTime, endTime) {
    const categoryData = this.metrics[category];
    if (!categoryData || !categoryData.has(key)) {
      return [];
    }

    return categoryData.get(key).filter(item => 
      item.timestamp >= startTime && item.timestamp <= endTime
    );
  }

  /**
   * Clean old metrics
   */
  cleanOldMetrics() {
    const cutoffTime = Date.now() - this.options.retentionPeriod;
    
    for (const [category, categoryData] of this.metrics.entries()) {
      for (const [key, data] of categoryData.entries()) {
        const filteredData = data.filter(item => item.timestamp > cutoffTime);
        this.metrics[category].set(key, filteredData);
      }
    }

    // Clean old alerts
    this.alerts = this.alerts.filter(alert => 
      alert.timestamp > cutoffTime
    );
  }

  /**
   * Get current metrics summary
   */
  getMetricsSummary() {
    const now = Date.now();
    const timeWindow = 5 * 60 * 1000; // 5 minutes
    
    // Request metrics
    const recentRequests = this.getMetricsInTimeWindow('requests', 'request_completed', now - timeWindow, now);
    const recentErrors = this.getMetricsInTimeWindow('errors', 'request_failed', now - timeWindow, now);
    
    const averageResponseTime = recentRequests.length > 0 ? 
      recentRequests.reduce((sum, req) => sum + req.duration, 0) / recentRequests.length : 0;
    
    const errorRate = recentRequests.length > 0 ? 
      recentErrors.length / recentRequests.length : 0;

    // Agent metrics
    const agentMetrics = {};
    for (const [agentType, data] of this.metrics.agents.entries()) {
      const recentInvocations = data.filter(item => item.timestamp > now - timeWindow);
      agentMetrics[agentType] = {
        invocations: recentInvocations.length,
        averageDuration: recentInvocations.length > 0 ? 
          recentInvocations.reduce((sum, inv) => sum + inv.duration, 0) / recentInvocations.length : 0
      };
    }

    // System metrics
    const latestSystemMetrics = this.getLatestMetric('system', 'system_stats');

    return {
      timestamp: now,
      requests: {
        total: recentRequests.length,
        errors: recentErrors.length,
        errorRate,
        averageResponseTime
      },
      agents: agentMetrics,
      system: latestSystemMetrics ? {
        memoryUsage: latestSystemMetrics.memory.usage,
        cpuLoad: latestSystemMetrics.cpu.loadAvg[0],
        uptime: latestSystemMetrics.process.uptime
      } : null,
      alerts: {
        total: this.alerts.length,
        unresolved: this.alerts.filter(a => !a.resolved).length
      }
    };
  }

  /**
   * Get latest metric
   */
  getLatestMetric(category, key) {
    const categoryData = this.metrics[category];
    if (!categoryData || !categoryData.has(key)) {
      return null;
    }

    const data = categoryData.get(key);
    return data.length > 0 ? data[data.length - 1] : null;
  }

  /**
   * Get alerts
   */
  getAlerts(options = {}) {
    let alerts = this.alerts;
    
    if (options.unresolved) {
      alerts = alerts.filter(a => !a.resolved);
    }
    
    if (options.type) {
      alerts = alerts.filter(a => a.type === options.type);
    }
    
    if (options.limit) {
      alerts = alerts.slice(-options.limit);
    }
    
    return alerts.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      
      this.emit('alert_resolved', alert);
      
      logger.info('Alert resolved', { alertId });
      return true;
    }
    return false;
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      startTime: this.startTime,
      uptime: Date.now() - this.startTime,
      options: this.options,
      metricsCount: Object.values(this.metrics).reduce((count, category) => {
        return count + Array.from(category.values()).reduce((sum, data) => sum + data.length, 0);
      }, 0),
      alertsCount: this.alerts.length
    };
  }
}

export default ModernMonitoringSystem;