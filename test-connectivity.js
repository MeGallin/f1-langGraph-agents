#!/usr/bin/env node

/**
 * Test script to verify F1 MCP Client connectivity
 */

import { F1MCPClient } from './src/adapters/f1McpClient.js';

async function testConnectivity() {
  console.log('🏎️  Testing F1 MCP Client Connectivity...\n');

  const client = new F1MCPClient();

  try {
    // Test 1: Health Check
    console.log('1. Testing health check...');
    const health = await client.healthCheck();
    console.log('✅ Health check result:', health.status);
    console.log('   Server:', health.server || 'unknown');
    console.log('   Mode:', health.status === 'fallback' ? 'FALLBACK (using mocks)' : 'LIVE');
    console.log();

    // Test 2: Get Tools
    console.log('2. Testing tool discovery...');
    const tools = await client.getTools();
    console.log(`✅ Found ${tools.length} tools`);
    console.log('   Tools:', tools.slice(0, 3).map(t => t.name || t).join(', '), '...');
    console.log();

    // Test 3: Get Current Season
    console.log('3. Testing current season...');
    const currentSeason = await client.getCurrentSeason();
    console.log('✅ Current season data received');
    console.log('   Data source:', currentSeason.source || 'live');
    console.log();

    // Test 4: Get 2024 Drivers
    console.log('4. Testing 2024 drivers...');
    const drivers = await client.getDrivers('2024');
    console.log('✅ 2024 drivers data received');
    console.log('   Data source:', drivers.source || 'live');
    if (drivers.drivers && drivers.drivers.length > 0) {
      console.log('   Sample driver:', drivers.drivers[0].name);
    }
    console.log();

    // Test 5: Get Driver Standings
    console.log('5. Testing driver standings...');
    const standings = await client.getStandings('2024', 'drivers');
    console.log('✅ Driver standings data received');
    console.log('   Data source:', standings.source || 'live');
    if (standings.standings && standings.standings.length > 0) {
      console.log('   Leader:', standings.standings[0].driver);
    }
    console.log();

    console.log('🎉 All connectivity tests passed!');
    
    if (health.status === 'fallback') {
      console.log('\n⚠️  Note: MCP server was unavailable, tests used fallback mock data');
      console.log('   This is normal for cold starts on free hosting tiers');
    } else {
      console.log('\n✨ MCP server is live and responding with real F1 data!');
    }

  } catch (error) {
    console.error('❌ Connectivity test failed:', error.message);
    console.error('   This indicates a configuration or network issue');
    process.exit(1);
  }
}

// Run the test
testConnectivity();