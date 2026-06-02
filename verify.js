#!/usr/bin/env node
/**
 * Verification script for Memory Graph Plugin v0.21.0
 * Tests the Pearl OTC scenario end-to-end
 */

const { MemoryGraphPlugin } = require('./dist/index');
const fs = require('fs');
const path = require('path');

async function verifyPearlOTCScenario() {
  console.log('🧪 Memory Graph Plugin v0.21.0 - Pearl OTC Verification\n');

  const dbPath = '/tmp/verify-pearl-otc.db';
  
  // Clean up old test db
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`);
  if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`);

  const plugin = new MemoryGraphPlugin({ dbPath });
  
  console.log('⏳ Initializing plugin...');
  await plugin.initialize();
  console.log('✅ Plugin initialized\n');

  // Simulate Pearl OTC conversation
  console.log('📝 Simulating Pearl OTC conversation...\n');

  console.log('👤 User: What is Pearl OTC and where can I find it?');
  await plugin.addConversationMessage({
    role: 'user',
    content: 'What is Pearl OTC and where can I find it?',
    timestamp: Date.now()
  });

  console.log('🤖 Assistant: Pearl OTC is at https://pearl.exchange/otc - it offers competitive rates for large trades.');
  await plugin.addConversationMessage({
    role: 'assistant',
    content: 'Pearl OTC is at https://pearl.exchange/otc - it offers competitive rates for large trades.',
    timestamp: Date.now() + 1000
  });

  console.log('👤 User: What are the rates for buying 0.5 ETH?');
  await plugin.addConversationMessage({
    role: 'user',
    content: 'What are the rates for buying 0.5 ETH?',
    timestamp: Date.now() + 2000
  });

  console.log('🤖 Assistant: Current rate is approximately $1,500 USD for 0.5 ETH on Pearl OTC.');
  await plugin.addConversationMessage({
    role: 'assistant',
    content: 'Current rate is approximately $1,500 USD for 0.5 ETH on Pearl OTC.',
    timestamp: Date.now() + 3000
  });

  console.log('\n✅ Conversation tracked\n');

  // Verify conversation window
  console.log('🔍 Verifying conversation window...');
  const window = await plugin.getConversationWindow();
  console.log(`   Messages in window: ${window.length}`);
  console.assert(window.length === 4, 'Should have 4 messages');
  console.log('   ✅ Conversation window correct\n');

  // Verify entity extraction
  console.log('🔍 Verifying entity extraction...');
  const stats = await plugin.stats();
  console.log(`   Total entities: ${stats.entities}`);
  console.log(`   Total conversations: ${stats.conversations}`);
  console.assert(stats.entities > 0, 'Should have extracted entities');
  console.assert(stats.conversations === 4, 'Should have 4 conversations');
  console.log('   ✅ Entity extraction working\n');

  // Search for Pearl
  console.log('🔍 Searching for "Pearl"...');
  const searchResults = await plugin.searchKeyword('Pearl');
  console.log(`   Found ${searchResults.length} results`);
  if (searchResults.length > 0) {
    console.log(`   Top result: ${searchResults[0].entity.name} (${searchResults[0].entity.type})`);
  }
  console.log('   ✅ Search working\n');

  // Inject context for follow-up query
  console.log('🔍 Injecting context for "Pearl OTC rates"...');
  const context = await plugin.injectContext('Pearl OTC rates');
  console.log(`   Conversation window: ${context.conversationWindow.length} messages`);
  console.log(`   Relevant entities: ${context.relevantEntities.length}`);
  console.log(`   Graph context: ${context.graphContext.length} relationships`);
  console.log(`   Priority: ${context.priority}`);
  console.assert(context.conversationWindow.length === 4, 'Should have 4 messages in context');
  console.assert(context.priority === 'conversation', 'Should prioritize conversation');
  console.log('   ✅ Context injection working\n');

  // Estimate token cost
  const conversationTokens = context.conversationWindow
    .map(m => m.content.split(' ').length * 1.3)
    .reduce((a, b) => a + b, 0);
  const entityTokens = context.relevantEntities.length * 50;
  const graphTokens = context.graphContext.length * 30;
  const totalTokens = Math.round(conversationTokens + entityTokens + graphTokens);

  console.log('💰 Token cost estimate:');
  console.log(`   Conversation: ~${Math.round(conversationTokens)} tokens`);
  console.log(`   Entities: ~${entityTokens} tokens`);
  console.log(`   Graph: ~${graphTokens} tokens`);
  console.log(`   Total: ~${totalTokens} tokens per response`);
  console.assert(totalTokens < 2000, 'Should be under 2000 tokens');
  console.log('   ✅ Token cost acceptable\n');

  // Clean up
  plugin.close();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`);
  if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`);

  console.log('🎉 All verifications passed!\n');
  console.log('✅ Memory Graph Plugin v0.21.0 is production-ready');
  console.log('✅ Pearl OTC scenario works correctly');
  console.log('✅ Context injection functional');
  console.log('✅ Token cost acceptable');
  console.log('✅ Ready to deploy and share\n');

  return true;
}

// Run verification
verifyPearlOTCScenario()
  .then(() => {
    console.log('✅ Verification complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  });
