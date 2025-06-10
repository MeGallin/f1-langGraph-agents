/**
 * Historical Comparison Agent Quick Test
 */

console.log('Starting Historical Comparison Agent quick test...');

const mockAdapter = {
  invoke: async () => ({ mockData: true }),
};

const mockModel = {
  invoke: async () => ({
    content:
      '{"comparisonType": "drivers", "drivers": ["Hamilton"], "teams": [], "seasons": [], "metrics": ["wins"]}',
  }),
};

try {
  console.log('Importing HistoricalComparisonAgent...');
  const { HistoricalComparisonAgent } = await import(
    '../src/agents/historicalComparisonAgent.js'
  );
  console.log('✅ Import successful');

  console.log('Creating agent instance...');
  const agent = new HistoricalComparisonAgent(mockAdapter, {
    model: mockModel,
  });
  console.log('✅ Agent created');

  console.log('Testing compareHistorical method...');
  const result = await agent.compareHistorical('Test Hamilton performance');
  console.log('✅ compareHistorical successful');
  console.log('Result keys:', Object.keys(result));

  console.log('\n🎉 Historical Comparison Agent is working correctly!');
  process.exit(0);
} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
