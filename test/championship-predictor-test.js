/**
 * Championship Predictor Agent Quick Test
 */

async function testChampionshipPredictorAgent() {
  console.log('🧪 Testing Championship Predictor Agent...');

  try {
    // Test import
    const { ChampionshipPredictorAgent } = await import(
      '../src/agents/championshipPredictorAgent.js'
    );
    console.log('✅ Championship Predictor Agent imported successfully'); // Test instantiation with mock adapter
    const mockAdapter = {
      invoke: async (tool, params) => {
        return [{ driverId: 'verstappen', points: '100', position: '1' }];
      },
    };

    // Create mock model to avoid API calls
    const mockModel = {
      invoke: async (messages) => {
        return {
          content: JSON.stringify({
            championshipType: 'drivers',
            season: 2024,
            scenarios: ['realistic'],
          }),
        };
      },
    };

    const agent = new ChampionshipPredictorAgent(mockAdapter, {
      model: mockModel,
    });
    console.log('✅ Championship Predictor Agent created successfully');

    console.log('🎉 Championship Predictor Agent basic test passed!');
    return true;
  } catch (error) {
    console.error(
      '❌ Championship Predictor Agent test failed:',
      error.message,
    );
    console.error('Stack:', error.stack);
    return false;
  }
}

testChampionshipPredictorAgent().then((success) => {
  process.exit(success ? 0 : 1);
});
