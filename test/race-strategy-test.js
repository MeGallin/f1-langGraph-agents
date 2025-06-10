/**
 * Race Strategy Agent Quick Test
 */

async function testRaceStrategyAgent() {
  console.log('🧪 Testing Race Strategy Agent...');

  try {
    // Test import
    const { RaceStrategyAgent } = await import(
      '../src/agents/raceStrategyAgent.js'
    );
    console.log('✅ Race Strategy Agent imported successfully');

    // Test instantiation with mock adapter
    const mockAdapter = {
      invoke: async (tool, params) => {
        return [{ raceId: 'monaco2023', season: 2023, round: 6 }];
      },
    };

    const agent = new RaceStrategyAgent(mockAdapter);
    console.log('✅ Race Strategy Agent created successfully');

    console.log('🎉 Race Strategy Agent basic test passed!');
    return true;
  } catch (error) {
    console.error('❌ Race Strategy Agent test failed:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

testRaceStrategyAgent().then((success) => {
  process.exit(success ? 0 : 1);
});
