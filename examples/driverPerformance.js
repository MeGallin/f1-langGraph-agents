/**
 * Driver Performance Agent Example
 *
 * Simple example demonstrating how to use the Driver Performance Agent
 * for analyzing F1 driver careers and performance.
 */

import { DriverPerformanceAgent } from '../src/agents/driverPerformanceAgent.js';
import { F1LangGraphAdapter } from '../src/adapters/langGraphAdapter.js';
import { F1McpClient } from '../src/adapters/f1McpClient.js';

async function driverPerformanceExample() {
  console.log('🏎️ F1 Driver Performance Agent Example\n');

  try {
    // Initialize the components
    console.log('🔧 Initializing components...');
    const mcpClient = new F1McpClient();
    await mcpClient.connect();

    const adapter = new F1LangGraphAdapter(mcpClient);
    await adapter.initialize();

    const agent = new DriverPerformanceAgent(adapter);
    console.log('✅ Driver Performance Agent ready!\n');

    // Example 1: Single driver career analysis
    console.log('📊 Example 1: Lewis Hamilton Career Analysis');
    console.log('='.repeat(50));

    const hamiltonAnalysis = await agent.analyzeDriver(
      "Analyze Lewis Hamilton's career performance, his championship wins, and peak performance periods",
    );

    console.log('Summary:', hamiltonAnalysis.synthesis?.summary);
    console.log('Key Findings:');
    hamiltonAnalysis.synthesis?.keyFindings
      ?.slice(0, 5)
      .forEach((finding, i) => {
        console.log(`  ${i + 1}. ${finding}`);
      });
    console.log(
      'Confidence Score:',
      hamiltonAnalysis.synthesis?.metadata?.confidence,
    );
    console.log();

    // Example 2: Driver comparison
    console.log('📊 Example 2: Hamilton vs Verstappen Comparison');
    console.log('='.repeat(50));

    const comparisonAnalysis = await agent.analyzeDriver(
      'Compare Lewis Hamilton and Max Verstappen: their racing styles, career achievements, and adaptability to different car regulations',
    );

    console.log('Summary:', comparisonAnalysis.synthesis?.summary);
    console.log(
      'Drivers Analyzed:',
      comparisonAnalysis.synthesis?.metadata?.driversAnalyzed,
    );
    console.log('Key Comparisons:');
    comparisonAnalysis.synthesis?.keyFindings
      ?.slice(0, 3)
      .forEach((finding, i) => {
        console.log(`  ${i + 1}. ${finding}`);
      });
    console.log();

    // Example 3: Peak performance analysis
    console.log('📊 Example 3: Sebastian Vettel Peak Performance');
    console.log('='.repeat(50));

    const vettelPeak = await agent.analyzeDriver(
      'When was Sebastian Vettel at his peak? Analyze his dominant Red Bull years and what made him so successful during 2010-2013',
    );

    console.log('Summary:', vettelPeak.synthesis?.summary);
    console.log('Peak Analysis Insights:');
    vettelPeak.synthesis?.keyFindings?.slice(0, 4).forEach((finding, i) => {
      console.log(`  ${i + 1}. ${finding}`);
    });
    console.log();

    // Example 4: Team adaptation analysis
    console.log('📊 Example 4: Fernando Alonso Team Adaptability');
    console.log('='.repeat(50));

    const alonsoAdaptation = await agent.analyzeDriver(
      "Analyze Fernando Alonso's ability to adapt to different teams throughout his career. How did he perform with McLaren, Ferrari, and other teams?",
    );

    console.log('Summary:', alonsoAdaptation.synthesis?.summary);
    console.log('Adaptation Analysis:');
    alonsoAdaptation.synthesis?.keyFindings
      ?.slice(0, 4)
      .forEach((finding, i) => {
        console.log(`  ${i + 1}. ${finding}`);
      });
    console.log();

    console.log('🎉 All driver performance examples completed successfully!');

    // Cleanup
    await mcpClient.disconnect();
  } catch (error) {
    console.error('❌ Error in driver performance example:', error);
    throw error;
  }
}

// Run example if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  driverPerformanceExample()
    .then(() => {
      console.log('\n✅ Driver Performance Agent examples completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Examples failed:', error);
      process.exit(1);
    });
}

export { driverPerformanceExample };
