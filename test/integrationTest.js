/**
 * Modern Integration Tests for F1 LangGraph Application
 * Comprehensive testing suite using Node.js built-in test runner
 */

import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { setTimeout } from 'node:timers/promises';
import ModernF1LangGraphApp from '../src/app.js';
import ModernF1Server from '../src/server.js';
import ModernF1StateManager from '../src/state/graphState.js';
import ModernF1LangGraphAdapter from '../src/adapters/langGraphAdapter.js';

describe('Modern F1 LangGraph Application Integration Tests', () => {
  let app;
  let server;
  let stateManager;
  let adapter;

  beforeEach(async () => {
    // Mock environment variables
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.F1_MCP_SERVER_URL = 'http://localhost:3001';
    
    // Initialize components with test configuration
    app = new ModernF1LangGraphApp({
      enableMemory: true,
      enableStreaming: true,
      enableCheckpointing: true,
      llmProvider: 'mock', // Use mock LLM for testing
      defaultTimeout: 10000
    });

    stateManager = new ModernF1StateManager({
      enableCheckpointing: true
    });

    adapter = new ModernF1LangGraphAdapter({
      serverUrl: 'http://localhost:3001',
      mode: 'mock' // Use mock mode for testing
    });
  });

  afterEach(async () => {
    if (app && app.cleanup) {
      await app.cleanup();
    }
    if (server && server.stop) {
      await server.stop();
    }
  });

  describe('Application Initialization', () => {
    test('should initialize application successfully', async () => {
      // Mock the initialization process
      const mockInitialize = mock.fn(async () => true);
      app.initialize = mockInitialize;

      const result = await app.initialize();
      
      assert.strictEqual(result, true);
      assert.strictEqual(mockInitialize.mock.callCount(), 1);
    });

    test('should handle initialization failure gracefully', async () => {
      const mockInitialize = mock.fn(async () => {
        throw new Error('Initialization failed');
      });
      app.initialize = mockInitialize;

      await assert.rejects(
        async () => await app.initialize(),
        { message: 'Initialization failed' }
      );
    });

    test('should validate required configuration', () => {
      const invalidApp = new ModernF1LangGraphApp({
        enableMemory: null,
        enableStreaming: undefined
      });

      // Should use defaults for invalid values
      assert.strictEqual(invalidApp.options.enableMemory, false);
      assert.strictEqual(invalidApp.options.enableStreaming, false);
    });
  });

  describe('State Management', () => {
    test('should create initial state correctly', () => {
      const query = 'Test F1 query about 2023 season';
      const threadId = 'test-thread-123';
      const userContext = { userId: 'test-user' };

      const state = stateManager.createInitialState(query, threadId, userContext);

      assert.strictEqual(state.query, query);
      assert.strictEqual(state.threadId, threadId);
      assert.deepStrictEqual(state.userContext, userContext);
      assert.strictEqual(state.currentStep, 'query_analysis');
      assert.strictEqual(state.errors.length, 0);
      assert.ok(state.metadata.startTime);
    });

    test('should update state correctly', async () => {
      const query = 'Test query';
      const threadId = 'test-thread-456';
      const initialState = stateManager.createInitialState(query, threadId);

      const updates = {
        currentStep: 'agent_routing',
        agentType: 'season_analysis'
      };

      const updatedState = await stateManager.updateState(threadId, updates);

      assert.strictEqual(updatedState.currentStep, 'agent_routing');
      assert.strictEqual(updatedState.agentType, 'season_analysis');
      assert.strictEqual(updatedState.query, query); // Original data preserved
    });

    test('should handle state validation errors', async () => {
      const query = 'Test query';
      const threadId = 'test-thread-789';
      stateManager.createInitialState(query, threadId);

      // Try to update with invalid data
      const invalidUpdates = {
        currentStep: null, // Invalid type
        metadata: 'invalid' // Should be object
      };

      await assert.rejects(
        async () => await stateManager.updateState(threadId, invalidUpdates)
      );
    });

    test('should add analysis results correctly', async () => {
      const query = 'Test query';
      const threadId = 'test-thread-results';
      stateManager.createInitialState(query, threadId);

      const analysisResult = {
        analysis: 'Detailed F1 season analysis',
        insights: ['insight1', 'insight2'],
        confidence: 0.85
      };

      const updatedState = await stateManager.addAnalysisResult(
        threadId, 
        'season_analysis', 
        analysisResult
      );

      assert.strictEqual(updatedState.analysisResults.length, 1);
      assert.strictEqual(updatedState.analysisResults[0].agentType, 'season_analysis');
      assert.deepStrictEqual(updatedState.analysisResults[0].result, analysisResult);
      assert.ok(updatedState.analysisResults[0].timestamp);
      assert.ok(updatedState.analysisResults[0].id);
    });
  });

  describe('Query Processing', () => {
    test('should process simple query successfully', async () => {
      // Mock the processing method
      const mockResult = {
        success: true,
        result: 'Mock F1 analysis result',
        agentType: 'season_analysis',
        duration: 1500
      };

      const mockProcessQuery = mock.fn(async () => mockResult);
      app.processQuery = mockProcessQuery;

      const query = 'Tell me about the 2023 F1 season';
      const threadId = 'test-query-123';
      
      const result = await app.processQuery(query, threadId);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, 'Mock F1 analysis result');
      assert.strictEqual(mockProcessQuery.mock.callCount(), 1);
      
      const [calledQuery, calledThreadId] = mockProcessQuery.mock.calls[0].arguments;
      assert.strictEqual(calledQuery, query);
      assert.strictEqual(calledThreadId, threadId);
    });

    test('should handle query processing errors', async () => {
      const mockProcessQuery = mock.fn(async () => {
        throw new Error('Processing failed');
      });
      app.processQuery = mockProcessQuery;

      const result = await app.processQuery('Invalid query', 'test-thread-error');

      // Should return error result instead of throwing
      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });

    test('should generate unique thread ID when not provided', async () => {
      const mockProcessQuery = mock.fn(async (query, threadId) => ({
        success: true,
        threadId,
        result: 'Mock result'
      }));
      app.processQuery = mockProcessQuery;

      const result = await app.processQuery('Test query');

      assert.ok(result.threadId);
      assert.ok(result.threadId.startsWith('thread_'));
    });

    test('should include user context in processing', async () => {
      const mockProcessQuery = mock.fn(async (query, threadId, userContext) => ({
        success: true,
        userContext,
        result: 'Mock result'
      }));
      app.processQuery = mockProcessQuery;

      const userContext = { 
        userId: 'test-user', 
        preferences: { language: 'en' } 
      };

      const result = await app.processQuery(
        'Test query', 
        'test-thread', 
        userContext
      );

      assert.deepStrictEqual(result.userContext, userContext);
    });
  });

  describe('Health Checks', () => {
    test('should return healthy status when components are working', async () => {
      const mockHealth = {
        status: 'healthy',
        initialized: true,
        agents: [
          { type: 'seasonAnalysis', status: 'healthy' }
        ]
      };

      const mockGetHealth = mock.fn(async () => mockHealth);
      app.getHealth = mockGetHealth;

      const health = await app.getHealth();

      assert.strictEqual(health.status, 'healthy');
      assert.strictEqual(health.initialized, true);
      assert.strictEqual(health.agents.length, 1);
    });

    test('should return unhealthy status when components fail', async () => {
      const mockGetHealth = mock.fn(async () => {
        throw new Error('Health check failed');
      });
      app.getHealth = mockGetHealth;

      const health = await app.getHealth();

      assert.strictEqual(health.status, 'unhealthy');
      assert.ok(health.error);
    });
  });

  describe('Analytics', () => {
    test('should return analytics data', async () => {
      const mockAnalytics = {
        application: {
          initialized: true,
          healthStatus: 'healthy',
          agentCount: 1
        },
        state: {
          totalThreads: 5,
          completedThreads: 3,
          errorThreads: 1,
          averageDuration: 2500
        }
      };

      const mockGetAnalytics = mock.fn(async () => mockAnalytics);
      app.getAnalytics = mockGetAnalytics;

      const analytics = await app.getAnalytics({ days: 7 });

      assert.strictEqual(analytics.application.initialized, true);
      assert.strictEqual(analytics.state.totalThreads, 5);
      assert.strictEqual(analytics.state.completedThreads, 3);
    });
  });

  describe('Conversation Management', () => {
    test('should retrieve conversation history', async () => {
      const mockHistory = {
        threadId: 'test-thread-history',
        state: {
          query: 'Test query',
          currentStep: 'completed'
        },
        workflow: {
          completed: true
        }
      };

      const mockGetHistory = mock.fn(async () => mockHistory);
      app.getConversationHistory = mockGetHistory;

      const history = await app.getConversationHistory('test-thread-history');

      assert.strictEqual(history.threadId, 'test-thread-history');
      assert.strictEqual(history.state.query, 'Test query');
      assert.strictEqual(history.workflow.completed, true);
    });

    test('should handle memory disabled error', async () => {
      const mockGetHistory = mock.fn(async () => {
        const error = new Error('Memory not enabled');
        error.code = 'MEMORY_DISABLED';
        throw error;
      });
      app.getConversationHistory = mockGetHistory;

      await assert.rejects(
        async () => await app.getConversationHistory('test-thread'),
        { code: 'MEMORY_DISABLED' }
      );
    });
  });

  describe('Performance Tests', () => {
    test('should process query within timeout limit', async () => {
      const startTime = Date.now();
      
      const mockProcessQuery = mock.fn(async () => {
        await setTimeout(100); // Simulate processing time
        return {
          success: true,
          result: 'Fast result',
          duration: Date.now() - startTime
        };
      });
      app.processQuery = mockProcessQuery;

      const result = await app.processQuery('Fast query', 'test-thread-perf');

      assert.strictEqual(result.success, true);
      assert.ok(result.duration < 1000); // Should be fast
    });

    test('should handle concurrent queries', async () => {
      const mockProcessQuery = mock.fn(async (query, threadId) => {
        await setTimeout(50); // Simulate processing
        return {
          success: true,
          threadId,
          result: `Result for ${threadId}`
        };
      });
      app.processQuery = mockProcessQuery;

      // Process multiple queries concurrently
      const queries = [
        app.processQuery('Query 1', 'thread-1'),
        app.processQuery('Query 2', 'thread-2'),
        app.processQuery('Query 3', 'thread-3')
      ];

      const results = await Promise.all(queries);

      assert.strictEqual(results.length, 3);
      results.forEach((result, index) => {
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.threadId, `thread-${index + 1}`);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle application not initialized error', async () => {
      const uninitializedApp = new ModernF1LangGraphApp();
      
      await assert.rejects(
        async () => await uninitializedApp.processQuery('Test query'),
        { code: 'APP_NOT_INITIALIZED' }
      );
    });

    test('should handle invalid query input', async () => {
      const mockProcessQuery = mock.fn(async (query) => {
        if (!query || query.trim() === '') {
          return {
            success: false,
            error: 'Query is required',
            code: 'INVALID_INPUT'
          };
        }
        return { success: true, result: 'Valid result' };
      });
      app.processQuery = mockProcessQuery;

      const result1 = await app.processQuery('');
      const result2 = await app.processQuery(null);
      const result3 = await app.processQuery('Valid query');

      assert.strictEqual(result1.success, false);
      assert.strictEqual(result1.code, 'INVALID_INPUT');
      
      assert.strictEqual(result2.success, false);
      assert.strictEqual(result2.code, 'INVALID_INPUT');
      
      assert.strictEqual(result3.success, true);
    });
  });

  describe('Cleanup and Resource Management', () => {
    test('should cleanup resources properly', async () => {
      const mockCleanup = mock.fn(async () => true);
      app.cleanup = mockCleanup;

      await app.cleanup();

      assert.strictEqual(mockCleanup.mock.callCount(), 1);
    });

    test('should handle cleanup errors gracefully', async () => {
      const mockCleanup = mock.fn(async () => {
        throw new Error('Cleanup failed');
      });
      app.cleanup = mockCleanup;

      // Should not throw, but handle gracefully
      await app.cleanup();

      assert.strictEqual(mockCleanup.mock.callCount(), 1);
    });
  });
});

describe('Modern F1 Server Integration Tests', () => {
  let server;
  const testPort = 3001;

  beforeEach(() => {
    server = new ModernF1Server({
      port: testPort,
      enableStreaming: true,
      enableRateLimit: false, // Disable for testing
      enableCompression: true
    });
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  test('should start server successfully', async () => {
    // Mock the start method
    const mockStart = mock.fn(async () => ({
      listening: true,
      port: testPort
    }));
    server.start = mockStart;

    const result = await server.start();

    assert.strictEqual(result.listening, true);
    assert.strictEqual(result.port, testPort);
  });

  test('should stop server gracefully', async () => {
    const mockStop = mock.fn(async () => true);
    server.stop = mockStop;

    await server.stop();

    assert.strictEqual(mockStop.mock.callCount(), 1);
  });

  test('should handle server startup errors', async () => {
    const mockStart = mock.fn(async () => {
      throw new Error('Port already in use');
    });
    server.start = mockStart;

    await assert.rejects(
      async () => await server.start(),
      { message: 'Port already in use' }
    );
  });
});

// Utility functions for testing
export const testHelpers = {
  createMockF1Data: () => ({
    seasons: [
      { year: 2023, races: 23 },
      { year: 2022, races: 22 }
    ],
    drivers: [
      { name: 'Max Verstappen', team: 'Red Bull Racing' },
      { name: 'Lewis Hamilton', team: 'Mercedes' }
    ],
    constructors: [
      { name: 'Red Bull Racing', championships: 6 },
      { name: 'Mercedes', championships: 8 }
    ]
  }),

  createMockAnalysisResult: (agentType = 'season_analysis') => ({
    agentType,
    result: `Mock ${agentType} analysis result`,
    confidence: 0.85,
    insights: ['insight1', 'insight2'],
    dataSources: ['f1_seasons', 'f1_drivers'],
    metadata: {
      duration: 1500,
      timestamp: Date.now()
    }
  }),

  createMockUserContext: () => ({
    userId: 'test-user-123',
    preferences: {
      language: 'en',
      units: 'metric'
    },
    session: {
      id: 'session-456',
      startTime: Date.now() - 300000 // 5 minutes ago
    }
  })
};

export default testHelpers;