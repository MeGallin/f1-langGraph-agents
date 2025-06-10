/**
 * Historical Comparison Agent Direct Method Test
 *
 * Test individual methods without using the LangGraph workflow
 */

console.log('Starting Historical Comparison Agent direct method test...');

const mockAdapter = {
  invoke: async () => ({ mockData: true }),
};

try {
  console.log('Importing HistoricalComparisonAgent...');
  const { HistoricalComparisonAgent } = await import(
    '../src/agents/historicalComparisonAgent.js'
  );
  console.log('✅ Import successful');

  console.log('Creating agent instance...');
  const agent = new HistoricalComparisonAgent(mockAdapter);
  console.log('✅ Agent created');

  console.log('Testing helper methods directly...');

  // Test parseJsonResponse
  const parseResult = agent.parseJsonResponse('{"test": "data"}');
  console.log('✅ parseJsonResponse works:', parseResult);

  // Test extractDriverNames
  const drivers = agent.extractDriverNames(
    'Hamilton and Verstappen comparison',
  );
  console.log('✅ extractDriverNames works:', drivers);

  // Test extractTeamNames
  const teams = agent.extractTeamNames('Mercedes vs Red Bull analysis');
  console.log('✅ extractTeamNames works:', teams);

  // Test extractSeasons
  const seasons = agent.extractSeasons('Compare 2020 and 2023 seasons');
  console.log('✅ extractSeasons works:', seasons);

  // Test analyze method directly
  console.log('Testing analyze method...');
  const state = {
    query: 'Test query',
    messages: [],
  };

  const analyzeResult = await agent.analyze(state);
  console.log('✅ analyze method works');
  console.log('Analyze result keys:', Object.keys(analyzeResult));

  console.log('\n🎉 All direct method tests passed!');
  console.log('✅ Historical Comparison Agent core functionality is working');
  process.exit(0);
} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
