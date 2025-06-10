/**
 * Historical Comparison Agent Comprehensive Test
 *
 * Individual test for the Historical Comparison Agent to ensure
 * it works correctly before proceeding with the final orchestrator.
 */

import { HistoricalComparisonAgent } from '../src/agents/historicalComparisonAgent.js';
import logger from '../src/utils/logger.js';

class HistoricalComparisonAgentTester {
  constructor() {
    this.agent = null;
  }

  async initialize() {
    try {
      console.log(
        '🧪 Initializing Historical Comparison Agent test environment...',
      );

      // Create mock adapter for testing
      this.mockAdapter = {
        invoke: async (tool, params) => {
          console.log(`📞 Mock call to ${tool} with params:`, params);

          switch (tool) {
            case 'get_races':
              return Array.from({ length: 20 }, (_, i) => ({
                season: params.season,
                round: i + 1,
                raceName: `Race ${i + 1}`,
                date: `${params.season}-${String(
                  Math.floor(i / 2) + 3,
                ).padStart(2, '0')}-${String((i % 2) * 15 + 5).padStart(
                  2,
                  '0',
                )}`,
              }));

            case 'get_driver_standings':
              const mockDrivers = {
                2020: [
                  {
                    Driver: { familyName: 'Hamilton', givenName: 'Lewis' },
                    points: '347',
                    position: '1',
                  },
                  {
                    Driver: { familyName: 'Bottas', givenName: 'Valtteri' },
                    points: '223',
                    position: '2',
                  },
                ],
                2021: [
                  {
                    Driver: { familyName: 'Verstappen', givenName: 'Max' },
                    points: '395',
                    position: '1',
                  },
                  {
                    Driver: { familyName: 'Hamilton', givenName: 'Lewis' },
                    points: '387',
                    position: '2',
                  },
                ],
                1988: [
                  {
                    Driver: { familyName: 'Senna', givenName: 'Ayrton' },
                    points: '90',
                    position: '1',
                  },
                  {
                    Driver: { familyName: 'Prost', givenName: 'Alain' },
                    points: '87',
                    position: '2',
                  },
                ],
              };
              return mockDrivers[params.season] || [];

            case 'get_constructor_standings':
              const mockConstructors = {
                2020: [
                  {
                    Constructor: { name: 'Mercedes' },
                    points: '573',
                    position: '1',
                  },
                  {
                    Constructor: { name: 'Red Bull' },
                    points: '319',
                    position: '2',
                  },
                ],
                2021: [
                  {
                    Constructor: { name: 'Mercedes' },
                    points: '613',
                    position: '1',
                  },
                  {
                    Constructor: { name: 'Red Bull' },
                    points: '585',
                    position: '2',
                  },
                ],
              };
              return mockConstructors[params.season] || [];

            default:
              return [];
          }
        },
      };

      // Create mock model to avoid API calls
      this.mockModel = {
        invoke: async (messages) => {
          const lastMessage = messages[messages.length - 1];
          if (
            lastMessage?.content?.includes('historical') ||
            lastMessage?.content?.includes('compare')
          ) {
            return {
              content: JSON.stringify({
                comparisonType: 'drivers',
                drivers: ['Hamilton', 'Verstappen', 'Senna'],
                teams: ['Mercedes', 'Red Bull', 'McLaren'],
                seasons: [1988, 2020, 2021],
                metrics: ['wins', 'championships', 'consistency'],
                eras: ['Turbo Era', 'Modern Hybrid Era'],
              }),
            };
          }
          return {
            content:
              'Mock AI response for historical comparison analysis with cross-era insights and era-adjusted performance metrics.',
          };
        },
      };

      // Create agent instance
      this.agent = new HistoricalComparisonAgent(this.mockAdapter, {
        model: this.mockModel,
      });

      console.log(
        '✅ Historical Comparison Agent test environment initialized',
      );
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize test environment:', error);
      return false;
    }
  }

  async testBasicFunctionality() {
    console.log(
      '\n🔧 Testing basic Historical Comparison Agent functionality...',
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
    console.log('\n🔍 Testing Historical Comparison Agent helper methods...');

    try {
      // Test era identification
      console.log('🗓️ Testing era identification...');
      const mockDriverData = {
        name: 'Lewis Hamilton',
        careerSpan: { start: 2007, end: 2024 },
      };

      const driverEras = this.agent.identifyDriverEras(mockDriverData);
      if (driverEras && driverEras.length > 0) {
        console.log('✅ Driver era identification working');
        console.log(
          `   Identified ${driverEras.length} eras for driver career`,
        );
        console.log(`   First era: ${driverEras[0].name}`);
      } else {
        console.log('❌ Driver era identification failed');
        return false;
      }

      // Test season era identification
      console.log('📅 Testing season era identification...');
      const era2020 = this.agent.identifySeasonEra(2020);
      const era1988 = this.agent.identifySeasonEra(1988);

      if (era2020 && era1988) {
        console.log('✅ Season era identification working');
        console.log(`   2020 era: ${era2020}`);
        console.log(`   1988 era: ${era1988}`);
      } else {
        console.log('❌ Season era identification failed');
        return false;
      }

      // Test metric normalization
      console.log('📊 Testing metric normalization...');
      const mockSubject = {
        name: 'Test Driver',
        type: 'driver',
        data: { wins: 50, podiums: 100, totalPoints: 2000, championships: 5 },
      };
      const mockEraContext = [{ name: 'Modern Era', start: 2010, end: 2024 }];

      const normalized = this.agent.normalizeSubjectMetrics(
        mockSubject,
        mockEraContext,
      );
      if (
        normalized &&
        normalized.rawMetrics &&
        normalized.eraAdjustedMetrics
      ) {
        console.log('✅ Metric normalization working');
        console.log(`   Raw wins: ${normalized.rawMetrics.wins}`);
        console.log(
          `   Normalized win rate: ${normalized.eraAdjustedMetrics.normalizedWinRate}`,
        );
      } else {
        console.log('❌ Metric normalization failed');
        return false;
      }

      // Test rule change identification
      console.log('📋 Testing rule change identification...');
      const ruleChanges2014 = this.agent.identifyRuleChanges(2014);
      const ruleChanges2021 = this.agent.identifyRuleChanges(2021);

      if (ruleChanges2014.length > 0 && ruleChanges2021.length > 0) {
        console.log('✅ Rule change identification working');
        console.log(`   2014 changes: ${ruleChanges2014.length} identified`);
        console.log(`   2021 changes: ${ruleChanges2021.length} identified`);
      } else {
        console.log('❌ Rule change identification failed');
        return false;
      }

      // Test competitiveness calculation
      console.log('🏁 Testing competitiveness calculation...');
      const mockStandings = [
        { points: '347' },
        { points: '223' },
        { points: '125' },
        { points: '105' },
      ];

      const competitiveness =
        this.agent.calculateSeasonCompetitiveness(mockStandings);
      if (
        typeof competitiveness === 'number' &&
        competitiveness >= 0 &&
        competitiveness <= 1
      ) {
        console.log('✅ Competitiveness calculation working');
        console.log(
          `   Season competitiveness: ${(competitiveness * 100).toFixed(1)}%`,
        );
      } else {
        console.log('❌ Competitiveness calculation failed');
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
        query: 'Compare Lewis Hamilton and Ayrton Senna across their careers',
        queryAnalysis: {
          comparisonType: 'drivers',
          drivers: ['Hamilton', 'Senna'],
          eras: ['Turbo Era', 'Modern Hybrid Era'],
          metrics: ['wins', 'championships', 'consistency'],
        },
        comparisonSubjects: [
          {
            type: 'driver',
            name: 'Hamilton',
            data: {
              wins: 103,
              championships: 7,
              careerSpan: { start: 2007, end: 2024 },
            },
          },
          {
            type: 'driver',
            name: 'Senna',
            data: {
              wins: 41,
              championships: 3,
              careerSpan: { start: 1984, end: 1994 },
            },
          },
        ],
        historicalData: {
          driver_hamilton: { wins: 103, championships: 7 },
          driver_senna: { wins: 41, championships: 3 },
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

      console.log('🔧 Testing identifyEraContexts node...');
      const eraResult = await this.agent.identifyEraContexts(testState);
      if (eraResult.eraContexts) {
        console.log('✅ identifyEraContexts node working');
        console.log(
          `   Identified eras for ${
            Object.keys(eraResult.eraContexts).length
          } subjects`,
        );
      } else {
        console.log('❌ identifyEraContexts node failed');
        return false;
      }

      console.log('🔧 Testing normalizeMetrics node...');
      const normalizeResult = await this.agent.normalizeMetrics({
        ...testState,
        eraContexts: eraResult.eraContexts,
      });
      if (normalizeResult.normalizedMetrics) {
        console.log('✅ normalizeMetrics node working');
        console.log(
          `   Normalized metrics for ${
            Object.keys(normalizeResult.normalizedMetrics).length
          } subjects`,
        );
      } else {
        console.log('❌ normalizeMetrics node failed');
        return false;
      }

      console.log('🔧 Testing performComparison node...');
      const comparisonResult = await this.agent.performComparison({
        ...testState,
        normalizedMetrics: normalizeResult.normalizedMetrics,
      });
      if (comparisonResult.comparativeAnalysis) {
        console.log('✅ performComparison node working');
      } else {
        console.log('❌ performComparison node failed');
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
    console.log('\n🚀 Testing full Historical Comparison Agent workflow...');

    try {
      const testQuery =
        'Compare Lewis Hamilton and Michael Schumacher across their F1 careers, focusing on championship wins and era-adjusted performance';

      console.log(`🔍 Running analysis for: "${testQuery}"`);

      const result = await this.agent.compareHistorical(testQuery);

      if (result && result.results) {
        console.log('✅ Full workflow execution successful');
        console.log(
          `   Analysis type: ${
            result.results.metadata?.analysisType || 'unknown'
          }`,
        );
        console.log(
          `   Subjects compared: ${
            result.results.metadata?.subjectsCompared?.length || 0
          }`,
        );
        console.log(
          `   Confidence: ${result.results.metadata?.confidence || 'unknown'}`,
        );

        if (
          result.results.keyFindings &&
          result.results.keyFindings.length > 0
        ) {
          console.log(
            `   Key findings: ${result.results.keyFindings.length} identified`,
          );
        }

        if (
          result.results.eraAdjustedRankings &&
          result.results.eraAdjustedRankings.length > 0
        ) {
          console.log(
            `   Era-adjusted rankings: ${result.results.eraAdjustedRankings.length} subjects ranked`,
          );
        }

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
      '🏛️ Starting comprehensive Historical Comparison Agent tests...\n',
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
    console.log('📊 HISTORICAL COMPARISON AGENT TEST SUMMARY');
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
        '🎉 ALL TESTS PASSED! Historical Comparison Agent is fully functional.',
      );
      return true;
    } else {
      console.log(
        '⚠️  Some tests failed. Historical Comparison Agent needs attention.',
      );
      return false;
    }
  }
}

// Run the comprehensive test
async function runHistoricalComparisonAgentTest() {
  const tester = new HistoricalComparisonAgentTester();

  const initialized = await tester.initialize();
  if (!initialized) {
    console.error('❌ Failed to initialize test environment');
    process.exit(1);
  }

  const success = await tester.runAllTests();
  process.exit(success ? 0 : 1);
}

runHistoricalComparisonAgentTest().catch((error) => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});
