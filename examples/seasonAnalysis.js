import SeasonAnalysisAgent from '../src/agents/seasonAnalysisAgent.js';
import logger from '../src/utils/logger.js';

/**
 * Example usage of the F1 Season Analysis Agent
 */
async function runSeasonAnalysisExamples() {
  try {
    console.log('🏁 F1 Season Analysis Agent Examples\n');

    // Initialize the agent
    console.log('Initializing Season Analysis Agent...');
    const agent = new SeasonAnalysisAgent();
    await agent.initialize();
    console.log('✅ Agent initialized successfully\n');

    // Example 1: Single season analysis
    console.log('📊 Example 1: Single Season Analysis (2023)');
    console.log('Query: "Analyze the 2023 F1 season performance"');

    const result1 = await agent.analyze(
      'Analyze the 2023 F1 season performance',
    );

    console.log('\n📋 Results:');
    console.log(`Confidence: ${result1.confidence}`);
    console.log(`Analysis Type: ${result1.analysisType}`);
    console.log(`Seasons Analyzed: ${result1.seasons?.join(', ')}`);
    console.log('\n💡 Final Response:');
    console.log(result1.finalResponse);
    console.log('\n' + '='.repeat(80) + '\n');

    // Example 2: Constructor comparison
    console.log('🏎️ Example 2: Constructor Analysis');
    console.log(
      'Query: "How did Red Bull perform in 2023 compared to Mercedes and Ferrari?"',
    );

    const result2 = await agent.analyze(
      'How did Red Bull perform in 2023 compared to Mercedes and Ferrari?',
    );

    console.log('\n📋 Results:');
    console.log(`Confidence: ${result2.confidence}`);
    console.log('\n💡 Final Response:');
    console.log(result2.finalResponse);
    console.log('\n' + '='.repeat(80) + '\n');

    // Example 3: Multi-season trends
    console.log('📈 Example 3: Multi-Season Trends');
    console.log('Query: "Compare the championship battles from 2021 to 2023"');

    const result3 = await agent.analyze(
      'Compare the championship battles from 2021 to 2023',
    );

    console.log('\n📋 Results:');
    console.log(`Confidence: ${result3.confidence}`);
    console.log(`Analysis Type: ${result3.analysisType}`);
    console.log(`Seasons Analyzed: ${result3.seasons?.join(', ')}`);
    console.log('\n💡 Final Response:');
    console.log(result3.finalResponse);
    console.log('\n' + '='.repeat(80) + '\n');

    console.log('✅ All examples completed successfully!');
  } catch (error) {
    console.error('❌ Error running examples:', error.message);
    logger.error('Example execution failed', { error: error.message });
  }
}

// Example API usage
async function runAPIExample() {
  try {
    console.log('\n🌐 API Usage Example\n');

    const apiUrl = 'http://localhost:3000';

    console.log('Testing API endpoints...');

    // Health check
    const healthResponse = await fetch(`${apiUrl}/health`);
    const health = await healthResponse.json();
    console.log('Health Check:', health);

    // Agent info
    const agentsResponse = await fetch(`${apiUrl}/agents`);
    const agents = await agentsResponse.json();
    console.log('Available Agents:', agents);

    // Season analysis
    const analysisResponse = await fetch(`${apiUrl}/agents/season/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'What made the 2023 F1 season so exciting?',
        options: {
          threadId: 'example_thread',
        },
      }),
    });

    const analysis = await analysisResponse.json();
    console.log('\nAPI Analysis Result:');
    console.log(`Success: ${analysis.success}`);
    console.log(`Confidence: ${analysis.result?.confidence}`);
    console.log(
      `Response: ${analysis.result?.finalResponse?.substring(0, 200)}...`,
    );
  } catch (error) {
    console.error('❌ API Example failed:', error.message);
  }
}

// Run examples
async function main() {
  console.log('🏎️ F1 LangGraph Agents - Examples\n');

  // Check if we should run API examples
  const runAPI = process.argv.includes('--api');

  if (runAPI) {
    await runAPIExample();
  } else {
    await runSeasonAnalysisExamples();

    console.log(
      '\n📝 To test API endpoints, run: node examples/seasonAnalysis.js --api',
    );
    console.log('💡 Make sure the server is running: npm start');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { runSeasonAnalysisExamples, runAPIExample };
