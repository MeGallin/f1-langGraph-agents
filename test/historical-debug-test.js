/**
 * Historical Comparison Agent Debug Test
 *
 * Simple test to identify what's causing the hanging issue
 */

console.log('Starting Historical Comparison Agent debug test...');

try {
  console.log('Attempting to import HistoricalComparisonAgent...');

  // Try importing just the class
  import('../src/agents/historicalComparisonAgent.js')
    .then((module) => {
      console.log('✅ Import successful');

      // Try instantiating with mock adapter
      const mockAdapter = {
        invoke: async (tool, params) => {
          console.log(`Mock adapter called with tool: ${tool}`);
          return { mockData: true };
        },
      };

      console.log('Attempting to instantiate agent...');
      const agent = new module.HistoricalComparisonAgent(mockAdapter);
      console.log('✅ Agent instantiated successfully');

      console.log('Testing basic method calls...');

      // Test parseJsonResponse which seems problematic
      try {
        const result = agent.parseJsonResponse('{"test": "data"}');
        console.log('✅ parseJsonResponse worked');
      } catch (error) {
        console.log('❌ parseJsonResponse failed:', error.message);
      }
    })
    .catch((error) => {
      console.log('❌ Import failed:', error.message);
      console.log('Stack trace:', error.stack);
    });
} catch (error) {
  console.log('❌ Outer catch - error:', error.message);
}

console.log('Debug test script completed');
