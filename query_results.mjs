import F1MCPClient from './src/adapters/f1McpClient.js';

async function getCanadianGPResults() {
  try {
    const client = new F1MCPClient('https://f1-mcp-server-5dh3.onrender.com');
    
    console.log('🏁 Fetching Canadian GP 2025 race results...');
    
    // Try to get race results for 2025 Canadian GP
    try {
      const results = await client.invoke('get_f1_race_results', { 
        season: '2025', 
        round: '10' 
      });
      console.log('\n🏆 Canadian GP 2025 Results:', JSON.stringify(results, null, 2));
    } catch (err) {
      console.log('Canadian GP results error:', err.message);
      
      // Try general race results for 2025
      try {
        const allResults = await client.invoke('get_f1_race_results', { 
          season: '2025'
        });
        console.log('\n🏎️ 2025 Race Results:', JSON.stringify(allResults, null, 2));
      } catch (err2) {
        console.log('2025 results error:', err2.message);
      }
    }
    
    // Try qualifying results
    try {
      const qualResults = await client.invoke('get_f1_qualifying_results', { 
        season: '2025', 
        round: '10' 
      });
      console.log('\n🏁 Canadian GP 2025 Qualifying Results:', JSON.stringify(qualResults, null, 2));
    } catch (err) {
      console.log('Qualifying results error:', err.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

getCanadianGPResults();