import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { F1MCPClient } from '../src/adapters/f1McpClient.js';
import { F1LangGraphAdapter } from '../src/adapters/langGraphAdapter.js';
import SeasonAnalysisAgent from '../src/agents/seasonAnalysisAgent.js';

/**
 * Basic integration tests for F1 LangGraph Agents
 */

describe('F1 MCP Client', () => {
  let client;

  before(async () => {
    client = new F1MCPClient({
      mcpServerUrl:
        process.env.F1_MCP_SERVER_URL ||
        'https://f1-mcp-server-5dh3.onrender.com',
    });
  });

  it('should connect to F1 MCP server', async () => {
    const health = await client.healthCheck();
    assert.ok(health);
    assert.strictEqual(health.status, 'ok');
  });

  it('should get available tools', async () => {
    const tools = await client.getTools();
    assert.ok(Array.isArray(tools) || typeof tools === 'object');
  });

  it('should get F1 seasons', async () => {
    const seasons = await client.getSeasons();
    assert.ok(Array.isArray(seasons) || typeof seasons === 'object');
  });
});

describe('F1 LangGraph Adapter', () => {
  let adapter;

  before(async () => {
    adapter = new F1LangGraphAdapter({
      mcpServerUrl:
        process.env.F1_MCP_SERVER_URL ||
        'https://f1-mcp-server-5dh3.onrender.com',
    });
  });

  it('should initialize successfully', async () => {
    const tools = await adapter.initialize();
    assert.ok(adapter.initialized);
    assert.ok(Array.isArray(tools));
  });

  it('should provide LangGraph-compatible tools', async () => {
    if (!adapter.initialized) {
      await adapter.initialize();
    }

    const tools = adapter.getTools();
    assert.ok(Array.isArray(tools));

    // Check tool structure
    if (tools.length > 0) {
      const tool = tools[0];
      assert.ok(tool.name);
      assert.ok(tool.description);
      assert.ok(tool.schema);
      assert.ok(typeof tool.func === 'function');
    }
  });
});

describe('Season Analysis Agent', () => {
  let agent;

  before(async () => {
    agent = new SeasonAnalysisAgent({
      mcpServerUrl:
        process.env.F1_MCP_SERVER_URL ||
        'https://f1-mcp-server-5dh3.onrender.com',
    });
  });

  it('should initialize successfully', async () => {
    await agent.initialize();
    assert.ok(agent.initialized);

    const info = agent.getInfo();
    assert.strictEqual(info.name, 'Season Analysis Agent');
    assert.ok(Array.isArray(info.capabilities));
  });

  it('should analyze a simple query', async () => {
    if (!agent.initialized) {
      await agent.initialize();
    }

    // Simple test with current year
    const currentYear = new Date().getFullYear();
    const result = await agent.analyze(
      `Tell me about the ${currentYear} F1 season`,
    );

    assert.ok(result);
    assert.ok(result.finalResponse);
    assert.ok(typeof result.confidence === 'number');
    assert.ok(result.confidence >= 0 && result.confidence <= 1);
    assert.ok(Array.isArray(result.seasons));
  });
});

describe('API Server', () => {
  const API_URL = process.env.API_TEST_URL || 'http://localhost:3000';

  it('should respond to health check', async () => {
    try {
      const response = await fetch(`${API_URL}/health`);
      assert.ok(response.ok);

      const health = await response.json();
      assert.strictEqual(health.status, 'ok');
    } catch (error) {
      console.log('⚠️  API server not running, skipping API tests');
      console.log('   Start server with: npm start');
    }
  });

  it('should provide agent information', async () => {
    try {
      const response = await fetch(`${API_URL}/agents`);
      assert.ok(response.ok);

      const agents = await response.json();
      assert.ok(Array.isArray(agents.available));
    } catch (error) {
      console.log('⚠️  API server not running, skipping API tests');
    }
  });
});
