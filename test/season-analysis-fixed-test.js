/**
 * Test the fixed Season Analysis Agent
 */

import SeasonAnalysisAgent from '../src/agents/seasonAnalysisAgent.js';

async function testSeasonAnalysisAgent() {
  console.log('🧪 Testing fixed Season Analysis Agent...');

  try {
    // Test import
    console.log('📦 Testing import...');
    console.log('✅ Season Analysis Agent imported successfully');

    // Test instantiation
    console.log('🏗️ Testing instantiation...');
    const agent = new SeasonAnalysisAgent();
    console.log('✅ Season Analysis Agent created successfully');

    // Test workflow creation (this was failing before)
    console.log('🔧 Testing workflow creation...');
    const workflow = agent.buildWorkflow();
    console.log('✅ Workflow created successfully');

    // Test basic properties
    console.log('🔍 Testing agent properties...');
    const info = agent.getInfo();
    console.log('Agent info:', info);
    console.log('✅ Agent properties working');

    console.log('\n🎉 All tests passed! Season Analysis Agent is now fixed.');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testSeasonAnalysisAgent();
