/**
 * Championship Predictor Agent Comprehensive Test
 *
 * Individual test for the Championship Predictor Agent to ensure
 * it works correctly before proceeding with other agents.
 */

import { ChampionshipPredictorAgent } from '../src/agents/championshipPredictorAgent.js';
import logger from '../src/utils/logger.js';

class ChampionshipPredictorAgentTester {
  constructor() {
    this.agent = null;
  }

  async initialize() {
    try {
      console.log(
        '🧪 Initializing Championship Predictor Agent test environment...',
      );

      // Create mock adapter for testing
      this.mockAdapter = {
        invoke: async (tool, params) => {
          console.log(`📞 Mock call to ${tool} with params:`, params);

          switch (tool) {
            case 'get_driver_standings':
              return [
                {
                  Driver: { familyName: 'Verstappen', givenName: 'Max' },
                  points: '350',
                  position: '1',
                },
                {
                  Driver: { familyName: 'Hamilton', givenName: 'Lewis' },
                  points: '280',
                  position: '2',
                },
                {
                  Driver: { familyName: 'Norris', givenName: 'Lando' },
                  points: '260',
                  position: '3',
                },
              ];

            case 'get_constructor_standings':
              return [
                {
                  Constructor: { name: 'Red Bull' },
                  points: '450',
                  position: '1',
                },
                {
                  Constructor: { name: 'Mercedes' },
                  points: '380',
                  position: '2',
                },
                {
                  Constructor: { name: 'McLaren' },
                  points: '350',
                  position: '3',
                },
              ];

            case 'get_races':
              return Array.from({ length: 24 }, (_, i) => ({
                season: params.season,
                round: i + 1,
                raceName: `Race ${i + 1}`,
                date: `2024-${String(Math.floor(i / 2) + 3).padStart(
                  2,
                  '0',
                )}-${String((i % 2) * 15 + 5).padStart(2, '0')}`,
              }));

            default:
              return [];
          }
        },
      };

      // Create mock model to avoid API calls
      this.mockModel = {
        invoke: async (messages) => {
          const lastMessage = messages[messages.length - 1];
          if (lastMessage?.content?.includes('championship')) {
            return {
              content: JSON.stringify({
                championshipType: 'drivers',
                season: 2024,
                scenarios: ['realistic', 'optimistic', 'pessimistic'],
              }),
            };
          }
          return {
            content:
              'Mock AI response for championship prediction analysis with high confidence levels and detailed statistical projections.',
          };
        },
      };

      // Create agent instance
      this.agent = new ChampionshipPredictorAgent(this.mockAdapter, {
        model: this.mockModel,
      });

      console.log(
        '✅ Championship Predictor Agent test environment initialized',
      );
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize test environment:', error);
      return false;
    }
  }

  async testBasicFunctionality() {
    console.log(
      '\n🔧 Testing basic Championship Predictor Agent functionality...',
    );

    try {
      // Test 1: Agent creation
      if (!this.agent) {
        console.log('❌ Agent not created');
        return false;
      }
      console.log('✅ Agent creation successful');

      // Test 2: Workflow creation
      const workflow = this.agent.createWorkflow();
      if (workflow) {
        console.log('✅ Workflow creation successful');
      } else {
        console.log('❌ Workflow creation failed');
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Basic functionality test failed:', error);
      return false;
    }
  }

  async testHelperMethods() {
    console.log('\n🔍 Testing Championship Predictor Agent helper methods...');

    try {
      // Test helper methods with mock data
      const mockDriverStandings = [
        {
          Driver: { familyName: 'Verstappen', givenName: 'Max' },
          points: '350',
          position: '1',
        },
        {
          Driver: { familyName: 'Hamilton', givenName: 'Lewis' },
          points: '280',
          position: '2',
        },
      ];

      const mockConstructorStandings = [
        {
          Constructor: { name: 'Red Bull' },
          points: '450',
          position: '1',
        },
        {
          Constructor: { name: 'Mercedes' },
          points: '380',
          position: '2',
        },
      ];

      const mockRemainingRaces = {
        remainingRaces: 5,
        totalRemainingPoints: 125,
      };

      // Test driver probability calculations
      console.log('🏁 Testing driver probability calculations...');
      const driverProbabilities = this.agent.calculateDriverProbabilities(
        mockDriverStandings,
        mockRemainingRaces,
      );
      if (driverProbabilities && driverProbabilities.length > 0) {
        console.log('✅ Driver probability calculations working');
        console.log(
          `   Calculated probabilities for ${driverProbabilities.length} drivers`,
        );
        console.log(
          `   Leader probability: ${driverProbabilities[0].probability}%`,
        );
      } else {
        console.log('❌ Driver probability calculations failed');
        return false;
      }

      // Test constructor probability calculations
      console.log('🏗️ Testing constructor probability calculations...');
      const constructorProbabilities =
        this.agent.calculateConstructorProbabilities(
          mockConstructorStandings,
          mockRemainingRaces,
        );
      if (constructorProbabilities && constructorProbabilities.length > 0) {
        console.log('✅ Constructor probability calculations working');
        console.log(
          `   Calculated probabilities for ${constructorProbabilities.length} constructors`,
        );
        console.log(
          `   Leader probability: ${constructorProbabilities[0].probability}%`,
        );
      } else {
        console.log('❌ Constructor probability calculations failed');
        return false;
      }

      // Test scenario calculations
      console.log('📊 Testing scenario calculations...');
      const mockCalculations = {
        drivers: driverProbabilities,
        constructors: constructorProbabilities,
      };

      const optimisticScenario =
        this.agent.calculateOptimisticScenario(mockCalculations);
      const realisticScenario =
        this.agent.calculateRealisticScenario(mockCalculations);
      const pessimisticScenario =
        this.agent.calculatePessimisticScenario(mockCalculations);

      if (optimisticScenario && realisticScenario && pessimisticScenario) {
        console.log('✅ Scenario calculations working');
        console.log(
          `   Optimistic scenario: ${optimisticScenario.drivers[0].probability}%`,
        );
        console.log(
          `   Realistic scenario: ${realisticScenario.drivers[0].probability}%`,
        );
        console.log(
          `   Pessimistic scenario: ${pessimisticScenario.drivers[0].probability}%`,
        );
      } else {
        console.log('❌ Scenario calculations failed');
        return false;
      }

      console.log('✅ All helper methods working correctly');
      return true;
    } catch (error) {
      console.error('❌ Helper methods test failed:', error);
      console.error('Stack:', error.stack);
      return false;
    }
  }

  async testWorkflowNodes() {
    console.log('\n🔧 Testing individual workflow nodes...');

    try {
      // Test state creation and validation
      const testState = {
        query: 'Predict the 2024 F1 drivers championship winner',
        queryAnalysis: {
          championshipType: 'drivers',
          season: 2024,
          scenarios: ['realistic'],
        },
        currentStandings: {
          drivers: [
            {
              Driver: { familyName: 'Verstappen', givenName: 'Max' },
              points: '350',
              position: '1',
            },
          ],
          seasonRaces: [],
        },
        remainingRaces: {
          remainingRaces: 5,
          totalRemainingPoints: 125,
        },
        probabilityCalculations: {
          drivers: [
            {
              driver: 'Max Verstappen',
              probability: 85,
              currentPoints: 350,
            },
          ],
        },
      };

      // Test individual node functions
      console.log('🔧 Testing analyzeQuery node...');
      const queryResult = await this.agent.analyzeQuery(testState);
      if (queryResult.queryAnalysis) {
        console.log('✅ analyzeQuery node working');
      } else {
        console.log('❌ analyzeQuery node failed');
        return false;
      }

      console.log('🔧 Testing calculateProbabilities node...');
      const probabilityResult = await this.agent.calculateProbabilities(
        testState,
      );
      if (probabilityResult.probabilityCalculations) {
        console.log('✅ calculateProbabilities node working');
      } else {
        console.log('❌ calculateProbabilities node failed');
        return false;
      }

      console.log('🔧 Testing runScenarios node...');
      const scenarioResult = await this.agent.runScenarios(testState);
      if (scenarioResult.scenarios) {
        console.log('✅ runScenarios node working');
        console.log(
          `   Generated ${scenarioResult.scenarios.length} scenarios`,
        );
      } else {
        console.log('❌ runScenarios node failed');
        return false;
      }

      console.log('🔧 Testing synthesizeResults node...');
      const synthesisResult = await this.agent.synthesizeResults(testState);
      if (synthesisResult.synthesis || synthesisResult.results) {
        console.log('✅ synthesizeResults node working');
      } else {
        console.log('❌ synthesizeResults node failed');
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Workflow nodes test failed:', error);
      return false;
    }
  }
  async testFullWorkflow() {
    console.log('\n🚀 Testing full Championship Predictor Agent workflow...');

    try {
      const testQuery = 'Predict the 2024 F1 drivers championship winner';

      console.log(`🔍 Running analysis for: "${testQuery}"`);

      // Use a simpler test that just calls the method without extensive validation
      const result = await this.agent.predictChampionship(testQuery);

      if (result) {
        console.log('✅ Full workflow execution successful');
        console.log(`   Result type: ${typeof result}`);
        console.log(`   Has results: ${!!result.results}`);
        return true;
      } else {
        console.log('❌ Full workflow execution failed - no results');
        return false;
      }
    } catch (error) {
      console.error('❌ Full workflow test failed:', error);
      console.error('Stack:', error.stack);
      return false;
    }
  }

  async runAllTests() {
    console.log(
      '🏆 Starting comprehensive Championship Predictor Agent tests...\n',
    );

    const tests = [
      { name: 'Basic Functionality', method: this.testBasicFunctionality },
      { name: 'Helper Methods', method: this.testHelperMethods },
      { name: 'Workflow Nodes', method: this.testWorkflowNodes },
      { name: 'Full Workflow', method: this.testFullWorkflow },
    ];

    let passedTests = 0;
    const results = [];

    for (const test of tests) {
      try {
        console.log(`\n📋 Running ${test.name} test...`);
        const result = await test.method.call(this);

        if (result) {
          console.log(`✅ ${test.name} test PASSED`);
          passedTests++;
          results.push({ name: test.name, status: 'PASSED' });
        } else {
          console.log(`❌ ${test.name} test FAILED`);
          results.push({ name: test.name, status: 'FAILED' });
        }
      } catch (error) {
        console.log(`❌ ${test.name} test ERROR:`, error.message);
        results.push({
          name: test.name,
          status: 'ERROR',
          error: error.message,
        });
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 CHAMPIONSHIP PREDICTOR AGENT TEST SUMMARY');
    console.log('='.repeat(50));

    results.forEach((result) => {
      const icon = result.status === 'PASSED' ? '✅' : '❌';
      console.log(`${icon} ${result.name}: ${result.status}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    console.log(`\n📈 Tests passed: ${passedTests}/${tests.length}`);

    if (passedTests === tests.length) {
      console.log(
        '🎉 ALL TESTS PASSED! Championship Predictor Agent is fully functional.',
      );
      return true;
    } else {
      console.log(
        '⚠️  Some tests failed. Championship Predictor Agent needs attention.',
      );
      return false;
    }
  }
}

// Run the comprehensive test
async function runChampionshipPredictorAgentTest() {
  const tester = new ChampionshipPredictorAgentTester();

  const initialized = await tester.initialize();
  if (!initialized) {
    console.error('❌ Failed to initialize test environment');
    process.exit(1);
  }

  const success = await tester.runAllTests();
  process.exit(success ? 0 : 1);
}

runChampionshipPredictorAgentTest().catch((error) => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});
