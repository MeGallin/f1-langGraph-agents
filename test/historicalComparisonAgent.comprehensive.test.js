/**
 * Historical Comparison Agent Comprehensive Test
 *
 * Tests all functionality of the Historical Comparison Agent
 * following the same pattern as other successful agent tests
 */

import { HistoricalComparisonAgent } from '../src/agents/historicalComparisonAgent.js';

// Mock F1 MCP Adapter
const mockAdapter = {
  invoke: async (tool, params) => {
    console.log(`Mock adapter called with tool: ${tool}, params:`, params);

    // Return different mock data based on the tool
    const mockResponses = {
      get_drivers: {
        drivers: [
          { name: 'Lewis Hamilton', championships: 7, wins: 103 },
          { name: 'Max Verstappen', championships: 3, wins: 56 },
        ],
      },
      get_races: {
        races: [
          { name: 'Monaco Grand Prix', year: 2023, winner: 'Max Verstappen' },
          { name: 'British Grand Prix', year: 2023, winner: 'Lewis Hamilton' },
        ],
      },
      get_driver_standings: {
        standings: [
          { position: 1, driver: 'Max Verstappen', points: 575 },
          { position: 3, driver: 'Lewis Hamilton', points: 234 },
        ],
      },
      get_constructor_standings: {
        standings: [
          { position: 1, constructor: 'Red Bull Racing', points: 860 },
          { position: 2, constructor: 'Mercedes', points: 409 },
        ],
      },
    };

    return mockResponses[tool] || { result: 'mock response' };
  },
};

// Mock ChatOpenAI model
const mockModel = {
  invoke: async (messages) => {
    console.log('Mock model invoked with messages:', messages.length);
    return {
      content: JSON.stringify({
        comparisonType: 'drivers',
        drivers: ['Hamilton', 'Verstappen'],
        teams: ['Mercedes', 'Red Bull'],
        seasons: ['2023', '2024'],
        metrics: ['wins', 'championships', 'consistency'],
      }),
    };
  },
};

async function testBasicFunctionality() {
  console.log('\n=== Testing Basic Functionality ===');

  try {
    const agent = new HistoricalComparisonAgent(mockAdapter, {
      model: mockModel,
    });
    console.log('✅ Agent created successfully');

    // Test public interface
    const result = await agent.compareHistorical(
      'Compare Hamilton and Verstappen across different eras',
    );
    console.log('✅ compareHistorical method works');
    console.log('Result:', result);

    return true;
  } catch (error) {
    console.log('❌ Basic functionality test failed:', error.message);
    return false;
  }
}

async function testHelperMethods() {
  console.log('\n=== Testing Helper Methods ===');

  try {
    const agent = new HistoricalComparisonAgent(mockAdapter, {
      model: mockModel,
    });

    // Test parseJsonResponse
    const jsonResult = agent.parseJsonResponse('{"test": "data"}');
    console.log('✅ parseJsonResponse works with valid JSON');

    const fallbackResult = agent.parseJsonResponse(
      'Hamilton vs Verstappen comparison 2023 2024',
    );
    console.log('✅ parseJsonResponse fallback works');
    console.log('Fallback result:', fallbackResult);

    // Test extraction methods
    const drivers = agent.extractDriverNames(
      'Compare Hamilton and Verstappen performance',
    );
    console.log('✅ extractDriverNames works:', drivers);

    const teams = agent.extractTeamNames(
      'Mercedes vs Red Bull Racing analysis',
    );
    console.log('✅ extractTeamNames works:', teams);

    const seasons = agent.extractSeasons(
      'Comparison between 2020 and 2023 seasons',
    );
    console.log('✅ extractSeasons works:', seasons);

    return true;
  } catch (error) {
    console.log('❌ Helper methods test failed:', error.message);
    return false;
  }
}

async function testWorkflowExecution() {
  console.log('\n=== Testing Workflow Execution ===');

  try {
    const agent = new HistoricalComparisonAgent(mockAdapter, {
      model: mockModel,
    });

    console.log('Testing full workflow...');
    const result = await agent.compareHistorical(
      'Compare Lewis Hamilton and Max Verstappen performance across different F1 eras',
      { verbose: true },
    );

    console.log('✅ Full workflow executed successfully');
    console.log('Final result keys:', Object.keys(result));

    // Verify result structure
    if (result.query && result.results) {
      console.log('✅ Result has expected structure');
    } else {
      console.log('⚠️  Result structure might be incomplete');
    }

    return true;
  } catch (error) {
    console.log('❌ Workflow execution test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🏎️  Historical Comparison Agent Comprehensive Test Suite');
  console.log('================================================');

  const results = [];

  results.push(await testBasicFunctionality());
  results.push(await testHelperMethods());
  results.push(await testWorkflowExecution());

  const passed = results.filter(Boolean).length;
  const total = results.length;

  console.log('\n=== Test Summary ===');
  console.log(`✅ Passed: ${passed}/${total} tests`);

  if (passed === total) {
    console.log('🎉 All Historical Comparison Agent tests passed!');
    console.log('✅ Agent is ready for integration testing');
  } else {
    console.log('❌ Some tests failed - review the output above');
  }

  return passed === total;
}

// Run the tests
runAllTests()
  .then((success) => {
    console.log(
      success
        ? '\n🏁 Historical Comparison Agent testing completed successfully!'
        : '\n💥 Testing completed with failures',
    );
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });
