#!/usr/bin/env node

/**
 * Prowlarr Indexer Test Script
 * Tests configured indexers on a Prowlarr instance
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });
dotenv.config({ path: 'backend/.env' });

const PROWLARR_URL = process.env.PROWLARR_URL || 'http://localhost:9696';
const PROWLARR_API_KEY = process.env.PROWLARR_API_KEY;

const client = axios.create({
  baseURL: PROWLARR_URL,
  timeout: 30000,
  headers: {
    'X-Api-Key': PROWLARR_API_KEY || '',
    'User-Agent': 'MediaLinkExtractor/1.0',
  },
});

async function checkProwlarrStatus() {
  console.log('\n📡 Checking Prowlarr Status...');
  console.log(`   URL: ${PROWLARR_URL}`);
  console.log(`   API Key: ${PROWLARR_API_KEY ? '✅ Configured' : '❌ Not configured'}`);

  try {
    const response = await client.get('/api/v1/health');
    console.log('   Status: ✅ Prowlarr is running');
    return true;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('   ❌ Prowlarr is NOT running. Please start it first:');
      console.error('      - Windows: Open Prowlarr from Start menu (port 9696)');
      console.error('      - Docker: docker run -d -p 9696:9696 linuxserver/prowlarr:latest');
      return false;
    } else if (error.response?.status === 401 || error.response?.status === 403) {
      console.error('   ❌ API Key is invalid or missing');
      return false;
    } else {
      console.error(`   ❌ Error: ${error.message}`);
      return false;
    }
  }
}

async function listIndexers() {
  console.log('\n🔍 Configured Indexers:');
  try {
    const response = await client.get('/api/v1/indexer');
    const indexers = Array.isArray(response.data) ? response.data : [];

    if (indexers.length === 0) {
      console.log('   ❌ No indexers configured!');
      console.log('   Please add indexers in Prowlarr UI: http://localhost:9696');
      console.log('   Steps:');
      console.log('     1. Go to Indexers tab');
      console.log('     2. Click "Add Indexer"');
      console.log('     3. Search for and add public indexers (1337x, YTS, EZTV, etc)');
      return [];
    }

    console.log(`   Total: ${indexers.length} indexers`);
    indexers.forEach((indexer, idx) => {
      const status = indexer.enable ? '✅' : '⚠️ ';
      const privacy = indexer.privacy === 'Private' ? '[PRIVATE]' : '[PUBLIC]';
      console.log(`   ${idx + 1}. ${status} ${indexer.name} ${privacy}`);
    });

    return indexers.filter(i => i.enable);
  } catch (error) {
    console.error(`   ❌ Error listing indexers: ${error.message}`);
    return [];
  }
}

async function testIndexerSearch(query = 'Inception', limit = 5) {
  console.log(`\n🔎 Testing Indexer Search: "${query}"`);
  console.log(`   Timeout: 60 seconds`);

  try {
    const start = Date.now();
    const response = await client.get('/api/v1/search', {
      params: {
        query: query,
        type: 'search',
      },
      timeout: 60000,
    });

    const duration = ((Date.now() - start) / 1000).toFixed(2);
    const results = Array.isArray(response.data) ? response.data : [];

    console.log(`   ✅ Search completed in ${duration}s`);
    console.log(`   Found: ${results.length} results`);

    if (results.length > 0) {
      console.log(`\n   Top ${Math.min(limit, results.length)} Results:`);
      results.slice(0, limit).forEach((result, idx) => {
        const size = formatBytes(result.size);
        const seeders = result.seeders || 0;
        const peers = result.peers || result.leechers || 0;
        const indexer = result.indexer || 'Unknown';
        
        console.log(`   ${idx + 1}. ${result.title}`);
        console.log(`      Indexer: ${indexer}`);
        console.log(`      Size: ${size} | Seeders: ${seeders} | Leechers: ${peers}`);
        if (result.publishDate) {
          const date = new Date(result.publishDate).toLocaleDateString();
          console.log(`      Date: ${date}`);
        }
      });
    } else {
      console.log('   ⚠️  No results found. Check if indexers are properly configured.');
    }

    return results;
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.error(`   ❌ Search timed out after 60 seconds`);
      console.error(`   This usually means indexers are slow or misconfigured.`);
    } else if (error.response?.status === 401 || error.response?.status === 403) {
      console.error('   ❌ Authentication failed - check your API key');
    } else {
      console.error(`   ❌ Search error: ${error.message}`);
    }
    return [];
  }
}

async function testIndexersIndividually() {
  console.log('\n⚡ Testing Individual Indexers:');
  try {
    const response = await client.get('/api/v1/indexer');
    const indexers = Array.isArray(response.data) ? response.data : [];
    const enabledIndexers = indexers.filter(i => i.enable);

    if (enabledIndexers.length === 0) {
      console.log('   ❌ No enabled indexers to test');
      return;
    }

    for (const indexer of enabledIndexers.slice(0, 3)) {
      console.log(`\n   Testing: ${indexer.name}`);
      try {
        const response = await client.get('/api/v1/search', {
          params: {
            query: 'test',
            indexerId: indexer.id,
          },
          timeout: 20000,
        });
        const count = Array.isArray(response.data) ? response.data.length : 0;
        console.log(`      ✅ Responded (${count} results)`);
      } catch (error) {
        console.log(`      ❌ Failed: ${error.message}`);
      }
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
  }
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   Prowlarr Indexer Test Suite          ║');
  console.log('╚════════════════════════════════════════╝');

  // Step 1: Check Prowlarr status
  const isRunning = await checkProwlarrStatus();
  if (!isRunning) {
    console.log('\n❌ Cannot proceed - Prowlarr is not accessible');
    process.exit(1);
  }

  if (!PROWLARR_API_KEY) {
    console.log('\n⚠️  WARNING: PROWLARR_API_KEY is not set in .env');
    console.log('   Set it in your .env file to test with authentication');
  }

  // Step 2: List indexers
  const indexers = await listIndexers();

  // Step 3: Test search
  if (indexers.length > 0) {
    const results = await testIndexerSearch('Inception', 5);

    // Step 4: Test individual indexers (only first 3 to save time)
    if (results.length === 0) {
      console.log('\n💡 Tip: Try testing individual indexers to diagnose issues...');
      await testIndexersIndividually();
    }
  }

  // Summary
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   Test Summary                         ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('✅ Prowlarr Status: Running');
  console.log(`📊 Configured Indexers: ${indexers.length}`);
  
  if (indexers.length === 0) {
    console.log('\n📝 Next Steps:');
    console.log('1. Open Prowlarr UI: http://localhost:9696');
    console.log('2. Go to Settings → Indexers');
    console.log('3. Click "Add Indexer" and add free public indexers:');
    console.log('   - 1337x');
    console.log('   - YTS');
    console.log('   - EZTV');
    console.log('   - Torrentz2');
    console.log('4. Run this test again');
  }

  console.log('\n');
}

main().catch(console.error);
