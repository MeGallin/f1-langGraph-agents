/**
 * Race Strategy Agent Comprehensive Test
 *
 * Individual test for the Race Strategy Agent to ensure
 * it works correctly before proceeding with other agents.
 */

import { RaceStrategyAgent } from '../src/agents/raceStrategyAgent.js';
import logger from '../src/utils/logger.js';

class RaceStrategyAgentTester {
  constructor() {
    this.agent = null;
  }

  async initialize() {
    try {
      console.log('🧪 Initializing Race Strategy Agent test environment...');

      // Create mock adapter for testing
      this.mockAdapter = {
        invoke: async (tool, params) => {
          console.log(`📞 Mock call to ${tool} with params:`, params);

          switch (tool) {
            case 'get_races':
              return [
                {
                  season: params.season,
                  round: params.round,
                  raceName: 'Monaco Grand Prix',
                  Circuit: { circuitName: 'Circuit de Monaco' },
                },
              ];

            case 'get_race_results':
              return [
                {
                  Driver: { familyName: 'Verstappen', driverId: 'verstappen' },
                  Constructor: { name: 'Red Bull' },
                  position: '1',
                  grid: '1',
                  status: 'Finished',
                },
                {
                  Driver: { familyName: 'Hamilton', driverId: 'hamilton' },
                  Constructor: { name: 'Mercedes' },
                  position: '2',
                  grid: '3',
                  status: 'Finished',
                },
              ];

            case 'get_qualifying_results':
              return [
                {
                  Driver: { familyName: 'Verstappen' },
                  Constructor: { name: 'Red Bull' },
                  position: '1',
                },
              ];

            case 'get_lap_times':
            case 'get_pit_stops':
              return [];

            default:
              return [];
          }
        },
      };

      // Create mock model to avoid API calls
      this.mockModel = {
        invoke: async (messages) => {
          const lastMessage = messages[messages.length - 1];
          if (lastMessage?.content?.includes('race strategy')) {
            return {
              content: JSON.stringify({
                races: [{ season: 2023, round: 6 }],
                focus: ['pit', 'strategy'],
                analysisType: 'comprehensive',
              }),
            };
          }
          return {
            content:
              'Mock AI response for race strategy analysis with high confidence levels.',
          };
        },
      };

      // Create agent instance
      this.agent = new RaceStrategyAgent(this.mockAdapter, {
        model: this.mockModel,
      });

      console.log('✅ Race Strategy Agent test environment initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize test environment:', error);
      return false;
    }
  }

  async testBasicFunctionality() {
    console.log('\n🔧 Testing basic Race Strategy Agent functionality...');

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
    console.log('\n🔍 Testing Race Strategy Agent helper methods...');

    try {
      // Test helper methods with mock data
      const mockRaceData = {
        race: { raceName: 'Monaco Grand Prix', weather: 'dry' },
        results: [
          {
            Driver: { familyName: 'Verstappen', driverId: 'verstappen' },
            Constructor: { name: 'Red Bull' },
            position: '1',
            grid: '1',
          },
          {
            Driver: { familyName: 'Hamilton', driverId: 'hamilton' },
            Constructor: { name: 'Mercedes' },
            position: '2',
            grid: '3',
          },
        ],
        pitStops: [],
        lapTimes: [],
        qualifying: [],
      };

      // Test pit stop strategy analysis
      console.log('🔧 Testing pit stop strategy analysis...');
      const pitAnalysis = this.agent.analyzePitStopStrategies(mockRaceData);
      if (pitAnalysis && pitAnalysis.strategies) {
        console.log('✅ Pit stop strategy analysis working');
        console.log(
          `   Found ${pitAnalysis.strategies.length} driver strategies`,
        );
      } else {
        console.log('❌ Pit stop strategy analysis failed');
        return false;
      }

      // Test weather strategy evaluation
      console.log('🌦️ Testing weather strategy evaluation...');
      const weatherAnalysis =
        this.agent.evaluateWeatherStrategies(mockRaceData);
      if (weatherAnalysis) {
        console.log('✅ Weather strategy evaluation working');
        console.log(
          `   Weather conditions: ${weatherAnalysis.weatherConditions}`,
        );
      } else {
        console.log('❌ Weather strategy evaluation failed');
        return false;
      }

      // Test tire strategy assessment
      console.log('🏁 Testing tire strategy assessment...');
      const tireAnalysis = this.agent.assessTireChoices(mockRaceData);
      if (tireAnalysis && tireAnalysis.tireStrategies) {
        console.log('✅ Tire strategy assessment working');
        console.log(
          `   Analyzed ${tireAnalysis.tireStrategies.length} tire strategies`,
        );
      } else {
        console.log('❌ Tire strategy assessment failed');
        return false;
      }

      // Test safety car analysis
      console.log('🚨 Testing safety car analysis...');
      const safetyCarAnalysis =
        this.agent.analyzeSafetyCarStrategies(mockRaceData);
      if (safetyCarAnalysis) {
        console.log('✅ Safety car analysis working');
        console.log(
          `   Safety car periods detected: ${safetyCarAnalysis.safetyCarPeriods.length}`,
        );
      } else {
        console.log('❌ Safety car analysis failed');
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
        query: 'Analyze pit stop strategies for Monaco 2023',
        queryAnalysis: {
          races: [{ season: 2023, round: 6 }],
          focus: ['pit', 'strategy'],
          analysisType: 'comprehensive',
        },
        raceData: {
          '2023_6': {
            race: { raceName: 'Monaco Grand Prix' },
            results: [],
            pitStops: [],
            lapTimes: [],
          },
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

      console.log('🔧 Testing analyzePitStrategies node...');
      const pitResult = await this.agent.analyzePitStrategies(testState);
      if (pitResult.pitStrategies) {
        console.log('✅ analyzePitStrategies node working');
      } else {
        console.log('❌ analyzePitStrategies node failed');
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
    console.log('\n🚀 Testing full Race Strategy Agent workflow...');

    try {
      const testQuery =
        'Analyze the pit stop strategies for Monaco 2023, focusing on weather impact and tire choices';

      console.log(`🔍 Running analysis for: "${testQuery}"`);

      const result = await this.agent.analyzeRaceStrategy(testQuery);

      if (result && result.results) {
        console.log('✅ Full workflow execution successful');
        console.log(
          `   Analysis type: ${
            result.results.metadata?.analysisType || 'unknown'
          }`,
        );
        console.log(
          `   Races analyzed: ${
            result.results.metadata?.racesAnalyzed?.length || 0
          }`,
        );
        console.log(
          `   Confidence: ${result.results.metadata?.confidence || 'unknown'}`,
        );
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
    console.log('🏁 Starting comprehensive Race Strategy Agent tests...\n');

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
    console.log('📊 RACE STRATEGY AGENT TEST SUMMARY');
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
        '🎉 ALL TESTS PASSED! Race Strategy Agent is fully functional.',
      );
      return true;
    } else {
      console.log(
        '⚠️  Some tests failed. Race Strategy Agent needs attention.',
      );
      return false;
    }
  }
}

// Run the comprehensive test
async function runRaceStrategyAgentTest() {
  const tester = new RaceStrategyAgentTester();

  const initialized = await tester.initialize();
  if (!initialized) {
    console.error('❌ Failed to initialize test environment');
    process.exit(1);
  }

  const success = await tester.runAllTests();
  process.exit(success ? 0 : 1);
}

runRaceStrategyAgentTest().catch((error) => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});
