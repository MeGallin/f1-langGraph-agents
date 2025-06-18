#!/usr/bin/env node

/**
 * Test script to verify agents are getting real F1 data from MCP server
 */

import SeasonAnalysisAgent from './src/agents/seasonAnalysisAgent.js';

async function testAgentData() {
  console.log('🤖 Testing Agent Data Integration...\n');

  try {
    // Initialize the Season Analysis Agent
    console.log('1. Initializing Season Analysis Agent...');
    const agent = new SeasonAnalysisAgent();
    await agent.initialize();
    console.log('✅ Agent initialized successfully');
    console.log();

    // Test a simple season analysis query
    console.log('2. Testing season analysis with real data...');
    const query = "Give me a brief summary of the 2024 F1 season drivers";
    
    console.log(`   Query: "${query}"`);
    console.log('   Processing...');
    
    const result = await agent.analyze(query);
    
    console.log('✅ Analysis completed!');
    console.log();
    
    // Check if we got real or mock data
    const isRealData = !result.finalResponse.includes('Mock response') && 
                      !result.finalResponse.includes('mock_data');
    
    console.log('📊 Results:');
    console.log('   Data Source:', isRealData ? 'REAL F1 DATA' : 'MOCK DATA');
    console.log('   Confidence:', result.confidence);
    console.log('   Response Length:', result.finalResponse.length, 'characters');
    console.log();
    console.log('📝 Sample Response:');
    console.log('  ', result.finalResponse.substring(0, 200) + '...');
    console.log();
    
    if (isRealData) {
      console.log('🎉 SUCCESS: Agent is receiving real F1 data from MCP server!');
    } else {
      console.log('⚠️  FALLBACK: Agent is using mock data (MCP server likely unavailable)');
      console.log('   This is expected for cold starts on free hosting tiers');
    }

  } catch (error) {
    console.error('❌ Agent data test failed:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testAgentData();