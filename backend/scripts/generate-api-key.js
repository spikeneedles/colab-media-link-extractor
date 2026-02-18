#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateApiKey() {
  return `mls_${crypto.randomBytes(32).toString('hex')}`;
}

function main() {
  const args = process.argv.slice(2);
  const count = parseInt(args[0]) || 1;
  
  console.log('\n🔐 API Key Generator for Media Link Scanner\n');
  console.log('═'.repeat(60));
  
  const keys = [];
  for (let i = 0; i < count; i++) {
    const key = generateApiKey();
    keys.push(key);
    console.log(`\n🔑 Key ${i + 1}:`);
    console.log(`   ${key}`);
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log('\n📋 Setup Instructions:\n');
  console.log('1. Add the following to your .env file:\n');
  
  if (keys.length === 1) {
    console.log(`   API_KEYS=${keys[0]}`);
  } else {
    console.log(`   API_KEYS=${keys.join(',')}`);
  }
  
  console.log('\n2. Set AUTH_ENABLED=true in your .env file\n');
  console.log('3. Restart your backend server\n');
  console.log('4. Store these keys securely - they won\'t be shown again!\n');
  console.log('═'.repeat(60));
  
  console.log('\n💡 Usage Examples:\n');
  console.log('   Header:');
  console.log(`   curl -H "X-API-Key: ${keys[0]}" http://localhost:3001/api/media/stream?url=...\n`);
  console.log('   Query Parameter:');
  console.log(`   curl "http://localhost:3001/api/media/stream?url=...&apiKey=${keys[0]}"\n`);
  console.log('═'.repeat(60));
  
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    console.log('\n⚠️  Found .env file. Update it manually with the keys above.');
  } else {
    console.log('\n⚠️  No .env file found. Create one based on .env.example');
  }
  
  console.log('\n📖 For more info, see: AUTHENTICATION.md\n');
}

main();
