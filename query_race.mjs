import F1MCPClient from './src/adapters/f1McpClient.js';

async function getLastRace() {
  try {
    const client = new F1MCPClient('https://f1-mcp-server-5dh3.onrender.com');
    
    console.log('🏁 Fetching current F1 race information...');
    
    // Try to get current race
    try {
      const currentRace = await client.invoke('get_current_f1_race', {});
      console.log('\n📅 Current Race:', JSON.stringify(currentRace, null, 2));
    } catch (err) {
      console.log('Current race not found, trying to get recent races...');
    }
    
    // Get races for 2024 season
    try {
      const races2024 = await client.invoke('get_f1_races', { season: '2024' });
      console.log('\n🏎️ 2024 F1 Races:', JSON.stringify(races2024, null, 2));
    } catch (err) {
      console.log('2024 races error:', err.message);
    }
    
    // Try to get next race
    try {
      const nextRace = await client.invoke('get_next_f1_race', {});
      console.log('\n➡️ Next Race:', JSON.stringify(nextRace, null, 2));
    } catch (err) {
      console.log('Next race error:', err.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

getLastRace();