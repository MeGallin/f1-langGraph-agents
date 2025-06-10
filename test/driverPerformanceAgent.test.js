/**
 * Driver Performance Agent Test
 *
 * Individual test for the Driver Performance Agent to ensure
 * it works correctly before proceeding with other agents.
 */

import { DriverPerformanceAgent } from '../src/agents/driverPerformanceAgent.js';
import { F1LangGraphAdapter } from '../src/adapters/langGraphAdapter.js';
import { F1McpClient } from '../src/adapters/f1McpClient.js';
import logger from '../src/utils/logger.js';

class DriverPerformanceAgentTester {
  constructor() {
    this.mcpClient = null;
    this.adapter = null;
    this.agent = null;
  }

  async initialize() {
    try {
      console.log('🔧 Initializing Driver Performance Agent Test...');

      // Initialize MCP client
      this.mcpClient = new F1McpClient();
      await this.mcpClient.connect();
      console.log('✅ F1 MCP Client connected');

      // Initialize LangGraph adapter
      this.adapter = new F1LangGraphAdapter(this.mcpClient);
      await this.adapter.initialize();
      console.log('✅ LangGraph Adapter initialized');

      // Initialize Driver Performance Agent
      this.agent = new DriverPerformanceAgent(this.adapter);
      console.log('✅ Driver Performance Agent created');

      return true;
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      return false;
    }
  }

  async testBasicFunctionality() {
    console.log('\n🧪 Testing basic Driver Performance Agent functionality...');

    try {
      // Test 1: Simple driver analysis
      console.log('\n📊 Test 1: Analyzing Lewis Hamilton career...');
      const hamiltonResult = await this.agent.analyzeDriver(
        "Analyze Lewis Hamilton's career performance and achievements",
      );

      console.log('Result summary:', hamiltonResult.synthesis?.summary);
      console.log(
        'Key findings:',
        hamiltonResult.synthesis?.keyFindings?.slice(0, 3),
      );
      console.log(
        'Confidence:',
        hamiltonResult.synthesis?.metadata?.confidence,
      );

      if (hamiltonResult.synthesis) {
        console.log('✅ Test 1 passed: Hamilton analysis completed');
      } else {
        console.log('❌ Test 1 failed: No synthesis generated');
        return false;
      }

      // Test 2: Multi-driver comparison
      console.log('\n📊 Test 2: Comparing Hamilton vs Verstappen...');
      const comparisonResult = await this.agent.analyzeDriver(
        'Compare Lewis Hamilton and Max Verstappen career statistics and performance',
      );

      console.log('Result summary:', comparisonResult.synthesis?.summary);
      console.log(
        'Drivers analyzed:',
        comparisonResult.synthesis?.metadata?.driversAnalyzed,
      );

      if (comparisonResult.synthesis?.metadata?.driversAnalyzed?.length >= 1) {
        console.log('✅ Test 2 passed: Multi-driver analysis completed');
      } else {
        console.log('❌ Test 2 failed: Multi-driver analysis failed');
        return false;
      }

      // Test 3: Peak performance analysis
      console.log('\n📊 Test 3: Peak performance analysis...');
      const peakResult = await this.agent.analyzeDriver(
        "When was Sebastian Vettel's peak performance period and what made it special?",
      );

      console.log('Result summary:', peakResult.synthesis?.summary);
      console.log(
        'Analysis type:',
        peakResult.synthesis?.metadata?.analysisType,
      );

      if (peakResult.synthesis) {
        console.log('✅ Test 3 passed: Peak performance analysis completed');
      } else {
        console.log('❌ Test 3 failed: Peak performance analysis failed');
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Basic functionality test failed:', error);
      return false;
    }
  }

  async testWorkflowNodes() {
    console.log('\n🔧 Testing individual workflow nodes...');

    try {
      // Test workflow creation
      const workflow = this.agent.createWorkflow();
      if (workflow) {
        console.log('✅ Workflow creation successful');
      } else {
        console.log('❌ Workflow creation failed');
        return false;
      }

      // Test state creation and validation
      const testState = {
        query: 'Test query for Lewis Hamilton',
        queryAnalysis: {
          drivers: ['Hamilton'],
          seasons: [2020, 2021],
          analysisType: 'career',
        },
      };

      // Test individual node functions (without running full workflow)
      console.log('🔧 Testing analyzeQuery node...');
      const queryResult = await this.agent.analyzeQuery(testState);
      if (queryResult.queryAnalysis) {
        console.log('✅ analyzeQuery node working');
      } else {
        console.log('❌ analyzeQuery node failed');
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Workflow nodes test failed:', error);
      return false;
    }
  }

  async testDataProcessing() {
    console.log('\n📈 Testing data processing functions...');

    try {
      // Test career statistics calculation
      const mockDriverData = {
        careerResults: [
          {
            season: 2020,
            results: [
              { position: '1', points: '25', statusId: '1' },
              { position: '2', points: '18', statusId: '1' },
              { position: '1', points: '25', statusId: '1' },
            ],
          },
          {
            season: 2021,
            results: [
              { position: '1', points: '25', statusId: '1' },
              { position: '3', points: '15', statusId: '1' },
            ],
          },
        ],
      };

      const stats = this.agent.calculateCareerStatistics(mockDriverData);
      console.log('Career stats calculated:', {
        totalRaces: stats.totalRaces,
        wins: stats.wins,
        podiums: stats.podiums,
        winRate: stats.winRate.toFixed(1) + '%',
      });

      if (stats.totalRaces === 5 && stats.wins === 3 && stats.podiums === 5) {
        console.log('✅ Career statistics calculation working correctly');
      } else {
        console.log('❌ Career statistics calculation failed');
        return false;
      }

      // Test team analysis
      const teamAnalysis = this.agent.analyzeDriverTeamChanges(mockDriverData);
      if (teamAnalysis.hasOwnProperty('totalTeamChanges')) {
        console.log('✅ Team change analysis working');
      } else {
        console.log('❌ Team change analysis failed');
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Data processing test failed:', error);
      return false;
    }
  }

  async testErrorHandling() {
    console.log('\n🛡️ Testing error handling...');

    try {
      // Test with invalid driver name
      console.log('🔧 Testing with invalid driver name...');
      const invalidResult = await this.agent.analyzeDriver(
        'Analyze the career of NonExistent Driver',
      );

      // Should complete without throwing, but may have limited data
      if (invalidResult) {
        console.log('✅ Error handling for invalid driver working');
      } else {
        console.log('❌ Error handling failed');
        return false;
      }

      // Test with empty query
      console.log('🔧 Testing with minimal query...');
      const minimalResult = await this.agent.analyzeDriver('driver analysis');

      if (minimalResult) {
        console.log('✅ Error handling for minimal query working');
      } else {
        console.log('❌ Error handling for minimal query failed');
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Error handling test failed:', error);
      return false;
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Driver Performance Agent Test Suite\n');

    // Initialize
    const initSuccess = await this.initialize();
    if (!initSuccess) {
      console.log('❌ Test suite failed at initialization');
      return false;
    }

    // Run tests
    const tests = [
      { name: 'Workflow Nodes', fn: this.testWorkflowNodes.bind(this) },
      { name: 'Data Processing', fn: this.testDataProcessing.bind(this) },
      {
        name: 'Basic Functionality',
        fn: this.testBasicFunctionality.bind(this),
      },
      { name: 'Error Handling', fn: this.testErrorHandling.bind(this) },
    ];

    let passedTests = 0;
    const totalTests = tests.length;

    for (const test of tests) {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`🧪 Running ${test.name} Test`);
      console.log(`${'='.repeat(50)}`);

      try {
        const result = await test.fn();
        if (result) {
          passedTests++;
          console.log(`✅ ${test.name} Test PASSED`);
        } else {
          console.log(`❌ ${test.name} Test FAILED`);
        }
      } catch (error) {
        console.log(`❌ ${test.name} Test FAILED with error:`, error.message);
      }
    }

    // Final results
    console.log(`\n${'='.repeat(60)}`);
    console.log('🏁 TEST SUITE RESULTS');
    console.log(`${'='.repeat(60)}`);
    console.log(`Passed: ${passedTests}/${totalTests} tests`);
    console.log(
      `Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`,
    );

    if (passedTests === totalTests) {
      console.log('🎉 ALL TESTS PASSED! Driver Performance Agent is ready.');
      return true;
    } else {
      console.log(
        '⚠️  Some tests failed. Driver Performance Agent needs fixes.',
      );
      return false;
    }
  }

  async cleanup() {
    try {
      if (this.mcpClient) {
        await this.mcpClient.disconnect();
        console.log('🧹 Cleaned up MCP client connection');
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new DriverPerformanceAgentTester();

  tester
    .runAllTests()
    .then((success) => {
      if (success) {
        console.log('\n🎯 Driver Performance Agent is fully functional!');
        process.exit(0);
      } else {
        console.log('\n🔧 Driver Performance Agent needs debugging.');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n💥 Test suite crashed:', error);
      process.exit(1);
    })
    .finally(() => {
      tester.cleanup();
    });
}

export { DriverPerformanceAgentTester };
