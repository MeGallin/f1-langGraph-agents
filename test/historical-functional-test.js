/**
 * Historical Comparison Agent Quick Test
 */

async function testHistoricalComparisonAgent() {
  console.log('🧪 Testing Historical Comparison Agent...');

  try {
    // First, let's try the basic version
    console.log('Testing basic version...');
    const { HistoricalComparisonAgent: BasicAgent } = await import(
      '../src/agents/historicalComparisonAgentBasic.js'
    );
    console.log('✅ Basic Historical Comparison Agent imported successfully');

    const basicAgent = new BasicAgent({});
    console.log('✅ Basic agent created successfully');

    // Test basic functionality
    const basicResult = await basicAgent.compareHistorical('Test query');
    console.log('✅ Basic agent methods work:', basicResult);

    // Now test the full version
    console.log('Testing full version...');
    const { HistoricalComparisonAgent } = await import(
      '../src/agents/historicalComparisonAgent.js'
    );
    console.log('✅ Full Historical Comparison Agent imported successfully');

    // Test instantiation with mock adapter
    const mockAdapter = {
      invoke: async (tool, params) => {
        return { mockData: true, tool, params };
      },
    };

    const agent = new HistoricalComparisonAgent(mockAdapter);
    console.log('✅ Full Historical Comparison Agent created successfully');

    // Test helper methods
    const parseResult = agent.parseJsonResponse('{"test": "data"}');
    console.log('✅ parseJsonResponse works:', parseResult);

    const drivers = agent.extractDriverNames('Hamilton vs Verstappen');
    console.log('✅ extractDriverNames works:', drivers);

    console.log('🎉 Historical Comparison Agent tests passed!');
    return true;
  } catch (error) {
    console.error('❌ Historical Comparison Agent test failed:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

// Execute the test
testHistoricalComparisonAgent()
  .then((success) => {
    if (success) {
      console.log(
        '\n🏁 Historical Comparison Agent testing completed successfully!',
      );
      process.exit(0);
    } else {
      console.log('\n💥 Testing failed');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });
