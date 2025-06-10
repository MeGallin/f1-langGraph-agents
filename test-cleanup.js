#!/usr/bin/env node

// Test script to verify Anthropic cleanup
console.log('🧪 Testing Anthropic cleanup...');

async function testImports() {
  try {
    // Test OpenAI import (should work)
    const { ChatOpenAI } = await import('@langchain/openai');
    console.log('✅ OpenAI import successful');
    
    // Test Anthropic import (should fail)
    try {
      const { ChatAnthropic } = await import('@langchain/anthropic');
      console.log('❌ ERROR: Anthropic import should have failed but succeeded');
      process.exit(1);
    } catch (e) {
      console.log('✅ Anthropic import correctly failed:', e.message.substring(0, 50) + '...');
    }
    
    console.log('✅ SUCCESS: System is clean of Anthropic dependencies');
    console.log('🎉 All tests passed!');
    
  } catch (error) {
    console.log('❌ ERROR:', error.message);
    process.exit(1);
  }
}

testImports();
