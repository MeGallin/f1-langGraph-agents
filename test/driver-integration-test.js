/**
 * Driver Performance Agent Integration Test
 * Tests the agent with actual MCP connection
 */

import { DriverPerformanceAgent } from '../src/agents/driverPerformanceAgent.js';
import { F1LangGraphAdapter } from '../src/adapters/langGraphAdapter.js';
import { F1McpClient } from '../src/adapters/f1McpClient.js';

async function testDriverPerformanceIntegration() {
  console.log('🧪 Driver Performance Agent Integration Test\n');

  try {
    // Initialize components
    console.log('🔧 Initializing F1 MCP Client...');
    const mcpClient = new F1McpClient();
    await mcpClient.connect();
    console.log('✅ F1 MCP Client connected');

    console.log('🔧 Initializing LangGraph Adapter...');
    const adapter = new F1LangGraphAdapter(mcpClient);
    await adapter.initialize();
    console.log('✅ LangGraph Adapter initialized');

    console.log('🔧 Creating Driver Performance Agent...');
    const agent = new DriverPerformanceAgent(adapter);
    console.log('✅ Driver Performance Agent created');

    // Test with a simple query (mock mode for now)
    console.log('\n🧪 Testing with simple query...');
    const mockResult = await agent.analyzeDriver(
      "Tell me about Lewis Hamilton's career highlights",
    );

    console.log('✅ Query processed successfully!');
    console.log('Result keys:', Object.keys(mockResult));
    console.log('Messages:', mockResult.messages?.length || 0);

    // Cleanup
    await mcpClient.disconnect();
    console.log('\n🎉 Integration test completed successfully!');

    return true;
  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    return false;
  }
}

// Run test
testDriverPerformanceIntegration()
  .then((success) => {
    console.log(success ? '\n✅ All tests passed!' : '\n❌ Tests failed!');
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n💥 Test crashed:', error);
    process.exit(1);
  });
