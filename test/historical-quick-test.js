/**
 * Simple Historical Comparison Agent Test
 */

async function testHistoricalAgent() {
  console.log('🧪 Testing Historical Comparison Agent...');

  try {
    // Test import
    const { HistoricalComparisonAgent } = await import(
      '../src/agents/historicalComparisonAgent.js'
    );
    console.log('✅ Historical Comparison Agent imported successfully');

    // Test instantiation with mock adapter
    const mockAdapter = {
      invoke: async (tool, params) => {
        return [{ season: 2023, raceName: 'Monaco Grand Prix' }];
      },
    };

    // Create mock model to avoid API calls
    const mockModel = {
      invoke: async (messages) => {
        return {
          content: JSON.stringify({
            comparisonType: 'drivers',
            drivers: ['Hamilton', 'Senna'],
            metrics: ['wins', 'championships'],
          }),
        };
      },
    };

    const agent = new HistoricalComparisonAgent(mockAdapter, {
      model: mockModel,
    });
    console.log('✅ Historical Comparison Agent created successfully');

    // Test workflow creation
    const workflow = agent.createWorkflow();
    if (workflow) {
      console.log('✅ Workflow created successfully');
    }

    console.log('🎉 Historical Comparison Agent basic test passed!');
    return true;
  } catch (error) {
    console.error('❌ Historical Comparison Agent test failed:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

testHistoricalAgent().then((success) => {
  process.exit(success ? 0 : 1);
});
