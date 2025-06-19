import F1MCPClient from './src/adapters/f1McpClient.js';

async function getCanadianGPResults() {
  try {
    const client = new F1MCPClient('https://f1-mcp-server-5dh3.onrender.com');
    
    console.log('🏁 Fetching Canadian GP 2025 race results with different parameters...');
    
    // Try with different parameter formats
    const attempts = [
      { season: 2025, round: 10 },  // numeric values
      { year: '2025', round: '10' }, // alternative parameter names
      { season: '2025' }, // just season to see what races have results
    ];
    
    for (let i = 0; i < attempts.length; i++) {
      console.log(`\n🔄 Attempt ${i + 1}: ${JSON.stringify(attempts[i])}`);
      
      try {
        const results = await client.invoke('get_f1_race_results', attempts[i]);
        console.log('\n✅ Race Results Found:', JSON.stringify(results, null, 2));
        break;
      } catch (err) {
        console.log(`❌ Attempt ${i + 1} failed:`, err.message);
      }
    }
    
    // Try to get race details for the Canadian GP to confirm it exists
    try {
      const raceDetails = await client.invoke('get_f1_race_details', { 
        season: '2025', 
        round: '10' 
      });
      console.log('\n📋 Canadian GP 2025 Race Details:', JSON.stringify(raceDetails, null, 2));
    } catch (err) {
      console.log('Race details error:', err.message);
    }
    
    // Check current season to see what data is available
    try {
      const currentSeason = await client.invoke('get_current_f1_season', {});
      console.log('\n📅 Current Season Info:', JSON.stringify(currentSeason, null, 2));
    } catch (err) {
      console.log('Current season error:', err.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

getCanadianGPResults();