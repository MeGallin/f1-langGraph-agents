/**
 * F1 Error Handler
 * Multi-layer error handling and resilience patterns
 */

import logger from './logger.js';

export class F1ErrorHandler {
  constructor(options = {}) {
    this.options = {
      maxRetries: options.maxRetries || 3,
      baseDelay: options.baseDelay || 1000,
      maxDelay: options.maxDelay || 10000,
      enableFallbacks: options.enableFallbacks !== false,
      enableCircuitBreaker: options.enableCircuitBreaker !== false,
      ...options
    };

    // Circuit breaker state
    this.circuitBreakers = new Map();
    this.logger = logger;
  }

  /**
   * Execute function with comprehensive error handling
   */
  async executeWithResilience(fn, context = {}) {
    const {
      operation = 'unknown',
      fallbackFn = null,
      useCircuitBreaker = false,
      retries = this.options.maxRetries,
      timeout = 30000
    } = context;

    // Check circuit breaker
    if (useCircuitBreaker && this.isCircuitOpen(operation)) {
      throw new F1Error(
        `Circuit breaker is OPEN for operation: ${operation}`,
        'CIRCUIT_BREAKER_OPEN',
        { operation }
      );
    }

    let lastError;
    let attempt = 0;

    while (attempt <= retries) {
      try {
        this.logger.debug('F1ErrorHandler: Executing operation', {
          operation,
          attempt: attempt + 1,
          maxAttempts: retries + 1
        });

        // Execute with timeout
        const result = await this.executeWithTimeout(fn, timeout);
        
        // Reset circuit breaker on success
        if (useCircuitBreaker) {
          this.resetCircuitBreaker(operation);
        }

        this.logger.debug('F1ErrorHandler: Operation succeeded', {
          operation,
          attempt: attempt + 1
        });

        return result;

      } catch (error) {
        lastError = error;
        attempt++;

        this.logger.warn('F1ErrorHandler: Operation failed', {
          operation,
          attempt,
          error: error.message,
          errorType: error.constructor.name,
          willRetry: attempt <= retries
        });

        // Record failure for circuit breaker
        if (useCircuitBreaker) {
          this.recordFailure(operation);
        }

        // Don't retry on certain error types
        if (this.isNonRetryableError(error)) {
          this.logger.warn('F1ErrorHandler: Non-retryable error, stopping retries', {
            operation,
            errorType: error.constructor.name
          });
          break;
        }

        // Wait before retry (exponential backoff)
        if (attempt <= retries) {
          const delay = this.calculateDelay(attempt);
          this.logger.debug('F1ErrorHandler: Waiting before retry', {
            operation,
            delay,
            attempt
          });
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted, try fallback
    if (this.options.enableFallbacks && fallbackFn) {
      try {
        this.logger.info('F1ErrorHandler: Executing fallback', { operation });
        const fallbackResult = await fallbackFn(lastError);
        
        return {
          ...fallbackResult,
          isFallback: true,
          originalError: lastError.message
        };

      } catch (fallbackError) {
        this.logger.error('F1ErrorHandler: Fallback also failed', {
          operation,
          originalError: lastError.message,
          fallbackError: fallbackError.message
        });
        
        throw new F1Error(
          `Operation and fallback both failed: ${lastError.message}`,
          'OPERATION_AND_FALLBACK_FAILED',
          {
            operation,
            originalError: lastError,
            fallbackError,
            attempts: attempt
          }
        );
      }
    }

    // No fallback or fallback disabled
    throw new F1Error(
      `Operation failed after ${attempt} attempts: ${lastError.message}`,
      'MAX_RETRIES_EXCEEDED',
      {
        operation,
        originalError: lastError,
        attempts: attempt
      }
    );
  }

  /**
   * Execute function with timeout
   */
  async executeWithTimeout(fn, timeout) {
    return Promise.race([
      fn(),
      new Promise((_, reject) => 
        setTimeout(() => 
          reject(new F1Error(`Operation timeout after ${timeout}ms`, 'TIMEOUT')), 
          timeout
        )
      )
    ]);
  }

  /**
   * Calculate exponential backoff delay
   */
  calculateDelay(attempt) {
    const delay = this.options.baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * delay; // Add 10% jitter
    return Math.min(delay + jitter, this.options.maxDelay);
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if error should not be retried
   */
  isNonRetryableError(error) {
    const nonRetryableTypes = [
      'VALIDATION_ERROR',
      'AUTHENTICATION_ERROR',
      'AUTHORIZATION_ERROR',
      'NOT_FOUND',
      'BAD_REQUEST'
    ];

    const nonRetryableMessages = [
      'invalid query',
      'unauthorized',
      'forbidden',
      'not found',
      'bad request'
    ];

    if (error.code && nonRetryableTypes.includes(error.code)) {
      return true;
    }

    const errorMessage = error.message.toLowerCase();
    return nonRetryableMessages.some(msg => errorMessage.includes(msg));
  }

  /**
   * Circuit breaker implementation
   */
  getCircuitBreaker(operation) {
    if (!this.circuitBreakers.has(operation)) {
      this.circuitBreakers.set(operation, {
        state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
        failures: 0,
        lastFailureTime: null,
        successCount: 0,
        failureThreshold: 5,
        recoveryTimeout: 60000, // 1 minute
        successThreshold: 3
      });
    }
    return this.circuitBreakers.get(operation);
  }

  isCircuitOpen(operation) {
    const breaker = this.getCircuitBreaker(operation);
    
    if (breaker.state === 'OPEN') {
      const timeSinceLastFailure = Date.now() - breaker.lastFailureTime;
      
      if (timeSinceLastFailure >= breaker.recoveryTimeout) {
        breaker.state = 'HALF_OPEN';
        breaker.successCount = 0;
        this.logger.info('F1ErrorHandler: Circuit breaker entering HALF_OPEN state', {
          operation
        });
        return false;
      }
      return true;
    }

    return false;
  }

  recordFailure(operation) {
    const breaker = this.getCircuitBreaker(operation);
    breaker.failures++;
    breaker.lastFailureTime = Date.now();
    breaker.successCount = 0;

    if (breaker.state === 'HALF_OPEN') {
      breaker.state = 'OPEN';
      this.logger.warn('F1ErrorHandler: Circuit breaker back to OPEN state', {
        operation,
        failures: breaker.failures
      });
    } else if (breaker.failures >= breaker.failureThreshold) {
      breaker.state = 'OPEN';
      this.logger.warn('F1ErrorHandler: Circuit breaker opened', {
        operation,
        failures: breaker.failures,
        threshold: breaker.failureThreshold
      });
    }
  }

  resetCircuitBreaker(operation) {
    const breaker = this.getCircuitBreaker(operation);
    
    if (breaker.state === 'HALF_OPEN') {
      breaker.successCount++;
      
      if (breaker.successCount >= breaker.successThreshold) {
        breaker.state = 'CLOSED';
        breaker.failures = 0;
        breaker.successCount = 0;
        this.logger.info('F1ErrorHandler: Circuit breaker closed', {
          operation
        });
      }
    } else if (breaker.state === 'CLOSED') {
      breaker.failures = Math.max(0, breaker.failures - 1);
    }
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(operation) {
    if (!this.circuitBreakers.has(operation)) {
      return null;
    }

    const breaker = this.circuitBreakers.get(operation);
    return {
      operation,
      state: breaker.state,
      failures: breaker.failures,
      successCount: breaker.successCount,
      lastFailureTime: breaker.lastFailureTime,
      isOpen: this.isCircuitOpen(operation)
    };
  }

  /**
   * Create standardized error response
   */
  createErrorResponse(error, context = {}) {
    const errorResponse = {
      success: false,
      error: {
        message: error.message || 'Unknown error occurred',
        type: error.constructor.name,
        code: error.code || 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString(),
        context
      }
    };

    if (error.details) {
      errorResponse.error.details = error.details;
    }

    if (context.operation) {
      errorResponse.error.operation = context.operation;
    }

    return errorResponse;
  }

  /**
   * Handle specific F1 data errors
   */
  handleF1DataError(error, context = {}) {
    if (error.message?.includes('season not found')) {
      return this.createErrorResponse(
        new F1Error('Invalid season specified', 'INVALID_SEASON'),
        context
      );
    }

    if (error.message?.includes('driver not found')) {
      return this.createErrorResponse(
        new F1Error('Driver not found', 'DRIVER_NOT_FOUND'),
        context
      );
    }

    if (error.message?.includes('race not found')) {
      return this.createErrorResponse(
        new F1Error('Race not found', 'RACE_NOT_FOUND'),
        context
      );
    }

    if (error.message?.includes('timeout')) {
      return this.createErrorResponse(
        new F1Error('F1 data service timeout', 'SERVICE_TIMEOUT'),
        context
      );
    }

    return this.createErrorResponse(error, context);
  }

  /**
   * Get error handler statistics
   */
  getStats() {
    const circuitBreakerStats = Array.from(this.circuitBreakers.entries()).map(
      ([operation, breaker]) => ({
        operation,
        state: breaker.state,
        failures: breaker.failures,
        isOpen: this.isCircuitOpen(operation)
      })
    );

    return {
      circuitBreakers: circuitBreakerStats,
      options: this.options,
      totalCircuitBreakers: this.circuitBreakers.size
    };
  }

  /**
   * Reset all circuit breakers
   */
  resetAllCircuitBreakers() {
    for (const [operation, breaker] of this.circuitBreakers.entries()) {
      breaker.state = 'CLOSED';
      breaker.failures = 0;
      breaker.successCount = 0;
      breaker.lastFailureTime = null;
    }

    this.logger.info('F1ErrorHandler: All circuit breakers reset');
  }
}

/**
 * Custom F1 Error class
 */
export class F1Error extends Error {
  constructor(message, code = 'F1_ERROR', details = {}) {
    super(message);
    this.name = 'F1Error';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Error handler middleware for Express
 */
export function f1ErrorMiddleware(err, req, res, next) {
  logger.error('F1 API Error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body
  });

  if (err instanceof F1Error) {
    return res.status(err.code === 'VALIDATION_ERROR' ? 400 : 500).json({
      success: false,
      error: {
        message: err.message,
        code: err.code,
        details: err.details
      }
    });
  }

  res.status(500).json({
    success: false,
    error: {
      message: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message,
      code: 'INTERNAL_ERROR'
    }
  });
}

// Global error handler instance
export const globalErrorHandler = new F1ErrorHandler({
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  enableFallbacks: true,
  enableCircuitBreaker: true
});

export default {
  F1ErrorHandler,
  F1Error,
  f1ErrorMiddleware,
  globalErrorHandler
};